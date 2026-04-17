import type { StoredAgentResponse } from '@mastra/client-js';
import { useMemo } from 'react';
import { useStoredAgents } from '@/domains/agents/hooks/use-stored-agents';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';

export type StudioAgentScope = 'all' | 'mine' | 'team';

type UseStudioAgentsOptions = {
  scope?: StudioAgentScope;
  search?: string;
  perPage?: number;
};

export const useStudioAgents = ({ scope = 'all', search = '', perPage = 100 }: UseStudioAgentsOptions = {}) => {
  const { data: user } = useCurrentUser();
  const { data, isLoading, error } = useStoredAgents({
    orderBy: { field: 'updatedAt', direction: 'DESC' },
    perPage,
  });

  const agents: StoredAgentResponse[] = useMemo(() => data?.agents ?? [], [data]);

  const scoped = useMemo(() => {
    if (scope === 'all' || !user?.id) return agents;
    if (scope === 'mine') return agents.filter(a => a.authorId === user.id);
    // Team = agents authored by someone else (or legacy agents without an author)
    return agents.filter(a => !a.authorId || a.authorId !== user.id);
  }, [agents, scope, user?.id]);

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
