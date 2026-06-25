import type { StoredSkillResponse } from '@mastra/client-js';
import { toast } from '@mastra/playground-ui';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { extractSkillInstructions, extractSkillLicense } from '../components/agent-cms-pages/skill-file-tree-utils';
import type { InMemoryFileNode } from '../components/agent-edit-page/utils/form-validation';
import { usePermissions } from '@/domains/auth/hooks';
import { useWriteWorkspaceFile } from '@/domains/workspace/hooks';

interface UpdateSkillParams {
  id: string;
  name?: string;
  description?: string;
  visibility?: 'private' | 'public';
  instructions?: string;
  files?: InMemoryFileNode[];
  workspaceId?: string;
}

function flattenFiles(nodes: InMemoryFileNode[], basePath: string): { path: string; content: string }[] {
  const results: { path: string; content: string }[] = [];
  for (const node of nodes) {
    const nodePath = basePath ? `${basePath}/${node.name}` : node.name;
    if (node.type === 'file' && node.content !== undefined) {
      results.push({ path: nodePath, content: node.content });
    } else if (node.type === 'folder' && node.children) {
      results.push(...flattenFiles(node.children, nodePath));
    }
  }
  return results;
}

interface UseUpdateSkillOptions {
  /** When true, suppresses success and error toasts. Used by autosave flows. */
  silent?: boolean;
}

export function useUpdateSkill(options: UseUpdateSkillOptions = {}) {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const writeFile = useWriteWorkspaceFile();
  const { hasPermission } = usePermissions();
  const canWriteWorkspace = hasPermission('workspaces:write');
  const { silent = false } = options;

  return useMutation({
    mutationFn: async (params: UpdateSkillParams): Promise<StoredSkillResponse> => {
      const { id, name, description, visibility, instructions, files, workspaceId } = params;

      // Write updated files to workspace filesystem (best-effort — DB is the source of truth)
      if (files?.length && workspaceId && canWriteWorkspace) {
        const filesToWrite = flattenFiles(files, '');
        try {
          await Promise.all(
            filesToWrite.map(file =>
              writeFile.mutateAsync({
                workspaceId,
                path: `skills/${file.path}`,
                content: file.content,
                recursive: true,
              }),
            ),
          );
        } catch (err) {
          console.warn('[skill] Workspace file write failed, saving to DB only:', err);
        }
      }

      // Build a sparse update body — the server handler currently forwards
      // every key (including `undefined`) to the storage driver, which then
      // rejects "undefined cannot be passed as argument to the database".
      // Only include fields the caller actually wants to change.
      const resolvedInstructions = instructions ?? (files ? extractSkillInstructions(files) : undefined);
      const resolvedLicense = files ? extractSkillLicense(files) : undefined;
      const updateBody: Record<string, unknown> = {};
      if (name !== undefined) updateBody.name = name;
      if (description !== undefined) updateBody.description = description;
      if (visibility !== undefined) updateBody.visibility = visibility;
      if (resolvedInstructions !== undefined) updateBody.instructions = resolvedInstructions;
      if (resolvedLicense !== undefined) updateBody.license = resolvedLicense;
      if (files !== undefined) updateBody.files = files;

      // Update stored skill via API
      return client.getStoredSkill(id).update(updateBody);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stored-skills'] });
      void queryClient.invalidateQueries({ queryKey: ['stored-skill'] });
      if (!silent) {
        toast.success('Skill updated');
      }
    },
    onError: error => {
      if (!silent) {
        toast.error(`Failed to update skill: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  });
}
