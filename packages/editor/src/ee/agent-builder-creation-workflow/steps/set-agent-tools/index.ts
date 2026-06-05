import { createStep } from '@mastra/core/workflows';

import { configSchema, type Config, type StepFactoryArgs } from '../../types';

/**
 * Pass-through for the agent's tools/agents/workflows. The workflow input is a
 * single prompt with no tool catalog to select from, so this step leaves the
 * tool records untouched; tools are attached later via the playground builder.
 */
export const createSetToolsStep = (_args: StepFactoryArgs) =>
  createStep({
    id: 'set-agent-tools',
    description: 'Set the agent tools/agents/workflows',
    inputSchema: configSchema,
    outputSchema: configSchema,
    execute: async ({ inputData }) => inputData as Config,
  });
