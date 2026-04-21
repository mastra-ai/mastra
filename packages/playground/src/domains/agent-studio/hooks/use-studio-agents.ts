import type { StoredAgentResponse, VisibilityValue } from '@mastra/client-js';
import { useMemo } from 'react';
import { resolveVisibility } from '../components/visibility';
import { useStarredAgentIds } from './use-user-preferences';
import { useStoredAgents } from '@/domains/agents/hooks/use-stored-agents';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';

export type StudioAgentScope = 'all' | 'mine' | 'team' | 'mine-and-starred';

type UseStudioAgentsOptions = {
  scope?: StudioAgentScope;
  search?: string;
  perPage?: number;
  /** When set, only agents whose resolved visibility matches are returned. */
  visibility?: VisibilityValue;
};

export const useStudioAgents = ({
  scope = 'all',
  search = '',
  perPage = 100,
  visibility,
}: UseStudioAgentsOptions = {}) => {
  const { data: user } = useCurrentUser();
  const starredAgents = useStarredAgentIds();
  const { data, isLoading, error } = useStoredAgents({
    orderBy: { field: 'updatedAt', direction: 'DESC' },
    perPage,
  });

  const agents: StoredAgentResponse[] = useMemo(() => data?.agents ?? [], [data]);

  const scoped = useMemo(() => {
    const resolvedVisibility = (a: StoredAgentResponse) => a.visibility ?? resolveVisibility(a.metadata);
    const isMine = (a: StoredAgentResponse) => !!user?.id && a.authorId === user.id;
    const starredSet = new Set(starredAgents);
    const isStarred = (a: StoredAgentResponse) => starredSet.has(a.id);
    // Visibility rule: you can only see agents that are yours OR public. This
    // prevents private agents authored by other users from leaking into the
    // Studio list, even in the unscoped "All" tab.
    const visible = agents.filter(a => isMine(a) || resolvedVisibility(a) === 'public');

    const byScope =
      scope === 'mine'
        ? visible.filter(isMine)
        : scope === 'team'
          ? // Team = publicly shared agents authored by someone else.
            visible.filter(a => !isMine(a))
          : scope === 'mine-and-starred'
            ? // The default end-user view: your own agents, plus agents you've
              // starred from the Library. Keeps the list tight and personal.
              visible.filter(a => isMine(a) || isStarred(a))
            : visible;

    if (!visibility) return byScope;
    return byScope.filter(a => resolvedVisibility(a) === visibility);
  }, [agents, scope, user?.id, visibility, starredAgents]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return scoped;
    return scoped.filter(agent => {
      const name = (agent.name ?? '').toLowerCase();
      const description = (agent.description ?? '').toLowerCase();
      return name.includes(term) || description.includes(term);
    });
  }, [scoped, search]);

  return {
    agents: filtered,
    allAgents: agents,
    isLoading,
    error,
    currentUserId: user?.id,
  };
};
