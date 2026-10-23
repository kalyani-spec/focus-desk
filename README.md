# Focus Desk

Personal Pomodoro, to-do, project and timesheet tool. Single user, laptop browser.

- Plan, data model and build phases: [`PLAN.md`](PLAN.md)
- Working rules: [`CLAUDE.md`](CLAUDE.md)
- Design reference: [`design/`](design) (open `Focus Desk Prototype v3.dc.html` in a browser)

Stack: Next.js 16 (App Router, TypeScript), Tailwind 4, shadcn/ui-style components, Supabase
(Postgres, magic-link auth, Storage), hosted on Vercel.

## One-time setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com/dashboard) (region: Mumbai).
2. Apply the migrations in `supabase/migrations/`. Either:
   - **SQL editor:** paste each file in order and run it, or
   - **CLI:** `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`.
3. **Authentication → URL Configuration**
   - Site URL: your Vercel URL, e.g. `https://focus-desk.vercel.app`
   - Redirect URLs: `https://focus-desk.vercel.app/auth/confirm` and `http://localhost:3000/auth/confirm`
4. Sign in once (below). Your settings, the four starter projects, the 2026 public holidays and
   the two checklist templates are seeded automatically for your account. Then turn off
   **Authentication → Sign In / Providers → Allow new users to sign up**, so nobody else can
   create an account.

### 2. Local

```bash
cp .env.example .env.local   # fill in the Supabase URL, publishable key and your email
npm install
npm run dev                  # http://localhost:3000
```

### 3. Vercel

1. [vercel.com/new](https://vercel.com/new) → import `kalyani-spec/focus-desk`.
2. Add the variables from `.env.example` under **Environment Variables**.
3. Deploy. Every push to `main` redeploys.

## Commands

```bash
npm run dev     # dev server
npm run build   # production build
npm run lint    # ESLint
npx tsc --noEmit
```

## Conventions

- Schema changes only through new files in `supabase/migrations/`. RLS on every table, scoped
  to `auth.uid()`.
- Soft delete (`deleted_at`) everywhere, with a 5s Undo toast.
- Timestamps stored in UTC, shown in Asia/Kolkata (`src/lib/time.ts`).
- Design tokens live in `src/app/globals.css` as CSS variables (dark default, `.light` override)
  and map to Tailwind classes such as `bg-neutral-200`, `text-accent-700`, `bg-warning-100`.
