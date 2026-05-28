// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { makeHeartbeat, makeHeartbeatList } from '../../__tests__/fixtures/heartbeats';
import { useDeleteHeartbeat, useHeartbeats, useUpdateHeartbeat } from '../use-heartbeats';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MastraReactProvider baseUrl={BASE_URL}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MastraReactProvider>
    );
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useHeartbeats', () => {
  it('fetches the global list with no agentId filter', async () => {
    const heartbeats = [makeHeartbeat({ id: 'hb_chef_t1', agentId: 'chef' }), makeHeartbeat({ id: 'hb_sommelier' })];
    server.use(
      http.get(`${BASE_URL}/api/heartbeats`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('agentId')).toBeNull();
        return HttpResponse.json(makeHeartbeatList(heartbeats));
      }),
    );

    const { result } = renderHook(() => useHeartbeats(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0]?.id).toBe('hb_chef_t1');
  });

  it('forwards agentId as a query param when scoped', async () => {
    const captured: string[] = [];
    server.use(
      http.get(`${BASE_URL}/api/heartbeats`, ({ request }) => {
        const url = new URL(request.url);
        const agentId = url.searchParams.get('agentId');
        if (agentId) captured.push(agentId);
        return HttpResponse.json(makeHeartbeatList([makeHeartbeat({ agentId: 'chef' })]));
      }),
    );

    const { result } = renderHook(() => useHeartbeats({ agentId: 'chef' }), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(captured).toEqual(['chef']);
    expect(result.current.data?.[0]?.agentId).toBe('chef');
  });

  it('returns the empty list when no heartbeats exist', async () => {
    server.use(http.get(`${BASE_URL}/api/heartbeats`, () => HttpResponse.json(makeHeartbeatList([]))));

    const { result } = renderHook(() => useHeartbeats(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

describe('useUpdateHeartbeat', () => {
  it('PATCHes cron edits and invalidates the list + detail queries', async () => {
    const updated = makeHeartbeat({ cron: '0 * * * *' });
    let receivedBody: Record<string, unknown> | undefined;

    server.use(
      http.patch(`${BASE_URL}/api/agents/chef/heartbeats/hb_chef_thread-1`, async ({ request }) => {
        receivedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(updated);
      }),
    );

    const { result } = renderHook(() => useUpdateHeartbeat('chef', 'hb_chef_thread-1'), {
      wrapper: makeWrapper(),
    });

    result.current.mutate({ cron: '0 * * * *' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(receivedBody).toEqual({ cron: '0 * * * *' });
    expect(result.current.data?.cron).toBe('0 * * * *');
  });

  it('PATCHes prompt edits', async () => {
    const updated = makeHeartbeat({ prompt: 'remind the user about their stew' });
    let receivedBody: Record<string, unknown> | undefined;

    server.use(
      http.patch(`${BASE_URL}/api/agents/chef/heartbeats/hb_chef_thread-1`, async ({ request }) => {
        receivedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(updated);
      }),
    );

    const { result } = renderHook(() => useUpdateHeartbeat('chef', 'hb_chef_thread-1'), {
      wrapper: makeWrapper(),
    });

    result.current.mutate({ prompt: 'remind the user about their stew' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(receivedBody).toEqual({ prompt: 'remind the user about their stew' });
    expect(result.current.data?.prompt).toBe('remind the user about their stew');
  });

  it('surfaces errors when the server rejects an update', async () => {
    server.use(
      http.patch(`${BASE_URL}/api/agents/chef/heartbeats/hb_chef_thread-1`, () =>
        HttpResponse.json({ error: 'Invalid cron' }, { status: 400 }),
      ),
    );

    const { result } = renderHook(() => useUpdateHeartbeat('chef', 'hb_chef_thread-1'), {
      wrapper: makeWrapper(),
    });

    result.current.mutate({ cron: 'not-a-cron' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteHeartbeat', () => {
  it('DELETEs the heartbeat and returns the server message', async () => {
    server.use(
      http.delete(`${BASE_URL}/api/agents/chef/heartbeats/hb_chef_thread-1`, () =>
        HttpResponse.json({ message: 'Heartbeat hb_chef_thread-1 deleted' }),
      ),
    );

    const { result } = renderHook(() => useDeleteHeartbeat('chef', 'hb_chef_thread-1'), {
      wrapper: makeWrapper(),
    });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.message).toBe('Heartbeat hb_chef_thread-1 deleted');
  });

  it('surfaces delete failures as mutation errors', async () => {
    server.use(
      http.delete(`${BASE_URL}/api/agents/chef/heartbeats/hb_missing`, () =>
        HttpResponse.json({ error: 'Heartbeat not found' }, { status: 404 }),
      ),
    );

    const { result } = renderHook(() => useDeleteHeartbeat('chef', 'hb_missing'), {
      wrapper: makeWrapper(),
    });

    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
