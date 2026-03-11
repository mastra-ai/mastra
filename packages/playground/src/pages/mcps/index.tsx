import { Button, MCPServerList, McpServerIcon, useMCPServers, PageContent, MainHeader } from '@mastra/playground-ui';
import { ExternalLinkIcon } from 'lucide-react';
import { Link } from 'react-router';

const MCPs = () => {
  const { data: mcpServers = [], isLoading, error } = useMCPServers();

  return (
    <PageContent>
      <PageContent.TopBar>
        <Button
          as={Link}
          to="https://mastra.ai/en/docs/tools-mcp/mcp-overview"
          rel="noopener noreferrer"
          target="_blank"
          variant="ghost"
          size="md"
        >
          MCP documentation
          <ExternalLinkIcon />
        </Button>
      </PageContent.TopBar>
      <PageContent.Main>
        <div className="w-full max-w-[80rem] px-10 mx-auto grid h-full grid-rows-[auto_1fr] overflow-y-auto">
          <MainHeader>
            <MainHeader.Column>
              <MainHeader.Title isLoading={isLoading}>
                <McpServerIcon /> MCP Servers
              </MainHeader.Title>
            </MainHeader.Column>
          </MainHeader>

          <MCPServerList mcpServers={mcpServers} isLoading={isLoading} error={error} />
        </div>
      </PageContent.Main>
    </PageContent>
  );
};

export default MCPs;
