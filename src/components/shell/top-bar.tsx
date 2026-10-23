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
import { formatCountdown, formatTime } from "@/lib/time";
import type { ActiveTimer, Theme } from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";
import { saveTheme } from "./actions";

const NAV: { href: string; label: string; icon: Icon }[] = [
  { href: "/today", label: "Today", icon: SunHorizon },
  { href: "/projects", label: "Projects", icon: Folders },
  { href: "/timesheet", label: "Timesheet", icon: Table },
  { href: "/settings", label: "Settings", icon: GearSix },
];

export function TopBar({
  savedTheme,
  clockedInSince = null,
  timer = null,
  live = false,
}: {
  savedTheme?: Theme;
  clockedInSince?: string | null;
  timer?: ActiveTimer | null;
  /** false while the user's data is still loading */
  live?: boolean;
}) {
  const pathname = usePathname();

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
                active
                  ? "bg-accent-100 font-semibold text-accent-700"
                  : "text-neutral-800 hover:bg-neutral-200",
              )}
            >
              <Icon weight="duotone" className="size-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {timer && pathname !== "/today" && <MiniTimer timer={timer} />}

      <div className="ml-auto flex items-center gap-3.5">
        {live && (
          <span className="whitespace-nowrap text-[13px] text-neutral-700">
            {clockedInSince ? `In since ${formatTime(clockedInSince)}` : "Clocked out"}
          </span>
        )}
        <ThemeToggle savedTheme={savedTheme} />
      </div>
    </header>
  );
}

/** Remaining seconds, always derived from ends_at (running) or paused_remaining_seconds. */
function useRemaining(timer: ActiveTimer) {
  const now = useNow();
  if (!timer.ends_at) return timer.paused_remaining_seconds ?? 0;
  if (now === null) return null;
  return Math.max(0, (new Date(timer.ends_at).getTime() - now) / 1000);
}

function MiniTimer({ timer }: { timer: ActiveTimer }) {
  const remaining = useRemaining(timer);
  const focusing = timer.mode === "focus";
  const label = focusing
    ? `${timer.ends_at ? "Focusing" : "Paused"} · ${Math.min(4, timer.cycle_done + 1)}/4`
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
      <span className="text-sm font-medium leading-none tabular-nums text-accent-800">
        {remaining === null ? "–:––" : formatCountdown(remaining)}
      </span>
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
