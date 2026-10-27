"use client";

import { useTimerView } from "@/components/workday/use-timer-view";
import { useWorkday, type Entry } from "@/components/workday/workday-provider";
import { findGaps } from "@/lib/gaps";
import { formatDuration, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

type Row = { kind: "entry"; entry: Entry } | { kind: "gap"; from: number; to: number; minutes: number };

/** Vertical timeline: live session, past sessions (click to edit), and untracked gaps. */
export function SessionLog({
  onEdit,
  onLogGap,
}: {
  onEdit: (entry: Entry) => void;
  onLogGap: (from: number, to: number) => void;
}) {
  const { entries, projectById, timer, currentTask } = useWorkday();
  const view = useTimerView();
  const live = view.isFocus && timer?.started_at ? timer.started_at : null;

  const focused = entries.reduce((sum, e) => sum + e.duration_minutes, 0);

  const startOf = (r: Row) => (r.kind === "entry" ? new Date(r.entry.started_at).getTime() : r.from);
  const rows: Row[] = [
    ...entries.map((entry) => ({ kind: "entry" as const, entry })),
    ...findGaps(entries).map((g) => ({ kind: "gap" as const, ...g })),
  ].sort((a, b) => startOf(b) - startOf(a));

  return (
    <aside className="flex min-w-0 flex-col gap-[18px] rounded-2xl bg-card p-[22px] shadow-hairline">
      <div className="flex flex-col gap-0.5">
        <h2 className="m-0 text-sm font-semibold">Session log</h2>
        <span className="text-[13px] text-neutral-700">
          {entries.length} session{entries.length === 1 ? "" : "s"} · {formatDuration(focused)} focused
        </span>
      </div>

      {entries.length === 0 && !live && (
        <p className="m-0 text-[13px] text-neutral-700">Finished sessions show up here. Click one to edit, split or delete it.</p>
      )}

      <ol className="m-0 flex list-none flex-col p-0">
        {live && (
          <li className="relative grid grid-cols-[14px_minmax(0,1fr)] gap-3.5 pb-5">
            {rows.length > 0 && <span className="absolute top-3.5 bottom-0 left-1.5 w-px bg-neutral-300" />}
            <span className="mt-1 size-[13px] rounded-full bg-accent shadow-[0_0_0_4px_var(--a-200)]" />
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] text-accent-700">{formatTime(live)} – now</span>
              <span className="text-sm leading-tight font-semibold">{currentTask?.title ?? "Focus session"}</span>
            </div>
          </li>
        )}
        {rows.map((row, i) => {
          const last = i === rows.length - 1;
          if (row.kind === "gap") {
            return (
              <li key={`gap-${row.from}`} className="relative grid grid-cols-[14px_minmax(0,1fr)] gap-3.5 pb-5">
                {!last && <span className="absolute top-3.5 bottom-0 left-1.5 w-px bg-neutral-300" />}
                <span className="mt-1 size-[13px] rounded-full border-[1.5px] border-dashed border-neutral-500 bg-card" />
                <div className="flex items-center justify-between gap-2 text-[13px] text-neutral-600">
                  <span>
                    {formatDuration(row.minutes)} untracked
                  </span>
                  <button
                    type="button"
                    onClick={() => onLogGap(row.from, row.to)}
                    className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-accent-700 hover:underline"
                  >
                    Log
                  </button>
                </div>
              </li>
            );
          }
          const e = row.entry;
          const project = projectById.get(e.project_id);
          const title = e.note ?? e.task?.title ?? project?.name ?? "Session";
          return (
            <li key={e.id} className="relative grid grid-cols-[14px_minmax(0,1fr)] gap-3.5 pb-5">
              {!last && <span className="absolute top-3.5 bottom-0 left-1.5 w-px bg-neutral-300" />}
              <span
                className={cn(
                  "mt-1 size-[13px] rounded-full border-[1.5px] bg-card",
                  e.source === "manual" ? "border-neutral-400" : "border-accent-500",
                )}
              />
              <button
                type="button"
                onClick={() => onEdit(e)}
                title="Edit, split or delete"
                className="-m-1.5 flex cursor-pointer flex-col gap-0.5 rounded-lg border-0 bg-transparent p-1.5 text-left text-foreground hover:bg-neutral-200"
              >
                <span className="flex w-full justify-between text-[13px] tabular-nums text-neutral-700">
                  <span>
                    {formatTime(e.started_at)} – {formatTime(e.ended_at)}
                  </span>
                  <span>{formatDuration(e.duration_minutes)}</span>
                </span>
                <span className="text-sm leading-tight">{title}</span>
                <span className="text-[13px] text-neutral-600">
                  {project?.name}
                  {e.source === "manual" ? " · added by hand" : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
