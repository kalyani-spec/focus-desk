"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowsLeftRight, Check, Infinity as InfinityIcon, Warning, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { SwitchRow } from "@/components/ui/switch";
import { Tag } from "@/components/ui/tag";
import { useWorkday } from "@/components/workday/workday-provider";
import {
  DEFAULT_PHASES,
  NEW_PROJECT_COLORS,
  holidayOn,
  offWeekend,
  phaseShade,
  spreadDefault,
  startWarning,
} from "@/lib/projects";
import { createClient } from "@/lib/supabase/client";
import { addDays, daysBetween, lengthLabel, shortDate, shortDateYear } from "@/lib/time";
import { say, sayError } from "@/lib/toast";
import type { Template } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = ["Basics", "Phases", "Checklist & docs", "Review"];

interface CheckRow {
  phase: number;
  label: string;
  on: boolean;
}
interface DocRow {
  phase: number;
  name: string;
  owner: string;
  is_gate: boolean;
  on: boolean;
}
interface Draft {
  name: string;
  client: string;
  color: string;
  start: string;
  end: string;
  ongoing: boolean;
  phases: string[];
  phasesTouched: boolean;
  kickoff: boolean;
  template: string;
  checklist: CheckRow[];
  documents: DocRow[];
  ckDraft: string;
  ckPhase: number;
}

function fromTemplate(t: Template | undefined) {
  return {
    template: t?.id ?? "blank",
    checklist: (t?.payload.checklist ?? []).map((c) => ({ ...c, on: true })),
    documents: (t?.payload.documents ?? []).map((d) => ({ ...d, on: true })),
  };
}

function initialDraft(today: string, templates: Template[]): Draft {
  const start = offWeekend(addDays(today, 1));
  const end = offWeekend(addDays(start, 110));
  return {
    name: "",
    client: "",
    color: NEW_PROJECT_COLORS[0],
    start,
    end,
    ongoing: false,
    phases: spreadDefault(start, end),
    phasesTouched: false,
    kickoff: true,
    ckDraft: "",
    ckPhase: 0,
    ...fromTemplate(templates[0]),
  };
}

