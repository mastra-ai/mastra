import { McpToolDrawerBody } from './mcp-tool-drawer-body';
import { ToolDrawer } from '@/domains/tools/components/tool-drawer/tool-drawer';
import { useToolDrawerParam } from '@/domains/tools/hooks/use-tool-drawer-param';

export interface McpToolDrawerProps {
  serverId: string;
}

/** The drawer on an MCP server's page, opened by `?tool=` from its tools list. */
export function McpToolDrawer({ serverId }: McpToolDrawerProps) {
  const { toolId, close } = useToolDrawerParam();

  return (
    <ToolDrawer open={toolId !== undefined} onClose={close} toolId={toolId ?? ''}>
      {toolId && <McpToolDrawerBody key={toolId} serverId={serverId} toolId={toolId} />}
    </ToolDrawer>
  );
}
