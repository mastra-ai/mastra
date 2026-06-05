import { createStep } from '@mastra/core/workflows';

import { resolveAvailableAgentTools } from '../../available';
import { configSchema, type AgentToolType, type Config, type StepFactoryArgs } from '../../types';
import { createToolsAgent } from './agent';
import { routeTools } from './handler';

/**
 * Resolve the agent's tools/agents/workflows. Reads the registered Mastra
 * instance to enumerate the available tools/agents/workflows (with admin picker
 * allowlists applied), then injects the scoped tools agent into the handler so
 * it selects the minimum relevant set.
 *
 * Each entry type is gated by its own builder capability (`tools`, `agents`,
 * `workflows`): types whose capability is disabled are dropped before selection.
 * No-ops when nothing is available or no relevant capability is enabled.
 */
export const createSetToolsStep = ({ model }: StepFactoryArgs) =>
  createStep({
    id: 'set-agent-tools',
    description: 'Set the agent tools/agents/workflows',
    inputSchema: configSchema,
    outputSchema: configSchema,
    execute: async ({ inputData, mastra }) => {
      const config = inputData as Config;
      const capabilities = config.featureCapabilities;

      // Only offer entry types whose capability is enabled for the builder.
      const enabledByType: Record<AgentToolType, boolean> = {
        tool: capabilities?.tools ?? false,
        agent: capabilities?.agents ?? false,
        workflow: capabilities?.workflows ?? false,
      };
      if (!enabledByType.tool && !enabledByType.agent && !enabledByType.workflow) return config;

      const availableAgentTools = (await resolveAvailableAgentTools(mastra)).filter(item => enabledByType[item.type]);
      if (availableAgentTools.length === 0) return config;

      const entries = availableAgentTools.map(item => ({ id: item.id, name: item.name }));
      const agent = createToolsAgent({ model });
      const routed = await routeTools(agent, entries, availableAgentTools);

      return { ...config, tools: routed.tools, agents: routed.agents, workflows: routed.workflows };
    },
  });
