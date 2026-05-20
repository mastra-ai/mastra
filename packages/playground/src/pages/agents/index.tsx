import {
  AgentIcon,
  Button,
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
import { BookIcon, Plus } from 'lucide-react';
import { useState } from 'react';
import { useCanCreateAgent } from '@/domains/agent-builder/hooks/use-can-create-agent';
import { AgentHeaderCreateAction } from '@/domains/agents/agent-header-actions';
import { AgentsList } from '@/domains/agents/components/agent-list/agents-list';
import { NoAgentsInfo } from '@/domains/agents/components/agent-list/no-agents-info';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { useLinkComponent } from '@/lib/framework';

function Agents() {
  const { data: agents = {}, isLoading, error } = useAgents();
  const [search, setSearch] = useState('');
  const { canCreateAgent, createRoute } = useCanCreateAgent();
  const { Link: FrameworkLink } = useLinkComponent();
  const showCreateCta = canCreateAgent && Boolean(createRoute);

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
              <Button as={FrameworkLink} to={createRoute} tooltip="Create an agent">
                <Plus />
              </Button>
            )}
            <Button
              as="a"
              href="https://mastra.ai/en/docs/agents/overview"
              target="_blank"
              rel="noopener noreferrer"
              tooltip="Go to Agents documentation"
            >
              <BookIcon />
            </Button>
          </PageLayout.Column>
        </PageLayout.Row>
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
