# CLAUDE.md

Project: Focus Desk, a personal Pomodoro, to-do, project and timesheet tool.

- Read PLAN.md first. It defines stack, data model, rules and phase order, and it wins over
  design/README.md wherever the two differ.
- UI must match design/Focus Desk Prototype v3.dc.html and the tokens in design/README.md
  (Studio Mono, Poppins, Phosphor icons, dark default + light). Rebuild it as real Next.js +
  shadcn/ui components; don't paste the prototype's HTML or its inline script.
- To view the prototype, open the .dc.html file in a browser with support.js and _ds/ beside it.
- Single user, laptop-first. No teams or multi-user features.
- Stack: Next.js App Router + TypeScript, Tailwind, shadcn/ui, Supabase. No other backend.
- All schema changes go through migrations in /supabase/migrations. RLS is on for every table,
  scoped to auth.uid().
- Soft delete everywhere (deleted_at) with a 5s Undo toast.
- Timer state always derives from active_timer.ends_at; it must survive a refresh.
- Never edit or delete time_entries or work_sessions in a month whose timesheet is submitted.
- Store timestamps in UTC; display them in Asia/Kolkata.
- Build one phase at a time. At the end of each phase, stop, summarise what was built, list how
  to test it, and wait for my go-ahead.
- If the design and PLAN.md disagree on a feature that isn't covered in PLAN.md's
  "Decisions" section, ask me instead of choosing.
