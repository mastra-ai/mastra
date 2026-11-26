import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

export const FACTORY_BOARD_WORKFLOW_ID = 'factory-board';

const RUN_ID_PREFIX = `${FACTORY_BOARD_WORKFLOW_ID}:`;

/** One card's run: its id is the card's, so any caller finds it without a lookup. */
export function boardRunId(workItemId: string): string {
  return `${RUN_ID_PREFIX}${workItemId}`;
}

export const FACTORY_CARD_STEP_STATES = [
  'resting',
  'awaiting_start',
  'running',
  'probing',
  'awaiting_approval',
  'needs_attention',
  'terminal',
] as const;

const runStateSchema = z.object({
  state: z.enum(FACTORY_CARD_STEP_STATES).optional(),
  phase: z.string().optional(),
  probes: z.number().int().nonnegative().optional(),
  lastOutcome: z.string().optional(),
  reason: z.string().optional(),
  /** The last run end counted as ending without an outcome, so telling of it again counts nothing. */
  countedRunEnd: z.string().optional(),
});

/**
 * What a card is doing, as its board run last recorded it: phase keys, counts and short reasons,
 * never a request or who made it. Empty until the run applied its first input.
 */
export type FactoryCardRunState = Omit<FactoryCardRunRecord, 'countedRunEnd'>;

/** Everything the run carries from one input to the next. */
export type FactoryCardRunRecord = z.infer<typeof runStateSchema>;

export interface FactoryBoardWorkflowDeps {
  /**
   * Applies the input the engine holds under `inputId` to the card the run belongs to, and
   * answers what the card is doing now. An id the engine doesn't hold for that card (a resume
   * Factory didn't make) applies nothing and answers nothing, which keeps the state as it was.
   */
  apply(inputId: string, workItemId: string, state: FactoryCardRunRecord): Promise<FactoryCardRunRecord | undefined>;
}

/**
 * The board workflow: one run per card, a loop around one phase step. Each visit of the step
 * waits for an input, applies it to the card, and loops back to wait again, carrying what the
 * card is doing now.
 *
 * The run's card comes from its run id, and a resume carries only the input's id. The request
 * and its answer stay with the engine that asked, so a run started or resumed through Mastra's
 * workflow API can't move a card, and the run stores nothing of the card but its id and state.
 */
export function createFactoryBoardWorkflow(deps: FactoryBoardWorkflowDeps) {
  const phase = createStep({
    id: 'phase',
    inputSchema: runStateSchema,
    outputSchema: runStateSchema,
    resumeSchema: z.object({ inputId: z.uuid() }).strict(),
    suspendSchema: z.object({}),
    execute: async ({ runId, inputData, resumeData, suspend }) => {
      if (!resumeData?.inputId) return suspend({});
      if (!runId.startsWith(RUN_ID_PREFIX)) return inputData;
      return (await deps.apply(resumeData.inputId, runId.slice(RUN_ID_PREFIX.length), inputData)) ?? inputData;
    },
  });

  return createWorkflow({
    id: FACTORY_BOARD_WORKFLOW_ID,
    inputSchema: runStateSchema,
    outputSchema: runStateSchema,
  })
    .dountil(phase, async () => false)
    .commit();
}

export type FactoryBoardWorkflow = ReturnType<typeof createFactoryBoardWorkflow>;
