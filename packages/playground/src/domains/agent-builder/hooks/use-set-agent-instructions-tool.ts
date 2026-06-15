import { createTool } from '@mastra/client-js';
import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { z } from 'zod-v4';

import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';
import { MAX_GENERATED_INSTRUCTIONS_CHARS } from '@/domains/agent-builder/services/build-form-snapshot';

export const SET_AGENT_INSTRUCTIONS_TOOL_NAME = 'set-agent-instructions';

export function useSetAgentInstructionsTool() {
  const formMethods = useFormContext<AgentBuilderEditFormValues>();

  return useMemo(
    () =>
      createTool({
        id: SET_AGENT_INSTRUCTIONS_TOOL_NAME,
        description:
          'Set the agent instructions (its system prompt). Use this when the user provides or revises the body of guidance the agent should follow. Prefer a few focused paragraphs or compact bullet groups, target 1,200–2,000 characters, and stay under 2,500 characters unless the user explicitly needs more detail.',
        inputSchema: z.object({
          instructions: z
            .string()
            .describe(
              'The full instructions / system prompt for the agent. Should usually be 2–4 short paragraphs or compact bullet groups, targeting 1,200–2,000 characters and staying under 2,500 characters. Replaces the previous instructions.',
            ),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          rejected: z.boolean().optional(),
          currentLength: z.number().optional(),
          limit: z.number().optional(),
          finalLength: z.number().optional(),
          message: z.string().optional(),
        }),
        execute: async (inputData: any) => {
          if (typeof inputData?.instructions !== 'string') {
            return { success: true };
          }
          const value = inputData.instructions;
          const currentLength = value.length;
          if (currentLength > MAX_GENERATED_INSTRUCTIONS_CHARS) {
            return {
              success: false,
              rejected: true,
              currentLength,
              limit: MAX_GENERATED_INSTRUCTIONS_CHARS,
              message:
                'Rejected because the instructions are too long. Nothing was persisted. Rewrite as 2–4 short paragraphs or compact bullet groups, targeting 1,200–2,000 characters, and call set-agent-instructions once more.',
            };
          }
          formMethods.setValue('instructions', value, { shouldDirty: true });
          return {
            success: true,
            rejected: false,
            currentLength,
            finalLength: currentLength,
          };
        },
      }),
    [formMethods],
  );
}
