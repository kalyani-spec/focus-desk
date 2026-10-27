"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative inline-flex h-5 w-[34px] shrink-0 cursor-pointer items-center rounded-full bg-neutral-400 transition-colors data-[state=checked]:bg-accent disabled:opacity-45",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white transition-transform data-[state=checked]:translate-x-4" />
    </SwitchPrimitive.Root>
  );
}

/** The design's bordered switch row: switch + title + hint, the whole row clickable. */
function SwitchRow({
  checked,
  onCheckedChange,
  title,
  hint,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  title: React.ReactNode;
  hint?: React.ReactNode;
}) {
  const id = React.useId();
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-3.5 rounded-xl border border-neutral-300 px-3.5 py-3"
    >
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        {hint && <span className="text-[13px] text-neutral-700">{hint}</span>}
      </span>
    </label>
  );
}

export { Switch, SwitchRow };
