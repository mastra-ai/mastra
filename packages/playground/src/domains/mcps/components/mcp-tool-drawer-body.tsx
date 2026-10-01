import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { useMCPServerTool } from '../hooks/use-mcp-server-tool';
import { McpToolPlayground } from './mcp-tool-playground';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { ToolDrawerContent } from '@/domains/tools/components/tool-drawer/tool-drawer-content';
import { ToolOverview } from '@/domains/tools/components/tool-overview';

export interface McpToolDrawerBodyProps {
  serverId: string;
  toolId: string;
}

export function McpToolDrawerBody({ serverId, toolId }: McpToolDrawerBodyProps) {
  const { canExecute } = usePermissions();
  const { data: tool, isLoading } = useMCPServerTool(serverId, toolId);

  if (isLoading) return <DataPanel.LoadingData />;
  if (!tool) return <DataPanel.NoData>This server has no tool "{toolId}".</DataPanel.NoData>;

  return (
    <ToolDrawerContent
      description={tool.description}
      // MCP tools report only their input; they aren't attached to agents through this server.
      overview={<ToolOverview inputSchema={tool.inputSchema} />}
      playground={canExecute('tools') ? <McpToolPlayground serverId={serverId} tool={tool} /> : undefined}
    />
  );
}
