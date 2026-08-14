// @vitest-environment jsdom

import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../../test/msw-server';
import {
  completedFlowDetail,
  completedFlowTimeline,
  mixedFlowsPage,
  runningFlowDetail,
  settledFlowsPage,
} from '../../__tests__/fixtures/flows';
import { usePulseFlow, usePulseFlowTimeline, usePulseFlows } from '../use-pulse-flows';

const BASE_URL = 'http://localhost:4111';
const FLOWS_URL = `${BASE_URL}/api/pulse/flows`;

const queryClients: QueryClient[] = [];

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClients.push(queryClient);
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

afterEach(() => {
  cleanup();
  // Unmounting stops the observers but leaves cached queries armed. A leaked
  // 1s poller would land on the next test's handlers and inflate its counts.
  queryClients.splice(0).forEach(queryClient => queryClient.clear());
});

describe('usePulseFlows', () => {
  it('loads the flows list and forwards filters as query params', async () => {
    const searches: string[] = [];
    server.use(
      http.get(FLOWS_URL, ({ request }) => {
        searches.push(new URL(request.url).search);
        return HttpResponse.json(settledFlowsPage);
      }),
    );

    const { result, unmount } = renderHook(() => usePulseFlows({ status: 'completed', page: 0, perPage: 10 }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.flows.map(flow => flow.flowId)).toEqual(['flow-completed', 'flow-failed']);
    expect(result.current.data?.total).toBe(2);
    expect(searches[0]).toContain('status=completed');
    expect(searches[0]).toContain('page=0');
    expect(searches[0]).toContain('perPage=10');
    unmount();
  });

  it('polls every second while any flow is running', async () => {
    const onList = vi.fn<() => void>();
    server.use(
      http.get(FLOWS_URL, () => {
        onList();
        return HttpResponse.json(mixedFlowsPage);
      }),
    );

    const { result, unmount } = renderHook(() => usePulseFlows(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await waitFor(() => expect(onList.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 4000 });
    unmount();
  });

  it('stops polling once every flow has settled', async () => {
    const onList = vi.fn<() => void>();
    server.use(
      http.get(FLOWS_URL, () => {
        onList();
        return HttpResponse.json(settledFlowsPage);
      }),
    );

    const { result, unmount } = renderHook(() => usePulseFlows(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Wait past the 1s poll interval; a live poller would have refetched by now.
    await new Promise(resolve => setTimeout(resolve, 1300));
    expect(onList).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('surfaces the 501 pulse-unavailable error', async () => {
    server.use(http.get(FLOWS_URL, () => new HttpResponse(null, { status: 501 })));

    const { result, unmount } = renderHook(() => usePulseFlows(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as { status?: number } | null)?.status).toBe(501);
    unmount();
  });
});

describe('usePulseFlow', () => {
  it('polls while the flow is running', async () => {
    const onFlow = vi.fn<() => void>();
    server.use(
      http.get(`${FLOWS_URL}/flow-running`, () => {
        onFlow();
        return HttpResponse.json(runningFlowDetail);
      }),
    );

    const { result, unmount } = renderHook(() => usePulseFlow('flow-running'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await waitFor(() => expect(onFlow.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 4000 });
    unmount();
  });

  it('fetches once for a settled flow', async () => {
    const onFlow = vi.fn<() => void>();
    server.use(
      http.get(`${FLOWS_URL}/flow-completed`, () => {
        onFlow();
        return HttpResponse.json(completedFlowDetail);
      }),
    );

    const { result, unmount } = renderHook(() => usePulseFlow('flow-completed'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.flow?.status).toBe('completed');
    await new Promise(resolve => setTimeout(resolve, 1300));
    expect(onFlow).toHaveBeenCalledTimes(1);
    unmount();
  });
});

describe('usePulseFlowTimeline', () => {
  it('does not fetch until a flow id is provided', async () => {
    const onTimeline = vi.fn<() => void>();
    server.use(
      http.get(`${FLOWS_URL}/flow-completed/timeline`, () => {
        onTimeline();
        return HttpResponse.json(completedFlowTimeline);
      }),
    );

    const { unmount } = renderHook(() => usePulseFlowTimeline(undefined), { wrapper: makeWrapper() });

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(onTimeline).not.toHaveBeenCalled();
    unmount();
  });

  it('loads the timeline once for a settled flow and keeps polling while running', async () => {
    const onSettled = vi.fn<() => void>();
    const onRunning = vi.fn<() => void>();
    server.use(
      http.get(`${FLOWS_URL}/flow-completed/timeline`, () => {
        onSettled();
        return HttpResponse.json(completedFlowTimeline);
      }),
      http.get(`${FLOWS_URL}/flow-running/timeline`, () => {
        onRunning();
        return HttpResponse.json(completedFlowTimeline);
      }),
    );

    const settled = renderHook(() => usePulseFlowTimeline('flow-completed', false), { wrapper: makeWrapper() });
    const running = renderHook(() => usePulseFlowTimeline('flow-running', true), { wrapper: makeWrapper() });

    await waitFor(() => expect(settled.result.current.isSuccess).toBe(true));
    expect(settled.result.current.data?.timeline).toHaveLength(6);

    await waitFor(() => expect(onRunning.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 4000 });
    expect(onSettled).toHaveBeenCalledTimes(1);

    settled.unmount();
    running.unmount();
  });
});
