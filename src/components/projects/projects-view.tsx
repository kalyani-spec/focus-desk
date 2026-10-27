"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { useWorkday } from "@/components/workday/workday-provider";
import { phaseLine, projectRange, STATUS_LABEL, STATUS_TONE } from "@/lib/projects";
import { formatDuration, shortDate } from "@/lib/time";
import type { Phase, Project, Template } from "@/lib/types";
import { NewProjectWizard } from "./new-project-wizard";

export interface ProjectSummary {
  project: Project;
  phases: Phase[];
  tasksDone: number;
  tasksTotal: number;
  checklist: boolean[];
  docsApproved: number;
  docsTotal: number;
  minutes: number;
  nextDate: { date: string; title: string } | null;
}

export function ProjectsView({ summaries, templates }: { summaries: ProjectSummary[]; templates: Template[] }) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const total = summaries.reduce((s, x) => s + x.minutes, 0);

  return (
    <main className="flex min-w-0 animate-screen-in flex-col gap-7 px-10 pt-7 pb-16">
      <header className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-neutral-700">
            {summaries.length} project{summaries.length === 1 ? "" : "s"} · {formatDuration(total)} logged
          </span>
          <h1 className="m-0 text-[22px] font-semibold">Projects</h1>
        </div>
        <Button variant="primary" className="h-10 rounded-[10px]" onClick={() => setWizardOpen(true)}>
          <Plus className="size-[15px]" />
          New project
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-5 min-[960px]:grid-cols-2">
        {summaries.map((s) => (
          <ProjectCard key={s.project.id} summary={s} />
        ))}
      </div>

      <NewProjectWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        templates={templates}
        existingNames={summaries.map((s) => s.project.name)}
      />
    </main>
  );
}

function ProjectCard({ summary: s }: { summary: ProjectSummary }) {
  const { today } = useWorkday();
  const p = s.project;
  const pct = s.tasksTotal ? Math.round((s.tasksDone / s.tasksTotal) * 100) : 0;
  const checkDone = s.checklist.filter(Boolean).length;

  return (
    <Link
      href={`/projects/${p.id}`}
      className="flex flex-col gap-5 rounded-2xl bg-card px-7 py-[26px] text-foreground no-underline shadow-hairline transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-dialog"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: p.color }} />
            <h2 className="m-0 truncate text-lg font-semibold">{p.name}</h2>
          </div>
          <span className="text-[13px] text-neutral-700">{projectRange(p)}</span>
        </div>
        <Tag tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Tag>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-[13px]">
          <span className="text-neutral-700">Tasks</span>
          <span className="tabular-nums">
            {s.tasksDone} of {s.tasksTotal} · {pct}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-md bg-neutral-300">
          <div className="h-full rounded-md bg-accent" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3.5">
        <Stat label="Checklist">
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold tabular-nums">
              {checkDone}/{s.checklist.length}
            </span>
            <span className="flex gap-0.5">
              {s.checklist.slice(0, 16).map((done, i) => (
                <span key={i} className={done ? "h-3 w-[3px] rounded-sm bg-accent" : "h-3 w-[3px] rounded-sm bg-neutral-300"} />
              ))}
            </span>
          </span>
        </Stat>
        <Stat label="Documents">
          <span className="text-sm font-semibold">
            {s.docsApproved}/{s.docsTotal}
          </span>
        </Stat>
        <Stat label="Hours logged">
          <span className="text-sm font-semibold whitespace-nowrap">{formatDuration(s.minutes)}</span>
        </Stat>
        <Stat label="Next date">
          <span className="truncate text-sm">{s.nextDate ? `${shortDate(s.nextDate.date)} · ${s.nextDate.title}` : "—"}</span>
        </Stat>
      </div>

      <span className="text-[13px] text-neutral-700">{phaseLine(p, s.phases, today)}</span>
    </Link>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] text-neutral-700">{label}</span>
      {children}
    </div>
  );
}
