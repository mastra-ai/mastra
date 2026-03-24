import {
  MainContentLayout,
  Header,
  HeaderTitle,
  MainContentContent,
  ToolsIcon,
  Icon,
  HeaderAction,
  DocsIcon,
  Button,
  ButtonWithTooltip,
  ToolTable,
  ToolsList,
  ListSearch,
  MainHeader,
  EntityListPageLayout,
  useAgents,
  useTools,
} from '@mastra/playground-ui';
import { BookIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useExperimentalUI } from '@/domains/experimental-ui/use-experimental-ui';

export default function Tools() {
  const { data: agentsRecord = {}, isLoading: isLoadingAgents } = useAgents();
  const { data: tools = {}, isLoading: isLoadingTools, error } = useTools();
  const { variant } = useExperimentalUI('entity-list-page');
  const [search, setSearch] = useState('');

  const isLoading = isLoadingAgents || isLoadingTools;
  const hasDirectTools = Object.keys(tools).length > 0;
  const hasToolsFromAgents = Object.values(agentsRecord).some(
    agent => agent.tools && Object.keys(agent.tools).length > 0,
  );
  const isEmpty = !isLoading && !hasDirectTools && !hasToolsFromAgents;

  if (variant === 'new-proposal') {
    return (
      <EntityListPageLayout>
        <EntityListPageLayout.Top>
          <MainHeader withMargins={false}>
            <MainHeader.Column>
              <MainHeader.Title isLoading={isLoading}>
                <ToolsIcon /> Tools
              </MainHeader.Title>
            </MainHeader.Column>
            <MainHeader.Column className="flex justify-end gap-2">
              <ButtonWithTooltip
                as="a"
                href="https://mastra.ai/en/docs/agents/using-tools-and-mcp"
                target="_blank"
                rel="noopener noreferrer"
                tooltipContent="Go to Tools documentation"
              >
                <BookIcon />
              </ButtonWithTooltip>
            </MainHeader.Column>
          </MainHeader>
          <div className="max-w-[30rem]">
            <ListSearch onSearch={setSearch} label="Filter tools" placeholder="Filter by name" />
          </div>
        </EntityListPageLayout.Top>

        <ToolsList
          tools={tools}
          agents={agentsRecord}
          isLoading={isLoading}
          error={error}
          search={search}
          onSearch={setSearch}
        />
      </EntityListPageLayout>
    );
  }

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <ToolsIcon />
          </Icon>
          Tools
        </HeaderTitle>

        <HeaderAction>
          <Button
            as={Link}
            to="https://mastra.ai/en/docs/agents/using-tools-and-mcp"
            target="_blank"
            variant="ghost"
            size="md"
          >
            <DocsIcon />
            Tools documentation
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent isCentered={isEmpty}>
        <ToolTable tools={tools} agents={agentsRecord} isLoading={isLoading} error={error} />
      </MainContentContent>
    </MainContentLayout>
  );
}
