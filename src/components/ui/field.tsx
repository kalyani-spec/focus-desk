import * as React from "react";
import { cn } from "@/lib/utils";

/** Label above a control, as in the design's dialogs. */
function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-[5px]", className)}>
      <label htmlFor={htmlFor} className="text-xs text-neutral-700">
        {label}
      </label>
      {children}
    </div>
  );
}

export { Field };
