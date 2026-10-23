import { Suspense } from "react";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/shell/top-bar";
import { createClient } from "@/lib/supabase/server";
import type { ActiveTimer, Settings, WorkSession } from "@/lib/types";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      {/* The bar's frame renders instantly; clock status and the mini timer stream in. */}
      <Suspense fallback={<TopBar />}>
        <LiveTopBar />
      </Suspense>
      <Suspense fallback={null}>{children}</Suspense>
    </div>
  );
}

async function LiveTopBar() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  const [settings, openSession, timer] = await Promise.all([
    supabase.from("settings").select("theme").is("deleted_at", null).maybeSingle<Pick<Settings, "theme">>(),
    supabase
      .from("work_sessions")
      .select("id, date, clock_in, clock_out")
      .is("clock_out", null)
      .is("deleted_at", null)
      .maybeSingle<WorkSession>(),
    supabase.from("active_timer").select("*").is("deleted_at", null).maybeSingle<ActiveTimer>(),
  ]);

  return (
    <TopBar
      savedTheme={settings.data?.theme ?? "dark"}
      clockedInSince={openSession.data?.clock_in ?? null}
      timer={timer.data ?? null}
      live
    />
  );
}
