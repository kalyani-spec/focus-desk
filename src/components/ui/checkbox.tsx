"use client";

import * as React from "react";
import { Check } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/** Round completion check used on task rows. */
function RoundCheck({
  checked,
  onToggle,
  label = "Complete",
  className,
}: {
  checked: boolean;
  onToggle: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "grid size-[19px] shrink-0 cursor-pointer place-items-center rounded-full border-[1.5px] p-0 text-white transition-colors",
        checked ? "border-accent bg-accent" : "border-neutral-500 bg-transparent hover:border-accent-600",
        className,
      )}
    >
      <Check weight="bold" className={cn("size-[11px]", checked ? "opacity-100" : "opacity-0")} />
    </button>
  );
}

/** Square checkbox (checklists, subtasks). Native input so labels and keyboard just work. */
function Checkbox({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      className={cn("size-4 shrink-0 cursor-pointer accent-[var(--a)]", className)}
      {...props}
    />
  );
}

export { RoundCheck, Checkbox };
