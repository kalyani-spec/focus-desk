import { Suspense } from "react";
import { redirect } from "next/navigation";
import { TopBar, TopBarFallback } from "@/components/shell/top-bar";
import { TabTitle } from "@/components/workday/use-timer-view";
import { WorkdayProvider, type CurrentTask, type Entry } from "@/components/workday/workday-provider";
import { createClient } from "@/lib/supabase/server";
import { addDays, isoDate, istDayRange } from "@/lib/time";
import type { ActiveTimer, Holiday, Project, Settings, WorkSession } from "@/lib/types";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      {/* The bar's frame renders instantly; the user's day streams in. */}
      <Suspense fallback={<TopBarFallback />}>
        <Workday>{children}</Workday>
      </Suspense>
    </div>
  );
}

const DEFAULT_SETTINGS: Settings = {
  id: "",
  focus_minutes: 25,
  short_break: 5,
  long_break: 15,
  ask_rating: true,
  theme: "dark",
  rounding_minutes: 15,
  work_hours_per_day: 8,
  leave_allowance_days: 18,
  display_name: null,
  title: null,
};

async function Workday({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  const today = isoDate();
  const [dayStart, dayEnd] = istDayRange(today);

  const [settings, projects, timer, sessions, entries, holidays] = await Promise.all([
    supabase.from("settings").select("*").is("deleted_at", null).maybeSingle<Settings>(),
    supabase.from("projects").select("*").is("deleted_at", null).order("created_at").overrideTypes<Project[], { merge: false }>(),
    supabase.from("active_timer").select("*").is("deleted_at", null).maybeSingle<ActiveTimer>(),
    supabase
      .from("work_sessions")
      .select("id, date, clock_in, clock_out")
      .is("deleted_at", null)
      .or(`date.eq.${today},clock_out.is.null`)
      .order("clock_in")
      .overrideTypes<WorkSession[], { merge: false }>(),
    supabase
      .from("time_entries")
      .select("*, task:tasks(title)")
      .is("deleted_at", null)
      .gte("started_at", dayStart)
      .lt("started_at", dayEnd)
      .order("started_at", { ascending: false })
      .overrideTypes<Entry[], { merge: false }>(),
    supabase
      .from("holidays")
      .select("*")
      .is("deleted_at", null)
      .gte("to_date", addDays(today, -400))
      .order("from_date")
      .overrideTypes<Holiday[], { merge: false }>(),
  ]);

  let currentTask: CurrentTask | null = null;
  if (timer.data?.task_id) {
    const { data } = await supabase
      .from("tasks")
      .select("id, title, project_id")
      .eq("id", timer.data.task_id)
      .is("deleted_at", null)
      .maybeSingle<CurrentTask>();
    currentTask = data;
  }

  return (
    <WorkdayProvider
      init={{
        userId: String(auth.claims.sub),
        today,
        settings: settings.data ?? DEFAULT_SETTINGS,
        projects: projects.data ?? [],
        timer: timer.data ?? null,
        currentTask,
        sessions: sessions.data ?? [],
        entries: entries.data ?? [],
        holidays: holidays.data ?? [],
      }}
    >
      <TabTitle />
      <TopBar savedTheme={settings.data?.theme ?? "dark"} live />
      <Suspense fallback={null}>{children}</Suspense>
    </WorkdayProvider>
  );
}
