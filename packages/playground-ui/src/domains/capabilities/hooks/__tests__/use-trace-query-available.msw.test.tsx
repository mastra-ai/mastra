// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useTraceQueryAvailable } from '../use-trace-query-available';
import { legacyTraceCapabilities, traceQueryCapabilities } from './fixtures/observability-capabilities';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const CAPABILITIES_URL = `${BASE_URL}/api/observability/capabilities`;

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

afterEach(() => {
  cleanup();
});

describe('useTraceQueryAvailable', () => {
  describe('while capabilities are loading', () => {
    it('is loading and not enabled', () => {
      server.use(http.get(CAPABILITIES_URL, () => new Promise(() => {})));

      const { result } = renderHook(() => useTraceQueryAvailable(), { wrapper: makeWrapper() });

      expect(result.current).toEqual({ isLoading: true, enabled: false });
    });
  });

  describe('when the server supports trace query', () => {
    it('is enabled', async () => {
      server.use(http.get(CAPABILITIES_URL, () => HttpResponse.json(traceQueryCapabilities)));

      const { result } = renderHook(() => useTraceQueryAvailable(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current).toEqual({ isLoading: false, enabled: true }));
    });
  });

  describe('when the server does not support trace query', () => {
    it('is not enabled', async () => {
      server.use(http.get(CAPABILITIES_URL, () => HttpResponse.json(legacyTraceCapabilities)));

      const { result } = renderHook(() => useTraceQueryAvailable(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.enabled).toBe(false);
    });
  });

  describe('when the capabilities endpoint is missing', () => {
    it('falls back to enabled', async () => {
      server.use(http.get(CAPABILITIES_URL, () => HttpResponse.json({ error: 'Not found' }, { status: 404 })));

      const { result } = renderHook(() => useTraceQueryAvailable(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current).toEqual({ isLoading: false, enabled: true }));
    });
  });
});
