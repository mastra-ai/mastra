import { createTool } from '@mastra/client-js';
import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { z } from 'zod-v4';

import { routeToolInputToFormKeys } from '../services/route-tool-input';
import type { AgentTool } from '../types/agent-tool';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';

export const SET_AGENT_TOOLS_TOOL_NAME = 'set-agent-tools';

interface UseSetAgentToolsToolArgs {
  availableAgentTools: AgentTool[];
}

export function useSetAgentToolsTool({ availableAgentTools }: UseSetAgentToolsToolArgs) {
  const formMethods = useFormContext<AgentBuilderEditFormValues>();

  return useMemo(() => {
    const toolIds = availableAgentTools.map(t => t.id);
    const toolIdSchema = toolIds.length > 0 ? z.enum(toolIds as [string, ...string[]]) : z.string();

    const availableToolsBlock =
      availableAgentTools.length > 0
        ? `\n\nAvailable tools (use these ids in the "tools" field):\n${availableAgentTools
            .map(t => `- ${t.id}${t.description ? `: ${t.description}` : ''}`)
            .join('\n')}`
        : '';

    return createTool({
      id: SET_AGENT_TOOLS_TOOL_NAME,
      description:
        'Set the tools, agents, and workflows enabled on the agent. Each entry MUST include both `id` (from the available tools list) and `name` (a concise Title Case display label, e.g. "Web Search"). The `name` is shown to the user in chat.' +
        availableToolsBlock,
      inputSchema: z.object({
        tools: z
          .array(
            z.object({
              id: toolIdSchema.describe(
                'The tool id. Only use ids from the available tools list in this tool description.',
              ),
              name: z
                .string()
                .min(1)
                .describe(
                  "A short, human-readable display name for this tool in Title Case (max ~3 words), derived from the tool's description.",
                ),
            }),
          )
          .describe(
            'Tools to enable on the agent. Each entry must include both the tool `id` and a concise human-readable `name`.',
          ),
      }),
      outputSchema: z.object({ success: z.boolean() }),
      execute: async (inputData: any) => {
        if (Array.isArray(inputData?.tools)) {
          const { tools, agents, workflows } = routeToolInputToFormKeys(availableAgentTools, inputData.tools);
          formMethods.setValue('tools', tools, { shouldDirty: true });
          formMethods.setValue('agents', agents, { shouldDirty: true });
          formMethods.setValue('workflows', workflows, { shouldDirty: true });
        }
        return { success: true };
      },
    });
  }, [formMethods, availableAgentTools]);
}
