"use client";

import { useCallback, useMemo, useState } from "react";
import { useLatest } from "@/lib/use-latest";
import { createClient } from "@/lib/supabase/client";
import { say, sayError, sayUndo } from "@/lib/toast";
import type { Subtask, Task } from "@/lib/types";

export type NewTask = Pick<Task, "project_id" | "title"> & Partial<Pick<Task, "scheduled_for" | "priority" | "estimate_minutes">>;

/** Client-side task + subtask state with optimistic writes to Supabase. */
export function useTaskStore(initialTasks: Task[], initialSubtasks: Subtask[]) {
  const supabase = createClient();
  const [tasks, setTasks] = useState(initialTasks);
  const [subtasks, setSubtasks] = useState(initialSubtasks);
  const tasksRef = useLatest(tasks);
  const subsRef = useLatest(subtasks);

  const subsByTask = useMemo(() => {
    const map = new Map<string, Subtask[]>();
    for (const s of [...subtasks].sort((a, b) => a.sort_order - b.sort_order)) {
      map.set(s.task_id, [...(map.get(s.task_id) ?? []), s]);
    }
    return map;
  }, [subtasks]);

  const addTask = useCallback(
    async (task: NewTask) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({ priority: "med", ...task })
        .select()
        .single<Task>();
      if (error) {
        sayError("Couldn't add the task", error);
        return null;
      }
      setTasks((list) => [...list, data]);
      return data;
    },
    [supabase],
  );

  const updateTask = useCallback(
    async (id: string, patch: Partial<Task>) => {
      const before = tasksRef.current.find((t) => t.id === id);
      if (!before) return false;
      setTasks((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) {
        setTasks((list) => list.map((t) => (t.id === id ? before : t)));
        sayError("Couldn't save the task", error);
        return false;
      }
      return true;
    },
    [supabase, tasksRef],
  );

  const toggleDone = useCallback(
    async (id: string) => {
      const t = tasksRef.current.find((x) => x.id === id);
      if (!t) return;
      const done = t.status !== "done";
      const ok = await updateTask(id, {
        status: done ? "done" : "todo",
        completed_at: done ? new Date().toISOString() : null,
      });
      if (ok && done) say(`Done: ${t.title}`);
    },
    [updateTask, tasksRef],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      const t = tasksRef.current.find((x) => x.id === id);
      if (!t) return;
      setTasks((list) => list.filter((x) => x.id !== id));
      const { error } = await supabase.from("tasks").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) {
        setTasks((list) => [...list, t]);
        return sayError("Couldn't delete the task", error);
      }
      sayUndo(`Deleted “${t.title}”`, async () => {
        const { error: undoError } = await supabase.from("tasks").update({ deleted_at: null }).eq("id", id);
        if (undoError) return sayError("Couldn't restore it", undoError);
        setTasks((list) => [...list, t]);
      });
    },
    [supabase, tasksRef],
  );

  /** Reschedule several open tasks at once (clock-out "move to tomorrow"). */
  const moveTasks = useCallback(
    async (ids: string[], date: string) => {
      if (!ids.length) return true;
      const before = tasksRef.current;
      setTasks((list) => list.map((t) => (ids.includes(t.id) ? { ...t, scheduled_for: date } : t)));
      const { error } = await supabase.from("tasks").update({ scheduled_for: date }).in("id", ids);
      if (error) {
        setTasks(before);
        sayError("Couldn't move the open tasks", error);
        return false;
      }
      return true;
    },
    [supabase, tasksRef],
  );

  const addSubtask = useCallback(
    async (taskId: string, title: string) => {
      const order = (subsRef.current.filter((s) => s.task_id === taskId).at(-1)?.sort_order ?? -1) + 1;
      const { data, error } = await supabase
        .from("subtasks")
        .insert({ task_id: taskId, title, sort_order: order })
        .select()
        .single<Subtask>();
      if (error) return sayError("Couldn't add the subtask", error);
      setSubtasks((list) => [...list, data]);
    },
    [supabase, subsRef],
  );

  const toggleSubtask = useCallback(
    async (id: string) => {
      const s = subsRef.current.find((x) => x.id === id);
      if (!s) return;
      setSubtasks((list) => list.map((x) => (x.id === id ? { ...x, is_done: !x.is_done } : x)));
      const { error } = await supabase.from("subtasks").update({ is_done: !s.is_done }).eq("id", id);
      if (error) {
        setSubtasks((list) => list.map((x) => (x.id === id ? s : x)));
        sayError("Couldn't save the subtask", error);
      }
    },
    [supabase, subsRef],
  );

  const deleteSubtask = useCallback(
    async (id: string) => {
      const s = subsRef.current.find((x) => x.id === id);
      if (!s) return;
      setSubtasks((list) => list.filter((x) => x.id !== id));
      const { error } = await supabase.from("subtasks").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) {
        setSubtasks((list) => [...list, s]);
        return sayError("Couldn't delete the subtask", error);
      }
      sayUndo(`Removed “${s.title}”`, async () => {
        const { error: undoError } = await supabase.from("subtasks").update({ deleted_at: null }).eq("id", id);
        if (undoError) return sayError("Couldn't restore it", undoError);
        setSubtasks((list) => [...list, s]);
      });
    },
    [supabase, subsRef],
  );

  return {
    tasks,
    subtasks,
    subsByTask,
    addTask,
    updateTask,
    toggleDone,
    deleteTask,
    moveTasks,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
  };
}

export type TaskStore = ReturnType<typeof useTaskStore>;
