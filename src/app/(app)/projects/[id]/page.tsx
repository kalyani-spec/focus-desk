import { notFound } from "next/navigation";
import { ProjectDetail } from "@/components/projects/project-detail";
import { createClient } from "@/lib/supabase/server";
import type { ChecklistItem, Doc, Phase, Project, ProjectDate, Subtask, Task } from "@/lib/types";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();

  const [project, phases, tasks, checklist, docs, dates, entries] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).is("deleted_at", null).maybeSingle<Project>(),
    supabase.from("phases").select("*").eq("project_id", id).is("deleted_at", null).order("sort_order").overrideTypes<Phase[], { merge: false }>(),
    supabase.from("tasks").select("*").eq("project_id", id).is("deleted_at", null).order("created_at").overrideTypes<Task[], { merge: false }>(),
    supabase.from("checklist_items").select("*").eq("project_id", id).is("deleted_at", null).order("sort_order").overrideTypes<ChecklistItem[], { merge: false }>(),
    supabase.from("documents").select("*").eq("project_id", id).is("deleted_at", null).order("created_at").overrideTypes<Doc[], { merge: false }>(),
    supabase.from("project_dates").select("*").eq("project_id", id).is("deleted_at", null).order("date").overrideTypes<ProjectDate[], { merge: false }>(),
    supabase.from("time_entries").select("duration_minutes").eq("project_id", id).is("deleted_at", null),
  ]);
  if (!project.data) notFound();

  const taskIds = (tasks.data ?? []).map((t) => t.id);
  const { data: subtasks } = taskIds.length
    ? await supabase.from("subtasks").select("*").in("task_id", taskIds).is("deleted_at", null).overrideTypes<Subtask[], { merge: false }>()
    : { data: [] as Subtask[] };

  return (
    <ProjectDetail
      key={project.data.id}
      project={project.data}
      phases={phases.data ?? []}
      tasks={tasks.data ?? []}
      subtasks={subtasks ?? []}
      checklist={checklist.data ?? []}
      documents={docs.data ?? []}
      dates={dates.data ?? []}
      minutes={((entries.data ?? []) as { duration_minutes: number }[]).reduce((s, e) => s + e.duration_minutes, 0)}
    />
  );
}
