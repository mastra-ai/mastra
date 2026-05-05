import type { StoredSkillResponse } from '@mastra/client-js';
import { toast } from '@mastra/playground-ui';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { extractSkillInstructions, extractSkillLicense } from '../components/agent-cms-pages/skill-file-tree';
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

export function useUpdateSkill() {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const writeFile = useWriteWorkspaceFile();
  const { hasPermission } = usePermissions();
  const canWriteWorkspace = hasPermission('workspaces:write');

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

      // Update stored skill via API
      return client.getStoredSkill(id).update({
        name,
        description,
        visibility,
        instructions: instructions ?? (files ? extractSkillInstructions(files) : undefined),
        license: files ? extractSkillLicense(files) : undefined,
        files,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stored-skills'] });
      void queryClient.invalidateQueries({ queryKey: ['stored-skill'] });
      toast.success('Skill updated');
    },
    onError: error => {
      toast.error(`Failed to update skill: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });
}
