import {
  Header,
  HeaderTitle,
  MainContentLayout,
  MainContentContent,
  Icon,
  Button,
  ButtonWithTooltip,
  HeaderAction,
  useLinkComponent,
  DocsIcon,
  useAgents,
  AgentsTable,
  AgentsList,
  AgentIcon,
  ListSearch,
  useIsCmsAvailable,
  usePermissions,
  MainHeader,
  EntityListPageLayout,
} from '@mastra/playground-ui';
import { useExperimentalUI } from '@/domains/experimental-ui/experimental-ui-context';
import { BookIcon, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

function Agents() {
  const { Link: FrameworkLink, navigate } = useLinkComponent();
  const { data: agents = {}, isLoading, error } = useAgents();
  const { isCmsAvailable } = useIsCmsAvailable();
  const { canEdit } = usePermissions();
  const { variant } = useExperimentalUI('entity-list-page');
  const [search, setSearch] = useState('');

  const canCreateAgent = isCmsAvailable && canEdit('stored-agents');

  const handleCreateClick = () => {
    navigate('/cms/agents/create');
  };

  if (variant === 'new-proposal') {
    return (
      <EntityListPageLayout>
        <EntityListPageLayout.Top>
          <MainHeader withMargins={false}>
            <MainHeader.Column>
              <MainHeader.Title isLoading={isLoading}>
                <AgentIcon /> Agents
              </MainHeader.Title>
            </MainHeader.Column>
            <MainHeader.Column className="flex justify-end gap-2">
              <ButtonWithTooltip
                as="a"
                href="https://mastra.ai/en/docs/agents/overview"
                target="_blank"
                rel="noopener noreferrer"
                tooltipContent="Go to Agents documentation"
              >
                <BookIcon />
              </ButtonWithTooltip>
              {canCreateAgent && (
                <Button as={Link} to="/cms/agents/create" variant="primary">
                  <Plus />
                  Create Agent
                </Button>
              )}
            </MainHeader.Column>
          </MainHeader>
          <div className="max-w-[30rem]">
            <ListSearch onSearch={setSearch} label="Filter agents" placeholder="Filter by name or instructions" />
          </div>
        </EntityListPageLayout.Top>

        <AgentsList
          agents={agents}
          isLoading={isLoading}
          error={error}
          onCreateClick={canCreateAgent ? handleCreateClick : undefined}
          search={search}
          onSearch={setSearch}
          hideToolbar
        />
      </EntityListPageLayout>
    );
  }

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <AgentIcon />
          </Icon>
          Agents
        </HeaderTitle>

        <HeaderAction>
          {canCreateAgent && (
            <Button as={FrameworkLink} to="/cms/agents/create">
              <Plus />
              Create an agent
            </Button>
          )}
          <Button
            variant="ghost"
            size="md"
            as={FrameworkLink}
            to="https://mastra.ai/en/docs/agents/overview"
            target="_blank"
          >
            <DocsIcon />
            Agents documentation
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent isCentered={!isLoading && Object.keys(agents || {}).length === 0}>
        <AgentsTable
          agents={agents}
          isLoading={isLoading}
          error={error}
          onCreateClick={canCreateAgent ? handleCreateClick : undefined}
        />
      </MainContentContent>
    </MainContentLayout>
  );
}

export { Agents };

export default Agents;
