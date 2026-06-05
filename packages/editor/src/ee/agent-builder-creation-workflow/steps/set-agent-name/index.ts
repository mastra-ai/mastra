import { createStep } from '@mastra/core/workflows';

import { configSchema, type Config, type StepFactoryArgs, type WorkflowInput } from '../../types';
import { createNameAgent } from './agent';
import { resolveName } from './handler';

/**
 * Resolve the agent `name`. Instantiates the scoped name agent from the builder
 * `model` and injects it into the handler (DI).
 */
export const createSetNameStep = ({ model }: StepFactoryArgs) =>
  createStep({
    id: 'set-agent-name',
    description: 'Set the agent name',
    inputSchema: configSchema,
    outputSchema: configSchema,
    execute: async ({ inputData, getInitData }) => {
      const init = getInitData<WorkflowInput>();
      const config = inputData as Config;
      const agent = createNameAgent({ model });
      return { ...config, name: await resolveName(agent, init.prompt, undefined, config.userOutcome) };
    },
  });
