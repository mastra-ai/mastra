import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

export const FACTORY_BOARD_WORKFLOW_ID = 'factory-board';

/** One card's run: its id is the card's, so any caller finds it without a lookup. */
export function boardRunId(workItemId: string): string {
  return `${FACTORY_BOARD_WORKFLOW_ID}:${workItemId}`;
}

/** The card a run belongs to, fixed when the run starts. */
export interface FactoryBoardRunCard {
  orgId: string;
  factoryProjectId: string;
  workItemId: string;
}

export interface FactoryBoardWorkflowDeps {
  /**
   * Applies the input the engine holds under `inputId` to the run's card. An id the engine
   * doesn't hold for that card (a resume Factory didn't make) applies nothing.
   */
  apply(inputId: string, card: FactoryBoardRunCard): Promise<void>;
}

const runStateSchema = z.object({
  orgId: z.string(),
  factoryProjectId: z.string(),
  workItemId: z.string(),
});

/**
 * The board workflow: one run per card, a loop around one phase step. Each visit of the step
 * waits for an input, applies it to the card, and loops back to wait again.
 *
 * A resume carries only the input's id. The request and its answer stay with the engine that
 * asked, so a resume made through Mastra's workflow API can't move a card, and the run's
 * snapshot holds nothing but the card's ids.
 */
export function createFactoryBoardWorkflow(deps: FactoryBoardWorkflowDeps) {
  const phase = createStep({
    id: 'phase',
    inputSchema: runStateSchema,
    outputSchema: runStateSchema,
    resumeSchema: z.object({ inputId: z.uuid() }).strict(),
    suspendSchema: z.object({}),
    execute: async ({ inputData, resumeData, suspend }) => {
      const card = {
        orgId: inputData.orgId,
        factoryProjectId: inputData.factoryProjectId,
        workItemId: inputData.workItemId,
      };
      if (!resumeData?.inputId) return suspend({});
      await deps.apply(resumeData.inputId, card);
      return card;
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
