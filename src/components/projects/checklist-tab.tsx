"use client";

import { useCallback, useState } from "react";
import { CaretDown, CaretRight, FileText, LinkSimple, Plus, X } from "@phosphor-icons/react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tag } from "@/components/ui/tag";
import { createClient } from "@/lib/supabase/client";
import { sayError, sayUndo } from "@/lib/toast";
import { useLatest } from "@/lib/use-latest";
import type { ChecklistItem, Doc, Phase } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Checklist state with optimistic writes and soft delete + undo. */
export function useChecklist(initial: ChecklistItem[]) {
  const supabase = createClient();
  const [items, setItems] = useState(initial);
  const itemsRef = useLatest(items);

  const patchItem = useCallback(
    async (id: string, patch: Partial<ChecklistItem>) => {
      const before = itemsRef.current.find((c) => c.id === id);
      if (!before) return;
      setItems((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      const { error } = await supabase.from("checklist_items").update(patch).eq("id", id);
      if (error) {
        setItems((list) => list.map((c) => (c.id === id ? before : c)));
        sayError("Couldn't save the checklist", error);
      }
    },
    [supabase, itemsRef],
  );

  const toggle = useCallback(
    (id: string) => {
      const c = itemsRef.current.find((x) => x.id === id);
      if (c) void patchItem(id, { is_done: !c.is_done });
    },
    [patchItem, itemsRef],
  );

  const add = useCallback(
    async (projectId: string, phaseId: string | null, label: string) => {
      const order = (itemsRef.current.at(-1)?.sort_order ?? -1) + 1;
      const { data, error } = await supabase
        .from("checklist_items")
        .insert({ project_id: projectId, phase_id: phaseId, label, sort_order: order })
        .select()
        .single<ChecklistItem>();
      if (error) return sayError("Couldn't add the item", error);
      setItems((list) => [...list, data]);
    },
    [supabase, itemsRef],
  );

  const remove = useCallback(
    async (id: string) => {
      const c = itemsRef.current.find((x) => x.id === id);
      if (!c) return;
      setItems((list) => list.filter((x) => x.id !== id));
      const { error } = await supabase.from("checklist_items").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) {
        setItems((list) => [...list, c].sort((a, b) => a.sort_order - b.sort_order));
        return sayError("Couldn't remove the item", error);
      }
      sayUndo(`Removed “${c.label}”`, async () => {
        const { error: undoError } = await supabase.from("checklist_items").update({ deleted_at: null }).eq("id", id);
        if (undoError) return sayError("Couldn't restore it", undoError);
        setItems((list) => [...list, c].sort((a, b) => a.sort_order - b.sort_order));
      });
    },
    [supabase, itemsRef],
  );

  const linkDoc = useCallback((id: string, docId: string | null) => patchItem(id, { document_id: docId }), [patchItem]);

  return { items, toggle, add, remove, linkDoc, reset: setItems };
}

export type ChecklistStore = ReturnType<typeof useChecklist>;

/** Checklist grouped by the project's own phases; current and next phase open by default. */
export function ChecklistTab({
  projectId,
  phases,
  curIdx,
  documents,
  checklist,
}: {
  projectId: string;
  phases: Phase[];
  curIdx: number;
  documents: Doc[];
  checklist: ChecklistStore;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const groups: { key: string; phase: Phase | null; index: number }[] = phases.length
    ? phases.map((p, i) => ({ key: p.id, phase: p, index: i }))
    : [{ key: "all", phase: null, index: 0 }];

  return (
    <div className="flex flex-col gap-3.5">
      <span className="text-sm text-neutral-700">
        Type in the last row of a phase and press Enter to add an item. Tick to complete; ✕ to remove. Link an item to
        a document instead of repeating it.
      </span>
      {groups.map(({ key, phase, index }) => {
        const items = checklist.items.filter((c) => (phase ? c.phase_id === phase.id : true));
        const done = items.filter((c) => c.is_done).length;
        const isCur = Boolean(phase) && index === curIdx;
        const defaultCollapsed = Boolean(phase) && index !== curIdx && index !== curIdx + 1 && !(curIdx < 0 && index === 0);
        const isCollapsed = collapsed[key] ?? defaultCollapsed;
        const phaseDocs = documents.filter((d) => (phase ? d.phase_id === phase.id : true));
        return (
          <section key={key} className="flex flex-col gap-1 rounded-[14px] bg-card px-5 py-4 shadow-hairline">
            <button
              type="button"
              aria-expanded={!isCollapsed}
              onClick={() => setCollapsed((s) => ({ ...s, [key]: !isCollapsed }))}
              className="flex cursor-pointer items-center gap-2.5 border-0 bg-transparent px-0 py-1 text-left text-foreground"
            >
              {isCollapsed ? (
                <CaretRight weight="duotone" className="size-3.5 text-neutral-600" />
              ) : (
                <CaretDown weight="duotone" className="size-3.5 text-neutral-600" />
              )}
              <span className={cn("text-[15px] font-semibold", isCur && "text-accent-700")}>{phase?.name ?? "Checklist"}</span>
              <span className="text-[13px] text-neutral-600">
                {done}/{items.length}
                {items.length > 0 && done === items.length ? " · complete" : ""}
              </span>
              {isCur && <Tag className="px-2 py-px text-[11px]">current</Tag>}
            </button>
            {!isCollapsed && (
              <>
                {items.map((c) => {
                  const doc = documents.find((d) => d.id === c.document_id);
                  return (
                    <div
                      key={c.id}
                      className="group flex items-center gap-3 rounded-lg py-1.5 pr-1 pl-6 hover:bg-neutral-200"
                    >
                      <Checkbox
                        checked={c.is_done}
                        onChange={() => checklist.toggle(c.id)}
                        aria-label={c.label}
                      />
                      <span className={cn("flex-1 text-sm", c.is_done && "text-neutral-600 line-through")}>{c.label}</span>
                      {doc && (
                        <span className="flex items-center gap-1 text-[13px] text-neutral-600">
                          <FileText weight="duotone" className="size-3.5" />
                          {doc.name}
                        </span>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            title="Link to a document"
                            aria-label={`Link ${c.label} to a document`}
                            className="grid cursor-pointer border-0 bg-transparent p-1 text-neutral-500 opacity-0 group-hover:opacity-100 hover:text-accent-700 focus-visible:opacity-100 data-[state=open]:opacity-100"
                          >
                            <LinkSimple className="size-[13px]" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Link to a document</DropdownMenuLabel>
                          {phaseDocs.length === 0 && (
                            <DropdownMenuItem disabled>No documents in this phase</DropdownMenuItem>
                          )}
                          {phaseDocs.map((d) => (
                            <DropdownMenuItem key={d.id} onSelect={() => checklist.linkDoc(c.id, d.id)}>
                              <FileText weight="duotone" className="size-3.5" />
                              {d.name}
                            </DropdownMenuItem>
                          ))}
                          {doc && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => checklist.linkDoc(c.id, null)}>Remove link</DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <button
                        type="button"
                        title="Remove"
                        aria-label={`Remove ${c.label}`}
                        onClick={() => checklist.remove(c.id)}
                        className="grid cursor-pointer border-0 bg-transparent p-1 text-neutral-500 opacity-0 group-hover:opacity-100 hover:text-warning-700 focus-visible:opacity-100"
                      >
                        <X weight="duotone" className="size-[13px]" />
                      </button>
                    </div>
                  );
                })}
                <AddItem
                  placeholder={`Add item to ${phase?.name ?? "the checklist"}…`}
                  onAdd={(label) => checklist.add(projectId, phase?.id ?? null, label)}
                />
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}

function AddItem({ placeholder, onAdd }: { placeholder: string; onAdd: (label: string) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <form
      className="flex items-center gap-3 py-1 pr-1 pl-6"
      onSubmit={(e) => {
        e.preventDefault();
        const label = draft.trim();
        if (!label) return;
        onAdd(label);
        setDraft("");
      }}
    >
      <Plus weight="bold" className="size-[15px] text-accent" />
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="flex-1 border-0 border-b-[1.5px] border-neutral-300 bg-transparent py-1.5 text-sm text-foreground outline-none placeholder:text-neutral-600 focus:border-accent"
      />
    </form>
  );
}
