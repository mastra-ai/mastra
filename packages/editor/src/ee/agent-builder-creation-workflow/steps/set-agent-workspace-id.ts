import { createStep } from '@mastra/core/workflows';

import { resolveWorkspaceId } from '../handlers';
import { configSchema, type Config, type StepFactoryArgs, type WorkflowInput } from '../types';

/**
 * Resolve the `workspaceId` to attach the agent to. Takes the builder `model`
 * for signature consistency with the other step factories.
 */
export const createSetWorkspaceIdStep = ({ model }: StepFactoryArgs) => {
  void model;
  return createStep({
    id: 'set-agent-workspace-id',
    description: 'Set the agent workspace id',
    inputSchema: configSchema,
    outputSchema: configSchema,
    execute: async ({ inputData, getInitData }) => {
      const init = getInitData<WorkflowInput>();
      const config = inputData as Config;
      return { ...config, workspaceId: resolveWorkspaceId(init.workspaceId) };
    },
  });
};
