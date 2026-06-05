import { createStep } from '@mastra/core/workflows';

import { createToolsAgent } from '../agents';
import { routeTools } from '../handlers';
import { configSchema, type Config, type StepFactoryArgs, type WorkflowInput } from '../types';

/**
 * Select and route the agent's tools/agents/workflows. Instantiates the scoped
 * tools agent from the builder `model` and injects it into the handler (DI).
 */
export const createSetToolsStep = ({ model }: StepFactoryArgs) =>
  createStep({
    id: 'set-agent-tools',
    description: 'Set the agent tools/agents/workflows',
    inputSchema: configSchema,
    outputSchema: configSchema,
    execute: async ({ inputData, getInitData }) => {
      const init = getInitData<WorkflowInput>();
      const config = inputData as Config;
      if (!init.tools) {
        return config;
      }
      const agent = createToolsAgent({ model });
      const routed = await routeTools(agent, init.tools, init.availableAgentTools ?? []);
      return { ...config, tools: routed.tools, agents: routed.agents, workflows: routed.workflows };
    },
  });
