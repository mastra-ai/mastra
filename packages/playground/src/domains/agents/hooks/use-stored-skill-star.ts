import type { StarToggleResponse, StoredSkillResponse, ListStoredSkillsResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePlaygroundStore } from '@/store/playground-store';

type StarContext = {
  previousDetail?: StoredSkillResponse | null;
  previousLists: Array<[unknown, ListStoredSkillsResponse | undefined]>;
};

const applyStarToSkill = (skill: StoredSkillResponse, starred: boolean): StoredSkillResponse => {
  const currentCount = skill.starCount ?? 0;
  const nextCount = starred
    ? currentCount + (skill.isStarred ? 0 : 1)
    : Math.max(0, currentCount - (skill.isStarred ? 1 : 0));
  return { ...skill, isStarred: starred, starCount: nextCount };
};

/**
 * Toggle the star state for a stored skill. Optimistically updates both the
 * detail cache (`['stored-skill', id]`) and any list caches
 * (`['stored-skills', ...]`) and rolls back on error.
 */
export const useToggleStoredSkillStar = (skillId?: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation<StarToggleResponse, Error, { starred: boolean }, StarContext>({
    mutationFn: async ({ starred }) => {
      if (!skillId) throw new Error('skillId is required to toggle star');
      const resource = client.getStoredSkill(skillId);
      return starred ? resource.star(requestContext) : resource.unstar(requestContext);
    },
    onMutate: async ({ starred }) => {
      if (!skillId) return { previousLists: [] };

      await queryClient.cancelQueries({ queryKey: ['stored-skills'] });
      await queryClient.cancelQueries({ queryKey: ['stored-skill', skillId] });

      const previousDetail = queryClient.getQueryData<StoredSkillResponse | null>(['stored-skill', skillId]);

      const listQueries = queryClient.getQueriesData<ListStoredSkillsResponse>({ queryKey: ['stored-skills'] });
      const previousLists: StarContext['previousLists'] = [];
      for (const [key, value] of listQueries) {
        previousLists.push([key, value]);
        if (!value?.skills) continue;
        queryClient.setQueryData<ListStoredSkillsResponse>(key as readonly unknown[], {
          ...value,
          skills: value.skills.map(s => (s.id === skillId ? applyStarToSkill(s, starred) : s)),
        });
      }

      if (previousDetail) {
        queryClient.setQueryData<StoredSkillResponse>(
          ['stored-skill', skillId],
          applyStarToSkill(previousDetail, starred),
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
