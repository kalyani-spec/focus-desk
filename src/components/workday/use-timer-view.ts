"use client";

import { useEffect } from "react";
import { formatCountdown } from "@/lib/time";
import { modeLength, remainingSeconds, sessionNumber, timerPhase } from "@/lib/timer";
import { useNow } from "@/lib/use-now";
import { useWorkday } from "./workday-provider";

/** Everything a timer display needs, recomputed every second. */
export function useTimerView() {
  const { timer, settings } = useWorkday();
  const now = useNow();
  const mode = timer?.mode ?? "focus";
  const full = modeLength(mode, settings);
  const phase = timerPhase(timer);
  const remaining = now === null && phase === "running" ? full : remainingSeconds(timer, full, now ?? 0);
  const isFocus = mode === "focus";
  return {
    mode,
    phase,
    isFocus,
    full,
    remaining,
    elapsed: full - remaining,
    progress: full ? (full - remaining) / full : 0,
    timeLabel: now === null && phase === "running" ? "––:––" : formatCountdown(remaining),
    sessionNumber: sessionNumber(timer),
    cycleDone: timer?.cycle_done ?? 0,
    hasStarted: Boolean(timer?.started_at),
  };
}

/** Shows the countdown in the tab title while the timer runs. Mount once. */
export function useTabTitle() {
  const view = useTimerView();
  const { currentTask } = useWorkday();
  useEffect(() => {
    if (view.phase !== "running") {
      document.title = "Focus Desk";
      return;
    }
    const what = view.isFocus ? (currentTask?.title ?? "Focusing") : "Break";
    document.title = `${view.timeLabel} · ${what}`;
  }, [view.phase, view.isFocus, view.timeLabel, currentTask?.title]);
}

/** Mount once inside the provider. */
export function TabTitle() {
  useTabTitle();
  return null;
}
