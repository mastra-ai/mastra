import {
  ButtonWithTooltip,
  McpServersList,
  McpServerIcon,
  ListSearch,
  MainHeader,
  EntityListPageLayout,
  useMCPServers,
} from '@mastra/playground-ui';
import { BookIcon } from 'lucide-react';
import { useState } from 'react';

const MCPs = () => {
  const { data: mcpServers = [], isLoading, error } = useMCPServers();
  const [search, setSearch] = useState('');

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
        <div className="max-w-120">
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
};

export default MCPs;
