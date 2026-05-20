import { useParams } from 'react-router';
import { MCPToolPanel } from '@/domains/mcps/components/MCPToolPanel';
import { useMCPServerTool } from '@/domains/mcps/hooks/use-mcp-server-tool';

const MCPServerToolExecutor = () => {
  const { serverId, toolId } = useParams<{ serverId: string; toolId: string }>();

  const { data: mcpTool, isLoading } = useMCPServerTool(serverId!, toolId!);

  if (isLoading) return null;
  if (!mcpTool) return null;

  return (
    <div className="h-full w-full overflow-y-auto">
      <MCPToolPanel toolId={toolId!} serverId={serverId!} />
    </div>
  );
};

export default MCPServerToolExecutor;
