import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { useMCPServerTool } from '@mastra/react/hooks/mcps';
import { McpToolPlayground } from './mcp-tool-playground';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useOpenToolId } from '@/domains/tools/components/tool-drawer/open-tool-context';
import { ToolDrawerContent } from '@/domains/tools/components/tool-drawer/tool-drawer-content';
import { ToolOverview } from '@/domains/tools/components/tool-overview';

export interface McpToolDrawerBodyProps {
  serverId: string;
}

export function McpToolDrawerBody({ serverId }: McpToolDrawerBodyProps) {
  const toolId = useOpenToolId();
  const { canExecute } = usePermissions();
  const { data: tool, isLoading } = useMCPServerTool({ serverId, toolId });

  if (isLoading) return <DataPanel.LoadingData />;
  if (!tool) return <DataPanel.NoData>This server has no tool "{toolId}".</DataPanel.NoData>;

  return (
    <ToolDrawerContent
      description={tool.description}
      // MCP tools report only their input; they aren't attached to agents through this server.
      overview={<ToolOverview inputSchema={tool.inputSchema} />}
      canRun={canExecute('tools')}
      playground={<McpToolPlayground serverId={serverId} tool={tool} />}
    />
  );
}
