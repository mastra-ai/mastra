import {
  Icon,
  DocsIcon,
  Button,
  HeaderAction,
  Header,
  MainContentContent,
  MainContentLayout,
  MCPTable,
  HeaderTitle,
  McpServerIcon,
} from '@mastra/playground-ui';

import { useMCPServers } from '@/hooks/use-mcp-servers';
import { Link } from 'react-router';

const MCPs = () => {
  const { servers, isLoading } = useMCPServers();

  const mcpServers = servers ?? [];

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
          <Button as={Link} to="https://mastra.ai/en/docs/tools-mcp/mcp-overview" target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
            MCP documentation
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent>
        <MCPTable mcpServers={mcpServers} isLoading={isLoading} />
      </MainContentContent>
    </MainContentLayout>
  );
};

export default MCPs;
