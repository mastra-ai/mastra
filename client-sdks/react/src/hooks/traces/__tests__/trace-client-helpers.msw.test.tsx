// @vitest-environment jsdom
import '../../../test/jsdom-polyfills';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { MastraReactProvider } from '../../../mastra-react-provider';
import { server } from '../../../test/msw-server';
import { useTraceColumnPreferencesStorageKey } from '../use-trace-column-preferences-storage-key';
import { useFetchTraceSpans } from '../use-trace-spans';
import { suspendedTrace } from './fixtures/trace-spans';

const BASE_URL = 'http://localhost:4111';

function makeWrapper(queryClient: QueryClient, apiPrefix?: string) {
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL} apiPrefix={apiPrefix}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

const newQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('useFetchTraceSpans', () => {
  describe('when a trace is fetched', () => {
    it('resolves the full trace and stores it in the shared trace-spans cache', async () => {
      server.use(http.get(`${BASE_URL}/api/observability/traces/:traceId`, () => HttpResponse.json(suspendedTrace)));
      const queryClient = newQueryClient();
      const { result } = renderHook(() => useFetchTraceSpans(), { wrapper: makeWrapper(queryClient) });

      const trace = await result.current(suspendedTrace.traceId);

      expect({ trace, cached: queryClient.getQueryData(['trace-spans', suspendedTrace.traceId]) }).toEqual({
        trace: suspendedTrace,
        cached: suspendedTrace,
      });
    });
  });
});

describe('useTraceColumnPreferencesStorageKey', () => {
  describe('when the client uses a custom api prefix', () => {
    it('scopes the key to the server url and prefix', () => {
      const { result } = renderHook(() => useTraceColumnPreferencesStorageKey(), {
        wrapper: makeWrapper(newQueryClient(), '/custom'),
      });

      expect(result.current).toBe(`mastra:traces:columns:${BASE_URL}:/custom`);
    });
  });
});
