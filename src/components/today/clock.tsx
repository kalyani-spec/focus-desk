"use client";

import { useState } from "react";
import { Warning } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogActions, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useWorkday } from "@/components/workday/workday-provider";
import { findGaps } from "@/lib/gaps";
import { useNow } from "@/lib/use-now";
import { addDays, formatDuration, formatTime, isWeekend, shortDate, weekdayShort } from "@/lib/time";
import { say } from "@/lib/toast";
import type { Holiday } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ClockButton({ onClockOut }: { onClockOut: () => void }) {
  const { openSession, clockIn } = useWorkday();
  const [busy, setBusy] = useState(false);
  const clockedIn = Boolean(openSession);
  return (
    <Button
      variant={clockedIn ? "secondary" : "primary"}
      className="h-auto gap-2.5 rounded-xl px-[18px] py-2.5"
      disabled={busy}
      onClick={async () => {
        if (clockedIn) return onClockOut();
        setBusy(true);
        if (await clockIn()) say(`Clocked in at ${formatTime(Date.now())}`);
        setBusy(false);
      }}
    >
      <span className={cn("size-[9px] rounded-full", clockedIn ? "bg-accent" : "bg-background")} />
      {clockedIn ? "Clock out" : "Clock in"}
    </Button>
  );
}

/** First working day after `from`, skipping weekends and full days off. */
export function nextWorkday(from: string, holidays: Holiday[]) {
  let d = addDays(from, 1);
  for (let i = 0; i < 30; i++) {
    const off = holidays.find((h) => h.part === "full" && d >= h.from_date && d <= h.to_date);
    if (!isWeekend(d) && !off) return d;
    d = addDays(d, 1);
  }
  return addDays(from, 1);
}

/** "Wrapping up": day span, focused time, project split, untracked gaps, move open tasks. */
export function ClockOutDialog({
  open,
  onClose,
  openTaskIds,
  onMoveTasks,
  onLogGap,
}: {
  open: boolean;
  onClose: () => void;
  openTaskIds: string[];
  onMoveTasks: (ids: string[], date: string) => Promise<boolean>;
  onLogGap: (from: number, to: number) => void;
}) {
  const { sessions, entries, projectById, today, holidays, clockOut } = useWorkday();
  const [move, setMove] = useState(true);
  const [busy, setBusy] = useState(false);

  const now = useNow() ?? 0;
  const todays = sessions.filter((s) => s.date === today);
  const firstIn = todays[0] ? new Date(todays[0].clock_in).getTime() : now;
  // Clocked time counts each session, not breaks between clock-out and clock-in.
  const clocked = todays.reduce(
    (sum, s) => sum + ((s.clock_out ? new Date(s.clock_out).getTime() : now) - new Date(s.clock_in).getTime()),
    0,
  );
  const focused = entries.reduce((sum, e) => sum + e.duration_minutes, 0);
  const split = [...projectById.values()]
    .map((p) => ({ p, m: entries.filter((e) => e.project_id === p.id).reduce((s, e) => s + e.duration_minutes, 0) }))
    .filter((x) => x.m > 0);
  const gaps = findGaps(entries, firstIn, now);
  const next = nextWorkday(today, holidays);
  const skipped = next !== addDays(today, 1);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[520px] gap-[18px]">
        <div className="flex flex-col gap-0.5">
          <DialogTitle>Wrapping up</DialogTitle>
          <DialogDescription>
            {formatTime(firstIn)} – {formatTime(now)}
          </DialogDescription>
        </div>
        <div className="flex gap-8">
          <Stat value={formatDuration(clocked / 60000)} label="clocked" />
          <Stat value={formatDuration(focused)} label="focused" accent />
          <Stat value={String(entries.length)} label={entries.length === 1 ? "session" : "sessions"} />
        </div>
        {split.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-md">
              {split.map(({ p, m }) => (
                <span key={p.id} title={`${p.name} ${formatDuration(m)}`} style={{ width: `${(m / focused) * 100}%`, background: p.color }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-3.5 text-[13px] text-neutral-700">
              {split.map(({ p, m }) => (
                <span key={p.id} className="flex items-center gap-1.5">
                  <span className="size-[9px] rounded-[3px]" style={{ background: p.color }} />
                  {p.name} {formatDuration(m)}
                </span>
              ))}
            </div>
          </div>
        )}
        {gaps.map((g) => (
          <div
            key={g.from}
            className="flex items-center gap-3 rounded-xl bg-warning-100 px-3.5 py-2.5 text-sm text-warning-800"
          >
            <Warning weight="duotone" className="size-3.5 shrink-0" />
            <span className="flex-1">
              {formatTime(g.from)} – {formatTime(g.to)} untracked ({formatDuration(g.minutes)})
            </span>
            <Button variant="ghost" size="sm" className="text-warning-800" onClick={() => onLogGap(g.from, g.to)}>
              Log it
            </Button>
          </div>
        ))}
        {openTaskIds.length > 0 && (
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <Checkbox checked={move} onChange={(e) => setMove(e.target.checked)} />
            Move {openTaskIds.length} open task{openTaskIds.length === 1 ? "" : "s"} to {weekdayShort(next)}{" "}
            {shortDate(next)}
            {skipped && <span className="text-neutral-600">(skips days off)</span>}
          </label>
        )}
        <DialogActions>
          <Button variant="secondary" onClick={onClose}>
            Keep working
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const ok = await clockOut();
              if (ok && move && openTaskIds.length) await onMoveTasks(openTaskIds, next);
              setBusy(false);
              if (!ok) return;
              say(
                `Clocked out at ${formatTime(Date.now())}${
                  move && openTaskIds.length ? ` · open tasks moved to ${weekdayShort(next)}` : ""
                }`,
              );
              onClose();
            }}
          >
            Clock out
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className={cn("text-[22px] font-semibold", accent && "text-accent-800")}>{value}</span>
      <span className="text-[13px] text-neutral-700">{label}</span>
    </div>
  );
}
