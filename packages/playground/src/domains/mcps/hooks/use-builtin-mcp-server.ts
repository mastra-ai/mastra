import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

/** The built-in Mastra MCP server (`server.mcp`). Servers that predate the descriptor route answer 404. */
export function useBuiltinMcpServer() {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['builtin-mcp-server'],
    queryFn: () => client.getBuiltinMcpServer(),
    retry: false,
  });
}
