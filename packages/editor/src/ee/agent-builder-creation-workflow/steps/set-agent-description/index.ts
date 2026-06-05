import { createStep } from '@mastra/core/workflows';

import { configSchema, type Config, type StepFactoryArgs, type WorkflowInput } from '../../types';
import { createDescriptionAgent } from './agent';
import { resolveDescription } from './handler';

/**
 * Seed the config-in-progress with a `description`, grounded in the structured
 * user outcome resolved by the first step. Instantiates the scoped description
 * agent from the builder `model` and injects it into the handler (DI).
 */
export const createSetDescriptionStep = ({ model }: StepFactoryArgs) =>
  createStep({
    id: 'set-agent-description',
    description: 'Set the agent description',
    inputSchema: configSchema,
    outputSchema: configSchema,
    execute: async ({ inputData, getInitData }) => {
      const init = getInitData<WorkflowInput>();
      const config = inputData as Config;
      const agent = createDescriptionAgent({ model });
      return {
        ...config,
        description: await resolveDescription(agent, init.prompt, config.userOutcome),
      };
    },
  });
