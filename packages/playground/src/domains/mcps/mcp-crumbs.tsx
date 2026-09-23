import { CrumbSkeleton } from '@mastra/playground-ui/components/Breadcrumb';
import { useParams } from 'react-router';
import { MCPServerCombobox } from './components/mcp-server-combobox';
import { useMCPServerTool } from './hooks/use-mcp-server-tool';
import { useMCPServers } from './hooks/use-mcp-servers';

export function McpServerCrumb() {
  const { serverId } = useParams<{ serverId: string }>();
  const { data: mcpServers, isLoading } = useMCPServers();
  if (!serverId) return null;
  if (isLoading) return <CrumbSkeleton />;

  return mcpServers?.find(server => server.id === serverId)?.name || serverId;
}

export function McpServerSwitcherAction() {
  const { serverId } = useParams<{ serverId: string }>();
  if (!serverId) return null;

  return (
    <MCPServerCombobox value={serverId} variant="ghost" size="icon-sm" align="end" aria-label="Switch MCP server" />
  );
}

export function McpServerToolCrumb() {
  const { serverId, toolId } = useParams<{ serverId: string; toolId: string }>();
  const { data: tool } = useMCPServerTool(serverId ?? '', toolId ?? '', { enabled: !!serverId && !!toolId });

  return tool?.name ?? toolId ?? null;
}
