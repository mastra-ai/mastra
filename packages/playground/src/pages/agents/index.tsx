import {
  NoDataPageLayout,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { useState } from 'react';
import { AgentHeaderCreateAction } from '@/domains/agents/agent-header-actions';
import { AgentsList } from '@/domains/agents/components/agent-list/agents-list';
import { NoAgentsInfo } from '@/domains/agents/components/agent-list/no-agents-info';
import { useAgents } from '@/domains/agents/hooks/use-agents';

function Agents() {
  const { data: agents = {}, isLoading, error } = useAgents();
  const [search, setSearch] = useState('');

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

  return (
    <PageLayout>
      <AgentHeaderCreateAction />
      <PageLayout.TopArea>
        <div className="max-w-120">
          <ListSearch onSearch={setSearch} label="Filter agents" placeholder="Filter by name or instructions" />
        </div>
      </PageLayout.TopArea>

      <AgentsList agents={agents} isLoading={isLoading} search={search} />
    </PageLayout>
  );
}

export { Agents };

export default Agents;
