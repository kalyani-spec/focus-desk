import { SunHorizon } from "@phosphor-icons/react/dist/ssr";
import { EmptyState, PageHeader, Screen } from "@/components/shell/page-header";
import { createClient } from "@/lib/supabase/server";
import { formatLongDate, greeting } from "@/lib/time";

export default async function TodayPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("settings")
    .select("display_name")
    .maybeSingle<{ display_name: string | null }>();
  const name = settings?.display_name;

  return (
    <Screen>
      <PageHeader title={formatLongDate()} subtitle={name ? `${greeting()}, ${name}` : greeting()} />
      <EmptyState
        icon={<SunHorizon weight="duotone" className="size-7" />}
        title="Your day starts here"
        body="The timer, to-do list and session log arrive in Phase 1."
      />
    </Screen>
  );
}
