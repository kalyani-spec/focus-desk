export const GAP_MINUTES = 30;

interface Span {
  started_at: string;
  ended_at: string;
}

export interface Gap {
  from: number;
  to: number;
  minutes: number;
}

/**
 * Untracked stretches of GAP_MINUTES or more between entries, optionally also before the first
 * entry (from `windowStart`, e.g. clock-in) and after the last (until `windowEnd`).
 */
export function findGaps(entries: Span[], windowStart?: number, windowEnd?: number): Gap[] {
  const spans = entries
    .map((e) => [new Date(e.started_at).getTime(), new Date(e.ended_at).getTime()] as const)
    .sort((a, b) => a[0] - b[0]);
  const gaps: Gap[] = [];
  let cursor = windowStart ?? spans[0]?.[0];
  if (cursor === undefined) {
    if (windowStart !== undefined && windowEnd !== undefined) push(windowStart, windowEnd);
    return gaps;
  }
  for (const [s, f] of spans) {
    if (windowEnd !== undefined && s >= windowEnd) break;
    if (s > cursor) push(cursor, s);
    cursor = Math.max(cursor, f);
  }
  if (windowEnd !== undefined && windowEnd > cursor) push(cursor, windowEnd);
  return gaps;

  function push(from: number, to: number) {
    const minutes = Math.round((to - from) / 60000);
    if (minutes >= GAP_MINUTES) gaps.push({ from, to, minutes });
  }
}
