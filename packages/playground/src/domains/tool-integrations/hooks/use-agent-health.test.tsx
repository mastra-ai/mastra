// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useAgentHealth } from './use-agent-health';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

type ToolIntegrations = NonNullable<AgentBuilderEditFormValues['toolIntegrations']>;

const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

const buildToolIntegrations = (
  config: Record<string, Record<string, Array<{ connectionId: string; label: string }>>>,
): ToolIntegrations => {
  const out: ToolIntegrations = {};
  for (const [providerId, services] of Object.entries(config)) {
    const connections: Record<
      string,
      Array<{ kind: 'author'; toolService: string; connectionId: string; label: string }>
    > = {};
    for (const [toolService, conns] of Object.entries(services)) {
      connections[toolService] = conns.map(c => ({
        kind: 'author' as const,
        toolService,
        connectionId: c.connectionId,
        label: c.label,
      }));
    }
    out[providerId] = { tools: {}, connections };
  }
  return out;
};

describe('useAgentHealth', () => {
  it("returns state 'empty' when no integrations have connections", () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useAgentHealth(undefined), { wrapper });
    expect(result.current.state).toBe('empty');
    expect(result.current.integrations).toEqual([]);
    expect(result.current.total).toBe(0);
  });

  it('aggregates ok when all connections are connected', async () => {
    server.use(
      http.post('*/api/tool-integrations/composio/connection-status', () =>
        HttpResponse.json({
          items: {
            ca_1: { connected: true },
            ca_2: { connected: true },
          },
        }),
      ),
    );
    const wrapper = makeWrapper();
    const { result } = renderHook(
      () =>
        useAgentHealth(
          buildToolIntegrations({
            composio: {
              gmail: [
                { connectionId: 'ca_1', label: 'Work' },
                { connectionId: 'ca_2', label: 'Personal' },
              ],
            },
          }),
        ),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.state).toBe('ok');
    expect(result.current.connected).toBe(2);
    expect(result.current.total).toBe(2);
    expect(result.current.integrations[0]?.state).toBe('ok');
  });

  it('aggregates warn when at least one connection is disconnected', async () => {
    server.use(
      http.post('*/api/tool-integrations/composio/connection-status', () =>
        HttpResponse.json({
          items: {
            ca_1: { connected: true },
            ca_2: { connected: false },
          },
        }),
      ),
    );
    const wrapper = makeWrapper();
    const { result } = renderHook(
      () =>
        useAgentHealth(
          buildToolIntegrations({
            composio: {
              gmail: [
                { connectionId: 'ca_1', label: 'Work' },
                { connectionId: 'ca_2', label: 'Personal' },
              ],
            },
          }),
        ),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.state).toBe('warn');
    expect(result.current.connected).toBe(1);
    expect(result.current.total).toBe(2);
    const service = result.current.integrations[0]?.byToolService[0];
    expect(service?.disconnectedConnections).toEqual([{ connectionId: 'ca_2', label: 'Personal' }]);
  });

  it('aggregates error when every connection is disconnected', async () => {
    server.use(
      http.post('*/api/tool-integrations/composio/connection-status', () =>
        HttpResponse.json({
          items: { ca_1: { connected: false } },
        }),
      ),
    );
    const wrapper = makeWrapper();
    const { result } = renderHook(
      () =>
        useAgentHealth(
          buildToolIntegrations({
            composio: { gmail: [{ connectionId: 'ca_1', label: 'Work' }] },
          }),
        ),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.state).toBe('error');
    expect(result.current.integrations[0]?.state).toBe('error');
  });

  it('issues exactly one HTTP call per provider regardless of connection count', async () => {
    const handler = vi.fn(() =>
      HttpResponse.json({
        items: {
          ca_1: { connected: true },
          ca_2: { connected: true },
          ca_3: { connected: true },
        },
      }),
    );
    server.use(http.post('*/api/tool-integrations/composio/connection-status', handler));

    const wrapper = makeWrapper();
    const { result } = renderHook(
      () =>
        useAgentHealth(
          buildToolIntegrations({
            composio: {
              gmail: [
                { connectionId: 'ca_1', label: 'Work' },
                { connectionId: 'ca_2', label: 'Personal' },
              ],
              slack: [{ connectionId: 'ca_3', label: 'Team' }],
            },
          }),
        ),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('ok');
  });

  it('does not call the API when no provider has stored connections', async () => {
    const handler = vi.fn(() => HttpResponse.json({ items: {} }));
    server.use(http.post('*/api/tool-integrations/composio/connection-status', handler));

    const wrapper = makeWrapper();
    renderHook(
      () =>
        useAgentHealth(
          buildToolIntegrations({
            composio: {}, // provider exists but has no connections
          }),
        ),
      { wrapper },
    );

    // Give react-query a tick to settle.
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(handler).not.toHaveBeenCalled();
  });
});
