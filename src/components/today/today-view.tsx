"use client";

import { useEffect, useState } from "react";
import { TaskDetailSheet } from "@/components/tasks/task-detail";
import { useTaskStore } from "@/components/tasks/use-task-store";
import { useWorkday } from "@/components/workday/workday-provider";
import { byPriority } from "@/lib/tasks";
import { formatDuration, formatLongDate, greeting } from "@/lib/time";
import type { Subtask, Task } from "@/lib/types";
import { ClockButton, ClockOutDialog } from "./clock";
import { SessionDialog, type SessionDialogState } from "./session-dialog";
import { SessionLog } from "./session-log";
import { TimerCard } from "./timer-card";
import { TodoColumn } from "./todo-column";

export function TodayView({
  tasks,
  subtasks,
  name,
  focusTaskId,
}: {
  tasks: Task[];
  subtasks: Subtask[];
  name: string | null;
  focusTaskId?: string;
}) {
  const store = useTaskStore(tasks, subtasks);
  const { entries, today, currentTask, setCurrentTask, focusOn } = useWorkday();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [session, setSession] = useState<SessionDialogState>(null);
  const [clockOutOpen, setClockOutOpen] = useState(false);

  // With nothing on the timer yet, suggest the top open task for today.
  useEffect(() => {
    if (currentTask) return;
    const top = store.tasks.filter((t) => t.status === "todo").sort(byPriority)[0];
    if (top) setCurrentTask({ id: top.id, title: top.title, project_id: top.project_id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Focus on next task" from a project lands here with ?focus=<task id>.
  useEffect(() => {
    if (!focusTaskId) return;
    const t = store.tasks.find((x) => x.id === focusTaskId);
    if (t) focusOn({ id: t.id, title: t.title, project_id: t.project_id });
    window.history.replaceState(null, "", "/today");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTaskId]);

  // Keep the timer's task title in step with edits.
  useEffect(() => {
    if (!currentTask) return;
    const t = store.tasks.find((x) => x.id === currentTask.id);
    if (t && (t.title !== currentTask.title || t.project_id !== currentTask.project_id)) {
      setCurrentTask({ id: t.id, title: t.title, project_id: t.project_id });
    }
  }, [store.tasks, currentTask, setCurrentTask]);

  const focused = entries.reduce((sum, e) => sum + e.duration_minutes, 0);
  const selected = store.tasks.find((t) => t.id === selectedId) ?? null;
  const openToday = store.tasks.filter((t) => t.status === "todo" && (t.scheduled_for ?? today) <= today);

  return (
    <main className="flex min-w-0 animate-screen-in flex-col gap-6 px-9 pt-7 pb-16">
      <header className="flex items-center justify-between gap-6">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-neutral-700">
            {greeting()}
            {name ? `, ${name}` : ""}
            {entries.length > 0 &&
              ` · ${formatDuration(focused)} focused across ${entries.length} session${entries.length === 1 ? "" : "s"}`}
          </span>
          <h1 className="m-0 text-[22px] font-semibold whitespace-nowrap">{formatLongDate()}</h1>
        </div>
        <ClockButton onClockOut={() => setClockOutOpen(true)} />
      </header>

      <div className="grid grid-cols-1 items-start gap-4 min-[860px]:grid-cols-2 min-[1200px]:grid-cols-[minmax(0,0.95fr)_minmax(0,1.2fr)_minmax(0,0.9fr)]">
        <TimerCard onLogTime={() => setSession({ kind: "new" })} />
        <TodoColumn store={store} selectedId={selectedId} onSelect={setSelectedId} />
        <SessionLog
          onEdit={(entry) => setSession({ kind: "edit", entry })}
          onLogGap={(from, to) => setSession({ kind: "new", from, to })}
        />
      </div>

      <TaskDetailSheet task={selected} store={store} onClose={() => setSelectedId(null)} />
      <SessionDialog state={session} onClose={() => setSession(null)} />
      <ClockOutDialog
        open={clockOutOpen}
        onClose={() => setClockOutOpen(false)}
        openTaskIds={openToday.map((t) => t.id)}
        onMoveTasks={store.moveTasks}
        onLogGap={(from, to) => {
          setClockOutOpen(false);
          setSession({ kind: "new", from, to });
        }}
      />
    </main>
  );
}
