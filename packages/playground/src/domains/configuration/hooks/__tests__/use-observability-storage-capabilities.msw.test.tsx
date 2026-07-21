import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { useObservabilityStorageCapabilities } from '../use-observability-storage-capabilities';
import {
  legacyPostgresWithoutCapabilities,
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

const useSystemPackagesFixture = (fixture: typeof renamedPostgresWithMetrics) => {
  server.use(http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(fixture)));
};

afterEach(() => cleanup());

describe('useObservabilityStorageCapabilities', () => {
  describe('when the server advertises metrics support for a renamed storage class', () => {
    it('reports metrics as available', async () => {
      useSystemPackagesFixture(renamedPostgresWithMetrics);

      const { result } = renderHook(() => useObservabilityStorageCapabilities(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.supportsMetrics).toBe(true));
    });
  });

  describe('when an older server only returns a recognized storage class', () => {
    it('keeps metrics available through the compatibility fallback', async () => {
      useSystemPackagesFixture(legacyPostgresWithoutCapabilities);

      const { result } = renderHook(() => useObservabilityStorageCapabilities(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.supportsMetrics).toBe(true));
    });
  });

  describe('when the server explicitly reports that metrics are unsupported', () => {
    it('does not let the legacy class-name fallback override the capability', async () => {
      useSystemPackagesFixture(storageWithoutMetrics);

      const { result } = renderHook(() => useObservabilityStorageCapabilities(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.supportsMetrics).toBe(false));
    });
  });
});
