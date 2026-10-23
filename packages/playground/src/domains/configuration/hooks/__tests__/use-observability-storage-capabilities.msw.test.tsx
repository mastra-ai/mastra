import type { GetObservabilityCapabilitiesResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { useObservabilityStorageCapabilities } from '../use-observability-storage-capabilities';
import {
  inMemoryStorage,
  renamedPostgresWithMetrics,
  storageWithoutMetrics,
} from './fixtures/observability-storage-capabilities';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

const useCapabilitiesFixture = (fixture: GetObservabilityCapabilitiesResponse) => {
  server.use(http.get(`${BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(fixture)));
};

afterEach(() => {
  cleanup();
  delete (window as Partial<Window>).MASTRA_CLOUD_API_ENDPOINT;
});

describe('useObservabilityStorageCapabilities', () => {
  describe('when the server advertises metrics support for a renamed storage class', () => {
    it('reports metrics as available', async () => {
      useCapabilitiesFixture(renamedPostgresWithMetrics);

      const { result } = renderHook(() => useObservabilityStorageCapabilities(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.supportsMetrics).toBe(true));
    });
  });

  describe('when the server explicitly reports that metrics are unsupported', () => {
    it('does not let the legacy class-name fallback override the capability', async () => {
      useCapabilitiesFixture(storageWithoutMetrics);

      const { result } = renderHook(() => useObservabilityStorageCapabilities(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.supportsMetrics).toBe(false);
    });
  });

  describe('when the observability storage is in-memory', () => {
    it('reports the in-memory storage', async () => {
      useCapabilitiesFixture(inMemoryStorage);

      const { result } = renderHook(() => useObservabilityStorageCapabilities(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isInMemory).toBe(true));
    });
  });

  describe('when an older server does not expose the capabilities endpoint', () => {
    it('reports metrics as unavailable', async () => {
      server.use(http.get(`${BASE_URL}/api/observability/capabilities`, () => new HttpResponse(null, { status: 404 })));

      const { result } = renderHook(() => useObservabilityStorageCapabilities(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.supportsMetrics).toBe(false);
    });
  });

  describe('when running on the Mastra platform', () => {
    // Observability reads are proxied by the edge router to the hosted
    // ClickHouse query service, so metrics are supported regardless of the
    // project's own storage.
    it('reports metrics as available even when storage does not support them', () => {
      window.MASTRA_CLOUD_API_ENDPOINT = 'https://api.mastra.cloud';
      useCapabilitiesFixture(storageWithoutMetrics);

      const { result } = renderHook(() => useObservabilityStorageCapabilities(), { wrapper: makeWrapper() });

      expect(result.current.supportsMetrics).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    it('does not surface the in-memory warning', async () => {
      window.MASTRA_CLOUD_API_ENDPOINT = 'https://api.mastra.cloud';
      useCapabilitiesFixture(inMemoryStorage);

      const { result } = renderHook(() => useObservabilityStorageCapabilities(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isInMemory).toBe(false));
      expect(result.current.supportsMetrics).toBe(true);
    });
  });
});
