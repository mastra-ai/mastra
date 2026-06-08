import type { Step } from '../context/use-current-run';

export interface TimelineRow {
  stepId: string;
  status: Step['status'];
  /** Bar left position, 0–100. */
  offsetPct: number;
  /** Bar width, 0–100. */
  widthPct: number;
  durationMs: number;
  isRunning: boolean;
}

const isInputKey = (key: string) => key === 'input' || key.endsWith('.input');

/** Smallest bar width (in %) so near-zero durations stay visible. */
const MIN_WIDTH_PCT = 1;

/**
 * Build positioned timeline rows from the current run's steps.
 *
 * `now` is injected (not read from `Date.now()`) so callers control the clock
 * and tests stay deterministic. Running steps (no `endedAt`) are measured
 * against `now`, so their bars grow as `now` advances.
 */
export function buildTimeline(steps: Record<string, Step>, now: number): TimelineRow[] {
  const entries = Object.entries(steps).filter(([key]) => !isInputKey(key));

  if (entries.length === 0) {
    return [];
  }

  const runStart = Math.min(...entries.map(([, step]) => step.startedAt));
  const runEnd = Math.max(...entries.map(([, step]) => step.endedAt ?? now));
  const totalMs = Math.max(runEnd - runStart, 1);

  return entries.map(([stepId, step]) => {
    const isRunning = step.endedAt === undefined;
    const end = step.endedAt ?? now;
    const durationMs = end - step.startedAt;
    const offsetPct = ((step.startedAt - runStart) / totalMs) * 100;
    const widthPct = Math.max((durationMs / totalMs) * 100, MIN_WIDTH_PCT);

    return {
      stepId,
      status: step.status,
      offsetPct,
      widthPct,
      durationMs,
      isRunning,
    };
  });
}
