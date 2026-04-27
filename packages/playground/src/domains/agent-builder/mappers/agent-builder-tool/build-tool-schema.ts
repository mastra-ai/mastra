import { z } from 'zod-v4';
import type { useBuilderAgentFeatures } from '../../hooks/use-builder-agent-features';
import type { AgentTool } from '../../types/agent-tool';

interface AvailableWorkspace {
  id: string;
  name: string;
}

type Features = ReturnType<typeof useBuilderAgentFeatures>;

export function buildAgentBuilderToolSchema(
  features: Features,
  availableAgentTools: AgentTool[],
  availableWorkspaces: AvailableWorkspace[],
): z.ZodObject<Record<string, z.ZodType>> {
  const toolIds = availableAgentTools.map(t => t.id);
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

  return z.object(shape);
}
