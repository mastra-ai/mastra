import type { StoredSkillResponse } from '@mastra/client-js';
import { createTool } from '@mastra/client-js';
import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { z } from 'zod-v4';

import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';

export const SET_AGENT_SKILLS_TOOL_NAME = 'set-agent-skills';

interface UseSetAgentSkillsToolArgs {
  availableSkills: StoredSkillResponse[];
}

export function useSetAgentSkillsTool({ availableSkills }: UseSetAgentSkillsToolArgs) {
  const formMethods = useFormContext<AgentBuilderEditFormValues>();

  return useMemo(() => {
    const skillIds = availableSkills.map(s => s.id);
    const skillIdSchema = skillIds.length > 0 ? z.enum(skillIds as [string, ...string[]]) : z.string();

    const availableSkillsBlock =
      availableSkills.length > 0
        ? `\n\nAvailable skills (use these ids in the "skills" field):\n${availableSkills
            .map(s => `- ${s.id}${s.description ? `: ${s.description}` : ''}`)
            .join('\n')}`
        : '';

    return createTool({
      id: SET_AGENT_SKILLS_TOOL_NAME,
      description:
        'Attach existing skills to the agent. Each entry MUST include both `id` (from the available skills list) and `name` (a concise Title Case display label). Use the separate `createSkillTool` tool to create NEW skills.' +
        availableSkillsBlock,
      inputSchema: z.object({
        skills: z
          .array(
            z.object({
              id: skillIdSchema.describe(
                'The skill id. Only use ids from the available skills list in this tool description.',
              ),
              name: z
                .string()
                .min(1)
                .describe('A short, human-readable Title Case display label for this skill (max ~3 words).'),
            }),
          )
          .describe(
            'Skills to enable on the agent. Each entry must include both the skill `id` and a concise human-readable `name`.',
          ),
      }),
      outputSchema: z.object({ success: z.boolean() }),
      execute: async (inputData: any) => {
        if (Array.isArray(inputData?.skills)) {
          const validSkillIds = new Set(availableSkills.map(s => s.id));
          const skills: Record<string, true> = {};
          for (const entry of inputData.skills) {
            if (entry && typeof entry.id === 'string' && validSkillIds.has(entry.id)) {
              skills[entry.id] = true;
            }
          }
          formMethods.setValue('skills', skills, { shouldDirty: true });
        }
        return { success: true };
      },
    });
  }, [formMethods, availableSkills]);
}
