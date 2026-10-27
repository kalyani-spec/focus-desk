"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CaretDown,
  Check,
  CheckCircle,
  Circle,
  CircleDashed,
  CircleHalf,
  CircleNotch,
  PencilSimple,
  Plus,
  Timer,
  Warning,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Checkbox, RoundCheck } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tag } from "@/components/ui/tag";
import { TaskDetailSheet } from "@/components/tasks/task-detail";
import { useTaskStore } from "@/components/tasks/use-task-store";
import { useWorkday } from "@/components/workday/workday-provider";
import {
  currentPhaseIndex,
  DOC_STATUS_LABEL,
  projectRange,
  STATUS_LABEL,
  STATUS_TONE,
} from "@/lib/projects";
import { createClient } from "@/lib/supabase/client";
import { byPriority, estimateLabel, priorityDotClass } from "@/lib/tasks";
import { daysBetween, formatDuration, relativeDay, shortDate } from "@/lib/time";
import { sayError } from "@/lib/toast";
import type { ChecklistItem, Doc, Phase, Project, ProjectDate, ProjectStatus, Subtask, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChecklistTab, useChecklist } from "./checklist-tab";
import { EditPhasesDialog } from "./edit-phases-dialog";

type TabKey = "overview" | "tasks" | "checklist";

