import { Link, useParams } from 'react-router';

import {
  Header,
  Breadcrumb,
  Crumb,
  McpServerIcon,
  Icon,
  Button,
  HeaderAction,
  DocsIcon,
  MCPToolPanel,
  useMCPServerTool,
  useMCPServers,
} from '@mastra/playground-ui';

const MCPServerToolExecutor = () => {
  const { data: mcpServers } = useMCPServers();
  const { serverId, toolId } = useParams<{ serverId: string; toolId: string }>();

  const { data: mcpTool, isLoading } = useMCPServerTool(serverId!, toolId!);

  const mcpServer = mcpServers?.find(server => server.id === serverId);

  const toolActualName = mcpTool?.name;
  const currentServerName = mcpServer?.name || '';

  if (isLoading) return null;
  if (!mcpTool) return null;

  return (
    <div className="h-full w-full bg-mastra-bg-1 overflow-y-hidden">
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/mcps`}>
            <Icon>
              <McpServerIcon />
            </Icon>
            MCP Servers
          </Crumb>
          <Crumb as={Link} to={`/mcps/${serverId}`}>
            {currentServerName}
          </Crumb>
          <Crumb as="span" to="" isCurrent>
            {toolActualName}
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

      <MCPToolPanel toolId={toolId!} serverId={serverId!} />
    </div>
  );
};

export default MCPServerToolExecutor;
