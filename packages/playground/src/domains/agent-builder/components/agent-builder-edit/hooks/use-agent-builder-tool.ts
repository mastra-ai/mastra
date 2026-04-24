import { createTool } from '@mastra/client-js';
import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { z } from 'zod-v4';

import type { useBuilderAgentFeatures } from '../../../hooks/use-builder-agent-features';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';

export interface AvailableTool {
  id: string;
  description?: string;
}

export interface AvailableWorkspace {
  id: string;
  name: string;
}

interface UseAgentBuilderToolArgs {
  features: ReturnType<typeof useBuilderAgentFeatures>;
  availableTools: AvailableTool[];
  availableWorkspaces?: AvailableWorkspace[];
}

export const useAgentBuilderTool = ({
  features,
  availableTools,
  availableWorkspaces = [],
}: UseAgentBuilderToolArgs) => {
  const formMethods = useFormContext<AgentBuilderEditFormValues>();

  return useMemo(() => {
    const toolIds = availableTools.map(t => t.id);
    const workspaceIds = availableWorkspaces.map(w => w.id);

    const shape: Record<string, z.ZodType> = {
      name: z.string(),
      instructions: z.string(),
    };
    if (features.tools) {
      const toolsItemSchema = toolIds.length > 0 ? z.enum(toolIds as [string, ...string[]]) : z.string();
      shape.tools = z
        .array(toolsItemSchema)
        .describe(
          'Ids of the tools to enable on the agent. Only use ids from the available tools list in this tool description.',
        );
    }
    if (features.skills) {
      shape.skills = z.array(z.string());
    }
    const workspaceIdSchema =
      workspaceIds.length > 0 ? z.enum(workspaceIds as [string, ...string[]]) : z.string();
    shape.workspaceId = workspaceIdSchema
      .optional()
      .describe(
        'Id of the workspace to attach to the agent. Only use ids from the available workspaces list in this tool description.',
      );

    const descriptionParts = ['name', 'instructions'];
    if (features.tools) descriptionParts.push('tools');
    if (features.skills) descriptionParts.push('skills');
    descriptionParts.push('workspaceId');

    const availableToolsBlock =
      features.tools && availableTools.length > 0
        ? `\n\nAvailable tools (use these ids in the "tools" field):\n${availableTools
            .map(t => `- ${t.id}${t.description ? `: ${t.description}` : ''}`)
            .join('\n')}`
        : '';

    const availableWorkspacesBlock =
      availableWorkspaces.length > 0
        ? `\n\nAvailable workspaces (use these ids in the "workspaceId" field):\n${availableWorkspaces
            .map(w => `- ${w.id}: ${w.name}`)
            .join('\n')}`
        : '';

    return createTool({
      id: 'builder-agent-tool',
      description: `Modify the agent configuration that the user is building. Supported fields: ${descriptionParts.join(', ')}.${availableToolsBlock}${availableWorkspacesBlock}`,
      inputSchema: z.object(shape),
      outputSchema: z.object({
        success: z.boolean(),
      }),
      execute: async (inputData: any) => {
        if (typeof inputData?.name === 'string') {
          formMethods.setValue('name', inputData.name);
        }
        if (typeof inputData?.instructions === 'string') {
          formMethods.setValue('instructions', inputData.instructions);
        }
        if (features.tools && Array.isArray(inputData?.tools)) {
          const toolsRecord = Object.fromEntries(inputData.tools.map((id: string) => [id, true]));
          formMethods.setValue('tools', toolsRecord);
        }
        if (features.skills && Array.isArray(inputData?.skills)) {
          formMethods.setValue('skills', inputData.skills);
        }
        if (typeof inputData?.workspaceId === 'string' && inputData.workspaceId.length > 0) {
          formMethods.setValue('workspaceId', inputData.workspaceId);
        }

        return { success: true };
      },
    });
  }, [formMethods, features.tools, features.skills, availableTools, availableWorkspaces]);
};
