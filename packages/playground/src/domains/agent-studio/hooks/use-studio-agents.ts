import type { StoredAgentResponse, VisibilityValue } from '@mastra/client-js';
import { useMemo } from 'react';
import { resolveVisibility } from '../components/visibility';
import { useStoredAgents } from '@/domains/agents/hooks/use-stored-agents';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';

export type StudioAgentScope = 'all' | 'mine' | 'team';

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
  const { data, isLoading, error } = useStoredAgents({
    orderBy: { field: 'updatedAt', direction: 'DESC' },
    perPage,
  });

  const agents: StoredAgentResponse[] = useMemo(() => data?.agents ?? [], [data]);

  const scoped = useMemo(() => {
    const byScope =
      scope === 'all' || !user?.id
        ? agents
        : scope === 'mine'
          ? agents.filter(a => a.authorId === user.id)
          : // Team = agents authored by someone else (or legacy agents without an author)
            agents.filter(a => !a.authorId || a.authorId !== user.id);
    if (!visibility) return byScope;
    return byScope.filter(a => (a.visibility ?? resolveVisibility(a.metadata)) === visibility);
  }, [agents, scope, user?.id, visibility]);

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
