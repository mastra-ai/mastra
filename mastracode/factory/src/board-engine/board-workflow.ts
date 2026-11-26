import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

import type { FactoryTransitionRequest } from '../rules/transition-service.js';
import type { FactoryTransitionResult } from '../rules/types.js';

export const FACTORY_BOARD_WORKFLOW_ID = 'factory-board';

/** One card's run: its id is the card's, so any caller finds it without a lookup. */
export function boardRunId(workItemId: string): string {
  return `${FACTORY_BOARD_WORKFLOW_ID}:${workItemId}`;
}

/** Something asked of a card's run. */
export type FactoryCardInput = { type: 'move'; inputId: string; request: FactoryTransitionRequest };

/** An error the step caught, carried back to the caller that asked for the input. */
export interface FactoryCardInputError {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  settled?: boolean;
}

/** The step's answer to the last input it took, keyed by that input's id. */
export type FactoryCardAnswer =
  | { inputId: string; type: 'move'; result: FactoryTransitionResult }
  | { inputId: string; error: FactoryCardInputError };

export interface FactoryBoardWorkflowDeps {
  requestMove(request: FactoryTransitionRequest): Promise<FactoryTransitionResult>;
}

// The card's request and verdict are Factory's own records; the run carries them, it doesn't shape them.
const cardInputSchema = z.custom<FactoryCardInput>(value => typeof value === 'object' && value !== null);
const answerSchema = z.custom<FactoryCardAnswer>(value => typeof value === 'object' && value !== null);

const runStateSchema = z.object({
  orgId: z.string(),
  factoryProjectId: z.string(),
  workItemId: z.string(),
  answer: answerSchema.optional(),
});

function inputError(error: unknown): FactoryCardInputError {
  if (!(error instanceof Error)) return { name: 'Error', message: String(error) };
  const fields = error as Error & { code?: unknown; settled?: unknown };
  return {
    name: error.name,
    message: error.message,
    ...(error.stack ? { stack: error.stack } : {}),
    ...(typeof fields.code === 'string' ? { code: fields.code } : {}),
    ...(typeof fields.settled === 'boolean' ? { settled: fields.settled } : {}),
  };
}

/**
 * The board workflow: one run per card, a loop around one phase step. Each visit of the step
 * waits for an input, applies it to the card, and hands its answer to the next visit, which
 * waits again with that answer in its suspend payload. The run keeps only the last answer;
 * the card's history stays on the card.
 */
export function createFactoryBoardWorkflow(deps: FactoryBoardWorkflowDeps) {
  const phase = createStep({
    id: 'phase',
    inputSchema: runStateSchema,
    outputSchema: runStateSchema,
    resumeSchema: z.object({ input: cardInputSchema }),
    suspendSchema: z.object({ answer: answerSchema.optional() }),
    execute: async ({ inputData, resumeData, suspend }) => {
      const input = resumeData?.input;
      if (!input) return suspend(inputData.answer ? { answer: inputData.answer } : {});
      let answer: FactoryCardAnswer;
      try {
        answer = { inputId: input.inputId, type: 'move', result: await deps.requestMove(input.request) };
      } catch (error) {
        // A failed input is the caller's to report; the card's run keeps waiting for the next one.
        answer = { inputId: input.inputId, error: inputError(error) };
      }
      return {
        orgId: inputData.orgId,
        factoryProjectId: inputData.factoryProjectId,
        workItemId: inputData.workItemId,
        answer,
      };
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
