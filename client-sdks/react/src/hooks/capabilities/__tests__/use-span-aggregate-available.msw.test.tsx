// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { MastraReactProvider } from '../../../mastra-react-provider';
import { server } from '../../../test/msw-server';
import { useSpanAggregateAvailable } from '../use-span-aggregate-available';
import {
  noSpanAggregateCapabilities,
  preSpanAggregateCapabilities,
  traceQueryCapabilities,
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

describe('useSpanAggregateAvailable', () => {
  describe('when capabilities are still loading', () => {
    it('is loading and not enabled', () => {
      server.use(http.get(CAPABILITIES_URL, () => new Promise(() => {})));

      const { result } = renderHook(() => useSpanAggregateAvailable(), { wrapper: makeWrapper() });

      expect(result.current).toEqual({ isLoading: true, enabled: false });
    });
  });

  describe('when the server supports span aggregation', () => {
    it('is enabled', async () => {
      server.use(http.get(CAPABILITIES_URL, () => HttpResponse.json(traceQueryCapabilities)));

      const { result } = renderHook(() => useSpanAggregateAvailable(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current).toEqual({ isLoading: false, enabled: true }));
    });
  });

  describe('when the server reports span aggregation as unsupported', () => {
    it('is not enabled', async () => {
      server.use(http.get(CAPABILITIES_URL, () => HttpResponse.json(noSpanAggregateCapabilities)));

      const { result } = renderHook(() => useSpanAggregateAvailable(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current).toEqual({ isLoading: false, enabled: false }));
    });
  });

  describe('when the server predates the spanAggregate capability', () => {
    it('is not enabled', async () => {
      server.use(http.get(CAPABILITIES_URL, () => HttpResponse.json(preSpanAggregateCapabilities)));

      const { result } = renderHook(() => useSpanAggregateAvailable(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current).toEqual({ isLoading: false, enabled: false }));
    });
  });

  describe('when the capabilities endpoint is missing', () => {
    it('is not enabled', async () => {
      server.use(http.get(CAPABILITIES_URL, () => HttpResponse.json({ error: 'Not found' }, { status: 404 })));

      const { result } = renderHook(() => useSpanAggregateAvailable(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current).toEqual({ isLoading: false, enabled: false }));
    });
  });
});
