import { createStep } from '@mastra/core/workflows';

import { resolveInstructions } from '../handlers';
import { configSchema, type Config, type StepFactoryArgs, type WorkflowInput } from '../types';

/**
 * Resolve the agent `instructions` (system prompt) from the explicit value or a
 * default generated from the name and description. Takes the builder `model` for
 * future LLM-backed prompt synthesis.
 */
export const createSetInstructionsStep = ({ model }: StepFactoryArgs) => {
  void model;
  return createStep({
    id: 'set-agent-instructions',
    description: 'Set the agent instructions',
    inputSchema: configSchema,
    outputSchema: configSchema,
    execute: async ({ inputData, getInitData }) => {
      const init = getInitData<WorkflowInput>();
      const config = inputData as Config;
      return {
        ...config,
        instructions: resolveInstructions(config.name ?? '', config.description ?? '', init.instructions),
      };
    },
  });
};
