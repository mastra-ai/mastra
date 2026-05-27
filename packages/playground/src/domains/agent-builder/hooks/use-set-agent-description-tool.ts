import { createTool } from '@mastra/client-js';
import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { z } from 'zod-v4';

import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';

export const SET_AGENT_DESCRIPTION_TOOL_NAME = 'set-agent-description';

export function useSetAgentDescriptionTool() {
  const formMethods = useFormContext<AgentBuilderEditFormValues>();

  return useMemo(
    () =>
      createTool({
        id: SET_AGENT_DESCRIPTION_TOOL_NAME,
        description:
          'Set the agent description. Use this for a short, human-readable summary of what this agent does. Shown to users when browsing agents. Keep it concise (one sentence).',
        inputSchema: z.object({
          description: z
            .string()
            .describe(
              'A short, human-readable summary of what this agent does. Shown to users when browsing agents. Keep it concise (one sentence).',
            ),
        }),
        outputSchema: z.object({ success: z.boolean() }),
        execute: async (inputData: any) => {
          if (typeof inputData?.description === 'string') {
            formMethods.setValue('description', inputData.description, { shouldDirty: true });
          }
          return { success: true };
        },
      }),
    [formMethods],
  );
}