export function ProjectDetail(props: {
  project: Project;
  phases: Phase[];
  tasks: Task[];
  subtasks: Subtask[];
  checklist: ChecklistItem[];
  documents: Doc[];
  dates: ProjectDate[];
  minutes: number;
}) {
  const { today } = useWorkday();
  const router = useRouter();
  const [project, setProject] = useState(props.project);
  const [phases, setPhases] = useState(props.phases);
  const [documents, setDocuments] = useState(props.documents);
  const store = useTaskStore(props.tasks, props.subtasks);
  const checklist = useChecklist(props.checklist);
  const [tab, setTab] = useState<TabKey>("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phasesOpen, setPhasesOpen] = useState(false);

  const ongoing = project.is_ongoing || phases.length === 0;
  const curIdx = ongoing ? -1 : currentPhaseIndex(phases, today);
  const tasks = store.tasks.filter((t) => t.project_id === project.id);
  const openTasks = tasks.filter((t) => t.status === "todo").sort(byPriority);
  const ckDone = checklist.items.filter((c) => c.is_done).length;
  const selected = store.tasks.find((t) => t.id === selectedId) ?? null;

  const setStatus = async (status: ProjectStatus) => {
    const before = project;
    setProject({ ...project, status });
    const { error } = await createClient().from("projects").update({ status }).eq("id", project.id);
    if (error) {
      setProject(before);
      return sayError("Couldn't change the status", error);
    }
    router.refresh();
  };

  /** After Edit phases saves, reload what the save could have moved. */
  const reloadStructure = async () => {
    const supabase = createClient();
    const [p, ph, ck, dc] = await Promise.all([
      supabase.from("projects").select("*").eq("id", project.id).single<Project>(),
      supabase.from("phases").select("*").eq("project_id", project.id).is("deleted_at", null).order("sort_order"),
      supabase.from("checklist_items").select("*").eq("project_id", project.id).is("deleted_at", null).order("sort_order"),
      supabase.from("documents").select("*").eq("project_id", project.id).is("deleted_at", null).order("created_at"),
    ]);
    if (p.data) setProject(p.data);
    if (ph.data) setPhases(ph.data as Phase[]);
    if (ck.data) checklist.reset(ck.data as ChecklistItem[]);
    if (dc.data) setDocuments(dc.data as Doc[]);
    router.refresh();
  };

  const nextTask = openTasks[0];
  const tabs: [TabKey, string][] = [
    ["overview", "Overview"],
    ["tasks", `Tasks ${tasks.length}`],
    ["checklist", `Checklist ${ckDone}/${checklist.items.length}`],
  ];

  return (
    <main className="flex min-w-0 animate-screen-in flex-col gap-6 px-10 pt-7 pb-16">
      <Link href="/projects" className="flex items-center gap-1.5 self-start text-sm text-neutral-700 no-underline hover:text-foreground">
        <ArrowLeft weight="duotone" className="size-3.5" />
        Projects
      </Link>

      <header className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <span className="size-3 rounded-[3px]" style={{ background: project.color }} />
            <h1 className="m-0 text-[22px] font-semibold">{project.name}</h1>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="cursor-pointer border-0 bg-transparent p-0" aria-label="Change status">
                  <Tag tone={STATUS_TONE[project.status]} className="gap-1">
                    {STATUS_LABEL[project.status]}
                    <CaretDown className="size-3 opacity-70" />
                  </Tag>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map((s) => (
                  <DropdownMenuItem key={s} onSelect={() => setStatus(s)}>
                    <Check className={cn("size-3.5", s === project.status ? "opacity-100" : "opacity-0")} />
                    {STATUS_LABEL[s]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <span className="text-sm text-neutral-700">
            {project.client ? `${project.client} · ` : ""}
            {projectRange(project)} · {formatDuration(props.minutes)} logged
          </span>
        </div>
        <Button
          variant="primary"
          className="rounded-xl"
          disabled={!nextTask}
          title={nextTask ? `Start a session on “${nextTask.title}”` : "No open tasks"}
          onClick={() => nextTask && router.push(`/today?focus=${nextTask.id}`)}
        >
          <Timer weight="duotone" className="size-3.5" />
          Focus on next task
        </Button>
      </header>

      {ongoing ? (
        <button
          type="button"
          onClick={() => setPhasesOpen(true)}
          className="flex cursor-pointer items-center gap-1.5 self-start rounded-full border border-dashed border-neutral-400 bg-transparent px-3 py-1.5 text-[13px] text-neutral-700 hover:border-accent hover:text-accent-700"
        >
          <Plus className="size-[13px]" />
          Add phases
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {phases.map((ph, i) => {
            const done = i < curIdx;
            const cur = i === curIdx;
            const Icon = done ? Check : cur ? CircleNotch : Circle;
            return (
              <div key={ph.id} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap",
                    done && "bg-accent text-white",
                    cur && "bg-accent-100 text-accent-700 shadow-[inset_0_0_0_1.5px_var(--a)]",
                    !done && !cur && "text-neutral-700 shadow-[inset_0_0_0_1px_var(--n-400)]",
                  )}
                >
                  <Icon weight="duotone" className="size-3.5" />
                  {ph.name}
                  <span className="text-xs opacity-80">{shortDate(ph.start_date)}</span>
                </span>
                {i < phases.length - 1 && <span className="h-[1.5px] w-5 bg-neutral-400" />}
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setPhasesOpen(true)}
            className="ml-1.5 flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-neutral-400 bg-transparent px-3 py-1.5 text-[13px] whitespace-nowrap text-neutral-700 hover:border-accent hover:text-accent-700"
          >
            <PencilSimple className="size-[13px]" />
            Edit phases
          </button>
        </div>
      )}

      <div className="flex gap-7 px-0.5" role="tablist">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "cursor-pointer border-0 border-b-[2.5px] bg-transparent px-0 pt-1.5 pb-2.5 text-sm",
              tab === key ? "border-accent font-semibold text-foreground" : "border-transparent text-neutral-700",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <Overview
          phases={phases}
          curIdx={curIdx}
          ongoing={ongoing}
          checklist={checklist}
          documents={documents}
          dates={props.dates}
          openTasks={openTasks}
          onSelectTask={setSelectedId}
          onTab={setTab}
        />
      )}

      {tab === "tasks" && (
        <TasksTab
          projectId={project.id}
          tasks={tasks}
          store={store}
          onSelect={setSelectedId}
        />
      )}

      {tab === "checklist" && (
        <ChecklistTab
          projectId={project.id}
          phases={ongoing ? [] : phases}
          curIdx={curIdx}
          documents={documents}
          checklist={checklist}
        />
      )}

      <TaskDetailSheet task={selected} store={store} onClose={() => setSelectedId(null)} />
      <EditPhasesDialog
        open={phasesOpen}
        onClose={() => setPhasesOpen(false)}
        project={project}
        phases={ongoing ? [] : phases}
        checklist={checklist.items}
        documents={documents}
        onSaved={reloadStructure}
      />
    </main>
  );
}

function Overview({
  phases,
  curIdx,
  ongoing,
  checklist,
  documents,
  dates,
  openTasks,
  onSelectTask,
  onTab,
}: {
  phases: Phase[];
  curIdx: number;
  ongoing: boolean;
  checklist: ReturnType<typeof useChecklist>;
  documents: Doc[];
  dates: ProjectDate[];
  openTasks: Task[];
  onSelectTask: (id: string) => void;
  onTab: (t: TabKey) => void;
}) {
  const { today } = useWorkday();
  const cur = curIdx >= 0 ? phases[curIdx] : null;
  const curItems = checklist.items.filter((c) => (ongoing ? true : cur ? c.phase_id === cur.id : false));
  const approved = documents.filter((d) => d.status === "approved").length;
  const upcoming = [
    ...dates.map((d) => ({ key: d.id, title: d.title, date: d.date })),
    ...phases.map((p) => ({ key: p.id, title: `${p.name} starts`, date: p.start_date })),
  ]
    .filter((d) => d.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);
  // Generic gate rule: any gate document not yet approved blocks closing its phase.
  const gate = cur ? documents.find((d) => d.is_gate && d.phase_id === cur.id && d.status !== "approved") : null;

  return (
    <div className="flex flex-col gap-5">
      {gate && cur && (
        <div className="flex items-center gap-2.5 rounded-xl bg-warning-100 px-4 py-3 text-sm text-warning-800">
          <Warning weight="duotone" className="size-4" />
          {cur.name} can&apos;t be marked complete until “{gate.name}” is approved.
        </div>
      )}
      <div className="grid grid-cols-1 gap-5 min-[1100px]:grid-cols-3">
        <OverviewCard
          title={ongoing ? "Checklist" : cur ? `${cur.name} checklist` : "Checklist"}
          link={`All ${checklist.items.filter((c) => c.is_done).length}/${checklist.items.length} →`}
          onLink={() => onTab("checklist")}
        >
          {!cur && !ongoing && <Empty>The first phase starts {phases[0] ? shortDate(phases[0].start_date) : "later"}.</Empty>}
          {(cur || ongoing) && curItems.length === 0 && <Empty>Nothing on this phase&apos;s checklist yet.</Empty>}
          {curItems.map((c) => (
            <label
              key={c.id}
              className={cn("flex cursor-pointer items-center gap-2.5 text-sm", c.is_done && "text-neutral-600 line-through")}
            >
              <Checkbox checked={c.is_done} onChange={() => checklist.toggle(c.id)} />
              {c.label}
            </label>
          ))}
        </OverviewCard>

        <OverviewCard title="Documents" link={`${approved}/${documents.length} approved`}>
          {documents.length === 0 && <Empty>No documents yet.</Empty>}
          {documents.map((d) => {
            const Icon = d.status === "approved" ? CheckCircle : d.status === "missing" ? CircleDashed : CircleHalf;
            const color =
              d.status === "approved" ? "text-accent-700" : d.status === "missing" ? "text-warning-700" : "text-neutral-700";
            return (
              <div key={d.id} className="flex items-center gap-2.5 text-sm">
                <Icon weight="duotone" className={cn("size-[15px] shrink-0", color)} />
                <span className="min-w-0 flex-1">{d.name}</span>
                <span className={cn("text-xs", color)}>{DOC_STATUS_LABEL[d.status]}</span>
              </div>
            );
          })}
        </OverviewCard>

        <OverviewCard title="Important dates">
          {upcoming.length === 0 && <Empty>Nothing coming up.</Empty>}
          {upcoming.map((d) => {
            const soon = daysBetween(today, d.date) <= 3;
            return (
              <div key={d.key} className="grid grid-cols-[58px_1fr_auto] items-center gap-2.5 text-sm">
                <span className="font-semibold whitespace-nowrap">{shortDate(d.date)}</span>
                <span className="min-w-0">{d.title}</span>
                <span className={cn("text-xs whitespace-nowrap", soon ? "text-warning-700" : "text-neutral-700")}>
                  {relativeDay(d.date, today)}
                </span>
              </div>
            );
          })}
        </OverviewCard>
      </div>

      <section className="flex flex-col gap-1.5 rounded-[14px] bg-card p-[22px] shadow-hairline">
        <div className="flex items-baseline justify-between">
          <h2 className="m-0 text-sm font-semibold">Open tasks</h2>
          <button
            type="button"
            onClick={() => onTab("tasks")}
            className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-accent-700 hover:underline"
          >
            All tasks →
          </button>
        </div>
        {openTasks.length === 0 && <Empty>No open tasks.</Empty>}
        {openTasks.slice(0, 4).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelectTask(t.id)}
            className="flex cursor-pointer items-center gap-3 rounded-[10px] border-0 bg-transparent p-1.5 text-left text-foreground hover:bg-neutral-200"
          >
            <span className={cn("size-[7px] rounded-full", priorityDotClass(t.priority))} />
            <span className="flex-1 text-sm">{t.title}</span>
            <span className="text-sm text-neutral-700">{estimateLabel(t.estimate_minutes)}</span>
          </button>
        ))}
      </section>
    </div>
  );
}

