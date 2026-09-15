import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTracesListSource } from '../hooks/use-traces-list-source';
import { traceQueryPage } from './fixtures/trace-query';
import { branchList, traceList } from './fixtures/traces';
import { server } from '@/test/msw-server';

const BASE = 'http://localhost:4111/api/observability';
const query = (now: Date) => ({ timeRange: { from: '2026-09-01T00:00:00Z', to: now.toISOString() } });
function wrapper({ children }: { children: ReactNode }) {
  return (
    <MastraReactProvider baseUrl="http://localhost:4111">
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {children}
      </QueryClientProvider>
    </MastraReactProvider>
  );
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
function handlers() {
  const post = vi.fn();
  const list = vi.fn();
  const branches = vi.fn();
  server.use(
    http.post(`${BASE}/traces/query`, async ({ request }) => {
      post(await request.json());
      return HttpResponse.json(traceQueryPage);
    }),
    http.get(`${BASE}/traces/light`, () => {
      list();
      return HttpResponse.json(traceList);
    }),
    http.get(`${BASE}/traces`, () => {
      list();
      return HttpResponse.json(traceList);
    }),
    http.get(`${BASE}/branches`, () => {
      branches();
      return HttpResponse.json(branchList);
    }),
  );
  return { post, list, branches };
}

describe('useTracesListSource', () => {
  describe('when filters are supported', () => {
    it('loads query rows without requesting the legacy list', async () => {
      const requests = handlers();
      const { result } = renderHook(() => useTracesListSource({ query }), { wrapper });
      await waitFor(() => expect(result.current.rows[0]?.spanId).toBe('span-a'));
      expect(result.current.source).toBe('query');
      expect(requests.post).toHaveBeenCalledTimes(1);
      expect(requests.list).not.toHaveBeenCalled();
    });
  });
  describe('when filters require the legacy list', () => {
    it('loads the list without querying traces', async () => {
      const requests = handlers();
      const filters = { status: 'running' as const };
      const { result } = renderHook(() => useTracesListSource({ query: () => null, filters }), { wrapper });
      await waitFor(() => expect(result.current.rows).toHaveLength(1));
      expect(result.current.source).toBe('list');
      expect(requests.post).not.toHaveBeenCalled();
    });
  });
  describe('when branches mode is selected', () => {
    it('loads branches without querying traces', async () => {
      const requests = handlers();
      const { result } = renderHook(() => useTracesListSource({ query, listMode: 'branches' }), { wrapper });
      await waitFor(() => expect(result.current.rows).toHaveLength(1));
      expect(requests.branches).toHaveBeenCalled();
      expect(requests.post).not.toHaveBeenCalled();
    });
  });
  describe('when auto refresh is enabled', () => {
    it('advances the time window and stops requests when paused', async () => {
      const requests = handlers();
      const { result } = renderHook(() => useTracesListSource({ query }), { wrapper });
      await waitFor(() => expect(result.current.rows).toHaveLength(1));
      act(() => result.current.setAutoRefetch(false));
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
      act(() => result.current.setAutoRefetch(true));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(requests.post).toHaveBeenCalledTimes(2);
      expect(requests.post.mock.calls[1]![0].timeRange.to).not.toBe(requests.post.mock.calls[0]![0].timeRange.to);
      act(() => result.current.setAutoRefetch(false));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });
      expect(requests.post).toHaveBeenCalledTimes(2);
      expect(requests.list).not.toHaveBeenCalled();
    });
  });
  describe('when the store returns 501', () => {
    it('falls back once and keeps using the list after remounting', async () => {
      handlers();
      const post = vi.fn();
      server.use(
        http.post(`${BASE}/traces/query`, () => {
          post();
          return HttpResponse.json({ code: 'TRACE_QUERY_UNSUPPORTED', error: 'Unsupported' }, { status: 501 });
        }),
      );
      const first = renderHook(() => useTracesListSource({ query }), { wrapper });
      await waitFor(() => expect(first.result.current.source).toBe('list'));
      await waitFor(() => expect(first.result.current.rows).toHaveLength(1));
      expect(post).toHaveBeenCalledTimes(1);
      first.unmount();
      const second = renderHook(() => useTracesListSource({ query }), { wrapper });
      await waitFor(() => expect(second.result.current.rows).toHaveLength(1));
      expect(post).toHaveBeenCalledTimes(1);
    });
  });
});
