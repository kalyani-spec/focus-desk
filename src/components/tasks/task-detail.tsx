"use client";

import { useState } from "react";
import { CheckCircle, ListChecks, Plus, Timer, Trash, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useWorkday } from "@/components/workday/workday-provider";
import { ESTIMATES, PRIORITY_LABEL, estimateLabel } from "@/lib/tasks";
import type { Priority, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { TaskStore } from "./use-task-store";

/** Right-hand task panel: complete, edit fields, notes, subtasks, "Focus on this task". */
export function TaskDetailSheet({
  task,
  store,
  onClose,
}: {
  task: Task | null;
  store: TaskStore;
  onClose: () => void;
}) {
  return (
    <Sheet open={Boolean(task)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>{task && <TaskDetail key={task.id} task={task} store={store} onClose={onClose} />}</SheetContent>
    </Sheet>
  );
}

function TaskDetail({ task, store, onClose }: { task: Task; store: TaskStore; onClose: () => void }) {
  const { projects, today, focusOn } = useWorkday();
  const subs = store.subsByTask.get(task.id) ?? [];
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [subDraft, setSubDraft] = useState("");
  const done = task.status === "done";
  const overdue = !done && task.due_date !== null && task.due_date < today;

  const saveTitle = () => {
    const t = title.trim();
    if (!t) return setTitle(task.title);
    if (t !== task.title) void store.updateTask(task.id, { title: t });
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <Button variant="secondary" className="rounded-xl" onClick={() => store.toggleDone(task.id)}>
          <CheckCircle weight={done ? "fill" : "duotone"} className={cn("size-3.5", done && "text-accent-700")} />
          {done ? "Completed" : "Mark complete"}
        </Button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Delete task"
            aria-label="Delete task"
            onClick={() => {
              onClose();
              void store.deleteTask(task.id);
            }}
            className="grid cursor-pointer rounded-xl p-2 text-neutral-700 hover:bg-neutral-200 hover:text-warning-700"
          >
            <Trash weight="duotone" className="size-4" />
          </button>
          <button
            type="button"
            title="Close"
            aria-label="Close"
            onClick={onClose}
            className="grid cursor-pointer rounded-xl p-2 text-neutral-700 hover:bg-neutral-200"
          >
            <X weight="duotone" className="size-4" />
          </button>
        </div>
      </div>

      <SheetTitle asChild>
        <textarea
          value={title}
          rows={1}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          aria-label="Task title"
          className="m-0 field-sizing-content w-full resize-none border-0 bg-transparent p-0 text-[22px] leading-tight font-semibold text-foreground outline-none"
        />
      </SheetTitle>

      <div className="grid grid-cols-[90px_1fr] items-center gap-y-2 text-sm">
        <span className="text-neutral-700">Project</span>
        <InlineSelect
          value={task.project_id}
          onChange={(v) => store.updateTask(task.id, { project_id: v })}
          options={projects.filter((p) => p.status !== "done" || p.id === task.project_id).map((p) => [p.id, p.name])}
        />
        <span className="text-neutral-700">Priority</span>
        <InlineSelect
          value={task.priority}
          onChange={(v) => store.updateTask(task.id, { priority: v as Priority })}
          options={(["high", "med", "low"] as const).map((p) => [p, PRIORITY_LABEL[p]])}
        />
        <span className="text-neutral-700">Due</span>
        <InlineDate
          value={task.due_date}
          onChange={(v) => store.updateTask(task.id, { due_date: v })}
          className={overdue ? "text-warning-700" : undefined}
          suffix={overdue ? "overdue" : undefined}
        />
        <span className="text-neutral-700">Do on</span>
        <InlineDate value={task.scheduled_for} onChange={(v) => store.updateTask(task.id, { scheduled_for: v })} />
        <span className="text-neutral-700">Estimate</span>
        <InlineSelect
          value={task.estimate_minutes ? String(task.estimate_minutes) : ""}
          onChange={(v) => store.updateTask(task.id, { estimate_minutes: v ? Number(v) : null })}
          options={[["", "None"], ...ESTIMATES.map((m) => [String(m), estimateLabel(m)] as [string, string])]}
        />
        <span className="text-neutral-700">Major</span>
        <span className="flex h-8 items-center">
          <Switch
            checked={task.is_major}
            onCheckedChange={(v) => store.updateTask(task.id, { is_major: v })}
            aria-label="Major task"
          />
        </span>
      </div>

      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => notes !== (task.notes ?? "") && store.updateTask(task.id, { notes: notes || null })}
        placeholder="Notes…"
        aria-label="Notes"
      />

      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline justify-between pb-1 text-[13px] text-neutral-700">
          <span className="flex items-center gap-1.5">
            <ListChecks weight="duotone" className="size-3.5" />
            Subtasks
          </span>
          <span>{subs.length ? `${subs.filter((s) => s.is_done).length} of ${subs.length} done` : "None yet"}</span>
        </div>
        {subs.map((s) => (
          <div key={s.id} className="group flex items-center gap-2.5 py-[3px]">
            <label
              className={cn(
                "flex flex-1 cursor-pointer items-center gap-2.5 text-sm",
                s.is_done && "text-neutral-600 line-through",
              )}
            >
              <Checkbox checked={s.is_done} onChange={() => store.toggleSubtask(s.id)} />
              {s.title}
            </label>
            <button
              type="button"
              title="Remove"
              aria-label={`Remove ${s.title}`}
              onClick={() => store.deleteSubtask(s.id)}
              className="grid cursor-pointer p-1 text-neutral-500 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-warning-700"
            >
              <X weight="duotone" className="size-[13px]" />
            </button>
          </div>
        ))}
        <form
          className="mt-1 flex items-center gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            const t = subDraft.trim();
            if (!t) return;
            void store.addSubtask(task.id, t);
            setSubDraft("");
          }}
        >
          <Plus weight="bold" className="size-[15px] text-accent" />
          <input
            value={subDraft}
            onChange={(e) => setSubDraft(e.target.value)}
            placeholder="Add a subtask…"
            aria-label="Add a subtask"
            className="flex-1 border-0 border-b-[1.5px] border-neutral-300 bg-transparent py-1.5 text-sm text-foreground outline-none placeholder:text-neutral-600 focus:border-accent"
          />
        </form>
      </div>

      {!done && (
        <Button
          variant="primary"
          size="lg"
          className="mt-auto h-11 rounded-xl"
          onClick={() => {
            focusOn({ id: task.id, title: task.title, project_id: task.project_id });
            onClose();
          }}
        >
          <Timer weight="duotone" className="size-4" />
          Focus on this task
        </Button>
      )}
    </>
  );
}

function InlineSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <NativeSelect
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 border-transparent bg-transparent px-1.5 hover:border-divider"
    >
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </NativeSelect>
  );
}

function InlineDate({
  value,
  onChange,
  className,
  suffix,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  className?: string;
  suffix?: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className={cn(
          "h-8 rounded-md border border-transparent bg-transparent px-1.5 text-sm text-foreground outline-none hover:border-divider focus-visible:border-accent",
          !value && "text-neutral-600",
          className,
        )}
      />
      {suffix && <span className="text-xs text-warning-700">{suffix}</span>}
    </span>
  );
}
