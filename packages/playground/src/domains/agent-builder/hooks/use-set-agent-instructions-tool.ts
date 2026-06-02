import { createTool } from '@mastra/client-js';
import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { z } from 'zod-v4';

import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';
import { MAX_GENERATED_INSTRUCTIONS_CHARS } from '@/domains/agent-builder/services/build-form-snapshot';

export const SET_AGENT_INSTRUCTIONS_TOOL_NAME = 'set-agent-instructions';

const TRUNCATION_NOTICE = '\n\n[…truncated to fit length limit]';

/**
 * Backstop for the snapshot-level soft cap on `instructions`. The builder LLM
 * is told the limit is strict; this enforces it before the value reaches the
 * form so an over-long value (or a partially-streamed one) can never push the
 * agent into an inconsistent state.
 */
function clampInstructions(value: string): { value: string; truncated: boolean; originalLength: number } {
  const originalLength = value.length;
  if (originalLength <= MAX_GENERATED_INSTRUCTIONS_CHARS) {
    return { value, truncated: false, originalLength };
  }
  const room = MAX_GENERATED_INSTRUCTIONS_CHARS - TRUNCATION_NOTICE.length;
  const clipped = value.slice(0, Math.max(0, room)).trimEnd() + TRUNCATION_NOTICE;
  return { value: clipped, truncated: true, originalLength };
}

export function useSetAgentInstructionsTool() {
  const formMethods = useFormContext<AgentBuilderEditFormValues>();

  return useMemo(
    () =>
      createTool({
        id: SET_AGENT_INSTRUCTIONS_TOOL_NAME,
        description: `Set the agent instructions (its system prompt). Use this when the user provides or revises the body of guidance the agent should follow. Hard limit: ${MAX_GENERATED_INSTRUCTIONS_CHARS} characters — content beyond that is truncated server-side.`,
        inputSchema: z.object({
          instructions: z
            .string()
            .describe(
              `The full instructions / system prompt for the agent. May be multi-paragraph markdown. Replaces the previous instructions. Strict ${MAX_GENERATED_INSTRUCTIONS_CHARS}-character limit; anything past that is truncated.`,
            ),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          truncated: z.boolean().optional(),
          originalLength: z.number().optional(),
          finalLength: z.number().optional(),
        }),
        execute: async (inputData: any) => {
          if (typeof inputData?.instructions !== 'string') {
            return { success: true };
          }
          const { value, truncated, originalLength } = clampInstructions(inputData.instructions);
          formMethods.setValue('instructions', value, { shouldDirty: true });
          return {
            success: true,
            truncated,
            originalLength,
            finalLength: value.length,
          };
        },
      }),
    [formMethods],
  );
}
