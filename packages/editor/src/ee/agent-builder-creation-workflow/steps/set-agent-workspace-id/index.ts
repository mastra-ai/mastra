import { createStep } from '@mastra/core/workflows';

import { resolveAvailableWorkspaces } from '../../available';
import { configSchema, type Config, type StepFactoryArgs } from '../../types';
import { createWorkspaceAgent } from './agent';
import { resolveWorkspaceId } from './handler';

/**
 * Resolve the `workspaceId` to attach the agent to. Reads the registered Mastra
 * instance to enumerate the available workspaces, then injects the scoped
 * workspace agent into the handler (DI) so it selects at most one. Leaves
 * `workspaceId` unset when none are registered.
 */
export const createSetWorkspaceIdStep = ({ model }: StepFactoryArgs) =>
  createStep({
    id: 'set-agent-workspace-id',
    description: 'Set the agent workspace id',
    inputSchema: configSchema,
    outputSchema: configSchema,
    execute: async ({ inputData, mastra }) => {
      const config = inputData as Config;
      const availableWorkspaces = await resolveAvailableWorkspaces(mastra);
      if (availableWorkspaces.length === 0) return config;

      const agent = createWorkspaceAgent({ model });
      return { ...config, workspaceId: await resolveWorkspaceId(agent, undefined, availableWorkspaces) };
    },
  });
