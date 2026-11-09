import type { MastraClient } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

/** The app HTML, or `null` when the resource has no text. */
type McpAppHtml = string | null;

export type ReadMcpServerResourceResponse = Awaited<ReturnType<MastraClient['readMcpServerResource']>>;

/**
 * The HTML of an MCP tool's `ui://` app resource (from the tool's `_meta`), for rendering the tool's own UI.
 * Skips the fetch when the tool has no app resource.
 */
export const useMcpAppHtml = <TData = McpAppHtml>({
  serverId,
  appResourceUri,
  queryOptions,
}: {
  serverId: string;
  appResourceUri?: string;
  queryOptions?: MastraQueryOptions<McpAppHtml, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['mcp-app-resource', serverId, appResourceUri],
    queryFn: async () => {
      if (!appResourceUri) return null;
      const response = await client.readMcpServerResource(serverId, appResourceUri);
      return response.contents[0]?.text ?? null;
    },
    enabled: appResourceUri !== undefined,
    ...queryOptions,
  });
};
