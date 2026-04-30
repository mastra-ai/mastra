import type { ListStoredAgentsParams, StoredAgentResponse } from '@mastra/client-js';
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
  Tab,
  TabContent,
  TabList,
  Tabs,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { PlusIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  AgentBuilderList,
  AgentBuilderListSkeleton,
} from '@/domains/agent-builder/components/agent-builder-list/agent-builder-list';
import { useStoredAgents } from '@/domains/agents/hooks/use-stored-agents';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';
import { useLinkComponent } from '@/lib/framework';

type Scope = 'mine' | 'all';

export default function AgentBuilderAgentsPage() {
  const { data: currentUser, isLoading: isCurrentUserLoading } = useCurrentUser();
  const [scope, setScope] = useState<Scope>('mine');
  const [search, setSearch] = useState('');
  const { Link: FrameworkLink } = useLinkComponent();

  const listParams = useMemo<ListStoredAgentsParams>(() => {
    const params: ListStoredAgentsParams = {};
    if (scope === 'mine' && currentUser?.id) {
      params.authorId = currentUser.id;
    }
    return params;
  }, [scope, currentUser?.id]);

  const { data, isLoading, error } = useStoredAgents(listParams, { enabled: !isCurrentUserLoading });
  const agents = data?.agents ?? [];

  function renderAgentList(agentList: StoredAgentResponse[]) {
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

    if (agentList.length === 0) {
      return (
        <div className="flex items-center justify-center pt-16">
          <EmptyState
            iconSlot={<AgentIcon className="h-8 w-8 text-neutral3" />}
            titleSlot={scope === 'mine' ? 'No agents yet' : 'No agents available'}
            descriptionSlot={
              scope === 'mine'
                ? 'Start building your first agent with the Agent Builder.'
                : 'No public agents are available yet.'
            }
            actionSlot={
              scope === 'mine' ? (
                <Button as={FrameworkLink} to="/agent-builder/agents/create" variant="primary">
                  <PlusIcon /> Create an agent
                </Button>
              ) : undefined
            }
          />
        </div>
      );
    }

    return <AgentBuilderList agents={agentList} search={search} />;
  }

  return (
    <EntityListPageLayout className="px-4 md:px-10">
      <EntityListPageLayout.Top>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
          <PageHeader>
            <PageHeader.Title>
              <AgentIcon /> Agents
            </PageHeader.Title>
            <PageHeader.Description>
              {scope === 'mine' ? "Agents you've created." : 'All agents available to you.'}
            </PageHeader.Description>
          </PageHeader>
          {agents.length > 0 && (
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
      </EntityListPageLayout.Top>

      <Tabs defaultTab="mine" value={scope} onValueChange={setScope}>
        <TabList>
          <Tab value="mine">My agents</Tab>
          <Tab value="all">All agents</Tab>
        </TabList>
        <TabContent value="mine">{renderAgentList(agents)}</TabContent>
        <TabContent value="all">{renderAgentList(agents)}</TabContent>
      </Tabs>
    </EntityListPageLayout>
  );
}
