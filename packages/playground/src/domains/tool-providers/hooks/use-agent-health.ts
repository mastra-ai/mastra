import { useMastraClient } from '@mastra/react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';

/**
 * Aggregated health rollup for a single `(providerId, toolkit)` pair.
 *
 * `connected` + `total` drive the `n of m connected` popover row.
 * `disconnectedConnections` lets the popover render a Reauthorize button per
 * broken connection.
 */
export interface ToolkitHealth {
  toolkit: string;
  total: number;
  connected: number;
  disconnectedConnections: Array<{
    connectionId: string;
    label?: string;
  }>;
}

export interface IntegrationHealth {
  providerId: string;
  state: 'ok' | 'warn' | 'error';
  total: number;
  connected: number;
  byToolkit: ToolkitHealth[];
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
  invalidateIntegration: (providerId: string) => Promise<void>;
}

interface ConnectionRef {
  toolkit: string;
  connectionId: string;
  label?: string;
}

interface ProviderItems {
  providerId: string;
  connections: ConnectionRef[];
  queryKey: readonly unknown[];
}

const buildQueryKey = (providerId: string, connections: ConnectionRef[]) => {
  const stable = connections.map(c => `${c.toolkit}:${c.connectionId}`).sort();
  return ['tool-integration-connection-status', providerId, stable.join('|')] as const;
};

/**
 * Per-agent health rollup. Fan-outs one batched `getConnectionStatus` call per
 * `ToolProvider` provider that has at least one stored connection. The
 * shape it returns is what the Tools-panel `HealthPill` consumes verbatim.
 */
export function useAgentHealth(
  toolProviders: AgentBuilderEditFormValues['toolProviders'] | undefined,
): AgentHealthResult {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  const providers = useMemo<ProviderItems[]>(() => {
    if (!toolProviders) return [];
    const list: ProviderItems[] = [];
    for (const [providerId, config] of Object.entries(toolProviders)) {
      const connections: ConnectionRef[] = [];
      for (const [toolkit, conns] of Object.entries(config.connections ?? {})) {
        for (const conn of conns) {
          connections.push({ toolkit, connectionId: conn.connectionId, label: conn.label });
        }
      }
      if (connections.length === 0) continue;
      list.push({
        providerId,
        connections,
        queryKey: buildQueryKey(providerId, connections),
      });
    }
    return list;
  }, [toolProviders]);

  const queries = useQueries({
    queries: providers.map(provider => ({
      queryKey: provider.queryKey,
      queryFn: () =>
        client.getToolProvider(provider.providerId).getConnectionStatus({
          items: provider.connections.map(c => ({
            connectionId: c.connectionId,
            toolkit: c.toolkit,
          })),
        }),
    })),
  });

  const invalidateIntegration = useCallback(
    async (providerId: string) => {
      const target = providers.find(p => p.providerId === providerId);
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

      const byToolkitMap = new Map<string, ToolkitHealth>();
      for (const conn of provider.connections) {
        const existing = byToolkitMap.get(conn.toolkit) ?? {
          toolkit: conn.toolkit,
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
        byToolkitMap.set(conn.toolkit, existing);
      }
      const byToolkit = Array.from(byToolkitMap.values());
      const total = provider.connections.length;
      const connected = byToolkit.reduce((sum, s) => sum + s.connected, 0);
      const state: IntegrationHealth['state'] =
        query?.data?.items === undefined ? 'ok' : connected === total ? 'ok' : connected === 0 ? 'error' : 'warn';

      return {
        providerId: provider.providerId,
        state,
        total,
        connected,
        byToolkit,
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
