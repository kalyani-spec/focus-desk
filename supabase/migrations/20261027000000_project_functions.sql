-- Atomic project operations used by the New project wizard and the Edit phases dialog.
-- Both run as the caller (security invoker), so RLS still scopes every row to auth.uid().

-- Creates a project with its phases, checklist, documents and optional kickoff date.
-- p: { name, client, color, start_date, end_date, is_ongoing, kickoff,
--      phases: [{ name, start_date }],
--      checklist: [{ phase, label }],             -- phase = index into phases
--      documents: [{ phase, name, owner, is_gate }] }
create or replace function public.create_project(p jsonb)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_project   uuid;
  v_phase_ids uuid[] := '{}';
  v_new_phase uuid;
  v_phase     jsonb;
  v_item      jsonb;
  v_idx       int;
  v_n         int;
  v_end       date := nullif(p->>'end_date', '')::date;
  v_ongoing   boolean := coalesce((p->>'is_ongoing')::boolean, false);
  v_due       date;
begin
  insert into public.projects (name, client, color, status, start_date, end_date, is_ongoing)
  values (
    trim(p->>'name'),
    nullif(trim(coalesce(p->>'client', '')), ''),
    coalesce(p->>'color', '#7b7bea'),
    case when v_ongoing then 'ongoing' else 'on_track' end,
    (p->>'start_date')::date,
    v_end,
    v_ongoing
  )
  returning id into v_project;

  if not v_ongoing then
    v_idx := 0;
    for v_phase in select * from jsonb_array_elements(coalesce(p->'phases', '[]'::jsonb)) loop
      insert into public.phases (project_id, name, start_date, sort_order)
      values (v_project, trim(v_phase->>'name'), (v_phase->>'start_date')::date, v_idx)
      returning id into v_new_phase;
      v_phase_ids := v_phase_ids || v_new_phase;
      v_idx := v_idx + 1;
    end loop;
  end if;
  v_n := coalesce(array_length(v_phase_ids, 1), 0);

  v_idx := 0;
  for v_item in select * from jsonb_array_elements(coalesce(p->'checklist', '[]'::jsonb)) loop
    insert into public.checklist_items (project_id, phase_id, label, sort_order)
    values (
      v_project,
      case when v_n > 0 then v_phase_ids[least(coalesce((v_item->>'phase')::int, 0), v_n - 1) + 1] end,
      trim(v_item->>'label'),
      v_idx
    );
    v_idx := v_idx + 1;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p->'documents', '[]'::jsonb)) loop
    -- Due when the next phase starts (or at the project end).
    v_due := v_end;
    if v_n > 0 and coalesce((v_item->>'phase')::int, 0) + 1 < v_n then
      select start_date into v_due from public.phases
      where id = v_phase_ids[coalesce((v_item->>'phase')::int, 0) + 2];
    end if;
    insert into public.documents (project_id, phase_id, name, owner, due_date, is_gate)
    values (
      v_project,
      case when v_n > 0 then v_phase_ids[least(coalesce((v_item->>'phase')::int, 0), v_n - 1) + 1] end,
      trim(v_item->>'name'),
      nullif(trim(coalesce(v_item->>'owner', '')), ''),
      v_due,
      coalesce((v_item->>'is_gate')::boolean, false)
    );
  end loop;

  if coalesce((p->>'kickoff')::boolean, false) then
    insert into public.project_dates (project_id, title, date, type)
    values (v_project, 'Kickoff', (p->>'start_date')::date, 'meeting');
  end if;

  return v_project;
end $$;

-- Replaces a project's phases. Existing phases keep their ids; removed phases are soft-deleted
-- and their checklist items, documents and tasks move to the nearest earlier surviving phase
-- (or the next one if none). Items with no phase (ongoing projects) go to the first phase.
-- p_phases: [{ id?: uuid, name, start_date }] in order. Returns how many items moved.
create or replace function public.save_phases(p_project uuid, p_phases jsonb, p_end date)
returns int
language plpgsql security invoker set search_path = ''
as $$
declare
  v_row     jsonb;
  v_idx     int := 0;
  v_prev    date;
  v_kept    uuid[] := '{}';
  v_old     record;
  v_target  uuid;
  v_first   uuid;
  v_moved   int := 0;
  v_n       int;
