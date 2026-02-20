import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import type { StoredSkillResponse } from '@mastra/client-js';

import { toast } from '@/lib/toast';
import { useWriteWorkspaceFile } from '@/domains/workspace/hooks';
import { extractSkillInstructions, extractSkillLicense } from '../components/agent-cms-pages/skill-file-tree';
import type { InMemoryFileNode } from '../components/agent-edit-page/utils/form-validation';

interface CreateSkillParams {
  name: string;
  description: string;
  workspaceId: string;
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

  return useMutation({
    mutationFn: async (params: CreateSkillParams): Promise<StoredSkillResponse> => {
      const { name, description, workspaceId, files } = params;
      // Write all files to workspace filesystem
      const filesToWrite = flattenFiles(files, '');
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

      // Create stored skill via API
      return client.createStoredSkill({
        name,
        description,
        instructions: extractSkillInstructions(files),
        license: extractSkillLicense(files),
        files,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stored-skills'] });
      queryClient.invalidateQueries({ queryKey: ['workspace', 'skills', variables.workspaceId] });
      toast.success('Skill created');
    },
    onError: error => {
      toast.error(`Failed to create skill: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });
}
