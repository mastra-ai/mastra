import { createStep } from '@mastra/core/workflows';

import { createWorkspaceAgent } from '../agents';
import { resolveWorkspaceId } from '../handlers';
import { configSchema, type Config, type StepFactoryArgs, type WorkflowInput } from '../types';

/**
 * Resolve the `workspaceId` to attach the agent to. Instantiates the scoped
 * workspace agent from the builder `model` and injects it into the handler (DI).
 */
export const createSetWorkspaceIdStep = ({ model }: StepFactoryArgs) =>
  createStep({
    id: 'set-agent-workspace-id',
    description: 'Set the agent workspace id',
    inputSchema: configSchema,
    outputSchema: configSchema,
    execute: async ({ inputData, getInitData }) => {
      const init = getInitData<WorkflowInput>();
      const config = inputData as Config;
      const agent = createWorkspaceAgent({ model });
      return { ...config, workspaceId: await resolveWorkspaceId(agent, init.workspaceId) };
    },
  });
