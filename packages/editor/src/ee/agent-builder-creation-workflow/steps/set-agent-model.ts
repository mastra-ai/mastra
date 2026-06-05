import { createStep } from '@mastra/core/workflows';

import { createModelAgent } from '../agents';
import { resolveModel } from '../handlers';
import { configSchema, type Config, type StepFactoryArgs, type WorkflowInput } from '../types';

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
    execute: async ({ inputData, getInitData }) => {
      const init = getInitData<WorkflowInput>();
      const config = inputData as Config;
      const agent = createModelAgent({ model });
      return { ...config, model: await resolveModel(agent, init.model, init.availableModels) };
    },
  });
