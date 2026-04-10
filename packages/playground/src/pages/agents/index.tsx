import {
  ButtonWithTooltip,
  useAgents,
  AgentsList,
  AgentIcon,
  NoAgentsInfo,
  ListSearch,
  NoDataPageLayout,
  PageLayout,
  PageHeader,
  PermissionDenied,
  SessionExpired,
  ErrorState,
  is401UnauthorizedError,
  is403ForbiddenError,
  useCanCreateAgent,
  useLinkComponent,
} from '@mastra/playground-ui';
import { BookIcon, Plus } from 'lucide-react';
import { useState } from 'react';

function Agents() {
  const { data: agents = {}, isLoading, error } = useAgents();
  const [search, setSearch] = useState('');
  const { canCreateAgent } = useCanCreateAgent();
  const { Link: FrameworkLink, paths } = useLinkComponent();
  const createAgentPath = paths.cmsAgentCreateLink();
  const showCreateCta = canCreateAgent && Boolean(createAgentPath);

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout title="Agents" icon={<AgentIcon />}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout title="Agents" icon={<AgentIcon />}>
        <PermissionDenied resource="agents" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout title="Agents" icon={<AgentIcon />}>
        <ErrorState title="Failed to load agents" message={error.message} />
      </NoDataPageLayout>
    );
  }

  if (Object.keys(agents).length === 0 && !isLoading) {
    return (
      <NoDataPageLayout title="Agents" icon={<AgentIcon />}>
        <NoAgentsInfo />
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
                <AgentIcon /> Agents
              </PageHeader.Title>
            </PageHeader>
          </PageLayout.Column>
          <PageLayout.Column className="flex justify-end gap-2">
            {showCreateCta && (
              <ButtonWithTooltip as={FrameworkLink} to={createAgentPath} tooltipContent="Create an agent">
                <Plus />
              </ButtonWithTooltip>
            )}
            <ButtonWithTooltip
              as="a"
              href="https://mastra.ai/en/docs/agents/overview"
              target="_blank"
              rel="noopener noreferrer"
              tooltipContent="Go to Agents documentation"
            >
              <BookIcon />
            </ButtonWithTooltip>
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
