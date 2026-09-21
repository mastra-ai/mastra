import type { Step } from '../context/use-current-run';

export interface TimelineRow {
  stepId: string;
  step: Step;
  status: Step['status'];
  timing?: { offsetPct: number; widthPct: number; durationMs: number };
  isRunning: boolean;
  isNestedEntry: boolean;
}

const isNestedTimelineEntry = (stepId: string) => stepId.includes('.');

const isInputKey = (key: string) => key === 'input' || key.endsWith('.input');
const MIN_WIDTH_PCT = 1;

export function formatTimelineDuration(durationMs: number) {
  if (durationMs < 1000) return `${Number(durationMs.toPrecision(3))}ms`;
  return `${Number((durationMs / 1000).toPrecision(3))}s`;
}

type StepSpan = { start: number; end: number };

const isStepRunning = (step: Step) => step.status === 'running' && step.endedAt === undefined;

function measureStep(step: Step, now: number): StepSpan | undefined {
  const start = step.startedAt;
  if (start === undefined || !Number.isFinite(start)) return undefined;
  const end = isStepRunning(step) ? Math.max(now, start) : step.endedAt;
  if (end === undefined || !Number.isFinite(end) || end < start) return undefined;
  return { start, end };
}

export function buildTimeline(steps: Record<string, Step>, now: number): TimelineRow[] {
  const entries = Object.entries(steps)
    .filter(([key]) => !isInputKey(key))
    .map(([stepId, step]) => ({ stepId, step, span: measureStep(step, now) }))
    .sort((a, b) => (a.span?.start ?? Infinity) - (b.span?.start ?? Infinity) || a.stepId.localeCompare(b.stepId));
  const spans = entries.flatMap(entry => (entry.span ? [entry.span] : []));
  const runStart = Math.min(...spans.map(span => span.start));
  const runEnd = Math.max(runStart, ...spans.map(span => span.end));
  const totalMs = Math.max(runEnd - runStart, 1);

  return entries.map(({ stepId, step, span }) => {
    let timing: TimelineRow['timing'];
    if (span) {
      const durationMs = span.end - span.start;
      const offsetPct = Math.min(((span.start - runStart) / totalMs) * 100, 100 - MIN_WIDTH_PCT);
      const widthPct = Math.min(Math.max((durationMs / totalMs) * 100, MIN_WIDTH_PCT), 100 - offsetPct);
      timing = { durationMs, offsetPct, widthPct };
    }
    return {
      stepId,
      step,
      status: step.status,
      timing,
      isRunning: isStepRunning(step),
      isNestedEntry: isNestedTimelineEntry(stepId),
    };
  });
}
