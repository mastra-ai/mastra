import type { ListStoredAgentsParams } from '@mastra/client-js';
import {
  EmptyState,
  EntityListPageLayout,
  ErrorState,
  ListSearch,
  PageHeader,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { LibraryIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  AgentBuilderList,
  AgentBuilderListSkeleton,
} from '@/domains/agent-builder/components/agent-builder-list/agent-builder-list';
import { useStoredAgents } from '@/domains/agents/hooks/use-stored-agents';

export default function AgentBuilderLibraryPage() {
  const [search, setSearch] = useState('');

  const listParams = useMemo<ListStoredAgentsParams>(() => ({ visibility: 'public' }), []);

  const { data, isLoading, error } = useStoredAgents(listParams);
  const agents = data?.agents ?? [];

  const body = (() => {
    if (isLoading) {
      return <AgentBuilderListSkeleton rowTestId="library-skeleton-row" />;
    }

    if (error) {
      if (is401UnauthorizedError(error)) {
        return (
          <div className="flex items-center justify-center pt-10">
            <SessionExpired />
          </div>
        );
      }
      if (is403ForbiddenError(error)) {
        return (
          <div className="flex items-center justify-center pt-10">
            <PermissionDenied resource="agents" />
          </div>
        );
      }
      return (
        <div className="flex items-center justify-center pt-10">
          <ErrorState title="Failed to load the library" message={error.message} />
        </div>
      );
    }

    if (agents.length === 0) {
      return (
        <div className="flex items-center justify-center pt-16">
          <EmptyState
            iconSlot={<LibraryIcon className="h-8 w-8 text-neutral3" />}
            titleSlot="No public agents yet"
            descriptionSlot="Mark an agent as Public to share it with the team library."
          />
        </div>
      );
    }

    return <AgentBuilderList agents={agents} search={search} rowTestId="library-agent-row" />;
  })();

  return (
    <EntityListPageLayout className="px-4 md:px-10">
      <EntityListPageLayout.Top>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
          <PageHeader>
            <PageHeader.Title>
              <LibraryIcon /> Library
            </PageHeader.Title>
            <PageHeader.Description>Agents shared with the team library.</PageHeader.Description>
          </PageHeader>
        </div>
        <div className="max-w-120">
          <ListSearch onSearch={setSearch} label="Filter library" placeholder="Filter by name or description" />
        </div>
      </EntityListPageLayout.Top>

      {body}
    </EntityListPageLayout>
  );
}
