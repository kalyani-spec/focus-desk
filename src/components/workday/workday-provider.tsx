"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useLatest } from "@/lib/use-latest";
import { createClient } from "@/lib/supabase/client";
import { MIN_LOG_SECONDS, modeLength, remainingSeconds, timerPhase } from "@/lib/timer";
import { formatDuration, formatTime, isoDate } from "@/lib/time";
import { requestNotificationPermission, notify, chime } from "@/lib/notify";
import { say, sayError, sayUndo } from "@/lib/toast";
import type { ActiveTimer, Holiday, Project, Settings, TimeEntry, TimerMode, WorkSession } from "@/lib/types";
import { TimerEngine } from "./timer-engine";
import { ClockInPrompt, StaleSessionDialog, SwitchTaskPrompt } from "./prompts";

export interface CurrentTask {
  id: string;
  title: string;
  project_id: string;
}

export type Entry = TimeEntry & { task: { title: string } | null };

export interface WorkdayInit {
  userId: string;
  today: string;
  settings: Settings;
  projects: Project[];
  timer: ActiveTimer | null;
  currentTask: CurrentTask | null;
  sessions: WorkSession[];
  entries: Entry[];
  holidays: Holiday[];
}

type NewEntry = Pick<TimeEntry, "project_id" | "task_id" | "started_at" | "ended_at" | "source" | "note">;

interface LastLogged {
  entryId: string;
  minutes: number;
  projectId: string;
  rated: boolean;
}

interface WorkdayContextValue {
  userId: string;
  today: string;
  settings: Settings;
  projects: Project[];
  projectById: Map<string, Project>;
  holidays: Holiday[];

  timer: ActiveTimer | null;
  currentTask: CurrentTask | null;
  lastLogged: LastLogged | null;
  setCurrentTask: (task: CurrentTask | null) => void;
  start: () => void;
  pause: () => void;
  endSession: () => void;
  skipBreak: () => void;
  focusOn: (task: CurrentTask) => void;
  rateLast: (rating: number) => void;

  sessions: WorkSession[];
  openSession: WorkSession | null;
  clockIn: () => Promise<boolean>;
  clockOut: () => Promise<boolean>;

  entries: Entry[];
  addEntry: (entry: NewEntry, taskTitle?: string | null) => Promise<boolean>;
  updateEntry: (id: string, patch: Partial<NewEntry>) => Promise<boolean>;
  splitEntry: (id: string, at: string) => Promise<boolean>;
  deleteEntry: (id: string) => Promise<void>;
}

const WorkdayContext = createContext<WorkdayContextValue | null>(null);

export function useWorkday() {
  const ctx = useContext(WorkdayContext);
  if (!ctx) throw new Error("useWorkday must be used inside <WorkdayProvider>");
  return ctx;
}

/** For components (like the top bar) that also render before the user's data has loaded. */
export function useWorkdayOptional() {
  return useContext(WorkdayContext);
}

const ENTRY_SELECT = "*, task:tasks(title)";

