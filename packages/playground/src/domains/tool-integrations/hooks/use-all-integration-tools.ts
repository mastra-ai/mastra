import { useMastraClient } from '@mastra/react';
import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useToolIntegrations } from './use-tool-integrations';

export interface AvailableIntegrationTool {
  providerId: string;
  slug: string;
  toolService: string;
  name?: string;
  description?: string;
}

/**
 * Upper bound for a single Composio-style `listTools` call. Composio's SDK has
 * no cursor — only `limit` — so we ask for a large page and fan out per
 * `toolService` to avoid being truncated when many toolkits are allowlisted.
 */
const PER_SERVICE_LIMIT = 500;

/**
 * Returns every tool surfaced by every registered ToolIntegration, scoped to
 * the provider's `allowedToolServices`/`allowedTools` filter (enforced
 * server-side). Used to render the full available-tools list inline.
 *
 * Fans out one `listTools({ toolService })` call per service so the dropdown
 * doesn't silently cap at a single page when many toolkits are configured.
 */
export const useAllIntegrationTools = () => {
  const client = useMastraClient();
  const integrationsQuery = useToolIntegrations();
  const integrations = useMemo(
    () => integrationsQuery.data?.integrations ?? [],
    [integrationsQuery.data?.integrations],
  );

  // 1. For every integration, fetch its tool services.
  const serviceQueries = useQueries({
    queries: integrations.map(integration => ({
      queryKey: ['tool-integration-services', integration.id],
      queryFn: () => client.getToolIntegration(integration.id).listToolServices(),
    })),
  });

  // 2. Flatten to (integrationId, serviceSlug) pairs.
  const servicePairs = useMemo(() => {
    const pairs: Array<{ integrationId: string; toolService: string }> = [];
    integrations.forEach((integration, idx) => {
      const services = serviceQueries[idx]?.data?.data ?? [];
      for (const service of services) {
        pairs.push({ integrationId: integration.id, toolService: service.slug });
      }
    });
    return pairs;
  }, [integrations, serviceQueries]);

  // 3. Fan out one tools query per (integration, service).
  const toolsQueries = useQueries({
    queries: servicePairs.map(pair => ({
      queryKey: ['tool-integration-tools-all', pair.integrationId, pair.toolService],
      queryFn: () =>
        client
          .getToolIntegration(pair.integrationId)
          .listTools({ toolService: pair.toolService, perPage: PER_SERVICE_LIMIT }),
    })),
  });

  const isLoading =
    integrationsQuery.isLoading || serviceQueries.some(q => q.isLoading) || toolsQueries.some(q => q.isLoading);

  const tools = useMemo<AvailableIntegrationTool[]>(() => {
    const out: AvailableIntegrationTool[] = [];
    servicePairs.forEach((pair, idx) => {
      const items = toolsQueries[idx]?.data?.data ?? [];
      for (const item of items) {
        const toolService = (item as { toolService?: string }).toolService ?? pair.toolService;
        out.push({
          providerId: pair.integrationId,
          slug: item.slug,
          toolService,
          name: (item as { name?: string }).name,
          description: (item as { description?: string }).description,
        });
      }
    });
    return out;
  }, [servicePairs, toolsQueries]);

  return { tools, isLoading };
};
