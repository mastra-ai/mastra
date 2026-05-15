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
 * Returns every tool surfaced by every registered ToolIntegration, scoped to
 * the provider's `allowedToolServices`/`allowedTools` filter (enforced
 * server-side). Used to render the full available-tools list inline.
 */
export const useAllIntegrationTools = () => {
  const client = useMastraClient();
  const integrationsQuery = useToolIntegrations();
  const integrations = useMemo(
    () => integrationsQuery.data?.integrations ?? [],
    [integrationsQuery.data?.integrations],
  );

  const queries = useQueries({
    queries: integrations.map(integration => ({
      queryKey: ['tool-integration-tools-all', integration.id],
      queryFn: () => client.getToolIntegration(integration.id).listTools({ perPage: 200 }),
    })),
  });

  const isLoading = integrationsQuery.isLoading || queries.some(q => q.isLoading);

  const tools = useMemo<AvailableIntegrationTool[]>(() => {
    const out: AvailableIntegrationTool[] = [];
    integrations.forEach((integration, idx) => {
      const query = queries[idx];
      const items = query?.data?.data ?? [];
      for (const item of items) {
        const toolService = (item as { toolService?: string }).toolService;
        if (!toolService) continue;
        out.push({
          providerId: integration.id,
          slug: item.slug,
          toolService,
          name: (item as { name?: string }).name,
          description: (item as { description?: string }).description,
        });
      }
    });
    return out;
  }, [integrations, queries]);

  return { tools, isLoading };
};
