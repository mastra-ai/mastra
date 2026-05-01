import { createTool } from '@mastra/client-js';
import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { z } from 'zod-v4';

import type { AvailableWorkspace } from './use-agent-builder-tool';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';
import { createInitialStructure, updateNodeContent } from '@/domains/agents/components/agent-cms-pages/skill-file-tree';
import { useCreateSkill } from '@/domains/agents/hooks/use-create-skill';
import { useDefaultVisibility } from '@/domains/auth/hooks/use-default-visibility';

export const CREATE_SKILL_TOOL_NAME = 'createSkillTool';

interface UseCreateSkillToolArgs {
  availableWorkspaces?: AvailableWorkspace[];
}

export function useCreateSkillTool({ availableWorkspaces = [] }: UseCreateSkillToolArgs = {}) {
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const createSkill = useCreateSkill();
  const defaultVisibility = useDefaultVisibility();

  return useMemo(() => {
    const workspaceIds = availableWorkspaces.map(w => w.id);
    const hasWorkspaces = workspaceIds.length > 0;

    const workspaceField = hasWorkspaces
      ? z.enum(workspaceIds as [string, ...string[]]).optional()
      : z.string().optional();

    const inputSchema = z.object({
      name: z.string().min(1),
      description: z.string().min(1),
      instructions: z.string().min(1),
      workspaceId: workspaceField,
      visibility: z.enum(['private', 'public']).optional(),
    });

    const workspacesBlock = hasWorkspaces
      ? `\n\nAvailable workspaces (use these ids in the "workspaceId" field):\n${availableWorkspaces
          .map(w => `- ${w.id}: ${w.name}`)
          .join('\n')}`
      : '';

    return createTool({
      id: CREATE_SKILL_TOOL_NAME,
      description:
        'Create a new stored skill and automatically attach it to the agent currently being edited. ' +
        'Provide `name`, `description`, and `instructions` (markdown body for SKILL.md). ' +
        'Optionally provide `workspaceId` (required when more than one workspace is available) and `visibility` (defaults to "private"). ' +
        "On success the new skill is added to the agent's selected skills." +
        workspacesBlock,
      inputSchema,
      outputSchema: z.object({
        success: z.boolean(),
        skillId: z.string().optional(),
        error: z.string().optional(),
      }),
      execute: async (inputData: any) => {
        const { name, description, instructions, visibility } = inputData ?? {};

        let workspaceId: string | undefined =
          typeof inputData?.workspaceId === 'string' && inputData.workspaceId.length > 0
            ? inputData.workspaceId
            : undefined;

        if (!workspaceId && availableWorkspaces.length === 1) {
          workspaceId = availableWorkspaces[0].id;
        }

        if (!workspaceId) {
          return { success: false, error: 'No workspace available for skill creation.' };
        }

        const initial = createInitialStructure(name);
        const files = updateNodeContent(initial, 'skill-md', instructions);

        try {
          const created = await createSkill.mutateAsync({
            name,
            description,
            visibility: visibility ?? defaultVisibility,
            workspaceId,
            files,
          });

          const currentSkills = formMethods.getValues('skills') ?? {};
          formMethods.setValue('skills', { ...currentSkills, [created.id]: true }, { shouldDirty: true });

          return { success: true, skillId: created.id };
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to create skill',
          };
        }
      },
    });
  }, [formMethods, createSkill, availableWorkspaces, defaultVisibility]);
}
