import { createStep } from '@mastra/core/workflows';

import { configSchema, type Config, type StepFactoryArgs } from '../../types';
import { createModelAgent } from './agent';
import { resolveModel } from './handler';

/**
 * Resolve the agent `model` selection. Instantiates the scoped model agent from
 * the builder `model` and injects it into the handler (DI).
 */
export const createSetModelStep = ({ model }: StepFactoryArgs) =>
  createStep({
    id: 'set-agent-model',
    description: 'Set the agent model',
    inputSchema: configSchema,
    outputSchema: configSchema,
    execute: async ({ inputData }) => {
      const config = inputData as Config;
      const agent = createModelAgent({ model });
      return { ...config, model: await resolveModel(agent, undefined, undefined) };
    },
  });
