import { createStep } from '@mastra/core/workflows';

import { configSchema, type Config, type StepFactoryArgs } from '../../types';

/**
 * Pass-through for the agent's skills. The workflow input is a single prompt
 * with no skill catalog to select from, so this step leaves the skills record
 * untouched; skills are attached later via the playground builder.
 */
export const createSetSkillsStep = (_args: StepFactoryArgs) =>
  createStep({
    id: 'set-agent-skills',
    description: 'Set the agent skills',
    inputSchema: configSchema,
    outputSchema: configSchema,
    execute: async ({ inputData }) => inputData as Config,
  });
