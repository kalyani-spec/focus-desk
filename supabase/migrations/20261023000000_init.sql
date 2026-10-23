-- Focus Desk: initial schema.
-- Every table: id, user_id, created_at, deleted_at (soft delete), RLS scoped to auth.uid().
-- Timestamps are stored in UTC (timestamptz); the app displays them in Asia/Kolkata.

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.settings (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at           timestamptz not null default now(),
  deleted_at           timestamptz,
  focus_minutes        int not null default 25 check (focus_minutes in (25, 50)),
  short_break          int not null default 5 check (short_break > 0),
  long_break           int not null default 15 check (long_break > 0),
  ask_rating           boolean not null default true,
  theme                text not null default 'dark' check (theme in ('dark', 'light')),
  rounding_minutes     int not null default 15 check (rounding_minutes > 0),
  work_hours_per_day   numeric(4, 2) not null default 8 check (work_hours_per_day > 0),
  leave_allowance_days numeric(5, 1) not null default 18 check (leave_allowance_days >= 0),
  display_name         text,
  title                text,
  unique (user_id)
);

-- Several per day are allowed; at most one open (no clock_out) at a time.
create table public.work_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  date       date not null,
  clock_in   timestamptz not null,
  clock_out  timestamptz,
  check (clock_out is null or clock_out > clock_in)
);
create unique index work_sessions_one_open
  on public.work_sessions (user_id) where clock_out is null and deleted_at is null;
create index work_sessions_user_date on public.work_sessions (user_id, date);

create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  name        text not null check (length(trim(name)) > 0),
  client      text,
  color       text not null default '#7b7bea',
  status      text not null default 'on_track' check (status in ('on_track', 'at_risk', 'ongoing', 'done')),
  start_date  date not null default current_date,
  end_date    date,
  is_ongoing  boolean not null default false,
  is_internal boolean not null default false,
  check (end_date is null or end_date >= start_date)
);
create unique index projects_unique_name
  on public.projects (user_id, lower(name)) where deleted_at is null;

-- Stable ids: checklist items and documents point at phase_id, never an index.
create table public.phases (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  project_id uuid not null references public.projects (id) on delete cascade,
  name       text not null check (length(trim(name)) > 0),
  start_date date not null,
  sort_order int not null default 0
);
create index phases_project on public.phases (project_id, sort_order);

create table public.tasks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  project_id       uuid not null references public.projects (id) on delete cascade,
  phase_id         uuid references public.phases (id) on delete set null,
  title            text not null check (length(trim(title)) > 0),
  notes            text,
  priority         text not null default 'med' check (priority in ('high', 'med', 'low')),
  estimate_minutes int check (estimate_minutes > 0),
  due_date         date,
  scheduled_for    date,
  is_major         boolean not null default false,
  status           text not null default 'todo' check (status in ('todo', 'done')),
  completed_at     timestamptz
);
create index tasks_user_scheduled on public.tasks (user_id, scheduled_for) where deleted_at is null;
create index tasks_project on public.tasks (project_id);

create table public.subtasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  task_id    uuid not null references public.tasks (id) on delete cascade,
  title      text not null check (length(trim(title)) > 0),
  is_done    boolean not null default false,
  sort_order int not null default 0
);
create index subtasks_task on public.subtasks (task_id, sort_order);

create table public.documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  project_id  uuid not null references public.projects (id) on delete cascade,
  phase_id    uuid references public.phases (id) on delete set null, -- null for ongoing projects (no phases)
  name        text not null check (length(trim(name)) > 0),
  status      text not null default 'missing' check (status in ('missing', 'draft', 'in_review', 'approved')),
  owner       text,
  due_date    date,
  is_gate     boolean not null default false,
  link_url    text,
  link_source text,
  file_path   text -- object path in the private "documents" Storage bucket
);
create index documents_project on public.documents (project_id);

create table public.checklist_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  project_id  uuid not null references public.projects (id) on delete cascade,
  phase_id    uuid references public.phases (id) on delete set null, -- null for ongoing projects (no phases)
  label       text not null check (length(trim(label)) > 0),
  is_done     boolean not null default false,
  document_id uuid references public.documents (id) on delete set null,
  sort_order  int not null default 0
);
create index checklist_items_project on public.checklist_items (project_id, sort_order);

