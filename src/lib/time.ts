/** Timestamps are stored in UTC and always displayed in Asia/Kolkata. */
export const TZ = "Asia/Kolkata";

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
const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", hourCycle: "h23" });

/** "9:42 AM" */
export function formatTime(value: string | Date) {
  return timeFmt.format(new Date(value)).toUpperCase();
}

/** "Thursday, 22 October" */
export function formatLongDate(value: string | Date = new Date()) {
  const parts = longDateFmt.formatToParts(new Date(value));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")}, ${get("day")} ${get("month")}`;
}

/** Calendar date in Kolkata as YYYY-MM-DD (for `date` columns). */
export function isoDate(value: string | Date = new Date()) {
  return isoDateFmt.format(new Date(value));
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
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
