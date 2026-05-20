import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface UpdateSkillParams {
  id: string;
  name?: string;
  description?: string;
  instructions?: string;
  visibility?: 'private' | 'public';
  files?: unknown[];
  workspaceId?: string;
}

interface UseUpdateSkillOptions {
  // No-op today; reserved for future toast/surface control.
  silent?: boolean;
}

export function useUpdateSkill(_options: UseUpdateSkillOptions = {}) {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: UpdateSkillParams) => (client as any).updateStoredSkill(params.id, params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stored-skills'] });
    },
  });
}
