import { Suspense } from "react";
import { Coffee } from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6 animate-screen-in">
      <Card className="flex w-full max-w-[380px] flex-col gap-6 p-7">
        <div className="flex items-center gap-2.5">
          <Coffee weight="duotone" className="size-[18px] text-accent-700" />
          <span className="text-[15px] font-semibold">Focus Desk</span>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[22px] font-semibold">Sign in</h1>
          <p className="m-0 text-[13px] text-neutral-700">We&apos;ll email you a one-time link. No password.</p>
        </div>
        <Suspense fallback={<LoginForm />}>
          <LoginFormWithError searchParams={searchParams} />
        </Suspense>
      </Card>
    </main>
  );
}

async function LoginFormWithError({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <LoginForm initialError={error} />;
}
