// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { MastraReactProvider } from '../../../mastra-react-provider';
import { server } from '../../../test/msw-server';
import { useTraceQueryDiscoveryAvailable } from '../use-trace-query-discovery-available';
import {
  legacyTraceCapabilities,
  traceQueryCapabilities,
  traceQueryWithoutDiscoveryCapabilities,
} from './fixtures/observability-capabilities';

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

describe('useTraceQueryDiscoveryAvailable', () => {
  describe('when capabilities are still loading', () => {
    it('is loading and not enabled', () => {
      server.use(http.get(CAPABILITIES_URL, () => new Promise(() => {})));

      const { result } = renderHook(() => useTraceQueryDiscoveryAvailable(), { wrapper: makeWrapper() });

      expect(result.current).toEqual({ isLoading: true, enabled: false });
    });
  });

  describe('when the server supports trace query and discovery', () => {
    it('is enabled', async () => {
      server.use(http.get(CAPABILITIES_URL, () => HttpResponse.json(traceQueryCapabilities)));

      const { result } = renderHook(() => useTraceQueryDiscoveryAvailable(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current).toEqual({ isLoading: false, enabled: true }));
    });
  });

  describe('when the server supports trace query but not discovery', () => {
    it('is not enabled', async () => {
      server.use(http.get(CAPABILITIES_URL, () => HttpResponse.json(traceQueryWithoutDiscoveryCapabilities)));

      const { result } = renderHook(() => useTraceQueryDiscoveryAvailable(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current).toEqual({ isLoading: false, enabled: false }));
    });
  });

  describe('when the server reports discovery without trace query', () => {
    it('is enabled, leaving the trace query gate to the caller', async () => {
      server.use(
        http.get(CAPABILITIES_URL, () =>
          HttpResponse.json({
            ...legacyTraceCapabilities,
            capabilities: { ...legacyTraceCapabilities.capabilities, traceQueryDiscovery: true },
          }),
        ),
      );

      const { result } = renderHook(() => useTraceQueryDiscoveryAvailable(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current).toEqual({ isLoading: false, enabled: true }));
    });
  });

  describe('when the server supports neither', () => {
    it('is not enabled', async () => {
      server.use(http.get(CAPABILITIES_URL, () => HttpResponse.json(legacyTraceCapabilities)));

      const { result } = renderHook(() => useTraceQueryDiscoveryAvailable(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current).toEqual({ isLoading: false, enabled: false }));
    });
  });

  describe('when the capabilities endpoint is missing', () => {
    it('falls back to enabled, like trace query', async () => {
      server.use(http.get(CAPABILITIES_URL, () => HttpResponse.json({ error: 'Not found' }, { status: 404 })));

      const { result } = renderHook(() => useTraceQueryDiscoveryAvailable(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current).toEqual({ isLoading: false, enabled: true }));
    });
  });
});
