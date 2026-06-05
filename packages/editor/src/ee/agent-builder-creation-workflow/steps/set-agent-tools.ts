import { createStep } from '@mastra/core/workflows';

import { routeTools } from '../handlers';
import { configSchema, type Config, type StepFactoryArgs, type WorkflowInput } from '../types';

/**
 * Route the selected tool entries into `tools` / `agents` / `workflows` by their
 * type in the available list. Takes the builder `model` for future LLM-backed
 * tool selection.
 */
export const createSetToolsStep = ({ model }: StepFactoryArgs) => {
  void model;
  return createStep({
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
      const routed = routeTools(init.tools, init.availableAgentTools ?? []);
      return { ...config, tools: routed.tools, agents: routed.agents, workflows: routed.workflows };
    },
  });
};
