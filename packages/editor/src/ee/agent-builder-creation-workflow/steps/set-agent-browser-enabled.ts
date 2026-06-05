import { createStep } from '@mastra/core/workflows';

import { resolveBrowserEnabled } from '../handlers';
import { configSchema, outputSchema, type Config, type StepFactoryArgs, type WorkflowInput } from '../types';

/**
 * Terminal step: resolve `browserEnabled` and finalize the fully-resolved agent
 * configuration (`outputSchema`). Takes the builder `model` for signature
 * consistency with the other step factories.
 */
export const createSetBrowserEnabledStep = ({ model }: StepFactoryArgs) => {
  void model;
  return createStep({
    id: 'set-agent-browser-enabled',
    description: 'Set whether the agent has browser access',
    inputSchema: configSchema,
    outputSchema,
    execute: async ({ inputData, getInitData }) => {
      const init = getInitData<WorkflowInput>();
      const config = inputData as Config;
      return {
        name: config.name ?? '',
        description: config.description ?? '',
        instructions: config.instructions ?? '',
        workspaceId: config.workspaceId,
        tools: config.tools,
        agents: config.agents,
        workflows: config.workflows,
        skills: config.skills,
        model: config.model,
        browserEnabled: resolveBrowserEnabled(init.browserEnabled),
      };
    },
  });
};
