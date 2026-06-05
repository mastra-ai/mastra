import { createStep } from '@mastra/core/workflows';

import { configSchema, type Config, type StepFactoryArgs } from '../../types';
import { createInstructionsAgent } from './agent';
import { resolveInstructions } from './handler';

/**
 * Resolve the agent `instructions` (system prompt). Instantiates the scoped
 * instructions agent from the builder `model` and injects it into the handler
 * (DI).
 */
export const createSetInstructionsStep = ({ model }: StepFactoryArgs) =>
  createStep({
    id: 'set-agent-instructions',
    description: 'Set the agent instructions',
    inputSchema: configSchema,
    outputSchema: configSchema,
    execute: async ({ inputData }) => {
      const config = inputData as Config;
      const agent = createInstructionsAgent({ model });
      return {
        ...config,
        instructions: await resolveInstructions(
          agent,
          config.name ?? '',
          config.description ?? '',
          undefined,
          config.userOutcome,
        ),
      };
    },
  });
