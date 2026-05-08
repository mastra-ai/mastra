import { Breadcrumb, Button, Crumb, DocsIcon, Header, HeaderAction, Icon, McpServerIcon } from '@mastra/playground-ui';
import { Link, useParams } from 'react-router';
import { MCPToolPanel } from '@/domains/mcps/components/MCPToolPanel';
import { useMCPServerTool } from '@/domains/mcps/hooks/use-mcp-server-tool';
import { useMCPServers } from '@/domains/mcps/hooks/use-mcp-servers';

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
    <div className="h-full w-full bg-surface2 overflow-y-auto">
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

      <MCPToolPanel toolId={toolId!} serverId={serverId!} />
    </div>
  );
};

export default MCPServerToolExecutor;
