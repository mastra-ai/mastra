import {
  Header,
  HeaderTitle,
  MainContentLayout,
  MainContentContent,
  Icon,
  Button,
  ButtonWithTooltip,
  HeaderAction,
  DocsIcon,
  useAgents,
  AgentsTable,
  AgentsList,
  AgentIcon,
  ListSearch,
  MainHeader,
  EntityListPageLayout,
  useCanCreateAgent,
  useLinkComponent,
} from '@mastra/playground-ui';
import { BookIcon, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useExperimentalUI } from '@/domains/experimental-ui/experimental-ui-context';

function Agents() {
  const { data: agents = {}, isLoading, error } = useAgents();
  const { variant } = useExperimentalUI('entity-list-page');
  const [search, setSearch] = useState('');
  const { canCreateAgent } = useCanCreateAgent();
  const { Link: FrameworkLink, paths } = useLinkComponent();

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
              {canCreateAgent && (
                <ButtonWithTooltip as={FrameworkLink} to={paths.cmsAgentCreateLink()} tooltipContent="Create an agent">
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
            </MainHeader.Column>
          </MainHeader>
          <div className="max-w-[30rem]">
            <ListSearch onSearch={setSearch} label="Filter agents" placeholder="Filter by name or instructions" />
          </div>
        </EntityListPageLayout.Top>

        <AgentsList agents={agents} isLoading={isLoading} error={error} search={search} />
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
            <Button variant="light" as={FrameworkLink} to={paths.cmsAgentCreateLink()}>
              <Icon>
                <Plus />
              </Icon>
              Create an agent
            </Button>
          )}
          <Button variant="ghost" size="md" as={Link} to="https://mastra.ai/en/docs/agents/overview" target="_blank">
            <DocsIcon />
            Agents documentation
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent isCentered={!isLoading && Object.keys(agents || {}).length === 0}>
        <AgentsTable agents={agents} isLoading={isLoading} error={error} />
      </MainContentContent>
    </MainContentLayout>
  );
}

export { Agents };

export default Agents;
