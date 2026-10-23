import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link landing. Handles both link styles Supabase can send:
 * `?token_hash=…&type=email` (custom email template) and `?code=…` (default PKCE link).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next = nextParam?.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/today";

  const supabase = await createClient();
  let error: { message: string } | null = null;

  if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));
  } else if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else {
    error = { message: searchParams.get("error_description") ?? "the link is incomplete" };
  }

  if (error) {
    const url = new URL("/login", origin);
    url.searchParams.set("error", `That sign-in link didn't work (${error.message}). Request a new one.`);
    return NextResponse.redirect(url);
  }
  return NextResponse.redirect(new URL(next, origin));
}
