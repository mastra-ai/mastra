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
  HeaderGroup,
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
          <Crumb as={Link} to={`/mcps`} isCurrent>
            <Icon>
              <McpServerIcon />
            </Icon>
            MCP Servers
          </Crumb>
        </Breadcrumb>

        <HeaderGroup>
          <div className="w-[240px]">
            <MCPServerCombobox value={serverId} />
          </div>
        </HeaderGroup>

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