export function WorkdayProvider({ init, children }: { init: WorkdayInit; children: React.ReactNode }) {
  const supabase = createClient();
  const { userId, today, settings, projects, holidays } = init;
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const [timer, setTimer] = useState<ActiveTimer | null>(init.timer);
  const [currentTask, setCurrentTaskState] = useState<CurrentTask | null>(init.currentTask);
  const [lastLogged, setLastLogged] = useState<LastLogged | null>(null);
  const [sessions, setSessions] = useState<WorkSession[]>(init.sessions);
  const [entries, setEntries] = useState<Entry[]>(init.entries);

  const [clockInAsk, setClockInAsk] = useState(false);
  const [switchAsk, setSwitchAsk] = useState<{ task: CurrentTask; elapsed: number } | null>(null);

  // Refs mirror state so async timer transitions always see the latest values.
  const timerRef = useLatest(timer);
  const taskRef = useLatest(currentTask);
  const entriesRef = useLatest(entries);
  const busy = useRef(false);

  const openSession = sessions.find((s) => !s.clock_out) ?? null;

  // ---------------------------------------------------------------------------
  // Timer persistence
  // ---------------------------------------------------------------------------

  // Saves run one at a time, and only the newest one's server response is applied, so a slow
  // earlier save can never overwrite a newer local state.
  const saveSeq = useRef(0);
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());

  const saveTimer = useCallback(
    (next: Omit<ActiveTimer, "id"> & { id?: string }) => {
      const mine = ++saveSeq.current;
      const prev = timerRef.current;
      const optimistic = { ...next, id: next.id ?? prev?.id ?? "pending" } as ActiveTimer;
      setTimer(optimistic);
      timerRef.current = optimistic;

      const run = saveChain.current.then(async () => {
        const { data, error } = await supabase
          .from("active_timer")
          .upsert(
            {
              user_id: userId,
              task_id: next.task_id,
              project_id: next.project_id,
              mode: next.mode,
              started_at: next.started_at,
              ends_at: next.ends_at,
              paused_remaining_seconds: next.paused_remaining_seconds,
              cycle_done: next.cycle_done,
              deleted_at: null,
            },
            { onConflict: "user_id" },
          )
          .select()
          .single<ActiveTimer>();
        if (mine !== saveSeq.current) return !error;
        if (error) {
          setTimer(prev);
          timerRef.current = prev;
          sayError("Couldn't save the timer", error);
          return false;
        }
        setTimer(data);
        timerRef.current = data;
        return true;
      });
      saveChain.current = run.catch(() => undefined);
      return run;
    },
    [supabase, userId, timerRef],
  );

  const baseTimer = useCallback(
    (task: CurrentTask | null, t: ActiveTimer | null): Omit<ActiveTimer, "id"> | null => {
      const projectId = task?.project_id ?? t?.project_id;
      if (!projectId) return null;
      return {
        task_id: task?.id ?? t?.task_id ?? null,
        project_id: projectId,
        mode: t?.mode ?? "focus",
        started_at: t?.started_at ?? null,
        ends_at: t?.ends_at ?? null,
        paused_remaining_seconds: t?.paused_remaining_seconds ?? null,
        cycle_done: t?.cycle_done ?? 0,
      };
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Time entries
  // ---------------------------------------------------------------------------

  /** Latest end among entries that overlap [start, end), so a new entry can start after it. */
  const clipStart = useCallback((start: number, end: number) => {
    let clipped = start;
    for (const e of entriesRef.current) {
      const s = new Date(e.started_at).getTime();
      const f = new Date(e.ended_at).getTime();
      if (s < end && f > clipped) clipped = Math.max(clipped, f);
    }
    return clipped;
  }, [entriesRef]);

  const insertEntry = useCallback(
    async (entry: NewEntry) => {
      const { data, error } = await supabase.from("time_entries").insert(entry).select(ENTRY_SELECT).single<Entry>();
      if (error) {
        sayError("Couldn't log that time", error);
        return null;
      }
      if (isoDate(data.started_at) === today) {
        setEntries((list) => [data, ...list].sort((a, b) => b.started_at.localeCompare(a.started_at)));
      }
      return data;
    },
    [supabase, today],
  );

  const addEntry = useCallback(
    async (entry: NewEntry) => Boolean(await insertEntry(entry)),
    [insertEntry],
  );

  const updateEntry = useCallback(
    async (id: string, patch: Partial<NewEntry>) => {
      const { data, error } = await supabase
        .from("time_entries")
        .update(patch)
        .eq("id", id)
        .select(ENTRY_SELECT)
        .single<Entry>();
      if (error) {
        sayError("Couldn't save the session", error);
        return false;
      }
      setEntries((list) =>
        list
          .map((e) => (e.id === id ? data : e))
          .filter((e) => isoDate(e.started_at) === today)
          .sort((a, b) => b.started_at.localeCompare(a.started_at)),
      );
      return true;
    },
    [supabase, today],
  );

  const splitEntry = useCallback(
    async (id: string, at: string) => {
      const original = entriesRef.current.find((e) => e.id === id);
      if (!original) return false;
      const t = new Date(at).getTime();
      if (t <= new Date(original.started_at).getTime() || t >= new Date(original.ended_at).getTime()) {
        say("Pick a time inside the session to split it.");
        return false;
      }
      // Shorten first, then add the second half, so the two never overlap.
      if (!(await updateEntry(id, { ended_at: new Date(t).toISOString() }))) return false;
      const second = await insertEntry({
        project_id: original.project_id,
        task_id: original.task_id,
        started_at: new Date(t).toISOString(),
        ended_at: original.ended_at,
        source: original.source,
        note: original.note,
      });
      if (!second) {
        await updateEntry(id, { ended_at: original.ended_at });
        return false;
      }
      say("Session split in two");
      return true;
    },
    [insertEntry, updateEntry, entriesRef],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      const entry = entriesRef.current.find((e) => e.id === id);
      if (!entry) return;
      setEntries((list) => list.filter((e) => e.id !== id));
      const { error } = await supabase
        .from("time_entries")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        setEntries((list) => [entry, ...list].sort((a, b) => b.started_at.localeCompare(a.started_at)));
        sayError("Couldn't delete the session", error);
        return;
      }
      sayUndo(`Deleted ${formatDuration(entry.duration_minutes)} session`, async () => {
        const { error: undoError } = await supabase.from("time_entries").update({ deleted_at: null }).eq("id", id);
        if (undoError) return sayError("Couldn't restore it", undoError);
        setEntries((list) => [entry, ...list].sort((a, b) => b.started_at.localeCompare(a.started_at)));
      });
    },
    [supabase, entriesRef],
  );

  // ---------------------------------------------------------------------------
  // Timer transitions
  // ---------------------------------------------------------------------------

  /** Log a focus session that ends at `endAt` after `focusedSeconds` of focus, then start the break. */
  const completeFocus = useCallback(
    async (endAt: number, focusedSeconds: number, live: boolean) => {
      const t = timerRef.current;
      if (!t) return;
      const task = taskRef.current;
      const ready = { ...t, mode: "focus" as TimerMode, started_at: null, ends_at: null, paused_remaining_seconds: null };

      if (focusedSeconds < MIN_LOG_SECONDS) {
        await saveTimer(ready);
        say("Under 2 minutes, so it wasn't logged");
        return;
      }

      const start = clipStart(endAt - focusedSeconds * 1000, endAt);
      let logged: Entry | null = null;
      if (endAt - start >= MIN_LOG_SECONDS * 1000) {
        logged = await insertEntry({
          project_id: t.project_id,
          task_id: t.task_id,
          started_at: new Date(start).toISOString(),
          ended_at: new Date(endAt).toISOString(),
          source: "pomodoro",
          note: null,
        });
      }

      const cycle = Math.min(4, t.cycle_done + 1);
      const breakMode: TimerMode = cycle >= 4 ? "long_break" : "short_break";
      const breakEnds = endAt + modeLength(breakMode, settings) * 1000;
      await saveTimer({ ...ready, mode: breakMode, cycle_done: cycle, ends_at: new Date(breakEnds).toISOString() });

      if (logged) {
        setLastLogged({ entryId: logged.id, minutes: logged.duration_minutes, projectId: logged.project_id, rated: false });
      }
      if (live) {
        chime();
        notify(
          "Session done",
          logged
            ? `${formatDuration(logged.duration_minutes)} logged${task ? ` to ${task.title}` : ""}. Time for a break.`
            : "Time for a break.",
        );
      }
    },
    [clipStart, insertEntry, saveTimer, settings, taskRef, timerRef],
  );

  const finishBreak = useCallback(
    async (live: boolean) => {
      const t = timerRef.current;
      if (!t) return;
      await saveTimer({
        ...t,
        mode: "focus",
        started_at: null,
        ends_at: null,
        paused_remaining_seconds: null,
        cycle_done: t.cycle_done >= 4 ? 0 : t.cycle_done,
      });
      setLastLogged(null);
      if (live) {
        chime();
        notify("Break's over", "Ready when you are.");
        say("Break's over · ready when you are");
      }
    },
    [saveTimer, timerRef],
  );

  /** Called every second by the engine: handles a countdown reaching zero (even while away). */
  const tick = useCallback(
    async (now: number) => {
      const t = timerRef.current;
      if (!t?.ends_at || busy.current) return;
      const endsAt = new Date(t.ends_at).getTime();
      if (now < endsAt) return;
      busy.current = true;
      try {
        const live = now - endsAt < 60_000;
        if (t.mode === "focus") {
          await completeFocus(endsAt, modeLength("focus", settings), live);
        } else {
          await finishBreak(live);
        }
      } finally {
        busy.current = false;
      }
    },
    [completeFocus, finishBreak, settings, timerRef],
  );

  const runTimer = useCallback(async () => {
    const t = timerRef.current;
    const base = baseTimer(taskRef.current, t);
    if (!base) return;
    const now = Date.now();
    const full = modeLength(base.mode, settings);
    const remaining = remainingSeconds(t, full, now);
    await saveTimer({
      ...base,
      started_at: base.mode === "focus" ? (base.started_at ?? new Date(now).toISOString()) : null,
      ends_at: new Date(now + remaining * 1000).toISOString(),
      paused_remaining_seconds: null,
    });
  }, [baseTimer, saveTimer, settings, taskRef, timerRef]);

  const start = useCallback(() => {
    requestNotificationPermission();
    const t = timerRef.current;
    const isFocus = (t?.mode ?? "focus") === "focus";
    if (isFocus && !openSession) {
      setClockInAsk(true);
      return;
    }
    void runTimer();
  }, [openSession, runTimer, timerRef]);

  const pause = useCallback(() => {
    const t = timerRef.current;
    if (!t?.ends_at) return;
    const remaining = remainingSeconds(t, 0, Date.now());
    void saveTimer({ ...t, ends_at: null, paused_remaining_seconds: Math.round(remaining) });
  }, [saveTimer, timerRef]);

  const endSession = useCallback(async () => {
    const t = timerRef.current;
    if (!t || t.mode !== "focus" || !t.started_at || busy.current) return;
    busy.current = true;
    try {
      const full = modeLength("focus", settings);
      const focused = full - remainingSeconds(t, full, Date.now());
      await completeFocus(Date.now(), focused, false);
    } finally {
      busy.current = false;
    }
  }, [completeFocus, settings, timerRef]);

  const skipBreak = useCallback(() => {
    void finishBreak(false);
  }, [finishBreak]);

  const setCurrentTask = useCallback(
    (task: CurrentTask | null) => {
      setCurrentTaskState(task);
      taskRef.current = task;
      const t = timerRef.current;
      if (!task) return;
      if (t && t.task_id === task.id && t.project_id === task.project_id) return;
      const base = baseTimer(task, t);
      if (base) void saveTimer({ ...base, task_id: task.id, project_id: task.project_id });
    },
    [baseTimer, saveTimer, taskRef, timerRef],
  );

  /** Switch the timer to `task`, logging the old task's elapsed time first if asked. */
  const switchTo = useCallback(
    async (task: CurrentTask, logElapsed: boolean) => {
      const t = timerRef.current;
      setSwitchAsk(null);
      if (t && logElapsed && t.mode === "focus" && t.started_at) {
        const full = modeLength("focus", settings);
        const focused = full - remainingSeconds(t, full, Date.now());
        const end = Date.now();
        const start = clipStart(end - focused * 1000, end);
        if (end - start >= MIN_LOG_SECONDS * 1000) {
          const logged = await insertEntry({
            project_id: t.project_id,
            task_id: t.task_id,
            started_at: new Date(start).toISOString(),
            ended_at: new Date(end).toISOString(),
            source: "pomodoro",
            note: null,
          });
          if (logged) say(`Logged ${formatDuration(logged.duration_minutes)} to ${taskRef.current?.title ?? "the last task"}`);
        }
        setCurrentTaskState(task);
        taskRef.current = task;
        const now = Date.now();
        await saveTimer({
          task_id: task.id,
          project_id: task.project_id,
          mode: "focus",
          started_at: new Date(now).toISOString(),
          ends_at: new Date(now + full * 1000).toISOString(),
          paused_remaining_seconds: null,
          cycle_done: t.cycle_done,
        });
        return;
      }
      setCurrentTask(task);
    },
    [clipStart, insertEntry, saveTimer, setCurrentTask, settings, taskRef, timerRef],
  );

  const focusOn = useCallback(
    (task: CurrentTask) => {
      const t = timerRef.current;
      const inSession = t?.mode === "focus" && t.started_at;
      if (inSession && t && t.task_id !== task.id) {
        const full = modeLength("focus", settings);
        const elapsed = full - remainingSeconds(t, full, Date.now());
        if (elapsed >= MIN_LOG_SECONDS) {
          setSwitchAsk({ task, elapsed });
          return;
        }
        void switchTo(task, false);
        return;
      }
      setCurrentTask(task);
      if (timerPhase(timerRef.current) !== "running" && (timerRef.current?.mode ?? "focus") === "focus") start();
    },
    [setCurrentTask, settings, start, switchTo, timerRef],
  );

  const rateLast = useCallback(
    async (rating: number) => {
      const last = lastLogged;
      if (!last) return;
      setLastLogged({ ...last, rated: true });
      const { error } = await supabase.from("time_entries").update({ rating }).eq("id", last.entryId);
      if (error) return sayError("Couldn't save the rating", error);
      setEntries((list) => list.map((e) => (e.id === last.entryId ? { ...e, rating } : e)));
    },
    [lastLogged, supabase],
  );

  // ---------------------------------------------------------------------------
  // Clocking
  // ---------------------------------------------------------------------------

  const clockIn = useCallback(async () => {
    if (openSession) return true;
    const now = new Date();
    const { data, error } = await supabase
      .from("work_sessions")
      .insert({ date: isoDate(now), clock_in: now.toISOString() })
      .select()
      .single<WorkSession>();
    if (error) {
      sayError("Couldn't clock in", error);
      return false;
    }
    setSessions((list) => [...list, data]);
    return true;
  }, [openSession, supabase]);

  const closeSession = useCallback(
    async (session: WorkSession, at: Date) => {
      const { data, error } = await supabase
        .from("work_sessions")
        .update({ clock_out: at.toISOString() })
        .eq("id", session.id)
        .select()
        .single<WorkSession>();
      if (error) {
        sayError("Couldn't clock out", error);
        return false;
      }
      setSessions((list) => list.map((s) => (s.id === session.id ? data : s)).filter((s) => s.date === today || !s.clock_out));
      return true;
    },
    [supabase, today],
  );

  const clockOut = useCallback(async () => {
    if (!openSession) return true;
    if (timerPhase(timerRef.current) === "running" && timerRef.current?.mode === "focus") pause();
    return closeSession(openSession, new Date());
  }, [closeSession, openSession, pause, timerRef]);

  const staleSession = openSession && openSession.date < today ? openSession : null;

  const value: WorkdayContextValue = {
    userId,
    today,
    settings,
    projects,
    projectById,
    holidays,
    timer,
    currentTask,
    lastLogged,
    setCurrentTask,
    start,
    pause,
    endSession: () => void endSession(),
    skipBreak,
    focusOn,
    rateLast: (r) => void rateLast(r),
    sessions,
    openSession,
    clockIn,
    clockOut,
    entries,
    addEntry,
    updateEntry,
    splitEntry,
    deleteEntry,
  };

  return (
    <WorkdayContext.Provider value={value}>
      <TimerEngine onTick={tick} />
      {children}

      <ClockInPrompt
        open={clockInAsk}
        onCancel={() => setClockInAsk(false)}
        onJustStart={() => {
          setClockInAsk(false);
          void runTimer();
        }}
        onClockIn={async () => {
          setClockInAsk(false);
          if (await clockIn()) {
            say(`Clocked in at ${formatTime(Date.now())}`);
            void runTimer();
          }
        }}
      />

      <SwitchTaskPrompt
        ask={switchAsk}
        fromTitle={currentTask?.title ?? "the current task"}
        onCancel={() => setSwitchAsk(null)}
        onSwitch={(log) => switchAsk && void switchTo(switchAsk.task, log)}
      />

      {staleSession && (
        <StaleSessionDialog session={staleSession} onSave={(at) => closeSession(staleSession, at)} />
      )}
    </WorkdayContext.Provider>
  );
}