-- Phase starts and holidays are derived, not stored here.
create table public.project_dates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  project_id uuid not null references public.projects (id) on delete cascade,
  title      text not null check (length(trim(title)) > 0),
  date       date not null,
  type       text not null default 'deadline' check (type in ('deadline', 'meeting', 'milestone')),
  reminder   interval -- how long before `date` to remind; null = no reminder
);
create index project_dates_project on public.project_dates (project_id, date);

create table public.holidays (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  title      text not null check (length(trim(title)) > 0),
  from_date  date not null,
  to_date    date not null,
  type       text not null default 'public' check (type in ('public', 'leave')),
  part       text not null default 'full' check (part in ('full', 'am', 'pm')),
  check (to_date >= from_date),
  check (part = 'full' or to_date = from_date)
);
create index holidays_user_dates on public.holidays (user_id, from_date);

create table public.time_entries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  project_id       uuid not null references public.projects (id),
  task_id          uuid references public.tasks (id) on delete set null,
  started_at       timestamptz not null,
  ended_at         timestamptz not null,
  duration_minutes int generated always as
                     (round(extract(epoch from (ended_at - started_at)) / 60)::int) stored,
  source           text not null default 'pomodoro' check (source in ('pomodoro', 'manual')),
  rating           int check (rating between 1 and 5),
  note             text,
  check (ended_at > started_at),
  -- Time entries cannot overlap (soft-deleted ones don't count).
  constraint time_entries_no_overlap exclude using gist (
    user_id with =,
    tstzrange(started_at, ended_at, '[)') with &&
  ) where (deleted_at is null)
);
create index time_entries_user_started on public.time_entries (user_id, started_at);

-- At most one row per user. Remaining time is always derived from ends_at
-- (running) or paused_remaining_seconds (paused).
create table public.active_timer (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at               timestamptz not null default now(),
  deleted_at               timestamptz,
  task_id                  uuid references public.tasks (id) on delete set null,
  project_id               uuid not null references public.projects (id),
  mode                     text not null default 'focus' check (mode in ('focus', 'short_break', 'long_break')),
  started_at               timestamptz, -- when the current focus session began (for its time entry)
  ends_at                  timestamptz,
  paused_remaining_seconds int check (paused_remaining_seconds >= 0),
  cycle_done               int not null default 0 check (cycle_done between 0 and 4),
  unique (user_id)
);

create table public.timesheets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  month         date not null check (extract(day from month) = 1),
  status        text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_at  timestamptz,
  total_minutes int not null default 0,
  unique (user_id, month)
);

create table public.templates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  kind       text not null default 'checklist_doc' check (kind in ('checklist_doc')),
  name       text not null,
  payload    jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- Row level security: every table, scoped to auth.uid()
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'settings', 'work_sessions', 'projects', 'phases', 'tasks', 'subtasks', 'documents',
    'checklist_items', 'project_dates', 'holidays', 'time_entries', 'active_timer',
    'timesheets', 'templates'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create index if not exists %I on public.%I (user_id)', t || '_user_id', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Submitted month lock: time_entries and work_sessions in a submitted month are read-only
-- ---------------------------------------------------------------------------

create or replace function public.month_is_submitted(p_user uuid, p_day date)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.timesheets
    where user_id = p_user
      and month = date_trunc('month', p_day)::date
      and status = 'submitted'
      and deleted_at is null
  );
$$;

create or replace function public.guard_submitted_month()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  old_day date;
  new_day date;
begin
  if tg_table_name = 'time_entries' then
    if tg_op <> 'INSERT' then old_day := (old.started_at at time zone 'Asia/Kolkata')::date; end if;
    if tg_op <> 'DELETE' then new_day := (new.started_at at time zone 'Asia/Kolkata')::date; end if;
  else
    if tg_op <> 'INSERT' then old_day := old.date; end if;
    if tg_op <> 'DELETE' then new_day := new.date; end if;
  end if;

  if (old_day is not null and public.month_is_submitted(old.user_id, old_day))
     or (new_day is not null and public.month_is_submitted(new.user_id, new_day)) then
    raise exception 'This month''s timesheet is submitted, so its % are read-only', replace(tg_table_name, '_', ' ')
      using errcode = 'P0001';
  end if;

  return coalesce(new, old);
end $$;

create trigger time_entries_month_lock
  before insert or update or delete on public.time_entries
  for each row execute function public.guard_submitted_month();

create trigger work_sessions_month_lock
  before insert or update or delete on public.work_sessions
  for each row execute function public.guard_submitted_month();

