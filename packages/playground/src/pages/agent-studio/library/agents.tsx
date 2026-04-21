import {
  AgentIcon,
  EmptyState,
  ErrorState,
  ListSearch,
  NoDataPageLayout,
  PageHeader,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { StoreIcon } from 'lucide-react';
import { useState } from 'react';
import { AgentStudioCard } from '@/domains/agent-studio/components/agent-studio-card';
import { useStudioAgents } from '@/domains/agent-studio/hooks/use-studio-agents';
import { useUserLookup } from '@/domains/agent-studio/hooks/use-user-lookup';

export function AgentStudioLibraryAgents() {
  const [search, setSearch] = useState('');
  const { agents, isLoading, error, currentUserId } = useStudioAgents({
    scope: 'team',
    search,
    visibility: 'public',
  });
  const { getDisplayName } = useUserLookup(agents.map(a => a.authorId));

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout title="Library — Agents" icon={<StoreIcon />}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout title="Library — Agents" icon={<StoreIcon />}>
        <PermissionDenied resource="agents" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout title="Library — Agents" icon={<StoreIcon />}>
        <ErrorState title="Failed to load library agents" message={(error as Error).message} />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column>
            <PageHeader>
              <PageHeader.Title isLoading={isLoading}>
                <StoreIcon /> Library — Agents
              </PageHeader.Title>
            </PageHeader>
          </PageLayout.Column>
        </PageLayout.Row>
        <div className="max-w-120">
          <ListSearch onSearch={setSearch} label="Filter agents" placeholder="Filter by name or description" />
        </div>
      </PageLayout.TopArea>

      {!isLoading && agents.length === 0 ? (
        <div className="flex items-center justify-center h-full p-8">
          <EmptyState
            iconSlot={<AgentIcon />}
            titleSlot="No teammate agents yet"
            descriptionSlot="When your teammates publish agents, they'll appear here for discovery."
          />
        </div>
      ) : (
        <div
          className="grid gap-4 p-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))' }}
          data-testid="library-agents-grid"
        >
          {agents.map(agent => (
            <AgentStudioCard
              key={agent.id}
              agent={agent}
              showAuthor
              currentUserId={currentUserId}
              authorDisplayName={getDisplayName(agent.authorId)}
              showStar
            />
          ))}
        </div>
      )}
    </PageLayout>
  );
}

export default AgentStudioLibraryAgents;
