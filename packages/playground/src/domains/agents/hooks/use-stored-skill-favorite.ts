import type { FavoriteToggleResponse, StoredSkillResponse, ListStoredSkillsResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePlaygroundStore } from '@/store/playground-store';

type FavoriteContext = {
  previousDetail?: StoredSkillResponse | null;
  previousLists: Array<[unknown, ListStoredSkillsResponse | undefined]>;
};

const applyFavoriteToSkill = (skill: StoredSkillResponse, favorited: boolean): StoredSkillResponse => {
  const currentCount = skill.favoriteCount ?? 0;
  const nextCount = favorited
    ? currentCount + (skill.isFavorited ? 0 : 1)
    : Math.max(0, currentCount - (skill.isFavorited ? 1 : 0));
  return { ...skill, isFavorited: favorited, favoriteCount: nextCount };
};

/**
 * Toggle the favorite state for a stored skill. Optimistically updates both the
 * detail cache (`['stored-skill', id]`) and any list caches
 * (`['stored-skills', ...]`) and rolls back on error.
 */
export const useToggleStoredSkillFavorite = (skillId?: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation<FavoriteToggleResponse, Error, { favorited: boolean }, FavoriteContext>({
    mutationFn: async ({ favorited }) => {
      if (!skillId) throw new Error('skillId is required to toggle favorite');
      const resource = client.getStoredSkill(skillId);
      return favorited ? resource.favorite(requestContext) : resource.unfavorite(requestContext);
    },
    onMutate: async ({ favorited }) => {
      if (!skillId) return { previousLists: [] };

      await queryClient.cancelQueries({ queryKey: ['stored-skills'] });
      await queryClient.cancelQueries({ queryKey: ['stored-skill', skillId] });

      const previousDetail = queryClient.getQueryData<StoredSkillResponse | null>(['stored-skill', skillId]);

      const listQueries = queryClient.getQueriesData<ListStoredSkillsResponse>({ queryKey: ['stored-skills'] });
      const previousLists: FavoriteContext['previousLists'] = [];
      for (const [key, value] of listQueries) {
        previousLists.push([key, value]);
        if (!value?.skills) continue;
        queryClient.setQueryData<ListStoredSkillsResponse>(key as readonly unknown[], {
          ...value,
          skills: value.skills.map(s => (s.id === skillId ? applyFavoriteToSkill(s, favorited) : s)),
        });
      }

      if (previousDetail) {
        queryClient.setQueryData<StoredSkillResponse>(
          ['stored-skill', skillId],
          applyFavoriteToSkill(previousDetail, favorited),
        );
      }

      return { previousDetail, previousLists };
    },
    onError: (_error, _vars, context) => {
      if (!context) return;
      if (skillId && context.previousDetail !== undefined) {
        queryClient.setQueryData(['stored-skill', skillId], context.previousDetail);
      }
      for (const [key, value] of context.previousLists) {
        queryClient.setQueryData(key as readonly unknown[], value);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['stored-skills'] });
      if (skillId) {
        void queryClient.invalidateQueries({ queryKey: ['stored-skill', skillId] });
      }
    },
  });
};
