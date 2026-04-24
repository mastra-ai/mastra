import { createTool } from '@mastra/client-js';
import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { z } from 'zod-v4';

import type { useBuilderAgentFeatures } from '../../../hooks/use-builder-agent-features';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';

export const AGENT_BUILDER_TOOL_NAME = 'agentBuilderTool';

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
      description: z
        .string()
        .optional()
        .describe(
          'A short, human-readable summary of what this agent does. Shown to users when browsing agents. Keep it concise (one sentence).',
        ),
      instructions: z.string(),
    };
    if (features.tools) {
      const toolIdSchema = toolIds.length > 0 ? z.enum(toolIds as [string, ...string[]]) : z.string();
      shape.tools = z
        .array(
          z.object({
            id: toolIdSchema.describe(
              'The tool id. Only use ids from the available tools list in this tool description.',
            ),
            name: z
              .string()
              .min(1)
              .describe(
                'A short, human-readable display name for this tool in Title Case (max ~3 words), derived from the tool\'s description. Example: "Web Search", "Weather Lookup". Shown to the user in chat.',
              ),
          }),
        )
        .describe(
          "Tools to enable on the agent. Each entry must include both the tool `id` (from the available tools list) and a concise human-readable `name` derived from that tool's description.",
        );
    }
    if (features.skills) {
      shape.skills = z.array(z.string());
    }
    const workspaceIdSchema = workspaceIds.length > 0 ? z.enum(workspaceIds as [string, ...string[]]) : z.string();
    shape.workspaceId = workspaceIdSchema
      .optional()
      .describe(
        'Id of the workspace to attach to the agent. Only use ids from the available workspaces list in this tool description.',
      );

    const descriptionParts = ['name', 'description', 'instructions'];
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

    const toolsGuidance = features.tools
      ? ' When enabling tools, each entry in `tools` MUST include both `id` (from the available tools list) and `name` (a concise Title Case display label, e.g. "Web Search"). The `name` is shown to the user in chat.'
      : '';

    return createTool({
      id: AGENT_BUILDER_TOOL_NAME,
      description: `Modify the agent configuration that the user is building. Supported fields: ${descriptionParts.join(', ')}.${toolsGuidance}${availableToolsBlock}${availableWorkspacesBlock}`,
      inputSchema: z.object(shape),
      outputSchema: z.object({
        success: z.boolean(),
      }),
      execute: async (inputData: any) => {
        if (typeof inputData?.name === 'string') {
          formMethods.setValue('name', inputData.name);
        }
        if (typeof inputData?.description === 'string') {
          formMethods.setValue('description', inputData.description);
        }
        if (typeof inputData?.instructions === 'string') {
          formMethods.setValue('instructions', inputData.instructions);
        }
        if (features.tools && Array.isArray(inputData?.tools)) {
          const toolsRecord = Object.fromEntries(
            inputData.tools.map((entry: { id: string; name: string }) => [entry.id, true]),
          );
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
