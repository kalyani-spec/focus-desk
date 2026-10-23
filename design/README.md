# Handoff: Focus Desk (Studio Mono)

## Overview
Focus Desk is a personal work tool for one product manager (Kalyani, Surviant). It combines a Pomodoro focus timer, a daily to-do list grouped by project, a project tracker (custom phases, checklists, documents, important dates), a weekly timesheet built from logged sessions, holidays and leave, and a clock-in/clock-out day summary.

Visual direction is **"Studio Mono"**: dark-first, flat near-black panels with hairline borders, one indigo accent used only where your attention should go (timer ring, primary actions). Calm, Notion-like.

## About the design files
Everything in this bundle is a **design reference built in HTML**: a clickable prototype that shows look and behaviour. It is not production code. Recreate it in the target codebase with that codebase's patterns. If there's no codebase yet, recommended stack:
- **React + TypeScript + Vite**
- Local-first storage (IndexedDB via Dexie), or **Tauri** for a desktop app. Desktop is a good fit because the timer must keep running and notify in the background.

**Primary reference:** `Focus Desk Prototype v3.dc.html`. Open it in a browser (keep `support.js` and `_ds/` beside it). All logic is in the `<script data-dc-script>` block at the bottom:
- Constants and sample data at the top (`PROJECTS`, `PHASES`, `DOC_FLOW`, `NP_TPL`, `LIGHT`/`DARK` palettes)
- Then a `Component` class: `state` holds the full data model, and `renderVals()` plus the `npVals` / `docDlgVals` / `phVals` helpers derive every view.

`Focus Desk Redesign.dc.html` shows the three explored directions. **1c Studio Mono** is the chosen one.

