import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useDeleteSkill(skillId?: string) {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (!skillId) throw new Error('skillId is required for delete');
      return client.getStoredSkill(skillId).delete();
    },
    onSuccess: () => {
      // Invalidate lists so the skills list page refetches without the deleted entry
      void queryClient.invalidateQueries({ queryKey: ['stored-skills'] });
      // Drop the deleted entity from cache so active observers don't refetch a 404
      if (skillId) {
        queryClient.removeQueries({ queryKey: ['stored-skill', skillId] });
      }
    },
  });
}
