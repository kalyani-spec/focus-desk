"use client";

import { useActionState } from "react";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    sendMagicLink,
    initialError ? { status: "error", message: initialError } : { status: "idle" },
  );

  if (state.status === "sent") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <EnvelopeSimple weight="duotone" className="size-8 text-accent-700" />
        <p className="m-0 text-[15px] font-medium">Check your inbox</p>
        <p className="m-0 text-[13px] text-neutral-700">
          We sent a sign-in link to <span className="text-foreground">{state.email}</span>. Open it in
          this browser to continue.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          defaultValue={state.email}
          aria-invalid={state.status === "error" || undefined}
        />
      </div>
      {state.status === "error" && <p className="m-0 text-[13px] text-warning-700">{state.message}</p>}
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
