"use client";

import { Pause, Play, SkipForward, Stop } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useTimerView } from "@/components/workday/use-timer-view";
import { useWorkday } from "@/components/workday/workday-provider";
import { formatDuration } from "@/lib/time";
import { cn } from "@/lib/utils";

const R = 104;
const CIRC = 2 * Math.PI * R;
const RATINGS: [number, string][] = [
  [1, "Distracted"],
  [3, "Fine"],
  [5, "Deep focus"],
];

export function TimerCard({ onLogTime }: { onLogTime: () => void }) {
  const { currentTask, projectById, start, pause, endSession, skipBreak, lastLogged, rateLast, settings } = useWorkday();
  const view = useTimerView();
  const project = currentTask ? projectById.get(currentTask.project_id) : undefined;
  const running = view.phase === "running";

  const phaseLabel = view.isFocus
    ? `${running ? "Focusing" : view.phase === "paused" ? "Paused" : "Ready"} · session ${view.sessionNumber} of 4`
    : `${view.mode === "long_break" ? "Long break" : "Short break"}${running ? "" : " · paused"}`;

  return (
    <section className="relative box-border flex min-h-[600px] flex-col items-center gap-[22px] overflow-hidden rounded-2xl bg-card p-[26px] shadow-hairline">
      <div className="pointer-events-none absolute top-[40%] left-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(91,91,214,.22),rgba(91,91,214,0))]" />

      <div className="relative flex items-center justify-between gap-3 self-stretch">
        <span className="text-[13px] text-neutral-700">{phaseLabel}</span>
        <div className="flex gap-1.5" aria-label={`${view.cycleDone} of 4 sessions done`}>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                "size-[7px] rounded-full",
                i < view.cycleDone ? "bg-accent" : "shadow-[inset_0_0_0_1.5px_var(--a-500)]",
              )}
            />
          ))}
        </div>
      </div>

      <div className="relative mt-[18px] size-[224px]">
        <svg width="224" height="224" className="-rotate-90 overflow-visible" aria-hidden>
          <circle cx="112" cy="112" r={R} className="fill-none stroke-neutral-300" strokeWidth={6} />
          <circle
            cx="112"
            cy="112"
            r={R}
            className="fill-none stroke-accent transition-[stroke-dashoffset] duration-1000 ease-linear"
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (view.remaining / (view.full || 1))}
            style={{ filter: "drop-shadow(0 0 8px rgba(91,91,214,.85))" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn("text-[52px] font-medium tracking-[-0.03em] tabular-nums", !view.isFocus && "text-accent-600")}
            role="timer"
          >
            {view.timeLabel}
          </span>
        </div>
      </div>

      {view.isFocus ? (
        <div className="relative mt-2 flex flex-col items-center gap-1 text-center">
          <span className="text-sm leading-snug font-medium text-pretty">
            {currentTask?.title ?? "Pick a task to focus on"}
          </span>
          <span className="text-[13px] text-neutral-700">
            {project?.name ?? "Click a task, then “Focus on this task”"}
          </span>
        </div>
      ) : (
        <BreakInfo
          title={view.mode === "long_break" ? "Take a long break" : "Take a short break"}
          logged={
            lastLogged
              ? `Session ${view.cycleDone} done · ${formatDuration(lastLogged.minutes)} logged to ${
                  projectById.get(lastLogged.projectId)?.name ?? "your project"
                }`
              : `Session ${view.cycleDone} done`
          }
          askRating={settings.ask_rating && Boolean(lastLogged) && !lastLogged?.rated}
          onRate={rateLast}
          nextUp={currentTask?.title}
        />
      )}

      <div className="relative mt-auto flex flex-col gap-2.5 self-stretch">
        {view.isFocus ? (
          <div className="flex gap-2">
            <Button
              variant="primary"
              className="h-10 flex-1 rounded-[10px]"
              onClick={running ? pause : start}
              disabled={!currentTask && !running}
            >
              {running ? <Pause weight="fill" className="size-3.5" /> : <Play weight="fill" className="size-3.5" />}
              {running ? "Pause" : view.phase === "paused" ? "Resume" : "Start"}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="size-10 rounded-[10px]"
              onClick={endSession}
              disabled={!view.hasStarted}
              title="End session"
              aria-label="End session"
            >
              <Stop weight="duotone" className="size-[15px]" />
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="primary" className="h-10 flex-1 rounded-[10px]" onClick={running ? pause : start}>
              {running ? <Pause weight="fill" className="size-3.5" /> : <Play weight="fill" className="size-3.5" />}
              {running ? "Pause break" : "Resume break"}
            </Button>
            <Button variant="secondary" className="h-10 rounded-[10px]" onClick={skipBreak}>
              <SkipForward weight="duotone" className="size-[15px]" />
              Skip to next session
            </Button>
          </div>
        )}
        <button
          type="button"
          onClick={onLogTime}
          className="cursor-pointer self-center border-0 bg-transparent p-0 text-[13px] text-accent-700 underline-offset-2 hover:underline"
        >
          Forgot to start? Log time
        </button>
      </div>
    </section>
  );
}

function BreakInfo({
  title,
  logged,
  askRating,
  onRate,
  nextUp,
}: {
  title: string;
  logged: string;
  askRating: boolean;
  onRate: (r: number) => void;
  nextUp?: string;
}) {
  return (
    <div className="relative mt-2 flex flex-col items-center gap-3 text-center">
      <span className="text-[13px] text-neutral-700">{logged}</span>
      <span className="text-[15px] font-semibold">{title}</span>
      {askRating && (
        <div className="flex flex-col items-center gap-2">
          <span className="text-[13px] text-neutral-700">How focused were you?</span>
          <div className="flex gap-1.5">
            {RATINGS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onRate(value)}
                className="cursor-pointer rounded-full border border-divider bg-transparent px-3.5 py-1.5 text-[13px] whitespace-nowrap text-foreground hover:border-accent hover:bg-accent hover:text-white"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {nextUp && (
        <span className="text-[13px] text-neutral-700">
          Next up: <span className="text-foreground">{nextUp}</span>
        </span>
      )}
    </div>
  );
}
