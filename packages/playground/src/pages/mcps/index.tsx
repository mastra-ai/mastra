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
  useMCPServers,
} from '@mastra/playground-ui';

import { Link } from 'react-router';

const MCPs = () => {
  const { data: mcpServers = [], isLoading } = useMCPServers();

  const isEmpty = !isLoading && mcpServers.length === 0;

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

      <MainContentContent isCentered={isEmpty}>
        <MCPTable mcpServers={mcpServers} isLoading={isLoading} />
      </MainContentContent>
    </MainContentLayout>
  );
};

export default MCPs;
