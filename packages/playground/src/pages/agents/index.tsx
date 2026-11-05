import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import type { AgentsSort,AgentsView } from '@mastra/playground-ui/domains/agents/components/agent-list';
import { AgentsCompactGrid,AgentsList,sortAgents,AgentsViewToggle,NoAgentsInfo } from '@mastra/playground-ui/domains/agents/components/agent-list';
import { extractPrompt } from '@mastra/playground-ui/domains/agents/utils';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useAgents } from '@mastra/react/hooks/agents';
import { useState } from 'react';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { AgentHeaderCreateAction } from '@/domains/agents/agent-header-actions';
import { navCrumb } from '@/domains/navigation/crumbs';

const crumbs = [navCrumb('/agents')];

function Agents() {
  const { data: agents = {}, isLoading, error } = useAgents();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<AgentsView>('list');
  const [sort, setSort] = useState<AgentsSort>('default');

  if (error && is401UnauthorizedError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Agents</h1>
        <SessionExpired variant="fill" />
      </PageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Agents</h1>
        <PermissionDenied variant="fill" resource="agents" />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Agents</h1>
        <EmptyState tone="error" variant="fill" titleSlot="Failed to load agents" descriptionSlot={error.message} />
      </PageLayout>
    );
  }

  if (Object.keys(agents).length === 0 && !isLoading) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Agents</h1>
        <NoAgentsInfo />
      </PageLayout>
    );
  }

  const term = search.toLowerCase();
  const filteredAgents = Object.values(agents).filter(agent => {
    const instructions = extractPrompt(agent.instructions);
    return agent.name.toLowerCase().includes(term) || instructions.toLowerCase().includes(term);
  });
  const visibleAgents = sortAgents(filteredAgents, sort);

  let agentsView = (
    <AgentsList
      agents={visibleAgents}
      isLoading={isLoading}
      hasSearch={Boolean(search)}
      sort={sort}
      onSortChange={setSort}
    />
  );
  if (view === 'compact') {
    agentsView = <AgentsCompactGrid agents={visibleAgents} isLoading={isLoading} hasSearch={Boolean(search)} />;
  }

  return (
    <PageLayout
      breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}
      headerActions={<AgentHeaderCreateAction />}
      actionRow={
        <ActionRow>
          <ActionRow.Start>
            <div className="max-w-120 flex-1">
              <ListSearch onSearch={setSearch} label="Filter agents" placeholder="Filter by name or instructions" />
            </div>
          </ActionRow.Start>
          <ActionRow.End>
            <AgentsViewToggle view={view} onViewChange={setView} />
          </ActionRow.End>
        </ActionRow>
      }
    >
      <h1 className="sr-only">Agents</h1>
      {agentsView}
    </PageLayout>
  );
}

export { Agents };

export default Agents;
