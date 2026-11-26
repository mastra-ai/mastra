// @vitest-environment jsdom
import '../../../test/jsdom-polyfills';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MastraReactProvider } from '../../../mastra-react-provider';
import { server } from '../../../test/msw-server';
import { useTraceTrajectory } from '../use-trace-trajectory';
import { weatherTrajectory } from './fixtures/trace-trajectory';

const BASE_URL = 'http://localhost:4111';

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

const newQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('useTraceTrajectory', () => {
  describe('when a trace id is given', () => {
    it('resolves the trace trajectory', async () => {
      server.use(
        http.get(`${BASE_URL}/api/observability/traces/trace-1/trajectory`, () => HttpResponse.json(weatherTrajectory)),
      );

      const { result } = renderHook(() => useTraceTrajectory({ traceId: 'trace-1' }), {
        wrapper: makeWrapper(newQueryClient()),
      });

      await waitFor(() => expect(result.current.data).toEqual(weatherTrajectory));
    });
  });

  describe('when the trace id is missing', () => {
    it('fails without requesting anything', async () => {
      const onTrajectory = vi.fn<() => void>();
      server.use(
        http.get(`${BASE_URL}/api/observability/traces/:traceId/trajectory`, () => {
          onTrajectory();
          return HttpResponse.json(weatherTrajectory);
        }),
      );

      const { result } = renderHook(() => useTraceTrajectory({ traceId: undefined }), {
        wrapper: makeWrapper(newQueryClient()),
      });

      await waitFor(() => expect(result.current.error?.message).toBe('Trace ID is required'));
      expect(onTrajectory).not.toHaveBeenCalled();
    });
  });

  describe('when the query is disabled', () => {
    it('does not request the trajectory', async () => {
      const onTrajectory = vi.fn<() => void>();
      server.use(
        http.get(`${BASE_URL}/api/observability/traces/:traceId/trajectory`, () => {
          onTrajectory();
          return HttpResponse.json(weatherTrajectory);
        }),
      );

      renderHook(() => useTraceTrajectory({ traceId: 'trace-1', queryOptions: { enabled: false } }), {
        wrapper: makeWrapper(newQueryClient()),
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(onTrajectory).not.toHaveBeenCalled();
    });
  });
});
