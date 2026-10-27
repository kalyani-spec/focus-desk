"use client";

import { useState } from "react";
import { Scissors, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { useWorkday, type Entry } from "@/components/workday/workday-provider";
import { findGaps } from "@/lib/gaps";
import { formatDuration, formatTime, hhmm, isoDate, istInstant } from "@/lib/time";
import { say } from "@/lib/toast";

export type SessionDialogState =
  | { kind: "new"; from?: number; to?: number }
  | { kind: "edit"; entry: Entry }
  | null;

/** "Log time" (new manual entry) and "Edit session" (edit, split, delete) in one dialog. */
export function SessionDialog({ state, onClose }: { state: SessionDialogState; onClose: () => void }) {
  return (
    <Dialog open={Boolean(state)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[460px]">
        {state && (
          <SessionForm key={state.kind === "edit" ? state.entry.id : `new-${state.from ?? ""}`} state={state} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SessionForm({ state, onClose }: { state: NonNullable<SessionDialogState>; onClose: () => void }) {
  const { projects, today, entries, currentTask, addEntry, updateEntry, splitEntry, deleteEntry } = useWorkday();
  const editing = state.kind === "edit" ? state.entry : null;
  const date = editing ? isoDate(editing.started_at) : today;
  const [now] = useState(() => Date.now());

  const [what, setWhat] = useState(editing ? (editing.note ?? editing.task?.title ?? "") : "");
  const [projectId, setProjectId] = useState(
    editing?.project_id ?? currentTask?.project_id ?? projects.find((p) => p.status !== "done")?.id ?? "",
  );
  const [from, setFrom] = useState(
    editing ? hhmm(editing.started_at) : hhmm(state.kind === "new" && state.from ? state.from : now - 30 * 60000),
  );
  const [to, setTo] = useState(
    editing ? hhmm(editing.ended_at) : hhmm(state.kind === "new" && state.to ? state.to : now),
  );
  const [splitAt, setSplitAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const others = entries.filter((e) => e.id !== editing?.id);
  const gaps = editing ? [] : findGaps(entries);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing && !what.trim()) return setError("Add a short description so it reads well on the timesheet.");
    if (!from || !to || to <= from) return setError("“To” needs to be after “From”.");
    const start = istInstant(date, from);
    const end = istInstant(date, to);
    const clash = others.find(
      (o) => new Date(o.started_at).getTime() < end.getTime() && new Date(o.ended_at).getTime() > start.getTime(),
    );
    if (clash) {
      return setError(
        `That overlaps ${formatTime(clash.started_at)} – ${formatTime(clash.ended_at)}. Sessions can't overlap.`,
      );
    }
    setSaving(true);
    const text = what.trim();
    const note = text && text !== editing?.task?.title ? text : null;
    const ok = editing
      ? await updateEntry(editing.id, {
          project_id: projectId,
          started_at: start.toISOString(),
          ended_at: end.toISOString(),
          note,
        })
      : await addEntry({
          project_id: projectId,
          task_id: null,
          started_at: start.toISOString(),
          ended_at: end.toISOString(),
          source: "manual",
          note,
        });
    setSaving(false);
    if (!ok) return;
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    say(
      editing
        ? "Session updated"
        : `Logged ${formatDuration(minutes)} to ${projects.find((p) => p.id === projectId)?.name ?? "the project"}`,
    );
    onClose();
  };

  const quick: [string, number, number][] = editing
    ? []
    : [
        ["Last 15 min", now - 15 * 60000, now],
        ["Last 30 min", now - 30 * 60000, now],
        ...gaps.map((g) => [`Gap ${formatTime(g.from)} – ${formatTime(g.to)}`, g.from, g.to] as [string, number, number]),
      ];

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <DialogTitle>{editing ? "Edit session" : "Log time"}</DialogTitle>
      <div className="flex flex-col gap-3.5">
        <Field label="What did you work on?" htmlFor="s-what">
          <Input
            id="s-what"
            value={what}
            onChange={(e) => {
              setWhat(e.target.value);
              setError("");
            }}
            placeholder="e.g. Stakeholder call"
            autoFocus={!editing}
          />
        </Field>
        <Field label="Project" htmlFor="s-project">
          <NativeSelect id="s-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects
              .filter((p) => p.status !== "done" || p.id === projectId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </NativeSelect>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From" htmlFor="s-from">
            <Input
              id="s-from"
              type="time"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setError("");
              }}
            />
          </Field>
          <Field label="To" htmlFor="s-to">
            <Input
              id="s-to"
              type="time"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setError("");
              }}
            />
          </Field>
        </div>
        {quick.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {quick.map(([label, f, t]) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setFrom(hhmm(f));
                  setTo(hhmm(t));
                  setError("");
                }}
                className="cursor-pointer rounded-full border border-divider bg-transparent px-3 py-1 text-[13px] text-accent-700 hover:border-accent"
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {editing && splitAt !== null && (
          <div className="flex items-end gap-2 rounded-xl bg-neutral-200 p-3">
            <Field label="Split at" htmlFor="s-split" className="flex-1">
              <Input id="s-split" type="time" value={splitAt} onChange={(e) => setSplitAt(e.target.value)} />
            </Field>
            <Button
              type="button"
              variant="primary"
              onClick={async () => {
                if (await splitEntry(editing.id, istInstant(date, splitAt).toISOString())) onClose();
              }}
            >
              Split
            </Button>
          </div>
        )}
        {error && <span className="text-[13px] text-warning-700">{error}</span>}
      </div>
      <DialogActions className="justify-between">
        <div className="flex gap-1">
          {editing && (
            <>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                title="Delete session"
                aria-label="Delete session"
                className="size-9 hover:text-warning-700"
                onClick={() => {
                  onClose();
                  void deleteEntry(editing.id);
                }}
              >
                <Trash weight="duotone" className="size-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                title="Split session"
                aria-label="Split session"
                className="size-9"
                onClick={() => {
                  const mid = (new Date(editing.started_at).getTime() + new Date(editing.ended_at).getTime()) / 2;
                  setSplitAt((s) => (s === null ? hhmm(mid) : null));
                }}
              >
                <Scissors weight="duotone" className="size-4" />
              </Button>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {editing ? "Save" : "Add to log"}
          </Button>
        </div>
      </DialogActions>
    </form>
  );
}
