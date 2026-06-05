import { createStep } from '@mastra/core/workflows';

import { resolveAvailableModels } from '../../available';
import { configSchema, type Config, type StepFactoryArgs } from '../../types';
import { createModelAgent } from './agent';
import { resolveModel } from './handler';

/**
 * Resolve the agent `model` selection. No-ops when the `model` capability isn't
 * enabled for the builder. Otherwise reads the registered Mastra builder to
 * enumerate the policy-allowed models, then injects the scoped model agent into
 * the handler (DI) so it picks one. Leaves `model` unset when none are allowed.
 */
export const createSetModelStep = ({ model }: StepFactoryArgs) =>
  createStep({
    id: 'set-agent-model',
    description: 'Set the agent model',
    inputSchema: configSchema,
    outputSchema: configSchema,
    execute: async ({ inputData, mastra }) => {
      const config = inputData as Config;
      // Skip entirely when the `model` capability isn't enabled for the builder.
      if (!config.featureCapabilities?.model) return config;

      const availableModels = await resolveAvailableModels(mastra);
      const agent = createModelAgent({ model });
      return { ...config, model: await resolveModel(agent, undefined, availableModels) };
    },
  });
