import { createStep } from '@mastra/core/workflows';

import { createDescriptionAgent } from '../agents';
import { resolveDescription } from '../handlers';
import { configSchema, inputSchema, type StepFactoryArgs } from '../types';

/**
 * First step: read the raw workflow input and seed the config-in-progress with a
 * `description`. Instantiates the scoped description agent from the builder
 * `model` and injects it into the handler (DI).
 */
export const createSetDescriptionStep = ({ model }: StepFactoryArgs) =>
  createStep({
    id: 'set-agent-description',
    description: 'Set the agent description',
    inputSchema,
    outputSchema: configSchema,
    execute: async ({ inputData }) => {
      const agent = createDescriptionAgent({ model });
      return { description: await resolveDescription(agent, inputData.description) };
    },
  });
