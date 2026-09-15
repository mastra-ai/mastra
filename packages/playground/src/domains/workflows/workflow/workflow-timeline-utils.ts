import type { Step } from '../context/use-current-run';

export interface TimelineRow {
  stepId: string;
  step: Step;
  status: Step['status'];
  timing?: { offsetPct: number; widthPct: number; durationMs: number };
  isRunning: boolean;
  isNestedEntry: boolean;
}

export const isNestedTimelineEntry = (stepId: string) => stepId.includes('.');

const isInputKey = (key: string) => key === 'input' || key.endsWith('.input');
const MIN_WIDTH_PCT = 1;

export function formatTimelineDuration(durationMs: number) {
  if (durationMs < 1000) return `${Number(durationMs.toPrecision(3))}ms`;
  return `${Number((durationMs / 1000).toPrecision(3))}s`;
}

export function buildTimeline(steps: Record<string, Step>, now: number): TimelineRow[] {
  const entries = Object.entries(steps)
    .filter(([key]) => !isInputKey(key))
    .map(([stepId, step]) => {
      const isRunning = step.status === 'running' && step.endedAt === undefined;
      const end = isRunning ? Math.max(now, step.startedAt) : step.endedAt;
      const hasTiming =
        Number.isFinite(step.startedAt) && end !== undefined && Number.isFinite(end) && end >= step.startedAt;
      return { stepId, step, isRunning, end: hasTiming ? end : undefined };
    });
  const measured = entries.filter(entry => entry.end !== undefined);
  const runStart = measured.reduce(
    (start, { step }) => Math.min(start, step.startedAt),
    measured[0]?.step.startedAt ?? 0,
  );
  const runEnd = measured.reduce((latest, { end }) => Math.max(latest, end ?? runStart), runStart);
  const totalMs = Math.max(runEnd - runStart, 1);

  return entries.map(({ stepId, step, isRunning, end }) => {
    let timing: TimelineRow['timing'];
    if (end !== undefined) {
      const durationMs = Math.max(0, end - step.startedAt);
      const offsetPct = Math.min(((step.startedAt - runStart) / totalMs) * 100, 100 - MIN_WIDTH_PCT);
      const widthPct = Math.min(Math.max((durationMs / totalMs) * 100, MIN_WIDTH_PCT), 100 - offsetPct);
      timing = { durationMs, offsetPct, widthPct };
    }
    return { stepId, step, status: step.status, timing, isRunning, isNestedEntry: isNestedTimelineEntry(stepId) };
  });
}
