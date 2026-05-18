import { useMastraClient } from '@mastra/react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';

/**
 * Aggregated health rollup for a single `(integrationId, toolService)` pair.
 *
 * `connected` + `total` drive the `n of m connected` popover row.
 * `disconnectedConnections` lets the popover render a Reauthorize button per
 * broken connection.
 */
export interface ToolServiceHealth {
  toolService: string;
  total: number;
  connected: number;
  disconnectedConnections: Array<{
    connectionId: string;
    label?: string;
  }>;
}

export interface IntegrationHealth {
  integrationId: string;
  state: 'ok' | 'warn' | 'error';
  total: number;
  connected: number;
  byToolService: ToolServiceHealth[];
  /** Underlying react-query state for the per-provider batch call. */
  isLoading: boolean;
  isError: boolean;
}

export interface AgentHealthResult {
  state: 'ok' | 'warn' | 'error' | 'empty';
  total: number;
  connected: number;
  integrations: IntegrationHealth[];
  isLoading: boolean;
  isError: boolean;
  /** Invalidate the batch query for a provider — used after a reauth flow. */
  invalidateIntegration: (integrationId: string) => Promise<void>;
}

interface ConnectionRef {
  toolService: string;
  connectionId: string;
  label?: string;
}

interface ProviderItems {
  integrationId: string;
  connections: ConnectionRef[];
  queryKey: readonly unknown[];
}

const buildQueryKey = (integrationId: string, connections: ConnectionRef[]) => {
  const stable = connections.map(c => `${c.toolService}:${c.connectionId}`).sort();
  return ['tool-integration-connection-status', integrationId, stable.join('|')] as const;
};

/**
 * Per-agent health rollup. Fan-outs one batched `getConnectionStatus` call per
 * `ToolIntegration` provider that has at least one stored connection. The
 * shape it returns is what the Tools-panel `HealthPill` consumes verbatim.
 */
export function useAgentHealth(
  toolIntegrations: AgentBuilderEditFormValues['toolIntegrations'] | undefined,
): AgentHealthResult {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  const providers = useMemo<ProviderItems[]>(() => {
    if (!toolIntegrations) return [];
    const list: ProviderItems[] = [];
    for (const [integrationId, config] of Object.entries(toolIntegrations)) {
      const connections: ConnectionRef[] = [];
      for (const [toolService, conns] of Object.entries(config.connections ?? {})) {
        for (const conn of conns) {
          connections.push({ toolService, connectionId: conn.connectionId, label: conn.label });
        }
      }
      if (connections.length === 0) continue;
      list.push({
        integrationId,
        connections,
        queryKey: buildQueryKey(integrationId, connections),
      });
    }
    return list;
  }, [toolIntegrations]);

  const queries = useQueries({
    queries: providers.map(provider => ({
      queryKey: provider.queryKey,
      queryFn: () =>
        client.getToolIntegration(provider.integrationId).getConnectionStatus({
          items: provider.connections.map(c => ({
            connectionId: c.connectionId,
            toolService: c.toolService,
          })),
        }),
    })),
  });

  const invalidateIntegration = useCallback(
    async (integrationId: string) => {
      const target = providers.find(p => p.integrationId === integrationId);
      if (!target) return;
      await queryClient.invalidateQueries({ queryKey: target.queryKey });
    },
    [providers, queryClient],
  );

  return useMemo<AgentHealthResult>(() => {
    if (providers.length === 0) {
      return {
        state: 'empty',
        total: 0,
        connected: 0,
        integrations: [],
        isLoading: false,
        isError: false,
        invalidateIntegration,
      };
    }

    const integrations: IntegrationHealth[] = providers.map((provider, idx) => {
      const query = queries[idx];
      const statusMap = (query?.data?.items ?? {}) as Record<string, { connected: boolean }>;

      const byToolServiceMap = new Map<string, ToolServiceHealth>();
      for (const conn of provider.connections) {
        const existing = byToolServiceMap.get(conn.toolService) ?? {
          toolService: conn.toolService,
          total: 0,
          connected: 0,
          disconnectedConnections: [],
        };
        existing.total += 1;
        if (statusMap[conn.connectionId]?.connected) {
          existing.connected += 1;
        } else {
          existing.disconnectedConnections.push({
            connectionId: conn.connectionId,
            label: conn.label,
          });
        }
        byToolServiceMap.set(conn.toolService, existing);
      }
      const byToolService = Array.from(byToolServiceMap.values());
      const total = provider.connections.length;
      const connected = byToolService.reduce((sum, s) => sum + s.connected, 0);
      const state: IntegrationHealth['state'] =
        query?.data?.items === undefined ? 'ok' : connected === total ? 'ok' : connected === 0 ? 'error' : 'warn';

      return {
        integrationId: provider.integrationId,
        state,
        total,
        connected,
        byToolService,
        isLoading: query?.isLoading ?? false,
        isError: query?.isError ?? false,
      };
    });

    const total = integrations.reduce((sum, i) => sum + i.total, 0);
    const connected = integrations.reduce((sum, i) => sum + i.connected, 0);
    const anyError = integrations.some(i => i.state === 'error');
    const anyWarn = integrations.some(i => i.state === 'warn');
    const aggregate: AgentHealthResult['state'] = anyError ? 'error' : anyWarn ? 'warn' : 'ok';

    return {
      state: aggregate,
      total,
      connected,
      integrations,
      isLoading: queries.some(q => q.isLoading),
      isError: queries.some(q => q.isError),
      invalidateIntegration,
    };
  }, [providers, queries, invalidateIntegration]);
}
