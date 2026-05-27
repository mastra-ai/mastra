import { createTool } from '@mastra/client-js';
import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { z } from 'zod-v4';

import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';

export const SET_AGENT_WORKSPACE_ID_TOOL_NAME = 'set-agent-workspace-id';

export interface AvailableWorkspace {
  id: string;
  name: string;
}

interface UseSetAgentWorkspaceIdToolArgs {
  availableWorkspaces: AvailableWorkspace[];
}

export function useSetAgentWorkspaceIdTool({ availableWorkspaces }: UseSetAgentWorkspaceIdToolArgs) {
  const formMethods = useFormContext<AgentBuilderEditFormValues>();

  return useMemo(() => {
    const workspaceIds = availableWorkspaces.map(w => w.id);
    const workspaceIdSchema = workspaceIds.length > 0 ? z.enum(workspaceIds as [string, ...string[]]) : z.string();

    const availableWorkspacesBlock =
      availableWorkspaces.length > 0
        ? `\n\nAvailable workspaces (use these ids in the "workspaceId" field):\n${availableWorkspaces
            .map(w => `- ${w.id}: ${w.name}`)
            .join('\n')}`
        : '';

    return createTool({
      id: SET_AGENT_WORKSPACE_ID_TOOL_NAME,
      description:
        'Set the workspace the agent should belong to. Only use ids from the available workspaces list.' +
        availableWorkspacesBlock,
      inputSchema: z.object({
        workspaceId: workspaceIdSchema.describe(
          'Id of the workspace to attach to the agent. Only use ids from the available workspaces list.',
        ),
      }),
      outputSchema: z.object({ success: z.boolean() }),
      execute: async (inputData: any) => {
        if (typeof inputData?.workspaceId === 'string' && inputData.workspaceId.length > 0) {
          formMethods.setValue('workspaceId', inputData.workspaceId, { shouldDirty: true });
        }
        return { success: true };
      },
    });
  }, [formMethods, availableWorkspaces]);
}
