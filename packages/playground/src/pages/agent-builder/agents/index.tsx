import {
  AgentIcon,
  Button,
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
import { useState } from 'react';
import {
  AgentBuilderList,
  AgentBuilderListSkeleton,
} from '@/domains/agent-builder/components/agent-builder-list/agent-builder-list';
import { useStoredAgents } from '@/domains/agents/hooks/use-stored-agents';
import { useLinkComponent } from '@/lib/framework';

export default function AgentBuilderAgentsPage() {
  const { data, isLoading, error } = useStoredAgents({ status: 'draft' });
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
              <AgentIcon /> Your agents
            </PageHeader.Title>
            <PageHeader.Description>Agents you've created in Agent Builder.</PageHeader.Description>
          </PageHeader>
          {agents.length > 0 && (
            <div className="shrink-0">
              <Button as={FrameworkLink} to="/agent-builder/agents/create" variant="primary">
                <PlusIcon /> New agent
              </Button>
            </div>
          )}
        </div>
        <div className="max-w-120">
          <ListSearch onSearch={setSearch} label="Filter agents" placeholder="Filter by name or description" />
        </div>
      </EntityListPageLayout.Top>

      {body}
    </EntityListPageLayout>
  );
}
