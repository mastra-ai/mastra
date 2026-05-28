import type { WorkflowRunState, StepResult } from '@mastra/core/workflows';

import type { WorkflowRunStreamResult } from './context/workflow-run-context';

function isStepResultLike(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function convertWorkflowRunStateToStreamResult(
  runState: WorkflowRunState | null | undefined,
): WorkflowRunStreamResult {
  if (!runState) {
    return { steps: {} } as WorkflowRunStreamResult;
  }

  try {
    // Extract step information from the context
    const steps: Record<string, any> = {};
    const context = runState.context || {};

    // Convert each step in the context to the expected format.
    // Defensive: a step entry can be null/undefined or a non-object (e.g. an in-flight
    // sub-workflow snapshot where a nested step is only partially materialised). Skip
    // anything we can't safely treat as a StepResult instead of throwing on `'status' in null`.
    Object.entries(context).forEach(([stepId, stepResult]) => {
      if (stepId === 'input') return;
      if (!isStepResultLike(stepResult)) return;
      if (!('status' in stepResult)) return;

      const result = stepResult as StepResult<any, any, any, any>;
      // Check if this is a tripwire (failed step with tripwire property)
      const hasTripwire = result.status === 'failed' && result.tripwire !== undefined;

      steps[stepId] = {
        status: result.status,
        output: 'output' in result ? result.output : undefined,
        payload: 'payload' in result ? result.payload : undefined,
        suspendPayload: 'suspendPayload' in result ? result.suspendPayload : undefined,
        suspendOutput: 'suspendOutput' in result ? result.suspendOutput : undefined,
        resumePayload: 'resumePayload' in result ? result.resumePayload : undefined,
        // Don't include error when tripwire is present - tripwire takes precedence
        error: hasTripwire ? undefined : 'error' in result ? result.error : undefined,
        tripwire: hasTripwire ? result.tripwire : undefined,
        startedAt: 'startedAt' in result ? result.startedAt : Date.now(),
        endedAt: 'endedAt' in result ? result.endedAt : undefined,
        suspendedAt: 'suspendedAt' in result ? result.suspendedAt : undefined,
        resumedAt: 'resumedAt' in result ? result.resumedAt : undefined,
      };
    });

    const suspendedStepIds = Object.entries(steps as Record<string, StepResult<any, any, any, any>>).flatMap(
      ([stepId, stepResult]) => {
        if (stepResult?.status === 'suspended') {
          const nestedPath = stepResult?.suspendPayload?.__workflow_meta?.path;
          return nestedPath ? [[stepId, ...nestedPath]] : [[stepId]];
        }

        return [];
      },
    );

    const suspendedStep = suspendedStepIds?.[0]?.[0];

    const suspendPayload = suspendedStep ? steps[suspendedStep]?.suspendPayload : undefined;

    return {
      input: context.input,
      steps: steps,
      status: runState.status,
      ...(runState.status === 'success' ? { result: runState.result } : {}),
      ...(runState.status === 'failed' ? { error: runState.error } : {}),
      ...(runState.status === 'suspended' ? { suspended: suspendedStepIds, suspendPayload: suspendPayload } : {}),
      ...(runState.status === 'tripwire' && runState.tripwire
        ? {
            tripwire: {
              reason: runState.tripwire.reason,
              retry: runState.tripwire.retry,
              metadata: runState.tripwire.metadata,
              processorId: runState.tripwire.processorId,
            },
          }
        : {}),
    } as WorkflowRunStreamResult;
  } catch (error) {
    // Last-resort safety net: a malformed snapshot must not crash the workflow detail
    // view (especially the useState initialiser in WorkflowRunProvider, where a throw
    // surfaces as an ErrorBoundary overlay over the whole panel).
    console.error('[convertWorkflowRunStateToStreamResult] failed to convert snapshot', { error, runState });
    return { steps: {}, status: runState.status } as WorkflowRunStreamResult;
  }
}
