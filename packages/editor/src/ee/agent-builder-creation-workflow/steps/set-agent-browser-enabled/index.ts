import { createStep } from '@mastra/core/workflows';

import { resolveBrowserAvailable } from '../../available';
import { outputSchema, configSchema, type Config, type StepFactoryArgs } from '../../types';
import { createBrowserAgent } from './agent';
import { resolveBrowserEnabled } from './handler';

/**
 * Terminal step: resolve `browserEnabled` and finalize the fully-resolved agent
 * configuration (`outputSchema`). Reads the registered Mastra builder to check
 * whether browser automation is configured: when it isn't, browser access is
 * forced off (you can't enable what isn't wired); when it is, the injected
 * browser agent decides based on the agent's description.
 */
export const createSetBrowserEnabledStep = ({ model }: StepFactoryArgs) =>
  createStep({
    id: 'set-agent-browser-enabled',
    description: 'Set whether the agent has browser access',
    inputSchema: configSchema,
    outputSchema,
    execute: async ({ inputData, mastra }) => {
      const config = inputData as Config;
      const agent = createBrowserAgent({ model });
      const browserAvailable = await resolveBrowserAvailable(mastra);
      // When browser isn't configured, force it off; otherwise let the agent decide.
      const explicitBrowserEnabled = browserAvailable ? undefined : false;
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
        browserEnabled: await resolveBrowserEnabled(agent, config.description ?? '', explicitBrowserEnabled),
      };
    },
  });
