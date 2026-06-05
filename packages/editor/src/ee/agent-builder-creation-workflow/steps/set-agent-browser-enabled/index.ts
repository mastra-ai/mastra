import { createStep } from '@mastra/core/workflows';

import { resolveBrowserAvailable } from '../../available';
import { configSchema, type Config, type StepFactoryArgs } from '../../types';
import { createBrowserAgent } from './agent';
import { resolveBrowserEnabled } from './handler';

/**
 * Resolve `browserEnabled` and thread the accumulated config forward
 * (`configSchema`). When the `browser` capability isn't enabled for the builder,
 * browser access is forced off without consulting the builder or the agent.
 * Otherwise it reads the registered Mastra builder to check whether browser
 * automation is configured: when it isn't, browser access is forced off (you
 * can't enable what isn't wired); when it is, the injected browser agent decides
 * based on the agent's description. The terminal `persist-agent` step consumes
 * this config and creates the agent.
 */
export const createSetBrowserEnabledStep = ({ model }: StepFactoryArgs) =>
  createStep({
    id: 'set-agent-browser-enabled',
    description: 'Set whether the agent has browser access',
    inputSchema: configSchema,
    outputSchema: configSchema,
    execute: async ({ inputData, mastra }) => {
      const config = inputData as Config;

      // When the `browser` capability isn't enabled for the builder, force it off
      // without consulting availability or the agent.
      if (!config.featureCapabilities?.browser) {
        return { ...config, browserEnabled: false };
      }

      const agent = createBrowserAgent({ model });
      const browserAvailable = await resolveBrowserAvailable(mastra);
      // When browser isn't configured, force it off; otherwise let the agent decide.
      const explicitBrowserEnabled = browserAvailable ? undefined : false;
      return {
        ...config,
        browserEnabled: await resolveBrowserEnabled(agent, config.description ?? '', explicitBrowserEnabled),
      };
    },
  });
