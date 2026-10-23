"use client";

import { useSyncExternalStore } from "react";

// One shared 1-second clock for every countdown on the page.
let now = Date.now();
let interval: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!interval) {
    now = Date.now();
    interval = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
    queueMicrotask(listener);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(interval);
      interval = undefined;
    }
  };
}

/** Current time in ms, ticking every second. `null` during server render and hydration. */
export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => null,
  );
}
