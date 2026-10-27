import * as React from "react";
import { cn } from "@/lib/utils";

const TONES = {
  accent: "bg-accent-100 text-accent-800",
  warning: "bg-warning-100 text-warning-800",
  neutral: "bg-neutral-200 text-neutral-800",
  outline: "border border-accent text-accent-700",
} as const;

function Tag({
  tone = "accent",
  className,
  ...props
}: React.ComponentProps<"span"> & { tone?: keyof typeof TONES }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-3 py-[3px] text-xs whitespace-nowrap", TONES[tone], className)}
      {...props}
    />
  );
}

export { Tag };
