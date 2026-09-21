import type { WorkflowRunStatus, WorkflowStepStatus } from '@mastra/core/workflows';

// Core drops `suspendedAt` when a step resumes (`omitPriorCompletionFields`), so after a
// resume only wall clock is left: `resumedAt` alone would hide the work done before suspending.
export interface WorkflowStepTiming {
  status?: WorkflowStepStatus;
  startedAt?: number;
  endedAt?: number;
  suspendedAt?: number;
  resumedAt?: number;
}

export interface WorkflowStepSpan {
  start: number;
  end?: number;
  isLive: boolean;
  spansSuspension: boolean;
}

export interface WorkflowRunTiming {
  span: { startedAt: number; endedAt?: number };
  spansSuspension: boolean;
  waitingSince?: number;
}

const finiteOrUndefined = (value?: number) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

// A nested workflow step stays `running` while its child waits and carries the child's
// `suspendedAt`; a step suspending twice in a loop still has the earlier `resumedAt`.
export function isAwaitingInput(timing: WorkflowStepTiming) {
  const suspendedAt = finiteOrUndefined(timing.suspendedAt);
  if (suspendedAt === undefined || finiteOrUndefined(timing.endedAt) !== undefined) return false;
  const resumedAt = finiteOrUndefined(timing.resumedAt);
  return resumedAt === undefined || suspendedAt >= resumedAt;
}

export function resolveStepSpan(timing: WorkflowStepTiming): WorkflowStepSpan | undefined {
  const start = finiteOrUndefined(timing.startedAt);
  if (start === undefined) return undefined;

  const awaitingInput = isAwaitingInput(timing);
  const closedAt = awaitingInput ? finiteOrUndefined(timing.suspendedAt) : finiteOrUndefined(timing.endedAt);
  const end = closedAt !== undefined && closedAt >= start ? closedAt : undefined;

  return {
    start,
    end,
    isLive: end === undefined && timing.status === 'running' && !awaitingInput,
    spansSuspension: !awaitingInput && finiteOrUndefined(timing.resumedAt) !== undefined,
  };
}

// `waiting` is sleep/sleepUntil, not a human: that clock keeps counting.
export function resolveRunTiming(
  steps: Record<string, WorkflowStepTiming> | undefined,
  status?: WorkflowRunStatus,
): WorkflowRunTiming | undefined {
  const startedTimes: number[] = [];
  const endedTimes: number[] = [];
  const suspendedTimes: number[] = [];
  let spansSuspension = false;

  for (const step of Object.values(steps ?? {})) {
    const span = resolveStepSpan(step);
    if (!span) continue;
    startedTimes.push(span.start);
    if (span.end !== undefined) (isAwaitingInput(step) ? suspendedTimes : endedTimes).push(span.end);
    if (span.spansSuspension) spansSuspension = true;
  }
  if (startedTimes.length === 0) return undefined;

  const startedAt = Math.min(...startedTimes);

  if (status === 'suspended') {
    const waitingSince = suspendedTimes.length > 0 ? Math.max(...suspendedTimes) : undefined;
    return {
      span: { startedAt, ...(waitingSince === undefined ? {} : { endedAt: waitingSince }) },
      spansSuspension,
      waitingSince,
    };
  }
  if (status === 'running' || status === 'waiting') return { span: { startedAt }, spansSuspension };

  if (endedTimes.length === 0) return undefined;
  return { span: { startedAt, endedAt: Math.max(...endedTimes) }, spansSuspension };
}
