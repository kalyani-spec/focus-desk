import { ProjectsView, type ProjectSummary } from "@/components/projects/projects-view";
import { createClient } from "@/lib/supabase/server";
import { isoDate } from "@/lib/time";
import type { Phase, Project, Template } from "@/lib/types";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const today = isoDate();

  const [projects, phases, tasks, checklist, docs, dates, entries, templates] = await Promise.all([
    supabase.from("projects").select("*").is("deleted_at", null).order("created_at").overrideTypes<Project[], { merge: false }>(),
    supabase.from("phases").select("*").is("deleted_at", null).order("sort_order").overrideTypes<Phase[], { merge: false }>(),
    supabase.from("tasks").select("project_id, status").is("deleted_at", null),
    supabase.from("checklist_items").select("project_id, is_done, sort_order").is("deleted_at", null).order("sort_order"),
    supabase.from("documents").select("project_id, status").is("deleted_at", null),
    supabase.from("project_dates").select("project_id, title, date").is("deleted_at", null).gte("date", today).order("date"),
    supabase.from("time_entries").select("project_id, duration_minutes").is("deleted_at", null),
    supabase.from("templates").select("id, name, payload").is("deleted_at", null).order("created_at").overrideTypes<Template[], { merge: false }>(),
  ]);

  const by = <T extends { project_id: string }>(rows: T[] | null, id: string) => (rows ?? []).filter((r) => r.project_id === id);

  const summaries: ProjectSummary[] = (projects.data ?? []).map((p) => {
    const ph = by(phases.data, p.id);
    const t = by(tasks.data as { project_id: string; status: string }[] | null, p.id);
    const ck = by(checklist.data as { project_id: string; is_done: boolean }[] | null, p.id);
    const dc = by(docs.data as { project_id: string; status: string }[] | null, p.id);
    const upcoming = [
      ...by(dates.data as { project_id: string; title: string; date: string }[] | null, p.id).map((d) => ({ date: d.date, title: d.title })),
      ...ph.filter((x) => x.start_date >= today).map((x) => ({ date: x.start_date, title: `${x.name} starts` })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    return {
      project: p,
      phases: ph,
      tasksDone: t.filter((x) => x.status === "done").length,
      tasksTotal: t.length,
      checklist: ck.map((c) => c.is_done),
      docsApproved: dc.filter((d) => d.status === "approved").length,
      docsTotal: dc.length,
      minutes: by(entries.data as { project_id: string; duration_minutes: number }[] | null, p.id).reduce(
        (s, e) => s + e.duration_minutes,
        0,
      ),
      nextDate: upcoming[0] ?? null,
    };
  });

  return <ProjectsView summaries={summaries} templates={templates.data ?? []} />;
}
