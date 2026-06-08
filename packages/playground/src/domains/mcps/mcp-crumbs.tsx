import { useParams } from 'react-router';
import { MCPServerCombobox } from './components/mcp-server-combobox';
import { useMCPServerTool } from './hooks/use-mcp-server-tool';

export function McpServerCrumb() {
  const { serverId } = useParams<{ serverId: string }>();
  if (!serverId) return null;

  return <MCPServerCombobox value={serverId} variant="ghost" />;
}

export function McpServerToolCrumb() {
  const { serverId, toolId } = useParams<{ serverId: string; toolId: string }>();
  const { data: tool } = useMCPServerTool(serverId ?? '', toolId ?? '', { enabled: !!serverId && !!toolId });

  return tool?.name ?? toolId ?? null;
}
