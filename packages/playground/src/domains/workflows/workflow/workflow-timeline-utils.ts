import type { Step } from '../context/use-current-run';
import { resolveStepSpan } from '../context/workflow-step-timing';

export interface TimelineRow {
  stepId: string;
  step: Step;
  status: Step['status'];
  timing?: { offsetPct: number; widthPct: number; durationMs: number };
  spansSuspension: boolean;
  isRunning: boolean;
  isNestedEntry: boolean;
}

const isNestedTimelineEntry = (stepId: string) => stepId.includes('.');

const isInputKey = (key: string) => key === 'input' || key.endsWith('.input');
const MIN_WIDTH_PCT = 1;

type StepSpan = { start: number; end: number };

function measureStep(step: Step, now: number) {
  const span = resolveStepSpan(step);
  const end = span?.isLive ? Math.max(now, span.start) : span?.end;
  const measured: StepSpan | undefined = span && end !== undefined ? { start: span.start, end } : undefined;
  return { span: measured, isLive: span?.isLive ?? false, spansSuspension: span?.spansSuspension ?? false };
}

export function buildTimeline(steps: Record<string, Step>, now: number): TimelineRow[] {
  const entries = Object.entries(steps)
    .filter(([key]) => !isInputKey(key))
    .map(([stepId, step]) => ({ stepId, step, ...measureStep(step, now) }))
    .sort((a, b) => (a.span?.start ?? Infinity) - (b.span?.start ?? Infinity) || a.stepId.localeCompare(b.stepId));
  const spans = entries.flatMap(entry => (entry.span ? [entry.span] : []));
  const runStart = Math.min(...spans.map(span => span.start));
  const runEnd = Math.max(runStart, ...spans.map(span => span.end));
  const totalMs = Math.max(runEnd - runStart, 1);

  return entries.map(({ stepId, step, span, isLive, spansSuspension }) => {
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
      spansSuspension,
      isRunning: isLive,
      isNestedEntry: isNestedTimelineEntry(stepId),
    };
  });
}
