import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ServerInfo } from '@mastra/core/mcp';
import { client } from '@/lib/client';
// Import types directly from the SDK if @/lib/client doesn't re-export them
import type { McpServerToolListResponse, McpToolInfo as SdkMcpToolInfo } from '@mastra/client-js';

export const useMCPServerTools = (selectedServer: ServerInfo | null) => {
  // The key for this Record will be the tool's display name, value is PlaygroundToolListItem
  const [tools, setTools] = useState<Record<string, SdkMcpToolInfo>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchTools = async () => {
      if (!selectedServer) {
        setTools({});
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const response: McpServerToolListResponse = await client.getMcpServerTools(selectedServer.id);
        const fetchedToolsArray: SdkMcpToolInfo[] = response.tools;

        const transformedTools: Record<string, SdkMcpToolInfo> = {};
        fetchedToolsArray.forEach((sdkToolInfo: SdkMcpToolInfo) => {
          transformedTools[sdkToolInfo.id] = sdkToolInfo;
        });

        setTools(transformedTools);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error fetching MCP server tools';
        console.error(`Error fetching tools for MCP server ${selectedServer.name}:`, e);
        toast.error(errorMessage);
        setError(e instanceof Error ? e : new Error(errorMessage));
        setTools({});
      } finally {
        setIsLoading(false);
      }
    };

    fetchTools();
  }, [selectedServer]);

  return { tools, isLoading, error };
};
