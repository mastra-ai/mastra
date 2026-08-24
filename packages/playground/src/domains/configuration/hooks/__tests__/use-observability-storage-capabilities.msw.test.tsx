import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { useObservabilityStorageCapabilities } from '../use-observability-storage-capabilities';
import {
  LEGACY_ANALYTICS_STORAGE_TYPES,
  inMemoryStorage,
  legacyPostgresWithoutCapabilities,
  legacyStorageWithoutCapabilities,
  noStorageTypeReported,
  renamedPostgresWithMetrics,
  storageWithoutMetrics,
  unknownStorageWithoutCapabilities,
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

  describe.each(LEGACY_ANALYTICS_STORAGE_TYPES)('when an older server reports %s', storageType => {
    it('keeps metrics available through the compatibility fallback', async () => {
      useSystemPackagesFixture(legacyStorageWithoutCapabilities(storageType));

      const { result } = renderHook(() => useObservabilityStorageCapabilities(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.supportsMetrics).toBe(true));
    });
  });

  describe('when an older server reports a storage class the fallback does not know', () => {
    it('reports metrics as unavailable', async () => {
      useSystemPackagesFixture(unknownStorageWithoutCapabilities);

      const { result } = renderHook(() => useObservabilityStorageCapabilities(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.supportsMetrics).toBe(false);
    });
  });

  describe('when the server reports no observability storage at all', () => {
    it('reports metrics as unavailable', async () => {
      useSystemPackagesFixture(noStorageTypeReported);

      const { result } = renderHook(() => useObservabilityStorageCapabilities(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.supportsMetrics).toBe(false);
    });

    it('does not claim the storage is in-memory', async () => {
      useSystemPackagesFixture(noStorageTypeReported);

      const { result } = renderHook(() => useObservabilityStorageCapabilities(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.isInMemory).toBe(false);
    });
  });

  describe('when the storage is the in-memory implementation', () => {
    it('flags it as in-memory so callers can warn about volatile data', async () => {
      useSystemPackagesFixture(inMemoryStorage);

      const { result } = renderHook(() => useObservabilityStorageCapabilities(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isInMemory).toBe(true));
    });
  });

  describe('when the storage is a durable backend', () => {
    it('does not flag it as in-memory', async () => {
      useSystemPackagesFixture(legacyPostgresWithoutCapabilities);

      const { result } = renderHook(() => useObservabilityStorageCapabilities(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.isInMemory).toBe(false);
    });
  });
});
