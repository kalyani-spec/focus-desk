// Row shapes for the tables in supabase/migrations.

export type Theme = "dark" | "light";

export interface Settings {
  id: string;
  focus_minutes: 25 | 50;
  short_break: number;
  long_break: number;
  ask_rating: boolean;
  theme: Theme;
  rounding_minutes: number;
  work_hours_per_day: number;
  leave_allowance_days: number;
  display_name: string | null;
  title: string | null;
}

export interface WorkSession {
  id: string;
  date: string;
  clock_in: string;
  clock_out: string | null;
}

export type ProjectStatus = "on_track" | "at_risk" | "ongoing" | "done";

export interface Project {
  id: string;
  name: string;
  client: string | null;
  color: string;
  status: ProjectStatus;
  start_date: string;
  end_date: string | null;
  is_ongoing: boolean;
  is_internal: boolean;
}

export interface Phase {
  id: string;
  project_id: string;
  name: string;
  start_date: string;
  sort_order: number;
}

export type Priority = "high" | "med" | "low";

export interface Task {
  id: string;
  project_id: string;
  phase_id: string | null;
  title: string;
  notes: string | null;
  priority: Priority;
  estimate_minutes: number | null;
  due_date: string | null;
  scheduled_for: string | null;
  is_major: boolean;
  status: "todo" | "done";
  completed_at: string | null;
  created_at: string;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  sort_order: number;
}

export interface ChecklistItem {
  id: string;
  project_id: string;
  phase_id: string | null;
  label: string;
  is_done: boolean;
  document_id: string | null;
  sort_order: number;
}

export type DocStatus = "missing" | "draft" | "in_review" | "approved";

export interface Doc {
  id: string;
  project_id: string;
  phase_id: string | null;
  name: string;
  status: DocStatus;
  owner: string | null;
  due_date: string | null;
  is_gate: boolean;
  link_url: string | null;
  link_source: string | null;
  file_path: string | null;
}

export interface ProjectDate {
  id: string;
  project_id: string;
  title: string;
  date: string;
  type: "deadline" | "meeting" | "milestone";
}

export interface Holiday {
  id: string;
  title: string;
  from_date: string;
  to_date: string;
  type: "public" | "leave";
  part: "full" | "am" | "pm";
}

export interface TimeEntry {
  id: string;
  project_id: string;
  task_id: string | null;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  source: "pomodoro" | "manual";
  rating: number | null;
  note: string | null;
}

export type TimerMode = "focus" | "short_break" | "long_break";

export interface ActiveTimer {
  id: string;
  task_id: string | null;
  project_id: string;
  mode: TimerMode;
  started_at: string | null;
  ends_at: string | null;
  paused_remaining_seconds: number | null;
  cycle_done: number;
}

export interface Template {
  id: string;
  name: string;
  payload: {
    phases: string[];
    checklist: { phase: number; label: string }[];
    documents: { phase: number; name: string; owner: string; is_gate: boolean }[];
  };
}
