// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { useTraces } from '../use-traces';
import { makeDeltaTracesResponse, makeListTracesResponse, makeTraceRow } from './fixtures/use-traces';

const BASE_URL = 'http://localhost:4111';
const server = setupServer();
const queryClients = new Set<QueryClient>();

const makeWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { gcTime: 0 },
    },
  });
  queryClients.add(queryClient);
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  for (const queryClient of queryClients) {
    queryClient.clear();
  }
  queryClients.clear();
  server.resetHandlers();
});

afterAll(() => server.close());

describe('useTraces', () => {
  describe('when total time sorting is requested', () => {
    it('requests duration-ordered page results from the server', async () => {
      const onTracesRequest = vi.fn<(url: URL) => void>();
      const durationOrderBy = { field: 'durationMs', direction: 'DESC' } as const;

      server.use(
        http.get(`${BASE_URL}/api/observability/traces`, ({ request }) => {
          const url = new URL(request.url);
          onTracesRequest(url);

          return HttpResponse.json(
            makeListTracesResponse({
              spans: [
                makeTraceRow({
                  traceId: 'trace-long',
                  spanId: 'span-long',
                  name: 'Long trace',
                  startedAt: new Date('2026-06-20T10:00:00.000Z'),
                  endedAt: new Date('2026-06-20T10:01:00.000Z'),
                }),
                makeTraceRow({
                  traceId: 'trace-short',
                  spanId: 'span-short',
                  name: 'Short trace',
                  startedAt: new Date('2026-06-20T11:00:00.000Z'),
                  endedAt: new Date('2026-06-20T11:00:05.000Z'),
                }),
              ],
            }),
          );
        }),
      );

      const { result } = renderHook(
        () =>
          useTraces({
            orderBy: durationOrderBy,
            polling: { pageModeRefetchIntervalMs: 60_000 },
          }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => {
        expect(result.current.data?.spans.map(span => span.traceId)).toEqual(['trace-long', 'trace-short']);
      });

      expect(onTracesRequest).toHaveBeenCalled();
      const url = onTracesRequest.mock.calls[0]![0];
      expect(url.searchParams.get('field')).toBe('durationMs');
      expect(url.searchParams.get('direction')).toBe('DESC');
      expect(url.searchParams.get('page')).toBe('0');
      expect(url.searchParams.get('perPage')).toBe('25');
    });
  });

  describe('when the default startedAt sort is active and delta polling is available', () => {
    it('merges delta rows back into startedAt descending order', async () => {
      const onDeltaRequest = vi.fn<(url: URL) => void>();

      server.use(
        http.get(`${BASE_URL}/api/observability/traces`, ({ request }) => {
          const url = new URL(request.url);

          if (url.searchParams.get('mode') === 'delta') {
            onDeltaRequest(url);

            return HttpResponse.json(
              makeDeltaTracesResponse({
                deltaCursor: 'cursor-2',
                spans: [
                  makeTraceRow({
                    traceId: 'trace-older-delta',
                    spanId: 'span-older-delta',
                    name: 'Older delta row',
                    startedAt: new Date('2026-06-20T11:00:00.000Z'),
                  }),
                  makeTraceRow({
                    traceId: 'trace-newest-delta',
                    spanId: 'span-newest-delta',
                    name: 'Newest delta row',
                    startedAt: new Date('2026-06-20T13:00:00.000Z'),
                  }),
                ],
              }),
            );
          }

          return HttpResponse.json(
            makeListTracesResponse({
              deltaCursor: 'cursor-1',
              spans: [
                makeTraceRow({
                  traceId: 'trace-existing',
                  spanId: 'span-existing',
                  name: 'Existing row',
                  startedAt: new Date('2026-06-20T12:00:00.000Z'),
                }),
              ],
            }),
          );
        }),
      );

      const { result } = renderHook(
        () =>
          useTraces({
            polling: {
              deltaPollIntervalMs: 60_000,
              deltaChaseIntervalMs: 60_000,
              page0StatusRefreshIntervalMs: 60_000,
            },
          }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => {
        expect(onDeltaRequest).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(result.current.data?.spans.map(span => span.traceId)).toEqual([
          'trace-newest-delta',
          'trace-existing',
          'trace-older-delta',
        ]);
      });

      const deltaUrl = onDeltaRequest.mock.calls[0]![0];
      expect(deltaUrl.searchParams.get('mode')).toBe('delta');
      expect(deltaUrl.searchParams.get('after')).toBe('cursor-1');
      expect(deltaUrl.searchParams.get('limit')).toBe('100');
    });
  });
});
