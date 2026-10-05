import { CrumbSkeleton, crumbSwitcherTriggerProps } from '@mastra/playground-ui/components/Breadcrumb';
import { useMCPServerTool, useMCPServers } from '@mastra/react/hooks';
import { useParams } from 'react-router';
import { MCPServerCombobox } from './components/mcp-server-combobox';

export function McpServerCrumb() {
  const { serverId } = useParams<{ serverId: string }>();
  const { data: mcpServers, isLoading } = useMCPServers();
  if (!serverId) return null;
  if (isLoading) return <CrumbSkeleton />;

  return mcpServers?.find(server => server.id === serverId)?.name || serverId;
}

export function McpServerSwitcher() {
  const { serverId } = useParams<{ serverId: string }>();
  if (!serverId) return null;

  return <MCPServerCombobox value={serverId} {...crumbSwitcherTriggerProps} aria-label="Switch MCP server" />;
}

export function McpServerToolCrumb() {
  const { serverId, toolId } = useParams<{ serverId: string; toolId: string }>();
  const { data: tool } = useMCPServerTool({
    serverId: serverId ?? '',
    toolId: toolId ?? '',
    queryOptions: { enabled: !!serverId && !!toolId },
  });

  return tool?.name ?? toolId ?? null;
}
