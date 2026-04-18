import {
  AgentIcon,
  Button,
  ButtonWithTooltip,
  EmptyState,
  ErrorState,
  ListSearch,
  NoDataPageLayout,
  PageHeader,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  Tab,
  TabList,
  Tabs,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { LayoutGrid, List, Plus } from 'lucide-react';
import { useState } from 'react';
import { AgentStudioCard } from '@/domains/agent-studio/components/agent-studio-card';
import type { StudioAgentScope } from '@/domains/agent-studio/hooks/use-studio-agents';
import { useStudioAgents } from '@/domains/agent-studio/hooks/use-studio-agents';
import { AgentsList } from '@/domains/agents/components/agent-list/agents-list';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { useCanCreateAgent } from '@/domains/agents/hooks/use-can-create-agent';
import { useLinkComponent } from '@/lib/framework';

type ViewMode = 'grid' | 'list';

export function AgentStudioAgents() {
  const { Link: FrameworkLink } = useLinkComponent();
  const { canCreateAgent } = useCanCreateAgent();
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<StudioAgentScope>('all');
  const [view, setView] = useState<ViewMode>('grid');

  const {
    agents: studioAgents,
    isLoading: isLoadingStudio,
    error: studioError,
    currentUserId,
  } = useStudioAgents({ scope, search });

  // AgentsList expects a Record<string, GetAgentResponse>. Build it from the
  // merged `useAgents` result but filtered to the ids our studio scope returned.
  const { data: allAgentsRecord = {}, isLoading: isLoadingMerged } = useAgents();
  const scopedIds = new Set(studioAgents.map(a => a.id));
  const listRecord = Object.fromEntries(Object.entries(allAgentsRecord).filter(([id]) => scopedIds.has(id)));

  const createPath = '/agent-studio/agents/create';
  const showCreateCta = canCreateAgent;

  if (studioError && is401UnauthorizedError(studioError)) {
    return (
      <NoDataPageLayout title="Agents" icon={<AgentIcon />}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (studioError && is403ForbiddenError(studioError)) {
    return (
      <NoDataPageLayout title="Agents" icon={<AgentIcon />}>
        <PermissionDenied resource="agents" />
      </NoDataPageLayout>
    );
  }

  if (studioError) {
    return (
      <NoDataPageLayout title="Agents" icon={<AgentIcon />}>
        <ErrorState title="Failed to load agents" message={(studioError as Error).message} />
      </NoDataPageLayout>
    );
  }

  const isLoading = isLoadingStudio || isLoadingMerged;

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column>
            <PageHeader>
              <PageHeader.Title isLoading={isLoading}>
                <AgentIcon /> Agents
              </PageHeader.Title>
            </PageHeader>
          </PageLayout.Column>
          <PageLayout.Column className="flex justify-end gap-2">
            {showCreateCta && (
              <ButtonWithTooltip as={FrameworkLink} href={createPath} tooltipContent="Create an agent">
                <Plus />
              </ButtonWithTooltip>
            )}
          </PageLayout.Column>
        </PageLayout.Row>

        <div className="flex items-center gap-4 justify-between flex-wrap">
          <Tabs defaultTab="all" value={scope} onValueChange={v => setScope(v as StudioAgentScope)}>
            <TabList>
              <Tab value="all">All</Tab>
              <Tab value="mine">Mine</Tab>
              <Tab value="team">Team</Tab>
            </TabList>
          </Tabs>

          <div className="flex items-center gap-2">
            <div className="max-w-120 w-[20rem]">
              <ListSearch onSearch={setSearch} label="Filter agents" placeholder="Filter by name or description" />
            </div>
            <Button
              variant={view === 'grid' ? 'default' : 'ghost'}
              onClick={() => setView('grid')}
              aria-label="Grid view"
              data-testid="agent-studio-view-grid"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={view === 'list' ? 'default' : 'ghost'}
              onClick={() => setView('list')}
              aria-label="List view"
              data-testid="agent-studio-view-list"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </PageLayout.TopArea>

      {!isLoading && studioAgents.length === 0 ? (
        <div className="flex items-center justify-center h-full p-8">
          <EmptyState
            iconSlot={<AgentIcon />}
            titleSlot={scope === 'mine' ? "You haven't created any agents yet" : 'No agents match this view'}
            descriptionSlot={
              scope === 'mine'
                ? 'Create your first agent to get started.'
                : 'Try a different scope or clear your search.'
            }
            actionSlot={
              showCreateCta && scope !== 'team' ? (
                <Button as={FrameworkLink} href={createPath} variant="default">
                  <Plus className="h-4 w-4" /> New agent
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : view === 'grid' ? (
        <div
          className="grid gap-4 p-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))' }}
          data-testid="agent-studio-grid"
        >
          {studioAgents.map(agent => (
            <AgentStudioCard key={agent.id} agent={agent} showAuthor={scope !== 'mine'} currentUserId={currentUserId} />
          ))}
        </div>
      ) : (
        <AgentsList agents={listRecord} isLoading={isLoading} search="" />
      )}
    </PageLayout>
  );
}

export default AgentStudioAgents;
