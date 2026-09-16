import type { GetWorkflowRunByIdResponse } from '@mastra/client-js';
import type { WorkflowRunState, WorkflowStateStepResult } from '@mastra/core/workflows';

import type { WorkflowRunStreamResult } from './context/workflow-run-context';

type RecordedRun = WorkflowRunState | GetWorkflowRunByIdResponse;
type RecordedStep = WorkflowRunState['context'][string] | WorkflowStateStepResult;
type RecordedStepResult = Exclude<RecordedStep, unknown[]>;
type StreamStep = WorkflowRunStreamResult['steps'][string];

const FINISHED_RUN_STATUSES = ['success', 'failed', 'canceled', 'bailed', 'tripwire'];

export function isPersistedRunState(run: RecordedRun): run is WorkflowRunState {
  return 'context' in run;
}

function readRecordedRun(run: RecordedRun) {
  if (isPersistedRunState(run)) {
    const { input, ...steps } = run.context;
    return { input, steps };
  }
  return { input: run.payload, steps: run.steps ?? {} };
}

function pickIterationToShow(iterations: RecordedStepResult[]) {
  return iterations.find(iteration => iteration?.status === 'suspended') ?? iterations[0];
}

function stripTripwireError(step: RecordedStepResult): StreamStep {
  const failedByTripwire = step.status === 'failed' && 'tripwire' in step && step.tripwire !== undefined;
  return failedByTripwire ? { ...step, error: undefined } : step;
}

function toStreamStep(recorded: RecordedStep): StreamStep | undefined {
  if (!Array.isArray(recorded)) return recorded ? stripTripwireError(recorded) : undefined;
  const shown = pickIterationToShow(recorded);
  if (!shown) return undefined;
  return {
    ...stripTripwireError(shown),
    payload: recorded.map(iteration => iteration?.payload),
    output: recorded.map(iteration => iteration?.output),
  };
}

// Object.fromEntries keeps a "__proto__" step id as an own key; index assignment would hit the setter.
function toStreamSteps(recordedSteps: Record<string, RecordedStep>): WorkflowRunStreamResult['steps'] {
  return Object.fromEntries(
    Object.entries(recordedSteps).flatMap(([stepId, recorded]) => {
      const step = toStreamStep(recorded);
      return step ? [[stepId, step] as const] : [];
    }),
  );
}

function suspendedPathOf(stepId: string, step: StreamStep): string[] {
  const path = step.suspendPayload?.__workflow_meta?.path;
  const nestedPath = Array.isArray(path) ? path.filter((part): part is string => typeof part === 'string') : [];
  return nestedPath[0] === stepId ? nestedPath : [stepId, ...nestedPath];
}

function collectSuspendedPaths(steps: WorkflowRunStreamResult['steps']) {
  return Object.entries(steps)
    .filter(([, step]) => step.status === 'suspended')
    .map(([stepId, step]) => suspendedPathOf(stepId, step));
}

function readRunOutcome(run: RecordedRun, steps: WorkflowRunStreamResult['steps']): Partial<WorkflowRunStreamResult> {
  switch (run.status) {
    case 'success':
      return { result: run.result };
    case 'failed':
      return { error: run.error };
    case 'suspended': {
      const suspended = collectSuspendedPaths(steps);
      const suspendedStepId = suspended[0]?.[0];
      return { suspended, suspendPayload: suspendedStepId ? steps[suspendedStepId]?.suspendPayload : undefined };
    }
    case 'tripwire':
      return 'tripwire' in run && run.tripwire ? { tripwire: run.tripwire } : {};
    default:
      return {};
  }
}

export function convertWorkflowRunStateToStreamResult(run: RecordedRun): WorkflowRunStreamResult {
  const { input, steps: recordedSteps } = readRecordedRun(run);
  const steps = toStreamSteps(recordedSteps);
  return { input, steps, status: run.status, ...readRunOutcome(run, steps) };
}

export function isWorkflowRunFinished(status?: string) {
  return FINISHED_RUN_STATUSES.includes(status ?? '');
}

export function getRunTimestamp(value: Date | string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
}
