/**
 * Timestamps are stored in UTC and always displayed in Asia/Kolkata.
 * Kolkata has a fixed +05:30 offset (no DST), so day boundaries are simple to build.
 */
export const TZ = "Asia/Kolkata";
export const TZ_OFFSET = "+05:30";

const timeFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: TZ,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const longDateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const isoDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const hmFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", hourCycle: "h23" });

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "9:42 AM" */
export function formatTime(value: string | Date | number) {
  return timeFmt.format(new Date(value)).toUpperCase();
}

/** "09:42" in Kolkata, for <input type="time">. */
export function hhmm(value: string | Date | number) {
  return hmFmt.format(new Date(value));
}

/** "Thursday, 22 October" */
export function formatLongDate(value: string | Date = new Date()) {
  const parts = longDateFmt.formatToParts(new Date(value));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")}, ${get("day")} ${get("month")}`;
}

/** Calendar date in Kolkata as YYYY-MM-DD (for `date` columns). */
export function isoDate(value: string | Date | number = new Date()) {
  return isoDateFmt.format(new Date(value));
}

/** UTC instant for a Kolkata calendar date + "HH:MM". */
export function istInstant(date: string, time = "00:00") {
  return new Date(`${date}T${time}:00${TZ_OFFSET}`);
}

/** [start, end) of a Kolkata calendar day as ISO strings. */
export function istDayRange(date: string) {
  const start = istInstant(date);
  return [start.toISOString(), new Date(start.getTime() + 864e5).toISOString()] as const;
}

/** "Good morning" / "Good afternoon" / "Good evening" by Kolkata time. */
export function greeting(value: Date = new Date()) {
  const h = Number(hourFmt.format(value));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** Seconds → "18:42" (or "1:02:05" past an hour). */
export function formatCountdown(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${String(m).padStart(2, "0")}:${sec}`;
}

/** Minutes → "1h 15m", "45m", "2h". */
export function formatDuration(minutes: number) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`;
}

// ---- Calendar-date (YYYY-MM-DD) arithmetic, timezone-free ----

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

/** Days since epoch for a YYYY-MM-DD string (UTC-based, so no DST surprises). */
export function dayNumber(iso: string) {
  const { y, m, d } = parts(iso);
  return Math.round(Date.UTC(y, m - 1, d) / 864e5);
}

export function fromDayNumber(n: number) {
  return new Date(n * 864e5).toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number) {
  return fromDayNumber(dayNumber(iso) + n);
}

export function daysBetween(a: string, b: string) {
  return dayNumber(b) - dayNumber(a);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(iso: string) {
  return new Date(dayNumber(iso) * 864e5).getUTCDay();
}

export function isWeekend(iso: string) {
  const d = weekday(iso);
  return d === 0 || d === 6;
}

/** "22 Oct" */
export function shortDate(iso: string) {
  const { m, d } = parts(iso);
  return `${d} ${MON[m - 1]}`;
}

/** "22 Oct 2026" */
export function shortDateYear(iso: string) {
  return `${shortDate(iso)} ${parts(iso).y}`;
}

/** "Mon" */
export function weekdayShort(iso: string) {
  return DOW[weekday(iso)];
}

/** "today", "tomorrow", "yesterday", "in 4d", "3d ago" relative to `today`. */
export function relativeDay(iso: string, today: string) {
  const n = daysBetween(today, iso);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n < 0 ? `${-n}d ago` : `in ${n}d`;
}

/** Length label used in phase editors: "12d" under two weeks, else "5 wk". */
export function lengthLabel(days: number) {
  return days < 14 ? `${Math.round(days)}d` : `${Math.round(days / 7)} wk`;
}
