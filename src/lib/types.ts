// Row shapes for the tables in supabase/migrations. Only what the app reads so far.

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
