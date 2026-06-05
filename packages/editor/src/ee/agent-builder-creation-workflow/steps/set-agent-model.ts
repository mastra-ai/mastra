import { createStep } from '@mastra/core/workflows';

import { resolveModel } from '../handlers';
import { configSchema, type Config, type StepFactoryArgs, type WorkflowInput } from '../types';

/**
 * Resolve the agent `model` selection. Takes the builder `model` string for
 * signature consistency with the other step factories.
 */
export const createSetModelStep = ({ model }: StepFactoryArgs) => {
  void model;
  return createStep({
    id: 'set-agent-model',
    description: 'Set the agent model',
    inputSchema: configSchema,
    outputSchema: configSchema,
    execute: async ({ inputData, getInitData }) => {
      const init = getInitData<WorkflowInput>();
      const config = inputData as Config;
      return { ...config, model: resolveModel(init.model) };
    },
  });
};
