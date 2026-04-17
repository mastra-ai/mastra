import type { StoredSkillResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAgentStudioConfig } from './use-agent-studio-config';
import { useStarredSkillIds } from './use-user-preferences';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';

/**
 * Returns the skills to surface in the end-user sidebar:
 *   1. Skills the current user has starred from the Marketplace.
 *   2. Fill from the user's own most-recently-updated skills.
 */
export const useRecentSkills = () => {
  const client = useMastraClient();
  const { data: user } = useCurrentUser();
  const { config } = useAgentStudioConfig();
  const maxItems = config?.recents?.maxItems ?? 5;
  const starredIds = useStarredSkillIds();

  const query = useQuery({
    queryKey: ['stored-skills', { perPage: Math.max(maxItems * 4, 20) }],
    queryFn: () => client.listStoredSkills({ perPage: Math.max(maxItems * 4, 20) }),
  });

  const recents = useMemo<StoredSkillResponse[]>(() => {
    const byId = new Map<string, StoredSkillResponse>();
    for (const skill of query.data?.skills ?? []) {
      byId.set(skill.id, skill);
    }

    const ordered: StoredSkillResponse[] = [];
    const seen = new Set<string>();

    for (const starredId of starredIds) {
      const skill = byId.get(starredId);
      if (skill && !seen.has(skill.id)) {
        ordered.push(skill);
        seen.add(skill.id);
      }
      if (ordered.length >= maxItems) return ordered;
    }

    if (user?.id) {
      for (const skill of query.data?.skills ?? []) {
        if (seen.has(skill.id)) continue;
        if (skill.authorId && skill.authorId !== user.id) continue;
        ordered.push(skill);
        seen.add(skill.id);
        if (ordered.length >= maxItems) return ordered;
      }
    }

    return ordered;
  }, [maxItems, query.data, starredIds, user?.id]);

  return { recents, isLoading: query.isLoading, maxItems };
};
