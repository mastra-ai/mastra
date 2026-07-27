import type { GetAgentResponse } from '@mastra/client-js';

export type AgentsSort = 'default' | 'name-asc' | 'name-desc';

export function sortAgents(agents: GetAgentResponse[], sort: AgentsSort) {
  if (sort === 'default') return agents;

  const direction = sort === 'name-asc' ? 1 : -1;
  return [...agents].sort((left, right) => {
    const nameComparison = left.name.localeCompare(right.name, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    const stableComparison = nameComparison || left.id.localeCompare(right.id);
    return stableComparison * direction;
  });
}
