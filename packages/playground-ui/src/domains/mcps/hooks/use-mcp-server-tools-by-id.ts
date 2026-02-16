import { useMastraClient } from '@mastra/react';
import type { McpToolInfo } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';

export const useMCPServerToolsById = (serverId: string | null) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['mcpserver-tools', serverId],
    queryFn: async () => {
      const response = await client.getMcpServerTools(serverId!);
      const fetchedToolsArray: McpToolInfo[] = response.tools;
      const transformedTools: Record<string, McpToolInfo> = {};
      fetchedToolsArray.forEach((sdkToolInfo: McpToolInfo) => {
        transformedTools[sdkToolInfo.id] = sdkToolInfo;
      });
      return transformedTools;
    },
    enabled: Boolean(serverId),
    retry: false,
    refetchOnWindowFocus: false,
  });
};
