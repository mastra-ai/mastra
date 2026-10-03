import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

/** The HTML of a tool's ui:// app resource, when it has one. */
export function useMcpAppHtml(serverId: string, appResourceUri: string | undefined) {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['mcp-app-resource', serverId, appResourceUri],
    queryFn: async () => {
      if (!appResourceUri) return null;
      const response = await client.readMcpServerResource(serverId, appResourceUri);
      return response.contents[0]?.text ?? null;
    },
    enabled: appResourceUri !== undefined,
    // React Query can't hold `undefined`, so the query returns `null` for "no app"; callers get `undefined`.
    select: html => html ?? undefined,
  });
}
