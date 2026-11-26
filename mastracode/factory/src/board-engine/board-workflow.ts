import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

export const FACTORY_BOARD_WORKFLOW_ID = 'factory-board';

const RUN_ID_PREFIX = `${FACTORY_BOARD_WORKFLOW_ID}:`;

/** One card's run: its id is the card's, so any caller finds it without a lookup. */
export function boardRunId(workItemId: string): string {
  return `${RUN_ID_PREFIX}${workItemId}`;
}

export interface FactoryBoardWorkflowDeps {
  /**
   * Applies the input the engine holds under `inputId` to the card the run belongs to. An id
   * the engine doesn't hold for that card (a resume Factory didn't make) applies nothing.
   */
  apply(inputId: string, workItemId: string): Promise<void>;
}

const runStateSchema = z.object({});

/**
 * The board workflow: one run per card, a loop around one phase step. Each visit of the step
 * waits for an input, applies it to the card, and loops back to wait again.
 *
 * The run's card comes from its run id, and a resume carries only the input's id. The request
 * and its answer stay with the engine that asked, so a run started or resumed through Mastra's
 * workflow API can't move a card, and the run stores nothing but its id.
 */
export function createFactoryBoardWorkflow(deps: FactoryBoardWorkflowDeps) {
  const phase = createStep({
    id: 'phase',
    inputSchema: runStateSchema,
    outputSchema: runStateSchema,
    resumeSchema: z.object({ inputId: z.uuid() }).strict(),
    suspendSchema: z.object({}),
    execute: async ({ runId, resumeData, suspend }) => {
      if (!resumeData?.inputId) return suspend({});
      if (runId.startsWith(RUN_ID_PREFIX)) await deps.apply(resumeData.inputId, runId.slice(RUN_ID_PREFIX.length));
      return {};
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
