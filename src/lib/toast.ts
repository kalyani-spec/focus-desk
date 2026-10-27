"use client";

import { toast } from "sonner";

/** Plain confirmation toast (2.6s). */
export function say(message: string) {
  toast(message);
}

/** Error toast with the database's message when it is a readable one. */
export function sayError(prefix: string, error?: { message?: string } | null) {
  const msg = error?.message ?? "";
  if (msg.includes("time_entries_no_overlap")) {
    toast.error(`${prefix}: it overlaps another session.`);
  } else if (msg.includes("projects_unique_name")) {
    toast.error(`${prefix}: a project with this name already exists.`);
  } else if (msg) {
    toast.error(`${prefix}: ${msg}`);
  } else {
    toast.error(prefix);
  }
}

/** Soft-delete confirmation with a 5s Undo. */
export function sayUndo(message: string, undo: () => void) {
  toast(message, { duration: 5000, action: { label: "Undo", onClick: undo } });
}
