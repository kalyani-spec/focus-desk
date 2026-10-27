import { formatDuration } from "./time";
import type { Priority, Task } from "./types";

export const PRIORITY_LABEL: Record<Priority, string> = { high: "High", med: "Medium", low: "Low" };
const PRIORITY_RANK: Record<Priority, number> = { high: 0, med: 1, low: 2 };

export const ESTIMATES = [10, 15, 20, 25, 30, 45, 60, 90, 120, 180, 240];

export function estimateLabel(minutes: number | null) {
  return minutes ? formatDuration(minutes) : "";
}

/** High priority first, then oldest first. */
export function byPriority(a: Task, b: Task) {
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.created_at.localeCompare(b.created_at);
}

/** Dot styles from the design: high = solid accent, medium = accent-400, low = hollow ring. */
export function priorityDotClass(p: Priority) {
  return p === "high" ? "bg-accent" : p === "med" ? "bg-accent-400" : "bg-transparent shadow-[inset_0_0_0_1.5px_var(--n-400)]";
}
