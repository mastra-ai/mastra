import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { client } from '@/lib/client';
import type { McpToolInfo as SdkMcpToolInfo } from '@mastra/client-js';

// Structure for the hook to return
export interface PlaygroundMCPToolInstance {
  instance: ReturnType<typeof client.getMcpServerTool>; // The MCPTool instance for calling .execute()
  details: SdkMcpToolInfo; // Details like name, description, inputSchema
}

export const useMCPServerTool = (serverId: string | undefined, toolId: string | undefined) => {
  const [tool, setTool] = useState<PlaygroundMCPToolInstance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchTool = async () => {
      if (!serverId || !toolId) {
        setTool(null);
        setIsLoading(false);
        setError(null);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        // Get the MCPTool instance from the client
        // toolId here is expected to be the namespaced ID, e.g., "actualServerId_toolName"
        const mcpToolInstance = client.getMcpServerTool(serverId, toolId);
        // Fetch its details (schema, description)
        const toolDetails = await mcpToolInstance.details();
        if (mounted) {
          setTool({
            instance: mcpToolInstance,
            details: toolDetails,
          });
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error fetching MCP tool details';
        console.error(`Error fetching details for MCP tool ${toolId} on server ${serverId}:`, e);
        if (mounted) {
          toast.error(errorMessage);
          setError(e instanceof Error ? e : new Error(errorMessage));
          setTool(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    fetchTool();
    return () => {
      mounted = false;
    };
  }, [serverId, toolId]);

  return { tool, isLoading, error };
};
