import { createStep } from '@mastra/core/workflows';

import { configSchema, inputSchema, type StepFactoryArgs } from '../../types';
import { createUserOutcomeAgent } from './agent';
import { resolveUserOutcome } from './handler';

/**
 * First step: turn the raw user prompt (the workflow `prompt` input) into a
 * structured, LLM-understandable user outcome and seed the config-in-progress
 * with it. Every later step reads this `userOutcome` so the generated name,
 * description, instructions, etc. are grounded in what the user actually wants.
 *
 * Instantiates the scoped user-outcome agent from the builder `model` and
 * injects it into the handler (DI).
 */
export const createUnderstandUserOutcomeStep = ({ model }: StepFactoryArgs) =>
  createStep({
    id: 'understand-user-outcome',
    description: 'Understand the user outcome from the prompt',
    inputSchema,
    outputSchema: configSchema,
    execute: async ({ inputData }) => {
      const agent = createUserOutcomeAgent({ model });
      return { userOutcome: await resolveUserOutcome(agent, inputData.prompt) };
    },
  });
