import { createStep } from '@mastra/core/workflows';

import { resolveDescription } from '../handlers';
import { configSchema, inputSchema, type StepFactoryArgs } from '../types';

/**
 * First step: read the raw workflow input and seed the config-in-progress with a
 * cleaned-up `description`. Takes the builder `model` so later revisions can spin
 * up a sub-agent (`new Agent({ model, ... })`) to refine the description.
 */
export const createSetDescriptionStep = ({ model }: StepFactoryArgs) => {
  void model;
  return createStep({
    id: 'set-agent-description',
    description: 'Set the agent description',
    inputSchema,
    outputSchema: configSchema,
    execute: async ({ inputData }) => {
      return { description: resolveDescription(inputData.description) };
    },
  });
};
