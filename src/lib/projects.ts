import { addDays, daysBetween, fromDayNumber, dayNumber, isWeekend, shortDate, shortDateYear } from "./time";
import type { DocStatus, Holiday, Phase, Project, ProjectStatus } from "./types";

export const DEFAULT_PHASES = ["Discovery", "Design", "Dev", "QA", "Handover"];
export const NEW_PROJECT_COLORS = ["#4fbf9f", "#e0a458", "#e07b9a", "#7b7bea", "#5fa3e8", "#a77be6"];

/** Phase shades cycle through the accent ramp. */
export const PHASE_SHADES = ["var(--a-300)", "var(--a-400)", "var(--a-500)", "var(--a)", "var(--a-800)"];
export const phaseShade = (i: number) => PHASE_SHADES[i % PHASE_SHADES.length];

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  on_track: "On track",
  at_risk: "At risk",
  ongoing: "Ongoing",
  done: "Done",
};
export const STATUS_TONE: Record<ProjectStatus, "accent" | "warning" | "neutral"> = {
  on_track: "accent",
  at_risk: "warning",
  ongoing: "neutral",
  done: "neutral",
};

export const DOC_STATUS_LABEL: Record<DocStatus, string> = {
  missing: "Missing",
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
};

export function holidayOn(date: string | null, holidays: Holiday[]) {
  if (!date) return null;
  return holidays.find((h) => date >= h.from_date && date <= h.to_date) ?? null;
}

/** "Starts on Diwali" / "Starts on a weekend" / "" for a phase start date. */
export function startWarning(date: string | null, holidays: Holiday[]) {
  if (!date) return "";
  const h = holidayOn(date, holidays);
  if (h) return `Starts on ${h.title}`;
  return isWeekend(date) ? "Starts on a weekend" : "";
}

/** Move a date forward off Saturday/Sunday. */
export function offWeekend(date: string) {
  let d = date;
  while (isWeekend(d)) d = addDays(d, 1);
  return d;
}

/** The design's default spread: phases at 0 / 15 / 35 / 70 / 90% of the duration, off weekends. */
export function spreadDefault(start: string, end: string) {
  const days = Math.max(5, daysBetween(start, end));
  return [0, 0.15, 0.35, 0.7, 0.9].map((f) => offWeekend(addDays(start, Math.round(days * f))));
}

/** N phases spread evenly between start and end, off weekends. */
export function spreadEvenly(start: string, end: string, n: number) {
  const days = Math.max(n, daysBetween(start, end));
  return Array.from({ length: n }, (_, i) => offWeekend(addDays(start, Math.round((days * i) / n))));
}

export function midpoint(a: string, b: string) {
  return fromDayNumber(Math.floor((dayNumber(a) + dayNumber(b)) / 2));
}

/** The current phase is the last one whose start is on or before today; -1 before the first. */
export function currentPhaseIndex(phases: Phase[], today: string) {
  let idx = -1;
  phases.forEach((p, i) => {
    if (p.start_date <= today) idx = i;
  });
  return idx;
}

export function projectRange(p: Project) {
  if (!p.end_date) return `From ${shortDateYear(p.start_date)}`;
  const sameYear = p.start_date.slice(0, 4) === p.end_date.slice(0, 4);
  return `${sameYear ? shortDate(p.start_date) : shortDateYear(p.start_date)} – ${shortDateYear(p.end_date)}`;
}

/** "In Dev · QA on 9 Nov" / "Not started" / "Ongoing support" */
export function phaseLine(p: Project, phases: Phase[], today: string) {
  if (p.is_ongoing) return "Ongoing support";
  if (!phases.length) return "No phases yet";
  const i = currentPhaseIndex(phases, today);
  if (i < 0) return `Starts ${shortDate(phases[0].start_date)}`;
  const next = phases[i + 1];
  return `In ${phases[i].name}${next ? ` · ${next.name} on ${shortDate(next.start_date)}` : ""}`;
}
