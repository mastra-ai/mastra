import type { ListStoredAgentsParams } from '@mastra/client-js';
import {
  AgentIcon,
  Button,
  cn,
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
import { PlusIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  AgentBuilderList,
  AgentBuilderListSkeleton,
} from '@/domains/agent-builder/components/agent-builder-list/agent-builder-list';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';
import { useStoredAgents } from '@/domains/agents/hooks/use-stored-agents';
import { useLinkComponent } from '@/lib/framework';

type AgentScope = 'mine' | 'all';

export default function AgentBuilderAgentsPage() {
  const [scope, setScope] = useState<AgentScope>('mine');
  const { data: currentUser } = useCurrentUser();

  const listParams = useMemo<ListStoredAgentsParams>(() => {
    const params: ListStoredAgentsParams = { status: 'draft' };
    if (scope === 'mine' && currentUser?.id) {
      params.authorId = currentUser.id;
    }
    return params;
  }, [scope, currentUser?.id]);

  const { data, isLoading, error } = useStoredAgents(listParams);
  const [search, setSearch] = useState('');
  const { Link: FrameworkLink } = useLinkComponent();

  const agents = data?.agents ?? [];

  const body = (() => {
    if (isLoading) {
      return <AgentBuilderListSkeleton />;
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
          <ErrorState title="Failed to load your agents" message={error.message} />
        </div>
      );
    }

    if (agents.length === 0) {
      return (
        <div className="flex items-center justify-center pt-16">
          <EmptyState
            iconSlot={<AgentIcon className="h-8 w-8 text-neutral3" />}
            titleSlot="No agents yet"
            descriptionSlot="Start building your first agent with the Agent Builder."
            actionSlot={
              <Button as={FrameworkLink} to="/agent-builder/agents/create" variant="primary">
                <PlusIcon /> Create an agent
              </Button>
            }
          />
        </div>
      );
    }

    return <AgentBuilderList agents={agents} search={search} />;
  })();

  return (
    <EntityListPageLayout>
      <EntityListPageLayout.Top>
        <div className="flex items-start justify-between gap-4">
          <PageHeader>
            <PageHeader.Title>
              <AgentIcon /> {scope === 'mine' ? 'Your agents' : 'All agents'}
            </PageHeader.Title>
            <PageHeader.Description>
              {scope === 'mine' ? "Agents you've created in Agent Builder." : 'All agents visible to you.'}
            </PageHeader.Description>
          </PageHeader>
          {agents.length > 0 && (
            <div className="shrink-0">
              <Button as={FrameworkLink} to="/agent-builder/agents/create" variant="primary">
                <PlusIcon /> New agent
              </Button>
            </div>
          )}
        </div>
        {currentUser && (
          <div className="flex items-center gap-1 rounded-lg border border-border1 bg-surface1 p-0.5 w-fit">
            <button
              type="button"
              onClick={() => setScope('mine')}
              className={cn(
                'rounded-md px-3 py-1.5 text-ui-xs font-medium transition-colors',
                scope === 'mine' ? 'bg-surface3 text-neutral6 shadow-sm' : 'text-neutral3 hover:text-neutral5',
              )}
            >
              My agents
            </button>
            <button
              type="button"
              onClick={() => setScope('all')}
              className={cn(
                'rounded-md px-3 py-1.5 text-ui-xs font-medium transition-colors',
                scope === 'all' ? 'bg-surface3 text-neutral6 shadow-sm' : 'text-neutral3 hover:text-neutral5',
              )}
            >
              All agents
            </button>
          </div>
        )}
        <div className="max-w-120">
          <ListSearch onSearch={setSearch} label="Filter agents" placeholder="Filter by name or description" />
        </div>
      </EntityListPageLayout.Top>

      {body}
    </EntityListPageLayout>
  );
}
