"use client";

import { useEffect, useMemo, useState } from "react";
import { ListChecks, Plus, Timer } from "@phosphor-icons/react";
import { RoundCheck } from "@/components/ui/checkbox";
import { Tag } from "@/components/ui/tag";
import { useWorkday } from "@/components/workday/workday-provider";
import { byPriority, estimateLabel, PRIORITY_LABEL, priorityDotClass } from "@/lib/tasks";
import { weekdayShort } from "@/lib/time";
import type { Project, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { TaskStore } from "@/components/tasks/use-task-store";

const LAST_PROJECT_KEY = "fd:lastProject";

/** Today's list: quick-add, "From earlier", and one card per project. */
export function TodoColumn({
  store,
  selectedId,
  onSelect,
}: {
  store: TaskStore;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { today, projects, currentTask } = useWorkday();
  const active = projects.filter((p) => p.status !== "done");
  const [draft, setDraft] = useState("");
  const [projectId, setProjectId] = useState(active[0]?.id ?? "");
  const [showDone, setShowDone] = useState<Record<string, boolean>>({});

  // Remember the last project used for quick-add (a per-browser convenience).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_PROJECT_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read after hydration to avoid a mismatch
      if (saved && active.some((p) => p.id === saved)) setProjectId(saved);
    } catch {
      // Storage unavailable; keep the default.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { overdue, groups, doneCount, totalCount } = useMemo(() => {
    const open = store.tasks.filter((t) => t.status === "todo");
    const overdue = open.filter((t) => t.scheduled_for && t.scheduled_for < today).sort(byPriority);
    const todays = store.tasks.filter((t) => !(t.status === "todo" && t.scheduled_for && t.scheduled_for < today));
    const groups = projects
      .map((p) => {
        const all = todays.filter((t) => t.project_id === p.id);
        return {
          project: p,
          open: all.filter((t) => t.status === "todo").sort(byPriority),
          done: all.filter((t) => t.status === "done"),
        };
      })
      .filter((g) => g.open.length || g.done.length);
    return {
      overdue,
      groups,
      doneCount: todays.filter((t) => t.status === "done").length,
      totalCount: todays.length,
    };
  }, [store.tasks, projects, today]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title || !projectId) return;
    setDraft("");
    try {
      localStorage.setItem(LAST_PROJECT_KEY, projectId);
    } catch {
      // Ignore storage errors.
    }
    const created = await store.addTask({ title, project_id: projectId, scheduled_for: today });
    if (!created) setDraft(title);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="m-0 text-[15px] font-semibold">Today&apos;s list</h2>
        <span className="text-sm text-neutral-700">
          {doneCount} of {totalCount} done
        </span>
      </div>

      <form onSubmit={add} className="flex gap-2.5">
        <div className="relative flex-1">
          <Plus weight="bold" className="absolute top-1/2 left-4 size-3.5 -translate-y-1/2 text-neutral-600" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a task for today…"
            aria-label="Add a task for today"
            className="h-[46px] w-full rounded-[14px] border border-transparent bg-card pr-3 pl-[42px] text-sm text-foreground shadow-hairline outline-none placeholder:text-neutral-600 focus-visible:border-accent"
          />
        </div>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          aria-label="Project for the new task"
          className="h-[46px] w-[200px] cursor-pointer rounded-[14px] border border-transparent bg-card px-3 text-sm text-foreground shadow-hairline outline-none focus-visible:border-accent"
        >
          {active.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </form>

      {overdue.length > 0 && (
        <div className="flex items-center gap-3.5 rounded-2xl bg-warning-100 px-[18px] py-3">
          <span className="text-[15px] whitespace-nowrap text-warning-800">From earlier</span>
          <div className="flex min-w-0 flex-1 flex-wrap gap-2.5">
            {overdue.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelect(t.id)}
                className="flex cursor-pointer items-center gap-2 rounded-full border-0 bg-background px-3 py-1 text-sm text-foreground hover:bg-card"
              >
                {t.title}
                <span className="text-[13px] text-warning-700">{weekdayShort(t.scheduled_for!)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {groups.length === 0 && (
        <div className="rounded-[14px] bg-card px-6 py-10 text-center text-[13px] text-neutral-700 shadow-hairline">
          Nothing on today&apos;s list yet. Add a task above.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {groups.map(({ project, open, done }) => {
          const show = showDone[project.id];
          return (
            <ProjectGroup
              key={project.id}
              project={project}
              meta={open.length ? `${open.length} open` : "all done"}
              tasks={show ? [...open, ...done] : open}
              store={store}
              selectedId={selectedId}
              currentId={currentTask?.id}
              onSelect={onSelect}
              doneToggle={
                done.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowDone((s) => ({ ...s, [project.id]: !s[project.id] }))}
                    className="mx-1.5 mt-0.5 cursor-pointer self-start border-0 bg-transparent px-0 py-0.5 text-sm text-neutral-600 hover:text-accent-700"
                  >
                    {show ? "hide completed" : `+ ${done.length} done`}
                  </button>
                )
              }
            />
          );
        })}
      </div>
    </section>
  );
}

function ProjectGroup({
  project,
  meta,
  tasks,
  store,
  selectedId,
  currentId,
  onSelect,
  doneToggle,
}: {
  project: Project;
  meta: string;
  tasks: Task[];
  store: TaskStore;
  selectedId: string | null;
  currentId?: string;
  onSelect: (id: string) => void;
  doneToggle: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[14px] bg-card px-4 pt-4 pb-3 shadow-hairline">
      <div className="flex items-center gap-2.5 px-1.5 pb-1">
        <span className="size-[9px] rounded-[3px]" style={{ background: project.color }} />
        <span className="min-w-0 flex-1 text-sm font-semibold">{project.name}</span>
        <span className="text-[13px] text-neutral-600">{meta}</span>
      </div>
      {tasks.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          subs={store.subsByTask.get(t.id) ?? []}
          selected={t.id === selectedId}
          current={t.id === currentId && t.status !== "done"}
          onToggle={() => store.toggleDone(t.id)}
          onSelect={() => onSelect(t.id)}
        />
      ))}
      {doneToggle}
    </div>
  );
}

export function TaskRow({
  task,
  subs,
  selected,
  current,
  onToggle,
  onSelect,
}: {
  task: Task;
  subs: { is_done: boolean }[];
  selected?: boolean;
  current?: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const done = task.status === "done";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "grid cursor-pointer grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-3 rounded-[10px] p-1.5 outline-none hover:bg-neutral-200 focus-visible:bg-neutral-200",
        selected && "bg-accent-100",
      )}
    >
      <RoundCheck checked={done} onToggle={onToggle} label={done ? `Reopen ${task.title}` : `Complete ${task.title}`} />
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn("size-1.5 shrink-0 rounded-full", priorityDotClass(task.priority))}
          title={PRIORITY_LABEL[task.priority]}
        />
        <span
          className={cn(
            "truncate text-sm leading-snug",
            done && "text-neutral-600 line-through",
          )}
        >
          {task.title}
        </span>
        {subs.length > 0 && (
          <span className="flex items-center gap-[3px] text-[13px] whitespace-nowrap text-neutral-600">
            <ListChecks weight="duotone" className="size-3.5" />
            {subs.filter((s) => s.is_done).length}/{subs.length}
          </span>
        )}
        {current && <Timer weight="duotone" className="size-3.5 shrink-0 text-accent" aria-label="On the timer" />}
      </div>
      <div className="flex items-center gap-2">
        {task.is_major && !done && (
          <Tag tone="outline" className="px-2 py-0 text-xs">
            major
          </Tag>
        )}
        <span className="text-sm whitespace-nowrap text-neutral-700">{estimateLabel(task.estimate_minutes)}</span>
      </div>
    </div>
  );
}
