"use client";

import { useEffect } from "react";
import { useNow } from "@/lib/use-now";

/**
 * Ticks once a second and hands the time to the provider, which handles a countdown reaching
 * zero. Kept as its own leaf so the per-second re-render stays here.
 */
export function TimerEngine({ onTick }: { onTick: (now: number) => void }) {
  const now = useNow();
  useEffect(() => {
    if (now !== null) onTick(now);
  }, [now, onTick]);
  return null;
}
