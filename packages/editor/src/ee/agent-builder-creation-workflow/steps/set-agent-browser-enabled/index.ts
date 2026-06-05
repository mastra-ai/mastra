import { createStep } from '@mastra/core/workflows';

import { outputSchema, configSchema, type Config, type StepFactoryArgs } from '../../types';
import { createBrowserAgent } from './agent';
import { resolveBrowserEnabled } from './handler';

/**
 * Terminal step: resolve `browserEnabled` and finalize the fully-resolved agent
 * configuration (`outputSchema`). Instantiates the scoped browser agent from the
 * builder `model` and injects it into the handler (DI).
 */
export const createSetBrowserEnabledStep = ({ model }: StepFactoryArgs) =>
  createStep({
    id: 'set-agent-browser-enabled',
    description: 'Set whether the agent has browser access',
    inputSchema: configSchema,
    outputSchema,
    execute: async ({ inputData }) => {
      const config = inputData as Config;
      const agent = createBrowserAgent({ model });
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
        browserEnabled: await resolveBrowserEnabled(agent, config.description ?? '', undefined),
      };
    },
  });
