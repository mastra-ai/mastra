import {
  Icon,
  DocsIcon,
  Button,
  ButtonWithTooltip,
  HeaderAction,
  Header,
  MainContentContent,
  MainContentLayout,
  MCPTable,
  McpServersList,
  McpServerIcon,
  ListSearch,
  MainHeader,
  EntityListPageLayout,
  useMCPServers,
  HeaderTitle,
} from '@mastra/playground-ui';
import { useExperimentalUI } from '@/domains/experimental-ui/experimental-ui-context';
import { BookIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

const MCPs = () => {
  const { data: mcpServers = [], isLoading, error } = useMCPServers();
  const { variant } = useExperimentalUI('entity-list-page');
  const [search, setSearch] = useState('');

  const isEmpty = !isLoading && mcpServers.length === 0;

  if (variant === 'new-proposal') {
    return (
      <EntityListPageLayout>
        <EntityListPageLayout.Top>
          <MainHeader withMargins={false}>
            <MainHeader.Column>
              <MainHeader.Title isLoading={isLoading}>
                <McpServerIcon /> MCP Servers
              </MainHeader.Title>
            </MainHeader.Column>
            <MainHeader.Column className="flex justify-end gap-2">
              <ButtonWithTooltip
                as="a"
                href="https://mastra.ai/en/docs/tools-mcp/mcp-overview"
                target="_blank"
                rel="noopener noreferrer"
                tooltipContent="Go to MCP documentation"
              >
                <BookIcon />
              </ButtonWithTooltip>
            </MainHeader.Column>
          </MainHeader>
          <div className="max-w-[30rem]">
            <ListSearch onSearch={setSearch} label="Filter MCP servers" placeholder="Filter by name" />
          </div>
        </EntityListPageLayout.Top>

        <McpServersList
          mcpServers={mcpServers}
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
            <McpServerIcon />
          </Icon>
          MCP Servers
        </HeaderTitle>

        <HeaderAction>
          <Button
            as={Link}
            to="https://mastra.ai/en/docs/tools-mcp/mcp-overview"
            target="_blank"
            variant="ghost"
            size="md"
          >
            <DocsIcon />
            MCP documentation
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent isCentered={isEmpty}>
        <MCPTable mcpServers={mcpServers} isLoading={isLoading} error={error} />
      </MainContentContent>
    </MainContentLayout>
  );
};

export default MCPs;
