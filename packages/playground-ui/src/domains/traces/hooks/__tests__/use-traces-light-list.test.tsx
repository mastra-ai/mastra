// @vitest-environment jsdom

import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTraces } from '../use-traces';
import { fullDeltaBatch, fullTracesPage0, lightDeltaBatch, lightDeltaEmptyBatch, lightPage0 } from './fixtures/traces';

const BASE_URL = 'http://localhost:4111';
const LIGHT_URL = `${BASE_URL}/api/observability/traces/light`;
const FULL_URL = `${BASE_URL}/api/observability/traces`;

const server = setupServer();

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

const renderTraces = () => renderHook(() => useTraces({}), { wrapper: makeWrapper() });

/** Serves both page-mode and delta-mode requests for one endpoint, recording each query string. */
function listHandler(url: string, pageResponse: unknown, deltaResponse: unknown, searches: string[]) {
  return http.get(url, ({ request }) => {
    const search = new URL(request.url).search;
    searches.push(search);
    const isDelta = new URL(request.url).searchParams.get('mode') === 'delta';
    return HttpResponse.json(isDelta ? deltaResponse : pageResponse);
  });
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('useTraces light-list fetching', () => {
  it('loads the traces list from the light endpoint and surfaces inputPreview rows', async () => {
    const lightSearches: string[] = [];
    server.use(listHandler(LIGHT_URL, lightPage0, lightDeltaEmptyBatch, lightSearches));

    const { result, unmount } = renderTraces();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data?.spans.map(s => s.traceId)).toEqual(['trace-alpha']);
    expect(result.current.data?.spans[0]?.inputPreview).toBe('What is the weather in Paris?');
    expect(lightSearches[0]).toContain('page=0');
    expect(lightSearches[0]).toContain('perPage=25');
    unmount();
  });

  it('polls the light endpoint in delta mode using the page-0 cursor and merges new rows', async () => {
    const lightSearches: string[] = [];
    server.use(listHandler(LIGHT_URL, lightPage0, lightDeltaBatch, lightSearches));

    const { result, unmount } = renderTraces();
    await waitFor(() => expect(lightSearches.some(s => s.includes('mode=delta'))).toBe(true));

    const deltaSearch = lightSearches.find(s => s.includes('mode=delta'));
    expect(deltaSearch).toContain('after=cursor-1');
    await waitFor(() => expect(result.current.data?.spans.map(s => s.traceId)).toEqual(['trace-bravo', 'trace-alpha']));
    unmount();
  });

  it('falls back to the full traces endpoint when the light endpoint returns 500', async () => {
    const fullSearches: string[] = [];
    server.use(
      http.get(LIGHT_URL, () => new HttpResponse(null, { status: 500 })),
      listHandler(FULL_URL, fullTracesPage0, fullDeltaBatch, fullSearches),
    );

    const { result, unmount } = renderTraces();
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 });

    expect(result.current.isError).toBe(false);
    expect(result.current.data?.spans.map(s => s.traceId)).toEqual(['trace-full']);
    unmount();
  });

  it('falls back to the full traces endpoint when the light endpoint returns 404', async () => {
    const fullSearches: string[] = [];
    server.use(
      http.get(LIGHT_URL, () => new HttpResponse(null, { status: 404 })),
      listHandler(FULL_URL, fullTracesPage0, fullDeltaBatch, fullSearches),
    );

    const { result, unmount } = renderTraces();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(false);
    expect(result.current.data?.spans.map(s => s.traceId)).toEqual(['trace-full']);
    unmount();
  });

  it('keeps delta polling on the full endpoint after falling back', async () => {
    const lightRequests = vi.fn<() => void>();
    const fullSearches: string[] = [];
    server.use(
      http.get(LIGHT_URL, () => {
        lightRequests();
        return new HttpResponse(null, { status: 404 });
      }),
      listHandler(FULL_URL, fullTracesPage0, fullDeltaBatch, fullSearches),
    );

    const { result, unmount } = renderTraces();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(fullSearches.some(s => s.includes('mode=delta'))).toBe(true));

    const deltaSearch = fullSearches.find(s => s.includes('mode=delta'));
    expect(deltaSearch).toContain('after=cursor-full-1');
    expect(lightRequests).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('surfaces a permission error without falling back when the light endpoint returns 403', async () => {
    const fullRequests = vi.fn<() => void>();
    server.use(
      http.get(LIGHT_URL, () => new HttpResponse(null, { status: 403 })),
      http.get(FULL_URL, () => {
        fullRequests();
        return HttpResponse.json(fullTracesPage0);
      }),
    );

    const { result, unmount } = renderTraces();
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toContain('status: 403');
    expect(result.current.data).toBeUndefined();
    expect(fullRequests).not.toHaveBeenCalled();
    unmount();
  });
});
