import { useParams } from 'react-router';
import { MCPDetail } from '@/domains/mcps/components/MCPDetail';
import { useMCPServers } from '@/domains/mcps/hooks/use-mcp-servers';

export const McpServerPage = () => {
  const { serverId } = useParams();
  const { data: mcpServers = [], isLoading } = useMCPServers();

  const server = mcpServers.find(server => server.id === serverId);

  return (
    <div className="h-full w-full overflow-hidden">
      <MCPDetail isLoading={isLoading} server={server} />
    </div>
  );
};
