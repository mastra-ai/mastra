// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTracesListSource } from '../use-traces-list-source';
import { lastTraceQueryPage } from './fixtures/trace-query';
import { lastLegacyTracePage } from './fixtures/trace-query-legacy';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const OBSERVABILITY_URL = `${BASE_URL}/api/observability`;
const query = (now: Date) => ({ timeRange: { from: '2026-09-01T00:00:00Z', to: now.toISOString() } });

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {children}
      </QueryClientProvider>
    </MastraReactProvider>
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  focusManager.setFocused(undefined);
});

function handlers() {
  const post = vi.fn();
  const list = vi.fn();
  server.use(
    http.post(`${OBSERVABILITY_URL}/traces/query`, async ({ request }) => {
      post(await request.json());
      return HttpResponse.json(lastTraceQueryPage);
    }),
    http.get(`${OBSERVABILITY_URL}/traces/light`, () => {
      list();
      return HttpResponse.json(lastLegacyTracePage);
    }),
  );
  return { post, list };
}

describe('useTracesListSource', () => {
  describe('when the server supports trace query', () => {
    it('loads query rows without requesting the legacy list', async () => {
      const requests = handlers();
      const { result } = renderHook(() => useTracesListSource({ query }), { wrapper });
      await waitFor(() => expect(result.current.rows[0]?.spanId).toBe('span-b'));
      expect(requests.post).toHaveBeenCalledTimes(1);
      expect(requests.list).not.toHaveBeenCalled();
    });
  });

  describe('when the caller opts out of trace query', () => {
    it('loads rows from the legacy list without requesting trace query', async () => {
      const requests = handlers();
      const { result } = renderHook(() => useTracesListSource({ query, withQueryTrace: false }), { wrapper });
      await waitFor(() => expect(result.current.rows).toHaveLength(lastLegacyTracePage.spans.length));
      expect(requests.list).toHaveBeenCalled();
      expect(requests.post).not.toHaveBeenCalled();
    });
  });

  describe('when the list is disabled', () => {
    it('does not request any endpoint', async () => {
      const requests = handlers();
      renderHook(() => useTracesListSource({ query, enabled: false }), { wrapper });
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(requests.post).not.toHaveBeenCalled();
      expect(requests.list).not.toHaveBeenCalled();
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
      const [[firstBody], [secondBody]] = requests.post.mock.calls;
      expect(secondBody.timeRange.to).not.toBe(firstBody.timeRange.to);
      act(() => result.current.setAutoRefetch(false));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });
      expect(requests.post).toHaveBeenCalledTimes(2);
      expect(requests.list).not.toHaveBeenCalled();
      await act(async () => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      expect(requests.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('when automatic refresh starts disabled', () => {
    it.each([true, false])('does not poll or refetch on focus with rolling=%s', async rolling => {
      const requests = handlers();
      const { result } = renderHook(() => useTracesListSource({ query, rolling, initialAutoRefetch: false }), {
        wrapper,
      });
      await waitFor(() => expect(result.current.rows).toHaveLength(1));
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
        focusManager.setFocused(false);
        focusManager.setFocused(true);
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      expect(requests.post).toHaveBeenCalledTimes(1);
      await act(async () => {
        await result.current.refetch();
      });
      expect(requests.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('when the store returns 501', () => {
    it('exposes the query error without requesting a legacy endpoint', async () => {
      const requests = handlers();
      const post = vi.fn();
      server.use(
        http.post(`${OBSERVABILITY_URL}/traces/query`, () => {
          post();
          return HttpResponse.json({ code: 'TRACE_QUERY_UNSUPPORTED', error: 'Unsupported' }, { status: 501 });
        }),
      );
      const { result } = renderHook(() => useTracesListSource({ query }), { wrapper });
      await waitFor(() => expect(result.current.error).toBeTruthy());
      expect(result.current.rows).toHaveLength(0);
      expect(post).toHaveBeenCalledTimes(1);
      expect(requests.list).not.toHaveBeenCalled();
    });
  });
});
