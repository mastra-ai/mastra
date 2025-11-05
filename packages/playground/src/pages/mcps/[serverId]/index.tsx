import { useMemo } from 'react';

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
  Combobox,
} from '@mastra/playground-ui';

import { Link, useParams, useNavigate } from 'react-router';

export const McpServerPage = () => {
  const { serverId } = useParams();
  const navigate = useNavigate();
  const { data: mcpServers = [], isLoading } = useMCPServers();

  const server = mcpServers.find(server => server.id === serverId);

  const mcpServerOptions = useMemo(() => {
    return mcpServers.map(server => ({
      label: server.name,
      value: server.id,
    }));
  }, [mcpServers]);

  const handleMcpServerChange = (newServerId: string) => {
    if (newServerId && newServerId !== serverId) {
      navigate(`/mcps/${newServerId}`);
    }
  };

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
            <Combobox
              options={mcpServerOptions}
              value={serverId}
              onValueChange={handleMcpServerChange}
              placeholder="Select an MCP server..."
              searchPlaceholder="Search MCP servers..."
              emptyText="No MCP servers found."
              buttonClassName="h-8"
            />
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
