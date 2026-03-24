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
} from '@mastra/playground-ui';
import { BookIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useExperimentalUI } from '@/domains/experimental-ui/experimental-ui-context';

function Agents() {
  const { data: agents = {}, isLoading, error } = useAgents();
  const { variant } = useExperimentalUI('entity-list-page');
  const [search, setSearch] = useState('');

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
