import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-md border border-divider bg-transparent px-3 text-sm text-foreground outline-none transition-colors placeholder:text-neutral-600 focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-warning-700",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
