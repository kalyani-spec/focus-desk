"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Theme } from "@/lib/types";

export async function saveTheme(theme: Theme) {
  if (theme !== "dark" && theme !== "light") return;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return;
  await supabase.from("settings").update({ theme }).eq("user_id", userId);
  revalidatePath("/", "layout");
}