-- ---------------------------------------------------------------------------
-- Seed data for a new user
-- ---------------------------------------------------------------------------

create or replace function public.seed_user(p_user uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.settings where user_id = p_user) then
    return; -- already seeded
  end if;

  insert into public.settings (user_id, display_name, title)
  values (p_user, 'Kalyani', 'Product Manager');

  insert into public.projects (user_id, name, color, status, start_date, end_date, is_ongoing, is_internal) values
    (p_user, 'FaithFlow',          '#7b7bea', 'on_track', '2026-08-04', '2026-12-12', false, false),
    (p_user, 'Mantralok',          '#5fa3e8', 'at_risk',  '2026-09-01', '2027-01-30', false, false),
    (p_user, 'STAX',               '#a77be6', 'on_track', '2026-07-15', '2026-11-28', false, false),
    (p_user, 'Surviant – General', '#8b8b94', 'ongoing',  '2026-01-01', null,         true,  true);

  insert into public.holidays (user_id, title, from_date, to_date, type, part) values
    (p_user, 'Dussehra',  '2026-10-23', '2026-10-23', 'public', 'full'),
    (p_user, 'Diwali',    '2026-11-09', '2026-11-10', 'public', 'full'),
    (p_user, 'Christmas', '2026-12-25', '2026-12-25', 'public', 'full');

  -- Template phases are positions in the wizard's phase list; they become
  -- real phase_ids when a project is created from the template.
  insert into public.templates (user_id, kind, name, payload) values
    (p_user, 'checklist_doc', 'Client project', jsonb_build_object(
      'phases', jsonb_build_array('Discovery', 'Design', 'Dev', 'QA', 'Handover'),
      'checklist', jsonb_build_array(
        jsonb_build_object('phase', 0, 'label', 'Stakeholder interviews'),
        jsonb_build_object('phase', 0, 'label', 'Scope agreed'),
        jsonb_build_object('phase', 0, 'label', 'Success metrics defined'),
        jsonb_build_object('phase', 1, 'label', 'Wireframes reviewed'),
        jsonb_build_object('phase', 1, 'label', 'Design sign-off'),
        jsonb_build_object('phase', 2, 'label', 'API contract agreed'),
        jsonb_build_object('phase', 2, 'label', 'Feature-complete'),
        jsonb_build_object('phase', 3, 'label', 'Test plan signed off'),
        jsonb_build_object('phase', 3, 'label', 'UAT with client'),
        jsonb_build_object('phase', 4, 'label', 'Handover session'),
        jsonb_build_object('phase', 4, 'label', 'Team training')),
      'documents', jsonb_build_array(
        jsonb_build_object('phase', 0, 'name', 'Scope & SOW',     'owner', 'Kalyani', 'is_gate', true),
        jsonb_build_object('phase', 1, 'name', 'PRD',             'owner', 'Kalyani', 'is_gate', false),
        jsonb_build_object('phase', 1, 'name', 'Design sign-off', 'owner', 'Client',  'is_gate', true),
        jsonb_build_object('phase', 3, 'name', 'UAT sign-off',    'owner', 'Client',  'is_gate', true),
        jsonb_build_object('phase', 4, 'name', 'Handover pack',   'owner', 'Kalyani', 'is_gate', false)))),
    (p_user, 'checklist_doc', 'Internal initiative', jsonb_build_object(
      'phases', jsonb_build_array('Discovery', 'Design', 'Dev', 'QA', 'Handover'),
      'checklist', jsonb_build_array(
        jsonb_build_object('phase', 0, 'label', 'Problem statement'),
        jsonb_build_object('phase', 0, 'label', 'Success metrics'),
        jsonb_build_object('phase', 1, 'label', 'Solution review'),
        jsonb_build_object('phase', 2, 'label', 'Build complete'),
        jsonb_build_object('phase', 3, 'label', 'Internal testing'),
        jsonb_build_object('phase', 4, 'label', 'Rollout announcement')),
      'documents', jsonb_build_array(
        jsonb_build_object('phase', 0, 'name', 'One-pager',   'owner', 'Kalyani', 'is_gate', true),
        jsonb_build_object('phase', 4, 'name', 'Rollout note', 'owner', 'Kalyani', 'is_gate', false))));
end $$;

revoke all on function public.seed_user(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.seed_user(new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Seed anyone who signed up before this migration ran.
select public.seed_user(id) from auth.users;
