"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Coffee,
  Folders,
  GearSix,
  Moon,
  Sun,
  SunHorizon,
  Table,
  Timer,
  type Icon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useWorkdayOptional } from "@/components/workday/workday-provider";
import { useTimerView } from "@/components/workday/use-timer-view";
import { formatTime } from "@/lib/time";
import type { Theme } from "@/lib/types";
import { cn } from "@/lib/utils";
import { saveTheme } from "./actions";

const NAV: { href: string; label: string; icon: Icon }[] = [
  { href: "/today", label: "Today", icon: SunHorizon },
  { href: "/projects", label: "Projects", icon: Folders },
  { href: "/timesheet", label: "Timesheet", icon: Table },
  { href: "/settings", label: "Settings", icon: GearSix },
];

export function TopBar({ savedTheme, live = false }: { savedTheme?: Theme; live?: boolean }) {
  const pathname = usePathname();
  const workday = useWorkdayOptional();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-7 border-b border-neutral-300 bg-background px-9">
      <Link href="/today" className="flex items-center gap-2.5 text-foreground no-underline">
        <Coffee weight="duotone" className="size-[18px] text-accent-700" />
        <span className="whitespace-nowrap text-sm font-semibold">Focus Desk</span>
      </Link>

      <nav className="flex gap-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 whitespace-nowrap rounded-md px-3 py-1.5 text-sm no-underline transition-colors",
                active ? "bg-accent-100 font-semibold text-accent-700" : "text-neutral-800 hover:bg-neutral-200",
              )}
            >
              <Icon weight="duotone" className="size-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {workday && pathname !== "/today" && <MiniTimer />}

      <div className="ml-auto flex items-center gap-3.5">
        {live && workday && (
          <span className="whitespace-nowrap text-[13px] text-neutral-700">
            {workday.openSession ? `In since ${formatTime(workday.openSession.clock_in)}` : "Clocked out"}
          </span>
        )}
        <ThemeToggle savedTheme={savedTheme} />
      </div>
    </header>
  );
}

/** Live timer pill, shown off the Today screen while a session or break is under way. */
function MiniTimer() {
  const view = useTimerView();
  if (view.phase === "ready" && view.isFocus) return null;

  const label = view.isFocus
    ? `${view.phase === "running" ? "Focusing" : "Paused"} · ${view.sessionNumber}/4`
    : "On a break";

  // Focus mode arrives in Phase 4; until then the pill takes you back to Today.
  return (
    <Link
      href="/today"
      className="flex items-center gap-2.5 rounded-md bg-accent-100 px-3 py-1.5 text-foreground no-underline transition-colors hover:bg-accent-200"
    >
      <span className="flex items-center gap-2 whitespace-nowrap text-xs text-accent-700">
        <Timer weight="duotone" className="size-3.5" />
        {label}
      </span>
      <span className="text-sm font-medium leading-none tabular-nums text-accent-800">{view.timeLabel}</span>
    </Link>
  );
}

function ThemeToggle({ savedTheme }: { savedTheme?: Theme }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [, startTransition] = useTransition();

  // The saved setting wins, so the theme follows you to a new browser.
  useEffect(() => {
    if (savedTheme) setTheme(savedTheme);
  }, [savedTheme, setTheme]);

  // Icons switch in CSS (the theme class is set before paint), so there's no hydration flash.
  return (
    <Button
      variant="secondary"
      size="icon"
      title="Toggle dark mode"
      aria-label="Toggle dark mode"
      onClick={() => {
        const next: Theme = resolvedTheme === "light" ? "dark" : "light";
        setTheme(next);
        startTransition(() => saveTheme(next));
      }}
    >
      <Sun weight="duotone" className="size-3.5 [.light_&]:hidden" />
      <Moon weight="duotone" className="hidden size-3.5 [.light_&]:block" />
    </Button>
  );
}
