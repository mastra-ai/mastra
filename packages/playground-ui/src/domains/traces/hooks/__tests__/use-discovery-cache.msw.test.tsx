// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { DISCOVERY_STALE_TIME } from '../discovery-cache';
import { useEnvironments } from '../use-environments';
import { useServiceNames } from '../use-service-names';
import { useTags } from '../use-tags';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

function newQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

afterEach(() => {
  cleanup();
});

describe('discovery hooks', () => {
  it('serves discovery results from cache when the filters remount', async () => {
    let tagRequests = 0;
    server.use(
      http.get(`${BASE_URL}/api/observability/discovery/tags`, () => {
        tagRequests++;
        return HttpResponse.json({ tags: ['agent', 'workflow'] });
      }),
    );

    const queryClient = newQueryClient();
    const wrapper = makeWrapper(queryClient);

    const first = renderHook(() => useTags(), { wrapper });
    await waitFor(() => expect(first.result.current.data).toEqual(['agent', 'workflow']));
    expect(tagRequests).toBe(1);

    // Navigating away from Traces and back must not re-trigger the discovery
    // scan on the store — that repeat mount is the main source of the
    // duplicate full-history queries this staleTime exists to prevent.
    first.unmount();
    const second = renderHook(() => useTags(), { wrapper });
    await waitFor(() => expect(second.result.current.data).toEqual(['agent', 'workflow']));

    expect(tagRequests).toBe(1);
  });

  it('refetches once the cached discovery values age past the stale window', async () => {
    let serviceRequests = 0;
    server.use(
      http.get(`${BASE_URL}/api/observability/discovery/service-names`, () => {
        serviceRequests++;
        return HttpResponse.json({ serviceNames: serviceRequests === 1 ? ['api'] : ['api', 'worker'] });
      }),
    );

    const queryClient = newQueryClient();
    const wrapper = makeWrapper(queryClient);

    const first = renderHook(() => useServiceNames(), { wrapper });
    await waitFor(() => expect(first.result.current.data).toEqual(['api']));
    first.unmount();

    // Age the cached entry past the stale window instead of advancing timers,
    // so this asserts the staleTime bound itself rather than a timer mock.
    const entry = queryClient.getQueryCache().find({ queryKey: ['observability-service-names'] });
    if (!entry) throw new Error('expected a cached service-names entry');
    entry.state.dataUpdatedAt = Date.now() - DISCOVERY_STALE_TIME - 1_000;

    const second = renderHook(() => useServiceNames(), { wrapper });

    await waitFor(() => expect(second.result.current.data).toEqual(['api', 'worker']));
    expect(serviceRequests).toBe(2);
  });

  it('applies the same freshness window to every discovery filter', async () => {
    let environmentRequests = 0;
    server.use(
      http.get(`${BASE_URL}/api/observability/discovery/environments`, () => {
        environmentRequests++;
        return HttpResponse.json({ environments: ['production'] });
      }),
    );

    const queryClient = newQueryClient();
    const wrapper = makeWrapper(queryClient);

    const first = renderHook(() => useEnvironments(), { wrapper });
    await waitFor(() => expect(first.result.current.data).toEqual(['production']));

    first.unmount();
    const second = renderHook(() => useEnvironments(), { wrapper });
    await waitFor(() => expect(second.result.current.data).toEqual(['production']));

    expect(environmentRequests).toBe(1);
  });
});
