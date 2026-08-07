import type { WorkflowState, WorkflowStateSingleStepResult, WorkflowStateStepResult } from '@mastra/core/workflows';
import type { WorkflowDataPart, WorkflowStepDataPart, StepResult } from './transformers';
import { createWorkflowDataPart, createWorkflowStepDataPart } from './transformers';

/**
 * Converts a `WorkflowState` (as returned by `getWorkflowRunById` or the
 * workflow runs API) into a `ReadableStream` of AI SDK UIMessage data parts —
 * the same `WorkflowDataPart` and `WorkflowStepDataPart` chunks that the live
 * workflow stream transformer produces. This lets you display historical
 * workflow runs using the same `useChat`-powered components used for live runs.
 *
 * @example
 * ```ts
 * import { workflowSnapshotToStream } from '@mastra/ai-sdk';
 * import { createUIMessageStreamResponse } from 'ai';
 *
 * const workflowRun = await mastra.getWorkflow('myWorkflow').getWorkflowRunById(runId);
 * const stream = workflowSnapshotToStream(workflowRun);
 * return createUIMessageStreamResponse({ stream });
 * ```
 */
export function workflowSnapshotToStream(
  workflowRun: WorkflowState,
): ReadableStream<WorkflowDataPart | WorkflowStepDataPart | { type: 'start' } | { type: 'finish' }> {
  const steps = workflowStateToSteps(workflowRun.steps ?? {});
  const current = { name: workflowRun.workflowName, steps };
  const runId = workflowRun.runId;
  const status = workflowRun.status;

  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'start' });

      controller.enqueue(
        createWorkflowDataPart({
          current,
          runId,
          status,
          includeOutputs: true,
          output: null,
        }),
      );

      for (const stepId of Object.keys(steps)) {
        controller.enqueue(
          createWorkflowStepDataPart({
            current,
            runId,
            status,
            stepId,
          }),
        );
      }

      controller.enqueue({ type: 'finish' });
      controller.close();
    },
  });
}

function workflowStateToSteps(stateSteps: Record<string, WorkflowStateStepResult>): Record<string, StepResult> {
  const steps: Record<string, StepResult> = {};

  for (const [key, value] of Object.entries(stateSteps)) {
    const stepResult = Array.isArray(value) ? mergeForEachStepResult(value) : value;
    if (!stepResult || typeof stepResult !== 'object' || !('status' in stepResult)) continue;

    steps[key] = {
      name: key,
      status: stepResult.status,
      input: stepResult.payload ?? null,
      output: stepResult.output ?? null,
      suspendPayload: stepResult.suspendPayload ?? null,
      resumePayload: stepResult.resumePayload ?? null,
    };
  }

  return steps;
}

function mergeForEachStepResult(results: WorkflowStateSingleStepResult[]): WorkflowStateSingleStepResult | undefined {
  const stepResults = results.filter(
    (result): result is WorkflowStateSingleStepResult => !!result && typeof result === 'object' && 'status' in result,
  );

  if (stepResults.length === 0) return undefined;

  const representative =
    stepResults.find(result => result.status === 'suspended') ??
    stepResults.find(result => result.status === 'failed') ??
    stepResults[0];
  if (!representative) return undefined;

  return {
    ...representative,
    payload: stepResults.map(result => result.payload),
    output: stepResults.map(result => result.output),
  };
}
