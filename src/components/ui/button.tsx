import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent font-medium transition-colors disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-accent-600 active:bg-accent-700",
        secondary: "border-divider bg-transparent hover:bg-neutral-200 active:bg-neutral-300",
        ghost: "bg-transparent text-accent-700 hover:bg-accent-100",
        link: "h-auto border-0 bg-transparent p-0 text-accent-700 hover:underline",
      },
      size: {
        default: "h-9 px-4 text-sm",
        sm: "h-8 px-3 text-[13px]",
        lg: "h-10 px-[18px] text-sm",
        icon: "size-[34px] p-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
