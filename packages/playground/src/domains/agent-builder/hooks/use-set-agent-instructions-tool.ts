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
        description: `Set the agent instructions (its system prompt). Use this when the user provides or revises the body of guidance the agent should follow. HARD limit: ${MAX_GENERATED_INSTRUCTIONS_CHARS} characters. Over-limit calls are REJECTED (no persistence) — you must re-submit a tighter version. Plan length BEFORE calling and drop whole sections rather than shaving words when over budget.`,
        inputSchema: z.object({
          instructions: z
            .string()
            .describe(
              `The full instructions / system prompt for the agent. May be multi-paragraph markdown. Replaces the previous instructions. HARD ${MAX_GENERATED_INSTRUCTIONS_CHARS}-character limit; over-limit calls are rejected without persisting. Count characters before calling.`,
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
          formMethods.setValue('instructions', value, { shouldDirty: true });
          return {
            success: true,
            rejected: false,
            currentLength,
            limit: MAX_GENERATED_INSTRUCTIONS_CHARS,
            finalLength: currentLength,
          };
        },
      }),
    [formMethods],
  );
}
