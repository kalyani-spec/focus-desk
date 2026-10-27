import { TodayView } from "@/components/today/today-view";
import { createClient } from "@/lib/supabase/server";
import { isoDate, istDayRange } from "@/lib/time";
import type { Subtask, Task } from "@/lib/types";

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const supabase = await createClient();
  const today = isoDate();
  const [dayStart] = istDayRange(today);
  const { focus: focusParam } = await searchParams;
  const focus = focusParam && /^[0-9a-f-]{36}$/i.test(focusParam) ? focusParam : undefined;

  const [settings, tasks] = await Promise.all([
    supabase.from("settings").select("display_name").maybeSingle<{ display_name: string | null }>(),
    // Open tasks scheduled up to today (overdue ones show under "From earlier"),
    // plus anything completed today. A task opened from a project is included too.
    supabase
      .from("tasks")
      .select("*")
      .is("deleted_at", null)
      .or(
        `and(status.eq.todo,scheduled_for.lte.${today}),and(status.eq.done,completed_at.gte.${dayStart})${
          focus ? `,id.eq.${focus}` : ""
        }`,
      )
      .order("created_at")
      .overrideTypes<Task[], { merge: false }>(),
  ]);

  const taskList = tasks.data ?? [];
  const { data: subtasks } = taskList.length
    ? await supabase
        .from("subtasks")
        .select("*")
        .is("deleted_at", null)
        .in(
          "task_id",
          taskList.map((t) => t.id),
        )
        .overrideTypes<Subtask[], { merge: false }>()
    : { data: [] as Subtask[] };

  return (
    <TodayView
      tasks={taskList}
      subtasks={subtasks ?? []}
      name={settings.data?.display_name ?? null}
      focusTaskId={focus}
    />
  );
}
