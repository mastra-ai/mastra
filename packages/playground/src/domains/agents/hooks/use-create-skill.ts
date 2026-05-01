import type { StoredSkillResponse } from '@mastra/client-js';
import { toast } from '@mastra/playground-ui';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { extractSkillInstructions, extractSkillLicense } from '../components/agent-cms-pages/skill-file-tree';
import type { InMemoryFileNode } from '../components/agent-edit-page/utils/form-validation';
import { usePermissions } from '@/domains/auth/hooks';
import { useWriteWorkspaceFile } from '@/domains/workspace/hooks';

interface CreateSkillParams {
  name: string;
  description: string;
  visibility?: 'private' | 'public';
  workspaceId?: string;
  files: InMemoryFileNode[];
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

export function useCreateSkill() {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const writeFile = useWriteWorkspaceFile();
  const { hasPermission } = usePermissions();
  const canWriteWorkspace = hasPermission('workspaces:write');

  return useMutation({
    mutationFn: async (params: CreateSkillParams): Promise<StoredSkillResponse> => {
      const { name, description, workspaceId, files } = params;

      // Write files to workspace filesystem (best-effort — DB is the source of truth)
      if (workspaceId && canWriteWorkspace) {
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

      // Create stored skill via API (DB record always created)
      return client.createStoredSkill({
        name,
        description,
        visibility: params.visibility,
        instructions: extractSkillInstructions(files),
        license: extractSkillLicense(files),
        files,
      });
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['stored-skills'] });
      if (variables.workspaceId) {
        void queryClient.invalidateQueries({ queryKey: ['workspace', 'skills', variables.workspaceId] });
      }
      toast.success('Skill created');
    },
    onError: error => {
      toast.error(`Failed to create skill: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });
}
