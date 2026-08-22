import { z } from 'zod/v4';
import { InternalSpans } from '../../observability';
import { createStep, createWorkflow } from '../../workflows/evented';
import type { WorkflowRunState } from '../../workflows';
import { executeScoreRun, SCORE_RUN_WORKFLOW_ID } from './executeScoreRun';
import type { ScoreRunInput } from './executeScoreRun';

const scoreRunInputSchema = z.object({
  hookData: z.any(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  targetCorrelationContext: z.record(z.string(), z.any()).optional(),
  targetMetadata: z.record(z.string(), z.any()).optional(),
});

const executeScorerStep = createStep({
  id: '__execute-scorer',
  inputSchema: scoreRunInputSchema,
  outputSchema: z.any(),
  // Transient scorer failures (rate-limited judge, network) retry with a fixed
  // delay — the existing engine capability. Exponential backoff is Phase 2.
  retries: 3,
  execute: async ({ inputData, mastra }) => {
    // Errors propagate: the run must end `failed` with the error recorded in
    // the snapshot so scoring failures are queryable (unlike the legacy
    // fire-and-forget hook which only logged).
    return executeScoreRun({ mastra, input: inputData as ScoreRunInput });
  },
});

/**
 * Strip payload bodies from persisted snapshots — a scoring run row is an
 * intent/outcome record, not a resume artifact. Keeps run identity, status,
 * error, timestamps, and the scorer/target identity needed for coverage
 * queries; drops hook input/output payloads and step results' bodies.
 */
export function pruneScoreRunSnapshot({ snapshot }: { snapshot: WorkflowRunState }): WorkflowRunState {
  const context = snapshot.context as Record<string, any> | undefined;
  const input = context?.input as Partial<ScoreRunInput> | undefined;

  const prunedInput = input
    ? {
        traceId: input.traceId,
        spanId: input.spanId,
        scorerId: input.hookData?.scorer?.id,
        entityId: input.hookData?.entity?.id,
        entityType: input.hookData?.entityType,
        runId: input.hookData?.runId,
      }
    : undefined;

  const prunedContext: Record<string, any> = {};
  if (prunedInput) {
    prunedContext.input = prunedInput;
  }
  for (const [stepId, stepResult] of Object.entries(context ?? {})) {
    if (stepId === 'input') continue;
    if (stepResult && typeof stepResult === 'object' && 'status' in stepResult) {
      const { status, error, startedAt, endedAt } = stepResult as Record<string, any>;
      prunedContext[stepId] = { status, error, startedAt, endedAt };
    }
  }

  return {
    ...snapshot,
    context: prunedContext as WorkflowRunState['context'],
    result: undefined,
  };
}

export const scoreRunWorkflow = createWorkflow({
  id: SCORE_RUN_WORKFLOW_ID,
  inputSchema: scoreRunInputSchema,
  outputSchema: z.any(),
  steps: [executeScorerStep],
  retryConfig: {
    attempts: 3,
    delay: 2000,
  },
  options: {
    validateInputs: false,
    // Internal scoring plumbing — hide its workflow spans from exported
    // traces. The scorer's own SCORER_RUN span keeps its own policy.
    tracingPolicy: {
      internal: InternalSpans.WORKFLOW,
    },
    // Persist the pending intent row (write-before-run) and the terminal
    // outcome; skip intermediate `running` writes to keep the hot path cheap.
    shouldPersistSnapshot: ({ workflowStatus }) =>
      workflowStatus === 'pending' || workflowStatus === 'success' || workflowStatus === 'failed',
    pruneSnapshot: pruneScoreRunSnapshot,
  },
});

scoreRunWorkflow.then(executeScorerStep).commit();