## Fidelity
**High fidelity.** Final colours, type, spacing and interactions. Designed on a 1440×960 desktop canvas; build it fluid (centre content flexible, Today's 3 columns collapse to 2 then 1 below ~1200px / ~860px).

## Global layout
- **Top bar** (64px, sticky, bottom hairline):
  - Left: brand (Phosphor `coffee` duotone + "Focus Desk" 15/600), then nav pills (Today, Projects, Timesheet, Settings; 6×12 padding, radius 8, active = accent-100 bg + accent-700 text)
  - Middle: a compact live mini-timer pill (shown when not on Today; click opens Focus mode)
  - Right: "In since 9:42 AM" and the dark/light toggle
- **Content** below, padding 28px 36px. Screens fade in (opacity 0→1, translateY 6px→0, 0.25s).
- Project detail and other screens span full width. There's no persistent sidebar; projects are reached via Projects.

## Screens

### 1. Today (3 cards)
- **Header:** H1 date "Thursday, 22 October" (22/600). Under it: "Good afternoon, Kalyani · 1h 15m focused across 3 sessions" (14, neutral-700). Clock in/out button on the right.
- **Coming up:** one quiet line, not pills, all 13px text:
  - "Coming up" label (neutral-600)
  - Holiday in holiday-yellow text with a 6px dot ("Dussehra tomorrow")
  - The next 1 item as a plain text button ("PRD review with client · FaithFlow", date in neutral-600; clicking it opens that project's Dates tab)
  - "+3 more" link (accent-700) that expands the rest inline / "Show less"
- **Grid** `0.95fr / 1.2fr / 0.9fr`, gap 16, cards align top:
  1. **Timer card** (min-height 600)
     - Phase label "Focusing · session 3 of 4" with 4 session dots (7px)
     - **Ring** 224px (r 104, stroke 6, track neutral-300, progress = accent with `drop-shadow(0 0 8px rgba(91,91,214,.85))`, 1s linear), with the time inside at 52px/500 tabular
     - A soft radial indigo glow behind the ring (rgba(91,91,214,.22) → 0, 420px)
     - Task title 15/500 and project 13
     - Bottom: primary Play/Pause (flex 1), secondary "Focus mode", icon "End session", and a "Forgot to start? Log time" link
  2. **To-do:** add-task input + project select. Project groups stacked in **one column**, each group a card: 9px swatch + name + "3 open". Rows:
     - Round checkbox, priority dot, title 14px, subtask count, timer icon if current, "major" tag, estimate
     - Done rows get a line-through and fade
     - "+ 2 done" toggle per group
  3. **Session log card:** vertical timeline with a live "now" entry (accent dot with ring), past sessions (range · duration, task, project), and gaps shown as untracked.
- Clicking a task opens the **task detail** (subtasks, notes, "Focus on this").

### 2. Focus mode (full-screen overlay)
- Large countdown (136px), task, project, session dots, subtasks checklist, "Up next" preview, Pause/End. Esc exits.
- Break screen after each session: logged confirmation, 5-min break (15 after the 4th session), optional focus rating, Start next / Skip.

### 3. Projects
- Header with Cards/Timeline segmented control and a **primary "New project"** button.
- **Cards:** status tag, date range, phase line, task progress, checklist ticks, "3/6 docs approved", hours, next date.
- **Timeline:** months across, a bar per project split into its phases (shades cycle through the accent ramp), milestone diamonds, holiday columns, a "today" line. A milestone on a holiday shows "⚠ Phase".

### 4. New project wizard (dialog 760px, 4 steps)
- **Stepper:** 4 equal segments with a 2px top bar (accent when reached), "01 Basics · 02 Phases · 03 Checklist & docs · 04 Review". Completed steps are clickable. The footer has the error message on the left and Back / Continue / **Create project** on the right.
1. **Basics:** name (required, unique), client/team, colour (6 swatches, selected = double ring), start date, target end date, "Ongoing work" switch (no phases).
2. **Phases:**
   - Default 5 phases (Discovery, Design, Dev, QA, Handover), auto-spread at 0 / 15 / 35 / 70 / 90% of the duration and moved off weekends.
   - Editing the start or end re-spreads the phases until the user edits a phase date by hand. "Spread evenly" button.
   - Proportional bar preview. Per row: number chip, name, date input, length (d/wk), and a magenta warning if the date is on a holiday or weekend.
   - Validation: in order, the first phase on or after start, the last before end.
   - Ongoing projects see a short "Ongoing projects skip phases" message instead.
3. **Checklist & docs:**
   - Template cards: Client project (11 checks, 5 docs) / Internal initiative / Start blank.
   - Checklist grouped by phase, with include/exclude checkboxes and an add-item row (text + phase select).
   - Documents with include checkboxes and a **Gate/Optional** pill. Gate means the document must be Approved before its phase can close.
4. **Review:**
   - Summary card: swatch, name, On-track tag, client · range, and a phase bar with names and dates.
   - 3 stat tiles: checklist items, documents, phases.
   - Warnings box (holiday/weekend phase starts, end date on a holiday, no gate docs).
   - "Add a kickoff meeting on <start>" switch.
- **Create** adds the project with tasks 0/0 and hours 0h, then opens its Overview and shows a toast.

### 5. Project detail
- Header: swatch, name, status tag, range · hours. Buttons: Add date, Focus on next task.
- **Phase stepper:** pills, done = solid accent + check, current = accent-100 + ring, future = hollow. It ends in a dashed **"Edit phases"** pill. Ongoing projects get "Add phases" instead.
- Tabs: Overview · Tasks · Checklist · Documents · Dates.
  - **Overview:** current-phase checklist, docs summary, next dates, gate warning.
  - **Checklist:** grouped by the project's own phases, collapsible, add/remove items.
  - **Documents:**
    - Table: Document · Phase · Status (click to cycle Missing→Draft→In review→Approved) · Owner · Due · File/link · remove.
    - Header has a primary **"Add document"** button.
    - File/link cell: if linked, source icon + label (click to edit) + an "open in new tab" icon; if not, a dashed **"Link or attach"** button.
  - **Dates:** month calendar plus list. Phase starts and holidays are auto-derived and read-only.

### 6. Edit phases dialog (680px)
- Proportional phase bar.
- Rows: number chip with a phase-shade inset bar, inline name input (underline on focus), "4 checks · 1 doc" or "New", start date, length, and actions **+ (insert after; date = midpoint to the next)** and **trash** (hidden when only 1 phase left). A holiday/weekend warning appears under the row.
- Footer row: "Add phase at the end", "Project ends" date.
- **Move notes** when removing phases, e.g. "Removing QA moves 3 items to Dev". Removed phases' checklist items and documents go to the nearest earlier surviving phase (or the next one if none).
- "Spread evenly" divides the time equally across N phases.
- Validation: names required, dates strictly ascending, end after the last start.
- Save updates `phases`, `ms`, `start`, `end` and remaps item phase indexes. Toast: "Phases updated · N items moved".

### 7. Add / edit document dialog (540px)
- **Fields:** name; Phase (the project's phases) / Owner / Due in a 3-column row; Status pills.
- **"Where is it?"** pills: Paste a link · Attach a file · Add later.
  - **Link:** URL input. The source is auto-detected: Google Doc, Google Drive, Figma, Notion, Confluence, SharePoint, OneDrive, Loom, otherwise the hostname. The detected source shows with its icon. Bare domains get `https://` added.
  - **File:** dashed drop area wrapping a file input (PDF, DOCX, XLSX, images). Real upload and storage happen in the build; the prototype stores only the name.
  - **Later:** a note that a "Link or attach" button stays in the list.
- **Switch:** "Required to close <phase>" (the gate).
- Validation: name; for links a URL that looks valid; for files, a chosen file; due date.

### 8. Timesheet
- **Week:** projects × Mon–Fri + Total. Today's column is tinted; the holiday column has a 0h target. Footer totals; "Submit week".
- **Day:** a 9–18h timeline of sessions, with gaps of 30 minutes or more shown hatched and a "Log" button.

### 9. Settings
- Timer: 25/50 focus, long break, ask for rating.
- Appearance: Dark (default) / Light.
- Holidays & leave: list, add dialog, balance "x of 18 days".

### Other dialogs
- **Log time:** task, project, from/to. No overlaps; to > from.
- **Clock-out summary:** focused vs clocked time, untracked gaps with "Log" for each.
- **Add date:** title, date, type, reminder, with a holiday warning.
- **Add day off.**
- All dialogs: radius 16, backdrop black 45%, Esc closes. **Toast:** bottom centre, 2.6s.

## Interactions & behaviour
- Timer: store the end timestamp and derive the remaining time (survives reload/sleep). At 0 in focus, log the session and start a break. Ending early logs the actual minutes. System notification at session end.
- Phase progress: the current phase is the last phase whose start ≤ today. A phase can't close while any of its gate docs (`req: true`) isn't Approved. **Use `req` per document; the prototype's QA gate warning is still hard-coded to phase index 3. Generalise it.**
- Milestones on holidays and weekends are flagged everywhere dates are entered.

## Known UX issues to fix during build (priority)
1. Switching task mid-session loses elapsed time. Log it to the old task (or prompt) first.
2. Logged sessions can't be edited. Allow edit, split and delete in the Day view and session log.
3. Checklist vs documents vs dates overlap:
   - Checklist = work items
   - Documents = artefacts with approval status
   - Dates = calendar events
   - Let a checklist item link to a document rather than duplicate it.
4. No undo on delete. Soft-delete with a 5s "Undo" toast for tasks, checklist items, docs, dates, phases and log entries.

See `Focus Desk UX Analysis.dc.html`.

## Data model
```ts
type Priority = 'high' | 'med' | 'low';
interface Task { id; title; project: string; pr: Priority; est: string; due: Date; done: boolean; major?: boolean; notes?: string; subs: { t: string; d: boolean }[] }
interface Project {
  id; name; client?: string; color: string; status: 'On track' | 'At risk' | 'Ongoing';
  start: Date; end: Date;
  phases?: string[];          // custom names; default ['Discovery','Design','Dev','QA','Handover']
  ms: Date[];                 // start date per phase, same length as phases; [] = ongoing
  checklist: { phase: number; t: string; d: boolean; meta: string }[];
  docs: { t: string; phase: number; s: 0 | 1 | 2 | 3; owner: string; due: Date; link: string; url?: string; req?: boolean }[];  // s: Missing/Draft/In review/Approved; link = label or filename; req = gate
  dates: { t: string; date: Date; type: 'deadline' | 'meeting' | 'milestone' }[];  // phase starts + holidays derived
}
interface LogEntry { date; from: 'HH:MM'; to: 'HH:MM'; taskId; projectId; manual?: boolean; rating?: 1 | 2 | 3 | 4 | 5 }
interface Holiday { id; t; from: Date; to: Date; type: 'public' | 'leave'; part: 'Full day' | 'AM half' | 'PM half' }
interface Timer { mode: 'focus' | 'break'; endsAt?: number; pausedRemaining?: number; cycleDone: 0..4; currentTaskId }
interface Prefs { focusLen: 25 | 50; longBreak: number; askRating: boolean; theme: 'dark' | 'light' }
```
Phase indexes in `checklist`/`docs` refer to positions in `phases`. Remap them whenever phases are added or removed (see `phMap` in the prototype). Better: give phases stable ids in the real build.

## Design tokens

**Font:** **Poppins** everywhere (400/500/600; no 700). Sizes:
- 136 Focus mode countdown, 52 Today ring time
- 22 page titles, 18 dialog titles
- 15 card titles, 14 body and task titles, 13 meta, 12 labels and small tags
- Tabular numbers for all times
- No uppercase or letter-spaced eyebrow labels

**Icons:** Phosphor 2.1.1. Duotone for nav and content, regular for small UI controls (+, x, link, check), fill for Play/Pause. Load all three weights.

**Dark (default)**
- bg #0e0e10 · surface/card #141416 · text #ececef · divider #26262b
- neutral 100–900: #141416 #1b1b1f #232327 #2e2e34 #3d3d45 #7a7a83 #8f8f98 #b8b8c0 #ececef
- accent (indigo) base **#5b5bd6**; 100–900: #17172a #20203d #2c2c58 #40408a #5b5bd6 #6e6ee6 #a5a5ff #c9c9ff #e4e4ff
- warning (magenta): 100 #2a141e · 700 #ef8fb6 · 800 #f6b8cf
- holiday: bg #1d1a10 · text #e5cd85
- "shadow-sm" is a hairline: `0 0 0 1px #232327`; lg: `0 24px 60px rgba(0,0,0,.6), 0 0 0 1px #2a2a30`

**Light**
- bg #fafafa · card #ffffff · text #17171a · divider #e6e6ea
- neutral: #fafafa #f1f1f4 #e6e6ea #d4d4da #b4b4bc #76767f #5c5c65 #3c3c44 #1f1f24
- accent 100–900: #f1f1fd #e3e3fa #c9c9f4 #9d9dea #7b7be0 #4b4bc4 #3c3ca8 #2e2e85 #1f1f5c (base #5b5bd6)
- warning 100 #fdf0f5 / 700 #b0185e / 800 #7c1043 · holiday #fbf3d9 / #6e5300
- sm `0 0 0 1px #e6e6ea`

**Text on solid accent is always #fff.**

**Project colours:**
- FaithFlow #7b7bea · Mantralok #5fa3e8 · STAX #a77be6 · Surviant – General #8b8b94
- New-project palette: #4fbf9f #e0a458 #e07b9a #7b7bea #5fa3e8 #a77be6

**Radii:** 6 (small chips), 8 (nav, inputs), 10 (buttons), 12–14 (cards inside dialogs, group cards), 16 (main cards, dialogs), 999 (pills).

**States:**
- Hover: neutral-200 (#1b1b1f)
- Focus-visible: 2px accent outline, offset 2
- Disabled: 45% opacity

## Sample data (replace with real)
- Today = Thu 22 Oct 2026.
- Holidays: Dussehra 23 Oct, Diwali 9–10 Nov, Christmas 25 Dec.
- Leave: 20 Nov, 4 Dec (PM half). Allowance 18 days.
- Projects and milestones are illustrative.

## Files
- `Focus Desk Prototype v3.dc.html`: **the final design** (all screens and flows).
- `Focus Desk Redesign.dc.html`: direction exploration (1c Studio Mono chosen).
- `Focus Desk UX Analysis.dc.html`: UX issues and priorities.
- `Focus Desk Wireframes.dc.html`: early lo-fi (context only).
- `support.js`, `_ds/`: needed to open the .dc.html files in a browser. Note: the visual style is overridden inline by the Studio Mono tokens above; don't use the base stylesheet's serif or cyan.
