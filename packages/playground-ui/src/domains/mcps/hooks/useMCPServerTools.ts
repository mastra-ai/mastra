import { ServerInfo } from '@mastra/core/mcp';
import { useMastraClient } from '@mastra/react';

import type { McpToolInfo as SdkMcpToolInfo } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';

export const useMCPServerTools = (selectedServer: ServerInfo) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['mcpserver-tools', selectedServer?.id],
    queryFn: async () => {
      const response = await client.getMcpServerTools(selectedServer?.id);
      const fetchedToolsArray: SdkMcpToolInfo[] = response.tools;
      const transformedTools: Record<string, SdkMcpToolInfo> = {};
      fetchedToolsArray.forEach((sdkToolInfo: SdkMcpToolInfo) => {
        transformedTools[sdkToolInfo.id] = sdkToolInfo;
      });

      return transformedTools;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
};