/** 4-step New project dialog: Basics · Phases · Checklist & docs · Review. */
export function NewProjectWizard({
  open,
  onClose,
  templates,
  existingNames,
}: {
  open: boolean;
  onClose: () => void;
  templates: Template[];
  existingNames: string[];
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[760px] gap-0 overflow-hidden p-0">
        {open && <Wizard templates={templates} existingNames={existingNames} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function Wizard({
  templates,
  existingNames,
  onClose,
}: {
  templates: Template[];
  existingNames: string[];
  onClose: () => void;
}) {
  const { today, holidays } = useWorkday();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(() => initialDraft(today, templates));
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const patch = (p: Partial<Draft>) => {
    setD((x) => ({ ...x, ...p }));
    setError("");
  };

  const total = Math.max(1, daysBetween(d.start, d.end));
  const phaseRows = DEFAULT_PHASES.map((name, i) => {
    const next = i < 4 ? d.phases[i + 1] : d.end;
    const days = Math.max(0, daysBetween(d.phases[i], next));
    return { name, date: d.phases[i], days, pct: (days / total) * 100, warn: startWarning(d.phases[i], holidays) };
  });

  const warnings = [
    ...(d.ongoing ? [] : phaseRows.filter((r) => r.warn).map((r) => `${r.name}: ${r.warn.toLowerCase()}`)),
    ...(holidayOn(d.end, holidays) ? [`End date falls on ${holidayOn(d.end, holidays)!.title}`] : []),
    ...(d.documents.length && !d.documents.some((x) => x.on && x.is_gate)
      ? ["No gate documents: phases can close without sign-off"]
      : []),
  ];

  const validate = () => {
    if (step === 0) {
      if (!d.name.trim()) return "Give the project a name.";
      if (existingNames.some((n) => n.toLowerCase() === d.name.trim().toLowerCase()))
        return "A project with this name already exists.";
      if (!d.start || !d.end) return "Pick a start and end date.";
      if (d.end <= d.start) return "End date needs to be after the start date.";
    }
    if (step === 1 && !d.ongoing) {
      if (d.phases[0] < d.start) return `${DEFAULT_PHASES[0]} can't start before the project start date.`;
      for (let i = 1; i < 5; i++) {
        if (!d.phases[i] || d.phases[i] <= d.phases[i - 1])
          return `${DEFAULT_PHASES[i]} must start after ${DEFAULT_PHASES[i - 1]}.`;
      }
      if (d.phases[4] >= d.end) return `${DEFAULT_PHASES[4]} must start before the end date.`;
    }
    return "";
  };

  const create = async () => {
    setCreating(true);
    const { data, error: rpcError } = await createClient().rpc("create_project", {
      p: {
        name: d.name.trim(),
        client: d.client.trim(),
        color: d.color,
        start_date: d.start,
        end_date: d.end,
        is_ongoing: d.ongoing,
        kickoff: d.kickoff,
        phases: d.ongoing ? [] : DEFAULT_PHASES.map((name, i) => ({ name, start_date: d.phases[i] })),
        checklist: d.checklist.filter((c) => c.on).map(({ phase, label }) => ({ phase, label })),
        documents: d.documents.filter((x) => x.on).map(({ phase, name, owner, is_gate }) => ({ phase, name, owner, is_gate })),
      },
    });
    setCreating(false);
    if (rpcError) return sayError("Couldn't create the project", rpcError);
    say(`Created ${d.name.trim()}`);
    onClose();
    router.push(`/projects/${data}`);
    router.refresh(); // so the new project shows up in project pickers everywhere
  };

  const next = () => {
    const err = validate();
    if (err) return setError(err);
    if (step === 3) return void create();
    setStep(step + 1);
  };

  const ckOn = d.checklist.filter((c) => c.on).length;
  const docsOn = d.documents.filter((x) => x.on).length;
  const gates = d.documents.filter((x) => x.on && x.is_gate).length;

  return (
    <>
      <div className="flex items-start justify-between gap-4 px-[26px] pt-[22px] pb-4">
        <div className="flex flex-col gap-0.5">
          <DialogTitle>New project</DialogTitle>
          <span className="text-[13px] text-neutral-700">
            Set it up once. Phases, checklist and documents are ready to track from day one.
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid cursor-pointer border-0 bg-transparent p-1 text-neutral-600 hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex gap-2 border-b border-neutral-300 px-[26px] pb-[18px]">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => i < step && (setStep(i), setError(""))}
            className={cn(
              "flex flex-1 items-center gap-2 border-0 border-t-2 bg-transparent pt-2 text-left text-[13px]",
              i <= step ? "border-accent" : "border-neutral-300",
              i === step ? "font-semibold text-foreground" : i < step ? "cursor-pointer text-neutral-800" : "text-neutral-600",
            )}
          >
            <span className="tabular-nums text-neutral-600">0{i + 1}</span>
            {label}
          </button>
        ))}
      </div>

      <div className="box-border max-h-[560px] min-h-[380px] overflow-auto px-[26px] py-[22px]">
        {step === 0 && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Project name" htmlFor="np-name" className="col-span-2">
              <Input
                id="np-name"
                value={d.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="e.g. Temple donations app"
                autoFocus
              />
            </Field>
            <Field label="Client or team" htmlFor="np-client">
              <Input
                id="np-client"
                value={d.client}
                onChange={(e) => patch({ client: e.target.value })}
                placeholder="e.g. Mantralok Trust"
              />
            </Field>
            <Field label="Colour">
              <div className="flex min-h-10 items-center gap-3" role="radiogroup" aria-label="Colour">
                {NEW_PROJECT_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    role="radio"
                    aria-checked={d.color === hex}
                    aria-label={hex}
                    onClick={() => patch({ color: hex })}
                    className="size-[22px] cursor-pointer rounded-full border-0 p-0"
                    style={{
                      background: hex,
                      boxShadow: d.color === hex ? `0 0 0 2px var(--bg), 0 0 0 4px ${hex}` : "none",
                    }}
                  />
                ))}
              </div>
            </Field>
            <Field label="Start date" htmlFor="np-start">
              <Input
                id="np-start"
                type="date"
                value={d.start}
                onChange={(e) => {
                  const v = e.target.value;
                  patch({ start: v, ...(d.phasesTouched || !v || !d.end ? {} : { phases: spreadDefault(v, d.end) }) });
                }}
              />
            </Field>
            <Field label="Target end date" htmlFor="np-end">
              <Input
                id="np-end"
                type="date"
                value={d.end}
                onChange={(e) => {
                  const v = e.target.value;
                  patch({ end: v, ...(d.phasesTouched || !v || !d.start ? {} : { phases: spreadDefault(d.start, v) }) });
                }}
              />
            </Field>
            <div className="col-span-2">
              <SwitchRow
                checked={d.ongoing}
                onCheckedChange={(v) => patch({ ongoing: v })}
                title="Ongoing work"
                hint="No phases. Good for retainers and internal ops."
              />
            </div>
          </div>
        )}

        {step === 1 && d.ongoing && (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 text-center">
            <InfinityIcon weight="duotone" className="size-7 text-accent-700" />
            <span className="text-[15px] font-medium">Ongoing projects skip phases</span>
            <span className="max-w-[360px] text-[13px] text-neutral-700">
              You can still add checklist items and documents in the next step.
            </span>
          </div>
        )}

        {step === 1 && !d.ongoing && (
          <div className="flex flex-col gap-[18px]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">When does each phase start?</span>
                <span className="text-[13px] text-neutral-700">
                  {lengthLabel(total)} ({shortDate(d.start)} – {shortDateYear(d.end)}). Edit any date.
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => patch({ phases: spreadDefault(d.start, d.end), phasesTouched: false })}
              >
                <ArrowsLeftRight className="size-3.5" />
                Spread evenly
              </Button>
            </div>
            <PhaseBar rows={phaseRows} />
            <div className="flex flex-col">
              {phaseRows.map((r, i) => (
                <div
                  key={r.name}
                  className="grid grid-cols-[26px_110px_170px_64px_minmax(0,1fr)] items-center gap-3 border-b border-neutral-300 py-2"
                >
                  <PhaseChip n={i + 1} shade={phaseShade(i)} />
                  <span className="text-sm font-medium">{r.name}</span>
                  <Input
                    type="date"
                    aria-label={`${r.name} start`}
                    value={r.date}
                    onChange={(e) => {
                      const phases = [...d.phases];
                      phases[i] = e.target.value;
                      patch({ phases, phasesTouched: true });
                    }}
                    className="h-[34px] rounded-lg px-2.5 text-[13px]"
                  />
                  <span className="text-[13px] text-neutral-700">{lengthLabel(r.days)}</span>
                  <span className="text-[13px] text-warning-700">{r.warn}</span>
                </div>
              ))}
            </div>
            <span className="text-[13px] text-neutral-700">Project ends {shortDateYear(d.end)}</span>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Start from a template</span>
              <div className="grid grid-cols-3 gap-2">
                {[...templates, undefined].map((t) => {
                  const id = t?.id ?? "blank";
                  const active = d.template === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => patch(fromTemplate(t))}
                      className={cn(
                        "flex cursor-pointer flex-col items-start gap-0.5 rounded-[10px] border px-3.5 py-2.5 text-left",
                        active ? "border-accent bg-accent text-white" : "border-divider bg-transparent text-foreground",
                      )}
                    >
                      <span className="text-[13px] font-medium">{t?.name ?? "Start blank"}</span>
                      <span className={cn("text-xs", active ? "text-white/80" : "text-neutral-700")}>
                        {t
                          ? `${t.payload.checklist.length} checks · ${t.payload.documents.length} docs`
                          : "Add your own later"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="flex min-w-0 flex-col gap-2.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold">Checklist</span>
                  <span className="text-xs text-neutral-600">
                    {ckOn} of {d.checklist.length}
                  </span>
                </div>
                {(d.ongoing ? ["Checklist"] : DEFAULT_PHASES).map((phaseName, phase) => {
                  const items = d.checklist
                    .map((c, i) => ({ c, i }))
                    .filter(({ c }) => (d.ongoing ? true : c.phase === phase));
                  if (!items.length) return null;
                  return (
                    <div key={phaseName} className="flex flex-col">
                      {!d.ongoing && <span className="py-1 text-xs text-neutral-600">{phaseName}</span>}
                      {items.map(({ c, i }) => (
                        <ToggleRow
                          key={i}
                          on={c.on}
                          onToggle={() =>
                            patch({ checklist: d.checklist.map((x, j) => (j === i ? { ...x, on: !x.on } : x)) })
                          }
                        >
                          <span className="text-[13px]">{c.label}</span>
                        </ToggleRow>
                      ))}
                    </div>
                  );
                })}
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const label = d.ckDraft.trim();
                    if (!label) return;
                    patch({ checklist: [...d.checklist, { phase: d.ckPhase, label, on: true }], ckDraft: "" });
                  }}
                >
                  <Input
                    value={d.ckDraft}
                    onChange={(e) => patch({ ckDraft: e.target.value })}
                    placeholder="Add an item"
                    aria-label="Add a checklist item"
                    className="h-[34px] rounded-lg text-[13px]"
                  />
                  {!d.ongoing && (
                    <NativeSelect
                      value={d.ckPhase}
                      onChange={(e) => patch({ ckPhase: Number(e.target.value) })}
                      aria-label="Phase"
                      className="h-[34px] w-[110px] rounded-lg text-[13px]"
                    >
                      {DEFAULT_PHASES.map((n, i) => (
                        <option key={n} value={i}>
                          {n}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </form>
              </div>

              <div className="flex min-w-0 flex-col gap-2.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold">Documents</span>
                  <span className="text-xs text-neutral-600">
                    {docsOn} · {gates} gate
                  </span>
                </div>
                <span className="text-xs text-neutral-700">
                  A gate document must be approved before its phase can close. Links can be added later from the
                  project.
                </span>
                {d.documents.map((x, i) => (
                  <ToggleRow
                    key={i}
                    on={x.on}
                    onToggle={() => patch({ documents: d.documents.map((y, j) => (j === i ? { ...y, on: !y.on } : y)) })}
                    trailing={
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          patch({ documents: d.documents.map((y, j) => (j === i ? { ...y, is_gate: !y.is_gate } : y)) });
                        }}
                        className={cn(
                          "cursor-pointer rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap",
                          x.is_gate
                            ? "border-accent-300 bg-accent-100 text-accent-700"
                            : "border-neutral-300 bg-transparent text-neutral-700",
                        )}
                      >
                        {x.is_gate ? "Gate" : "Optional"}
                      </button>
                    }
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[13px]">{x.name}</span>
                      <span className="text-xs text-neutral-600">
                        {d.ongoing ? "" : `${DEFAULT_PHASES[x.phase]} · `}
                        {x.owner}
                      </span>
                    </span>
                  </ToggleRow>
                ))}
                {!d.documents.length && <span className="text-[13px] text-neutral-600">No documents yet.</span>}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-[18px]">
            <div className="flex flex-col gap-3.5 rounded-xl bg-card p-[18px] shadow-hairline">
              <div className="flex items-center gap-2.5">
                <span className="size-2.5 rounded-[3px]" style={{ background: d.color }} />
                <span className="text-[17px] font-semibold">{d.name}</span>
                <Tag tone={d.ongoing ? "neutral" : "accent"} className="ml-auto">
                  {d.ongoing ? "Ongoing" : "On track"}
                </Tag>
              </div>
              <span className="text-[13px] text-neutral-700">
                {[d.client.trim(), d.ongoing ? `Ongoing from ${shortDate(d.start)}` : `${shortDate(d.start)} – ${shortDateYear(d.end)}`]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {!d.ongoing && (
                <div className="flex gap-0.5">
                  {phaseRows.map((r, i) => (
                    <div key={r.name} className="flex min-w-0 flex-col gap-1.5" style={{ width: `${r.pct}%` }}>
                      <span className="h-2 rounded-sm" style={{ background: phaseShade(i) }} />
                      <span className="truncate text-xs">{r.name}</span>
                      <span className="text-[11px] whitespace-nowrap text-neutral-600">{shortDate(r.date)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  [ckOn, "checklist items"],
                  [docsOn, docsOn === 1 ? "document" : "documents"],
                  [d.ongoing ? "—" : 5, "phases"],
                ] as const
              ).map(([n, l]) => (
                <div key={l} className="flex flex-col gap-0.5 rounded-xl px-4 py-3.5 shadow-hairline">
                  <span className="text-xl font-semibold">{n}</span>
                  <span className="text-[13px] text-neutral-700">{l}</span>
                </div>
              ))}
            </div>
            {warnings.length > 0 && (
              <div className="flex flex-col gap-1.5 rounded-xl bg-warning-100 px-3.5 py-3">
                {warnings.map((w) => (
                  <span key={w} className="flex items-center gap-2 text-[13px] text-warning-800">
                    <Warning weight="duotone" className="size-3.5" />
                    {w}
                  </span>
                ))}
              </div>
            )}
            <SwitchRow
              checked={d.kickoff}
              onCheckedChange={(v) => patch({ kickoff: v })}
              title={`Add a kickoff meeting on ${shortDate(d.start)}`}
              hint="Shows up in Dates and on Today when it's close."
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2.5 border-t border-neutral-300 px-[26px] py-4">
        {error && (
          <span className="flex items-center gap-2 text-[13px] text-warning-700">
            <Warning weight="duotone" className="size-3.5" />
            {error}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          {step > 0 && (
            <Button variant="secondary" onClick={() => (setStep(step - 1), setError(""))}>
              Back
            </Button>
          )}
          <Button variant="primary" onClick={next} disabled={creating}>
            {step === 3 ? (creating ? "Creating…" : "Create project") : "Continue"}
          </Button>
        </div>
      </div>
    </>
  );
}

export function PhaseBar({ rows }: { rows: { pct: number }[] }) {
  return (
    <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
      {rows.map((r, i) => (
        <span key={i} style={{ width: `${r.pct}%`, background: phaseShade(i) }} />
      ))}
    </div>
  );
}

export function PhaseChip({ n, shade }: { n: number; shade: string }) {
  return (
    <span
      className="grid size-[22px] place-items-center rounded-md bg-neutral-200 text-xs"
      style={{ boxShadow: `inset 3px 0 0 ${shade}` }}
    >
      {n}
    </span>
  );
}

function ToggleRow({
  on,
  onToggle,
  trailing,
  children,
}: {
  on: boolean;
  onToggle: () => void;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      role="checkbox"
      aria-checked={on}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-[5px] outline-none hover:bg-neutral-200 focus-visible:bg-neutral-200",
        !on && "opacity-45",
      )}
    >
      <span
        className={cn(
          "box-border grid size-[15px] shrink-0 place-items-center rounded border-[1.5px]",
          on ? "border-accent bg-accent" : "border-neutral-500 bg-transparent",
        )}
      >
        <Check weight="bold" className={cn("size-2.5 text-white", on ? "opacity-100" : "opacity-0")} />
      </span>
      {children}
      {trailing}
    </div>
  );
}
