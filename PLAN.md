# Focus Desk – Build Plan (v2, aligned to Claude Design handoff)

Personal work tool for Kalyani. Single user, laptop browser, logs internal hours that are
submitted monthly to Surviant.

The UI source of truth is `design/Focus Desk Prototype v3.dc.html`, plus `design/README.md`
for tokens, screens and behaviour. This plan decides the stack, data, scope and build order,
and it wins wherever it differs from the design README.

## Decisions that override the design README
- **Stack:** Next.js (App Router, TypeScript) + Tailwind + shadcn/ui + Supabase (Postgres, auth,
  Storage), hosted on Vercel. This replaces the README's Vite/Dexie/Tauri suggestion: the data
  must live in a real database and survive browser resets.
- **Timesheet is submitted monthly**, not weekly. Week and Day views stay as working views.
  "Submit week" is removed; a Month view with "Submit month" (locks the month) and PDF/CSV export
  is added.
- **Phases get stable ids.** Checklist items and documents reference `phase_id`, never an index.
- **The four high-severity UX issues in the README are built in from the start**, not fixed later:
  task switch logs elapsed time first; sessions are editable, splittable and deletable;
  checklist items can link to a document; every delete is a soft delete with a 5s Undo toast.
- **Gate logic is generic:** any document with `is_gate = true` blocks closing its phase until it
  is Approved. Nothing is hard-coded to QA.

## Look and feel
Studio Mono, as in `design/README.md`: dark default plus light theme, Poppins (400/500/600),
Phosphor 2.1.1 icons (duotone, regular and fill), and the token values exactly as listed.
Define the tokens as CSS variables and map them into the Tailwind and shadcn theme. Don't use the
`_ds/` base stylesheet's serif font or cyan colour.

## Database (Supabase / Postgres)
Every table has `id uuid`, `user_id`, `created_at`, `deleted_at` (soft delete) and RLS scoped
to `auth.uid()`.

```
settings        focus_minutes (25|50), short_break (5), long_break (15), ask_rating,
                theme (dark|light), rounding_minutes (15), work_hours_per_day (8),
                leave_allowance_days (18), display_name, title

work_sessions   date, clock_in, clock_out?          -- several per day allowed

projects        name (unique), client, color, status (on_track|at_risk|ongoing|done),
                start_date, end_date?, is_ongoing, is_internal

phases          project_id, name, start_date, sort_order

tasks           project_id, phase_id?, title, notes, priority (high|med|low),
                estimate_minutes?, due_date?, scheduled_for?, is_major, status (todo|done),
                completed_at?
subtasks        task_id, title, is_done, sort_order

checklist_items project_id, phase_id, label, is_done, document_id?, sort_order

documents       project_id, phase_id, name, status (missing|draft|in_review|approved),
                owner, due_date, is_gate, link_url?, link_source?, file_path?   -- Storage, private bucket

project_dates   project_id, title, date, type (deadline|meeting|milestone), reminder?
                -- phase starts and holidays are derived, not stored here

holidays        title, from_date, to_date, type (public|leave), part (full|am|pm)

time_entries    project_id, task_id?, started_at, ended_at, duration_minutes,
                source (pomodoro|manual), rating (1-5)?, note

active_timer    task_id?, project_id, mode (focus|short_break|long_break),
                ends_at?, paused_remaining_seconds?, cycle_done (0-4)   -- max one row

timesheets      month (first day), status (draft|submitted), submitted_at, total_minutes
templates       kind (checklist_doc), name, payload jsonb   -- seed "Client project", "Internal initiative"
```
Seed data: the projects FaithFlow, Mantralok, STAX and "Surviant – General" (`is_internal`), the
2026 public holidays from the design README, and the two templates.

## Behaviour rules
- **Timer:** store `ends_at` and derive the remaining time, so the timer survives refresh and
  sleep. At 0 in focus mode: write the time entry, ask for a rating if enabled, then start the
  break (long break after the 4th session). Ending early logs the actual minutes; sessions
  under 2 min are discarded. Send a system notification plus a sound at session end, and show the
  countdown in the tab title.
- **Task switch mid-session:** ask "Log 12m to <task> and switch?" with the default being to log it.
- **Time entries cannot overlap.** Manual entries need `to > from`.
- **Clocking:** starting a timer while clocked out offers to clock in. Clocking out shows the
  summary (focused vs clocked time, untracked gaps of 30 min or more, each with a "Log" button). If
  a work session is still open the next morning, ask when you finished, defaulting to the last
  activity.
- **Today:** tasks where `scheduled_for <= today` and not done; overdue ones go in "From earlier".
- **Holidays** drive the timesheet targets (0h, or half a day for half days), timeline shading
  and the warnings in every date picker.
- **Submitted month:** its time entries and work sessions are read-only.
- **Times:** stored in UTC, displayed in Asia/Kolkata.

## Build phases (stop after each one for review)
**Phase 0 – Setup.** Repo, Supabase, magic-link login, RLS, migrations, seed data, design tokens,
themes, app shell (top bar, nav, mini timer pill, dark/light toggle), deploy to Vercel.
*Done when:* I can log in on the live URL and see the empty shell in both themes.

**Phase 1 – Usable day one.**
- Today screen: header, Clock In/Out with the clock-out summary, the timer card with ring,
  persistence, notifications and inline break, the to-do column with quick-add and project groups
  (projects at name + colour only for now), task detail with subtasks and notes, and the session log.
- Session editing (edit, split, delete with undo), "Log time" dialog, task-switch prompt.

*Done when:* I run a real workday in it and nothing is lost after a refresh.

**Phase 2 – Projects.** Projects cards view, the 4-step New project wizard with templates, phases,
the Edit phases dialog (with move notes), project detail with the Overview, Tasks and Checklist tabs.

**Phase 3 – Timesheet and time off.** Holidays and leave in Settings (with the balance). Timesheet
Day, Week and Month views, with gaps and targets. Submit month and lock, PDF export (header with
name and title) and CSV export.
*Done when:* last month exports as a clean PDF I could send to Surviant.

**Phase 4 – Documents, dates and polish.**
- Documents tab: status cycle, gate rule, link detection, file upload to Storage.
- Dates tab: calendar and list.
- Projects Timeline view, the "Coming up" line on Today, full-screen Focus mode, "Add date" dialog.

## Later
Checklist-item reminders, weekly planned-vs-actual review, focus stats, desktop wrapper (Tauri)
for background notifications.
