import { createTool } from '@mastra/client-js';
import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { z } from 'zod-v4';

import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';

export const SET_AGENT_INSTRUCTIONS_TOOL_NAME = 'set-agent-instructions';

export function useSetAgentInstructionsTool() {
  const formMethods = useFormContext<AgentBuilderEditFormValues>();

  return useMemo(
    () =>
      createTool({
        id: SET_AGENT_INSTRUCTIONS_TOOL_NAME,
        description:
          'Set the agent instructions (its system prompt). Use this when the user provides or revises the body of guidance the agent should follow.',
        inputSchema: z.object({
          instructions: z
            .string()
            .describe(
              'The full instructions / system prompt for the agent. May be multi-paragraph markdown. Replaces the previous instructions.',
            ),
        }),
        outputSchema: z.object({ success: z.boolean() }),
        execute: async (inputData: any) => {
          if (typeof inputData?.instructions === 'string') {
            formMethods.setValue('instructions', inputData.instructions, { shouldDirty: true });
          }
          return { success: true };
        },
      }),
    [formMethods],
  );
}