begin
  if not exists (select 1 from public.projects where id = p_project and deleted_at is null) then
    raise exception 'Project not found';
  end if;
  if jsonb_array_length(coalesce(p_phases, '[]'::jsonb)) = 0 then
    raise exception 'Keep at least one phase.';
  end if;

  -- Validate order: names required, dates strictly ascending, end after the last start.
  for v_row in select * from jsonb_array_elements(p_phases) loop
    if length(trim(coalesce(v_row->>'name', ''))) = 0 then
      raise exception 'Every phase needs a name.';
    end if;
    if v_prev is not null and (v_row->>'start_date')::date <= v_prev then
      raise exception '% must start after the phase before it.', trim(v_row->>'name');
    end if;
    v_prev := (v_row->>'start_date')::date;
  end loop;
  if p_end is null or p_end <= v_prev then
    raise exception 'The project has to end after the last phase starts.';
  end if;

  -- Snapshot the current order before anything moves.
  create temp table if not exists _old_phases (id uuid, ord int) on commit drop;
  delete from _old_phases;
  insert into _old_phases
    select id, sort_order from public.phases where project_id = p_project and deleted_at is null;

  -- Upsert the phases in order.
  for v_row in select * from jsonb_array_elements(p_phases) loop
    if nullif(v_row->>'id', '') is not null then
      update public.phases
         set name = trim(v_row->>'name'), start_date = (v_row->>'start_date')::date, sort_order = v_idx
       where id = (v_row->>'id')::uuid and project_id = p_project and deleted_at is null;
      v_kept := v_kept || (v_row->>'id')::uuid;
    else
      insert into public.phases (project_id, name, start_date, sort_order)
      values (p_project, trim(v_row->>'name'), (v_row->>'start_date')::date, v_idx)
      returning id into v_target;
      v_kept := v_kept || v_target;
    end if;
    v_idx := v_idx + 1;
  end loop;
  v_first := v_kept[1];

  -- Re-home items from removed phases: nearest earlier surviving phase, else the next one.
  for v_old in select id, ord from _old_phases where not (id = any (v_kept)) loop
    v_target := null;
    select id into v_target from _old_phases
     where id = any (v_kept) and ord < v_old.ord order by ord desc limit 1;
    if v_target is null then
      select id into v_target from _old_phases
       where id = any (v_kept) and ord > v_old.ord order by ord asc limit 1;
    end if;
    v_target := coalesce(v_target, v_first);

    update public.checklist_items set phase_id = v_target where phase_id = v_old.id and deleted_at is null;
    get diagnostics v_n = row_count; v_moved := v_moved + v_n;
    update public.documents set phase_id = v_target where phase_id = v_old.id and deleted_at is null;
    get diagnostics v_n = row_count; v_moved := v_moved + v_n;
    update public.tasks set phase_id = v_target where phase_id = v_old.id;

    update public.phases set deleted_at = now() where id = v_old.id;
  end loop;

  -- Ongoing projects gaining phases: unphased items go to the first phase.
  update public.checklist_items set phase_id = v_first
   where project_id = p_project and phase_id is null and deleted_at is null;
  update public.documents set phase_id = v_first
   where project_id = p_project and phase_id is null and deleted_at is null;

  update public.projects
     set start_date = (p_phases->0->>'start_date')::date,
         end_date   = p_end,
         is_ongoing = false,
         status     = case when status = 'ongoing' then 'on_track' else status end
   where id = p_project;

  return v_moved;
end $$;

grant execute on function public.create_project(jsonb) to authenticated;
grant execute on function public.save_phases(uuid, jsonb, date) to authenticated;
