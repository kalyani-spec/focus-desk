import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-[90px] w-full resize-y rounded-[14px] border border-transparent bg-card px-4 py-3.5 text-sm leading-relaxed text-foreground outline-none placeholder:text-neutral-600 focus-visible:border-accent",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
