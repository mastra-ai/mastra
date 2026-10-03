import { CrumbSkeleton, crumbSwitcherTriggerProps } from '@mastra/playground-ui/components/Breadcrumb';
import { useParams } from 'react-router';
import { MCPServerCombobox } from './components/mcp-server-combobox';
import { useMCPServers } from './hooks/use-mcp-servers';

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
