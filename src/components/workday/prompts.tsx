"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { formatDuration, formatTime, hhmm, istDayRange, istInstant, shortDate, weekdayShort } from "@/lib/time";
import type { WorkSession } from "@/lib/types";
import type { CurrentTask } from "./workday-provider";

/** Starting a timer while clocked out offers to clock in. */
export function ClockInPrompt({
  open,
  onCancel,
  onJustStart,
  onClockIn,
}: {
  open: boolean;
  onCancel: () => void;
  onJustStart: () => void;
  onClockIn: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="w-[420px]">
        <div className="flex flex-col gap-1">
          <DialogTitle>You&apos;re clocked out</DialogTitle>
          <DialogDescription>Clock in now so today&apos;s hours count from this session?</DialogDescription>
        </div>
        <DialogActions>
          <Button variant="secondary" onClick={onJustStart}>
            Just start the timer
          </Button>
          <Button variant="primary" onClick={onClockIn} autoFocus>
            Clock in and start
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}

/** Switching task mid-session: log the elapsed time to the old task first (the default). */
export function SwitchTaskPrompt({
  ask,
  fromTitle,
  onCancel,
  onSwitch,
}: {
  ask: { task: CurrentTask; elapsed: number } | null;
  fromTitle: string;
  onCancel: () => void;
  onSwitch: (log: boolean) => void;
}) {
  const minutes = ask ? formatDuration(ask.elapsed / 60) : "";
  return (
    <Dialog open={Boolean(ask)} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="w-[520px]">
        <div className="flex flex-col gap-1 pr-6">
          <DialogTitle>
            Log {minutes} to {fromTitle} and switch?
          </DialogTitle>
          <DialogDescription>
            A fresh session starts on “{ask?.task.title}”. If you don&apos;t log it, the time so far carries over to
            the new task.
          </DialogDescription>
        </div>
        <DialogActions className="flex-wrap">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => onSwitch(false)}>
            Don&apos;t log
          </Button>
          <Button variant="primary" onClick={() => onSwitch(true)} autoFocus>
            Log {minutes} and switch
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}

/** A work session left open overnight: ask when you finished, defaulting to the last activity. */
export function StaleSessionDialog({
  session,
  onSave,
}: {
  session: WorkSession;
  onSave: (at: Date) => Promise<boolean>;
}) {
  const [time, setTime] = useState<string | null>(null);
  const [lastActivity, setLastActivity] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const [from, to] = istDayRange(session.date);
    void createClient()
      .from("time_entries")
      .select("ended_at")
      .is("deleted_at", null)
      .gte("started_at", from)
      .lt("started_at", to)
      .order("ended_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const last = data?.[0]?.ended_at ?? session.clock_in;
        setLastActivity(last);
        setTime((t) => t ?? hhmm(last));
      });
  }, [session.date, session.clock_in]);

  const save = async () => {
    if (!time) return;
    const at = istInstant(session.date, time);
    if (at.getTime() <= new Date(session.clock_in).getTime()) {
      setError(`That's before you clocked in (${formatTime(session.clock_in)}).`);
      return;
    }
    setSaving(true);
    const ok = await onSave(at);
    setSaving(false);
    if (!ok) setError("Couldn't save. Try again.");
  };

  return (
    <Dialog open>
      <DialogContent className="w-[440px]" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <div className="flex flex-col gap-1">
          <DialogTitle>When did you finish on {weekdayShort(session.date)} {shortDate(session.date)}?</DialogTitle>
          <DialogDescription>
            You clocked in at {formatTime(session.clock_in)} and didn&apos;t clock out.
            {lastActivity && ` Your last activity was at ${formatTime(lastActivity)}.`}
          </DialogDescription>
        </div>
        <Field label="Finished at" htmlFor="stale-out">
          <Input id="stale-out" type="time" value={time ?? ""} onChange={(e) => { setTime(e.target.value); setError(""); }} />
        </Field>
        {error && <p className="m-0 text-[13px] text-warning-700">{error}</p>}
        <DialogActions>
          <Button variant="primary" onClick={save} disabled={!time || saving}>
            Clock out at {time ? formatTime(istInstant(session.date, time)) : "…"}
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
