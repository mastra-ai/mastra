import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface UpdateSkillParams {
  id: string;
  name?: string;
  description?: string;
  instructions?: string;
  visibility?: 'private' | 'public';
  files?: unknown[];
}

export function useUpdateSkill() {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: UpdateSkillParams) => (client as any).updateStoredSkill(params.id, params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stored-skills'] });
    },
  });
}
