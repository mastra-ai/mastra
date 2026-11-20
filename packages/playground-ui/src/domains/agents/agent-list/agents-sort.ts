import type { GetAgentResponse } from '@mastra/client-js';
import { sortBy } from '@/lib/sort/sort-by';

export type AgentsSort = 'default' | 'name-asc' | 'name-desc';

export function sortAgents(agents: GetAgentResponse[], sort: AgentsSort) {
  if (sort === 'default') return agents;

  return sortBy(
    agents,
    { key: 'name', direction: sort === 'name-asc' ? 'asc' : 'desc' },
    { name: agent => agent.name },
  );
}
