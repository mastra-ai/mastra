import type { ListStoredAgentsParams } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { PlusIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  AgentBuilderList,
  AgentBuilderListSkeleton,
} from '@/domains/agent-builder/components/agent-list/agent-builder-list';
import { useAgentBuilderAllowedModels } from '@/domains/agent-builder/hooks/use-agent-builder-allowed-models';
import { useBuilderAgentAccess } from '@/domains/agent-builder/hooks/use-builder-agent-access';
import { useStoredAgents } from '@/domains/agents/hooks/use-stored-agents';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';
import { useLinkComponent } from '@/lib/framework';

export default function AgentBuilderAgentsPage() {
  const { data: currentUser, isLoading: isCurrentUserLoading } = useCurrentUser();
  const { canWrite, canUseFavorites } = useBuilderAgentAccess();
  const [search, setSearch] = useState('');
  // Prefetch and seed the ['builder-available-models'] cache (return value
  // ignored) from the agent list — the entry point users pass through before
  // creating/opening an agent — so the model picker is already warm by the time
  // the create/edit page mounts instead of paying the cold gateway fetch then.
  useAgentBuilderAllowedModels({ enabled: canWrite });
  const { Link: FrameworkLink } = useLinkComponent();

  const listParams = useMemo<ListStoredAgentsParams>(() => {
    const params: ListStoredAgentsParams = {};
    if (currentUser?.id) {
      params.authorId = currentUser.id;
    }
    return params;
  }, [currentUser?.id]);

  const { data, isLoading, error } = useStoredAgents(listParams, { enabled: !isCurrentUserLoading });
  const agents = data?.agents ?? [];

  const body = (() => {
    if (isCurrentUserLoading || isLoading) {
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
          <ErrorState title="Failed to load agents" message={error.message} />
        </div>
      );
    }

    if (agents.length === 0) {
      return (
        <div className="flex items-center justify-center pt-16">
          <EmptyState
            iconSlot={<AgentIcon className="text-neutral3 h-8 w-8" />}
            titleSlot="No agents yet"
            descriptionSlot="Start building your first agent with the Agent Builder."
            actionSlot={
              canWrite ? (
                <Button as={FrameworkLink} to="/agent-builder/agents/create" variant="primary">
                  <PlusIcon /> Create an agent
                </Button>
              ) : undefined
            }
          />
        </div>
      );
    }

    return <AgentBuilderList agents={agents} search={search} showFavorites={canUseFavorites} />;
  })();

  return (
    <PageLayout className="px-4 md:px-10">
      <PageLayout.TopArea>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
          <PageHeader>
            <PageHeader.Title>
              <AgentIcon /> My agents
            </PageHeader.Title>
            <PageHeader.Description>Agents you've created.</PageHeader.Description>
          </PageHeader>
          {agents.length > 0 && canWrite && (
            <div className="w-full shrink-0 md:w-auto">
              <Button
                as={FrameworkLink}
                to="/agent-builder/agents/create"
                variant="primary"
                className="w-full justify-center md:w-auto"
              >
                <PlusIcon /> New agent
              </Button>
            </div>
          )}
        </div>
        <div className="max-w-120">
          <ListSearch onSearch={setSearch} label="Filter agents" placeholder="Filter by name or description" />
        </div>
      </PageLayout.TopArea>

      {body}
    </PageLayout>
  );
}
