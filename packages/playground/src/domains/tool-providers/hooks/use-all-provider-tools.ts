import { useMastraClient } from '@mastra/react';
import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useToolProviders } from './use-tool-providers';

export interface AvailableIntegrationTool {
  providerId: string;
  slug: string;
  toolkit: string;
  name?: string;
  description?: string;
}

/**
 * Upper bound for a single Composio-style `listTools` call. Composio's SDK has
 * no cursor — only `limit` — so we ask for a large page and fan out per
 * `toolkit` to avoid being truncated when many toolkits are allowlisted.
 */
const PER_SERVICE_LIMIT = 500;

/**
 * Returns every tool surfaced by every registered ToolProvider, scoped to
 * the provider's `allowedToolkits`/`allowedTools` filter (enforced
 * server-side). Used to render the full available-tools list inline.
 */
export const useAllProviderTools = () => {
  const client = useMastraClient();
  const integrationsQuery = useToolProviders();
  const integrations = useMemo(() => integrationsQuery.data?.providers ?? [], [integrationsQuery.data?.providers]);

  // 1. For every integration, fetch its tool services.
  const serviceQueries = useQueries({
    queries: integrations.map(integration => ({
      queryKey: ['tool-integration-services', integration.id],
      queryFn: () => client.getToolProvider(integration.id).listToolkits(),
    })),
  });

  // 2. Flatten to (providerId, serviceSlug) pairs.
  const servicePairs = useMemo(() => {
    const pairs: Array<{ providerId: string; toolkit: string }> = [];
    integrations.forEach((integration, idx) => {
      const services = serviceQueries[idx]?.data?.data ?? [];
      for (const service of services) {
        pairs.push({ providerId: integration.id, toolkit: service.slug });
      }
    });
    return pairs;
  }, [integrations, serviceQueries]);

  // 3. Fan out one tools query per (integration, service).
  const toolsQueries = useQueries({
    queries: servicePairs.map(pair => ({
      queryKey: ['tool-integration-tools-all', pair.providerId, pair.toolkit],
      queryFn: () =>
        client.getToolProvider(pair.providerId).listTools({ toolkit: pair.toolkit, perPage: PER_SERVICE_LIMIT }),
    })),
  });

  const isLoading =
    integrationsQuery.isLoading || serviceQueries.some(q => q.isLoading) || toolsQueries.some(q => q.isLoading);

  const tools = useMemo<AvailableIntegrationTool[]>(() => {
    const out: AvailableIntegrationTool[] = [];
    servicePairs.forEach((pair, idx) => {
      const items = toolsQueries[idx]?.data?.data ?? [];
      for (const item of items) {
        const toolkit = (item as { toolkit?: string }).toolkit ?? pair.toolkit;
        out.push({
          providerId: pair.providerId,
          slug: item.slug,
          toolkit,
          name: (item as { name?: string }).name,
          description: (item as { description?: string }).description,
        });
      }
    });
    return out;
  }, [servicePairs, toolsQueries]);

  return { tools, isLoading };
};
