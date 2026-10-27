import type { ActiveTimer, Settings, TimerMode } from "./types";

export const MIN_LOG_SECONDS = 120; // sessions under 2 minutes are discarded

export type TimerPhase = "ready" | "running" | "paused";

/** Full length of the current mode, in seconds. */
export function modeLength(mode: TimerMode, settings: Pick<Settings, "focus_minutes" | "short_break" | "long_break">) {
  if (mode === "focus") return settings.focus_minutes * 60;
  return (mode === "long_break" ? settings.long_break : settings.short_break) * 60;
}

export function timerPhase(timer: ActiveTimer | null): TimerPhase {
  if (!timer) return "ready";
  if (timer.ends_at) return "running";
  if (timer.paused_remaining_seconds != null) return "paused";
  return "ready";
}

/** Remaining seconds, always derived from ends_at (running) or paused_remaining_seconds (paused). */
export function remainingSeconds(timer: ActiveTimer | null, fullLength: number, now: number) {
  if (!timer) return fullLength;
  if (timer.ends_at) return Math.max(0, (new Date(timer.ends_at).getTime() - now) / 1000);
  if (timer.paused_remaining_seconds != null) return timer.paused_remaining_seconds;
  return fullLength;
}

export function sessionNumber(timer: ActiveTimer | null) {
  return Math.min(4, (timer?.cycle_done ?? 0) + 1);
}
