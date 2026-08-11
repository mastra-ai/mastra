import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useState } from 'react';
import { AgentHeaderCreateAction } from '@/domains/agents/agent-header-actions';
import { AgentsCompactGrid } from '@/domains/agents/components/agent-list/agents-compact-grid';
import { AgentsList } from '@/domains/agents/components/agent-list/agents-list';
import { sortAgents } from '@/domains/agents/components/agent-list/agents-sort';
import type { AgentsSort } from '@/domains/agents/components/agent-list/agents-sort';
import { AgentsSortSelect } from '@/domains/agents/components/agent-list/agents-sort-select';
import { AgentsViewToggle } from '@/domains/agents/components/agent-list/agents-view-toggle';
import type { AgentsView } from '@/domains/agents/components/agent-list/agents-view-toggle';
import { NoAgentsInfo } from '@/domains/agents/components/agent-list/no-agents-info';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { extractPrompt } from '@/domains/agents/utils/extractPrompt';

function Agents() {
  const { data: agents = {}, isLoading, error } = useAgents();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<AgentsView>('list');
  const [sort, setSort] = useState<AgentsSort>('default');

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout>
        <PermissionDenied resource="agents" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout>
        <ErrorState title="Failed to load agents" message={error.message} />
      </NoDataPageLayout>
    );
  }

  if (Object.keys(agents).length === 0 && !isLoading) {
    return (
      <NoDataPageLayout>
        <NoAgentsInfo />
      </NoDataPageLayout>
    );
  }

  const term = search.toLowerCase();
  const filteredAgents = Object.values(agents).filter(agent => {
    const instructions = extractPrompt(agent.instructions);
    return agent.name.toLowerCase().includes(term) || instructions.toLowerCase().includes(term);
  });
  const visibleAgents = sortAgents(filteredAgents, sort);

  let agentsView = <AgentsList agents={visibleAgents} isLoading={isLoading} hasSearch={Boolean(search)} />;
  if (view === 'compact') {
    agentsView = <AgentsCompactGrid agents={visibleAgents} isLoading={isLoading} hasSearch={Boolean(search)} />;
  }

  return (
    <PageLayout width="narrow" height="full" className="max-w-7xl grid-rows-[auto_minmax(0,1fr)] content-normal">
      <AgentHeaderCreateAction />
      <PageLayout.TopArea>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="max-w-120 flex-1">
            <ListSearch onSearch={setSearch} label="Filter agents" placeholder="Filter by name or instructions" />
          </div>
          <div className="flex items-center justify-between gap-2 sm:ml-auto sm:justify-end">
            <AgentsSortSelect sort={sort} onSortChange={setSort} />
            <AgentsViewToggle view={view} onViewChange={setView} />
          </div>
        </div>
      </PageLayout.TopArea>

      {agentsView}
    </PageLayout>
  );
}

export { Agents };

export default Agents;
