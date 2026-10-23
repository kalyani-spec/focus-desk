import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { PageHeader, Screen } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { signOut } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const email = typeof auth?.claims?.email === "string" ? auth.claims.email : null;

  return (
    <Screen>
      <PageHeader title="Settings" />
      <Card className="flex max-w-xl items-center justify-between gap-6 p-6">
        <div className="flex flex-col gap-0.5">
          <CardTitle>Account</CardTitle>
          <span className="text-[13px] text-neutral-700">
            Signed in as {email ?? "you"}. Timer, appearance and holiday settings arrive in later phases.
          </span>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="secondary">
            <SignOut weight="regular" className="size-4" />
            Sign out
          </Button>
        </form>
      </Card>
    </Screen>
  );
}
