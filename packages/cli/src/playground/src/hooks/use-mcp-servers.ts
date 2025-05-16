import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { client } from '@/lib/client';
import { McpServerListResponse } from '@mastra/client-js';

export const useMCPServers = () => {
  const [servers, setServers] = useState<McpServerListResponse['servers']>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchMCPServers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const mcpServers: McpServerListResponse['servers'] = (await client.getMcpServers()).servers;

        setServers(mcpServers);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error fetching MCP servers';
        console.error('Error fetching MCP servers', e);
        toast.error(errorMessage);
        setError(e instanceof Error ? e : new Error(errorMessage));
        setServers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMCPServers();
  }, []);

  return { servers, isLoading, error };
};
