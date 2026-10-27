import * as React from "react";
import { cn } from "@/lib/utils";

/** Native select styled like the inputs; reliable keyboard and screen-reader behaviour. */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-10 w-full min-w-0 cursor-pointer rounded-md border border-divider bg-background px-3 text-sm text-foreground outline-none focus-visible:border-accent disabled:opacity-45",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export { NativeSelect };
