"use client";

import { useState } from "react";
import { ArrowBendDownRight, ArrowsLeftRight, Plus, Trash, Warning } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useWorkday } from "@/components/workday/workday-provider";
import { DEFAULT_PHASES, midpoint, phaseShade, spreadDefault, spreadEvenly, startWarning } from "@/lib/projects";
import { createClient } from "@/lib/supabase/client";
import { addDays, daysBetween, lengthLabel } from "@/lib/time";
import { say, sayError } from "@/lib/toast";
import type { ChecklistItem, Doc, Phase, Project } from "@/lib/types";
import { PhaseBar, PhaseChip } from "./new-project-wizard";

interface Row {
  key: string;
  id: string | null; // null = new phase
  name: string;
  date: string;
}

/** Rename, reschedule, add or remove phases; removed phases' items move to a surviving phase. */
export function EditPhasesDialog({
  open,
  onClose,
  project,
  phases,
  checklist,
  documents,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  project: Project;
  phases: Phase[];
  checklist: ChecklistItem[];
  documents: Doc[];
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[680px]">
        {open && (
          <Editor
            project={project}
            phases={phases}
            checklist={checklist}
            documents={documents}
            onClose={onClose}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

let keySeq = 0;
const newKey = () => `n${++keySeq}`;

function Editor({
  project,
  phases,
  checklist,
  documents,
  onClose,
  onSaved,
}: {
  project: Project;
  phases: Phase[];
  checklist: ChecklistItem[];
  documents: Doc[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { holidays } = useWorkday();
  const adding = phases.length === 0;
  const [end, setEnd] = useState(project.end_date ?? addDays(project.start_date, 90));
  const [rows, setRows] = useState<Row[]>(() =>
    adding
      ? spreadDefault(project.start_date, project.end_date ?? addDays(project.start_date, 90)).map((date, i) => ({
          key: newKey(),
          id: null,
          name: DEFAULT_PHASES[i],
          date,
        }))
      : phases.map((p) => ({ key: p.id, id: p.id, name: p.name, date: p.start_date })),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (next: Row[]) => {
    setRows(next);
    setError("");
  };

  const start = rows[0]?.date ?? project.start_date;
  const total = Math.max(1, daysBetween(start, end));
  const view = rows.map((r, i) => {
    const next = i < rows.length - 1 ? rows[i + 1].date : end;
    const days = r.date && next ? Math.max(0, daysBetween(r.date, next)) : 0;
    const nCk = checklist.filter((c) => c.phase_id === r.id).length;
    const nDoc = documents.filter((d) => d.phase_id === r.id).length;
    const counts = r.id ? `${nCk} check${nCk === 1 ? "" : "s"} · ${nDoc} doc${nDoc === 1 ? "" : "s"}` : "New";
    return { ...r, next, days, pct: (days / total) * 100, warn: startWarning(r.date, holidays), meta: counts };
  });

  // Where each removed phase's items will go: nearest earlier surviving phase, else the next one.
  const notes = phases.flatMap((p, oldIdx) => {
    if (rows.some((r) => r.id === p.id)) return [];
    const n = checklist.filter((c) => c.phase_id === p.id).length + documents.filter((d) => d.phase_id === p.id).length;
    if (!n) return [];
    const surviving = phases
      .map((q, i) => ({ q, i }))
      .filter(({ q }) => rows.some((r) => r.id === q.id));
    const target =
      [...surviving].reverse().find(({ i }) => i < oldIdx) ?? surviving.find(({ i }) => i > oldIdx) ?? null;
    const targetName = target ? rows.find((r) => r.id === target.q.id)?.name : rows[0]?.name;
    return [`Removing ${p.name} moves ${n} item${n > 1 ? "s" : ""} to ${targetName ?? "the first phase"}`];
  });
  if (adding) {
    const n = checklist.length + documents.length;
    if (n) notes.push(`${n} existing item${n > 1 ? "s" : ""} will go to ${rows[0]?.name ?? "the first phase"}`);
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rows.length < 1) return setError("Keep at least one phase.");
    if (rows.some((r) => !r.name.trim())) return setError("Every phase needs a name.");
    for (let i = 0; i < rows.length; i++) {
      if (!rows[i].date) return setError(`Pick a start date for ${rows[i].name}.`);
      if (i && rows[i].date <= rows[i - 1].date) return setError(`${rows[i].name} must start after ${rows[i - 1].name}.`);
    }
    if (!end || end <= rows[rows.length - 1].date) return setError("The project has to end after the last phase starts.");

    setSaving(true);
    const { data, error: rpcError } = await createClient().rpc("save_phases", {
      p_project: project.id,
      p_phases: rows.map((r) => ({ id: r.id, name: r.name.trim(), start_date: r.date })),
      p_end: end,
    });
    setSaving(false);
    if (rpcError) return sayError("Couldn't save the phases", rpcError);
    const moved = Number(data) || 0;
    say(`Phases updated${moved ? ` · ${moved} item${moved > 1 ? "s" : ""} moved` : ""}`);
    onSaved();
    onClose();
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <DialogTitle>{adding ? "Add phases" : "Edit phases"}</DialogTitle>
          <span className="text-[13px] text-neutral-700">{project.name} · rename, reschedule, add or remove phases</span>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            const dates = spreadEvenly(start, end, rows.length);
            update(rows.map((r, i) => ({ ...r, date: dates[i] })));
          }}
        >
          <ArrowsLeftRight className="size-3.5" />
          Spread evenly
        </Button>
      </div>

      <div className="flex flex-col gap-3.5">
        <PhaseBar rows={view} />
        <div className="flex max-h-[380px] flex-col overflow-auto">
          <div className="grid grid-cols-[24px_minmax(0,1fr)_160px_56px_64px] gap-2.5 pb-1.5 text-xs text-neutral-600">
            <span />
            <span>Phase</span>
            <span>Starts</span>
            <span>Length</span>
            <span />
          </div>
          {view.map((r, i) => (
            <div key={r.key} className="flex flex-col gap-1 border-t border-neutral-300 py-2">
              <div className="grid grid-cols-[24px_minmax(0,1fr)_160px_56px_64px] items-center gap-2.5">
                <PhaseChip n={i + 1} shade={phaseShade(i)} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <input
                    value={r.name}
                    aria-label={`Phase ${i + 1} name`}
                    onChange={(e) => update(rows.map((x) => (x.key === r.key ? { ...x, name: e.target.value } : x)))}
                    className="border-0 border-b border-transparent bg-transparent px-0 py-0.5 text-sm font-medium text-foreground outline-none focus:border-accent"
                  />
                  <span className="text-xs text-neutral-600">{r.meta}</span>
                </div>
                <Input
                  type="date"
                  aria-label={`${r.name} start`}
                  value={r.date}
                  onChange={(e) => update(rows.map((x) => (x.key === r.key ? { ...x, date: e.target.value } : x)))}
                  className="h-[34px] rounded-lg px-2.5 text-[13px]"
                />
                <span className="text-[13px] text-neutral-700">{lengthLabel(r.days)}</span>
                <div className="flex justify-end gap-0.5">
                  <IconButton
                    title="Add a phase after this"
                    onClick={() => {
                      const copy = [...rows];
                      copy.splice(i + 1, 0, { key: newKey(), id: null, name: "New phase", date: midpoint(r.date, r.next) });
                      update(copy);
                    }}
                  >
                    <Plus className="size-3.5" />
                  </IconButton>
                  {rows.length > 1 && (
                    <IconButton title="Remove phase" danger onClick={() => update(rows.filter((x) => x.key !== r.key))}>
                      <Trash className="size-3.5" />
                    </IconButton>
                  )}
                </div>
              </div>
              {r.warn && (
                <span className="flex items-center gap-1.5 pl-[34px] text-xs text-warning-700">
                  <Warning weight="duotone" className="size-[13px]" />
                  {r.warn}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-neutral-300 pt-1">
          <button
            type="button"
            onClick={() => {
              const last = rows[rows.length - 1];
              update([...rows, { key: newKey(), id: null, name: "New phase", date: last ? midpoint(last.date, end) : start }]);
            }}
            className="flex cursor-pointer items-center gap-1.5 border-0 bg-transparent px-0 py-1.5 text-[13px] text-accent-700"
          >
            <Plus className="size-3.5" />
            Add phase at the end
          </button>
          <label className="flex items-center gap-2.5 text-[13px] text-neutral-700">
            Project ends
            <Input
              type="date"
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                setError("");
              }}
              className="h-[34px] w-[160px] rounded-lg px-2.5 text-[13px]"
            />
          </label>
        </div>
        {notes.length > 0 && (
          <div className="flex flex-col gap-1 rounded-[10px] bg-neutral-200 px-3.5 py-2.5">
            {notes.map((n) => (
              <span key={n} className="flex items-center gap-2 text-[13px] text-neutral-800">
                <ArrowBendDownRight weight="duotone" className="size-3.5" />
                {n}
              </span>
            ))}
          </div>
        )}
        {error && (
          <span className="flex items-center gap-2 text-[13px] text-warning-700">
            <Warning weight="duotone" className="size-3.5" />
            {error}
          </span>
        )}
      </div>

      <DialogActions>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Saving…" : "Save phases"}
        </Button>
      </DialogActions>
    </form>
  );
}

function IconButton({
  title,
  danger,
  onClick,
  children,
}: {
  title: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`grid cursor-pointer rounded-md border-0 bg-transparent p-1.5 text-neutral-600 hover:bg-neutral-200 ${
        danger ? "hover:text-warning-700" : "hover:text-accent-700"
      }`}
    >
      {children}
    </button>
  );
}
