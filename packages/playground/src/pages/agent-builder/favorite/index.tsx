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
import { StarIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  AgentBuilderList,
  AgentBuilderListSkeleton,
} from '@/domains/agent-builder/components/agent-builder-list/agent-builder-list';
import { useStoredAgents } from '@/domains/agents/hooks/use-stored-agents';

export default function AgentBuilderFavoritePage() {
  const [search, setSearch] = useState('');

  const listParams = useMemo<ListStoredAgentsParams>(
    () => ({
      starredOnly: true,
      orderBy: { field: 'updatedAt', direction: 'DESC' },
    }),
    [],
  );

  const { data, isLoading, error } = useStoredAgents(listParams);
  const agents = data?.agents ?? [];

  const body = (() => {
    if (isLoading) {
      return <AgentBuilderListSkeleton rowTestId="favorite-skeleton-row" />;
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
          <ErrorState title="Failed to load favorite agents" message={error.message} />
        </div>
      );
    }

    if (agents.length === 0) {
      return (
        <div className="flex items-center justify-center pt-16">
          <EmptyState
            iconSlot={<StarIcon className="h-8 w-8 text-neutral3" />}
            titleSlot="No favorite agents yet"
            descriptionSlot="Star agents to keep them here for quick access."
          />
        </div>
      );
    }

    return <AgentBuilderList agents={agents} search={search} rowTestId="favorite-agent-row" />;
  })();

  return (
    <EntityListPageLayout>
      <EntityListPageLayout.Top>
        <div className="flex items-start justify-between gap-4">
          <PageHeader>
            <PageHeader.Title>
              <StarIcon /> Favorites
            </PageHeader.Title>
            <PageHeader.Description>Agents you've starred in Agent Builder.</PageHeader.Description>
          </PageHeader>
        </div>
        <div className="max-w-120">
          <ListSearch onSearch={setSearch} label="Filter favorites" placeholder="Filter by name or description" />
        </div>
      </EntityListPageLayout.Top>

      {body}
    </EntityListPageLayout>
  );
}
