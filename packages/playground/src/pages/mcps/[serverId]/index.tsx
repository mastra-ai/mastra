import {
  Header,
  Crumb,
  Breadcrumb,
  Icon,
  McpServerIcon,
  MainContentLayout,
  HeaderAction,
  Button,
  DocsIcon,
  MCPDetail,
  useMCPServers,
  MCPServerCombobox,
} from '@mastra/playground-ui';

import { Link, useParams } from 'react-router';

export const McpServerPage = () => {
  const { serverId } = useParams();
  const { data: mcpServers = [], isLoading } = useMCPServers();

  const server = mcpServers.find(server => server.id === serverId);

  return (
    <MainContentLayout>
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/mcps`}>
            <Icon>
              <McpServerIcon />
            </Icon>
            MCP Servers
          </Crumb>
          <Crumb as="span" to="" isCurrent>
            <MCPServerCombobox value={serverId} variant="ghost" />
          </Crumb>
        </Breadcrumb>

        <HeaderAction>
          <Button as={Link} to="https://mastra.ai/en/docs/tools-mcp/mcp-overview" target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
            MCP documentation
          </Button>
        </HeaderAction>
      </Header>

      <MCPDetail isLoading={isLoading} server={server} />
    </MainContentLayout>
  );
};