function OverviewCard({
  title,
  link,
  onLink,
  children,
}: {
  title: string;
  link?: string;
  onLink?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5 rounded-[14px] bg-card p-[22px] shadow-hairline">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-sm font-semibold">{title}</h2>
        {link &&
          (onLink ? (
            <button
              type="button"
              onClick={onLink}
              className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-accent-700 hover:underline"
            >
              {link}
            </button>
          ) : (
            <span className="text-[13px] text-neutral-700">{link}</span>
          ))}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="m-0 text-[13px] text-neutral-600">{children}</p>;
}

function TasksTab({
  projectId,
  tasks,
  store,
  onSelect,
}: {
  projectId: string;
  tasks: Task[];
  store: ReturnType<typeof useTaskStore>;
  onSelect: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const sorted = [...tasks.filter((t) => t.status === "todo").sort(byPriority), ...tasks.filter((t) => t.status === "done")];

  return (
    <section className="flex flex-col gap-1 rounded-[14px] bg-card px-[22px] py-5 shadow-hairline">
      <form
        className="mb-2 flex items-center gap-2.5"
        onSubmit={async (e) => {
          e.preventDefault();
          const title = draft.trim();
          if (!title) return;
          setDraft("");
          if (!(await store.addTask({ title, project_id: projectId }))) setDraft(title);
        }}
      >
        <Plus weight="bold" className="size-[15px] text-accent" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a task to this project… (set “Do on” to put it on Today)"
          aria-label="Add a task to this project"
          className="flex-1 border-0 border-b-[1.5px] border-neutral-300 bg-transparent py-1.5 text-sm text-foreground outline-none placeholder:text-neutral-600 focus:border-accent"
        />
      </form>
      {sorted.length === 0 && <Empty>No tasks yet.</Empty>}
      {sorted.map((t) => {
        const done = t.status === "done";
        return (
          <div
            key={t.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(t.id)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(t.id))}
            className="grid cursor-pointer grid-cols-[20px_minmax(0,1fr)_110px_60px] items-center gap-3.5 rounded-[10px] p-2 outline-none hover:bg-neutral-200 focus-visible:bg-neutral-200"
          >
            <RoundCheck checked={done} onToggle={() => store.toggleDone(t.id)} label={done ? `Reopen ${t.title}` : `Complete ${t.title}`} />
            <span className={cn("truncate text-sm", done && "text-neutral-600 line-through")}>{t.title}</span>
            <span className="text-[13px] text-neutral-700">
              {t.due_date ? `Due ${shortDate(t.due_date)}` : t.scheduled_for ? `Do ${shortDate(t.scheduled_for)}` : "Someday"}
            </span>
            <span className="text-right text-sm text-neutral-700">{estimateLabel(t.estimate_minutes)}</span>
          </div>
        );
      })}
    </section>
  );
}
