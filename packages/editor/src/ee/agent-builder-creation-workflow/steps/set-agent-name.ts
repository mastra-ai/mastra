import { createStep } from '@mastra/core/workflows';

import { resolveName } from '../handlers';
import { configSchema, type Config, type StepFactoryArgs, type WorkflowInput } from '../types';

/**
 * Resolve the agent `name` from the explicit name or the original description.
 * Takes the builder `model` for future LLM-backed naming.
 */
export const createSetNameStep = ({ model }: StepFactoryArgs) => {
  void model;
  return createStep({
    id: 'set-agent-name',
    description: 'Set the agent name',
    inputSchema: configSchema,
    outputSchema: configSchema,
    execute: async ({ inputData, getInitData }) => {
      const init = getInitData<WorkflowInput>();
      const config = inputData as Config;
      return { ...config, name: resolveName(init.description, init.name) };
    },
  });
};
