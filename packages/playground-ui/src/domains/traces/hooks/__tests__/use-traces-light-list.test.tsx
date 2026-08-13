// @vitest-environment jsdom

import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../../test/msw-server';
import { useTraces } from '../use-traces';
import {
  fullDeltaBatch,
  fullTracesPage0,
  legacyLightEmptyPage0,
  legacyLightPage0,
  lightDeltaBatch,
  lightDeltaEmptyBatch,
  lightPage0,
} from './fixtures/traces';

const BASE_URL = 'http://localhost:4111';
const LIGHT_URL = `${BASE_URL}/api/observability/traces/light`;
const FULL_URL = `${BASE_URL}/api/observability/traces`;

const queryClients: QueryClient[] = [];

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClients.push(queryClient);
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

const renderTraces = () => renderHook(() => useTraces({}), { wrapper: makeWrapper() });

/** Page-0 response with no `deltaCursor`, so the delta query never enables. A test that isn't
 *  asserting polling must not leave a poller running into the next test, where it lands on that
 *  test's handlers and inflates its request counts. */
function pageOnly(response: { deltaCursor?: string }) {
  return { ...response, deltaCursor: undefined };
}

/** Serves both page-mode and delta-mode requests for one endpoint, recording each query string. */
function listHandler(url: string, pageResponse: unknown, deltaResponse: unknown, searches: string[]) {
  return http.get(url, ({ request }) => {
    const search = new URL(request.url).search;
    searches.push(search);
    const isDelta = new URL(request.url).searchParams.get('mode') === 'delta';
    return HttpResponse.json(isDelta ? deltaResponse : pageResponse);
  });
}

afterEach(() => {
  cleanup();
  // Unmounting stops the observers but leaves the cached queries armed. A leaked poller
  // lands on the next test's handlers and inflates its request counts.
  queryClients.splice(0).forEach(queryClient => queryClient.clear());
});

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
      listHandler(FULL_URL, pageOnly(fullTracesPage0), fullDeltaBatch, fullSearches),
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

  it('falls back to the full traces endpoint when the light endpoint 200s with legacy-shape rows', async () => {
    const lightRequests = vi.fn<() => void>();
    const fullSearches: string[] = [];
    server.use(
      http.get(LIGHT_URL, () => {
        lightRequests();
        return HttpResponse.json(legacyLightPage0);
      }),
      listHandler(FULL_URL, fullTracesPage0, fullDeltaBatch, fullSearches),
    );

    const { result, unmount } = renderTraces();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(false);
    expect(result.current.data?.spans.map(s => s.traceId)).toEqual(['trace-full']);
    await waitFor(() => expect(fullSearches.some(s => s.includes('mode=delta'))).toBe(true));
    expect(lightRequests).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('does not fall back when the light endpoint 200s with an empty page', async () => {
    const fullRequests = vi.fn<() => void>();
    server.use(
      http.get(LIGHT_URL, () => HttpResponse.json(legacyLightEmptyPage0)),
      http.get(FULL_URL, () => {
        fullRequests();
        return HttpResponse.json(fullTracesPage0);
      }),
    );

    const { result, unmount } = renderTraces();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data?.spans).toEqual([]);
    expect(fullRequests).not.toHaveBeenCalled();
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

  // A 500 also comes from a DB hiccup or a request timeout, not only from an old core's
  // store throwing. Serving that one request from the full endpoint is right; degrading
  // the list for the rest of the session is not.
  it('recovers to the light endpoint after a single 500', async () => {
    let lightFailures = 0;
    server.use(
      http.get(LIGHT_URL, () => {
        if (lightFailures === 0) {
          lightFailures += 1;
          return new HttpResponse(null, { status: 500 });
        }
        return HttpResponse.json(lightPage0);
      }),
      http.get(FULL_URL, () => HttpResponse.json(pageOnly(fullTracesPage0))),
    );

    const { result, unmount } = renderTraces();

    // Light rows once the fault clears — a pinned client would be stuck on `trace-full`.
    await waitFor(() => expect(result.current.data?.spans.map(s => s.traceId)).toEqual(['trace-alpha']));
    expect(result.current.data?.spans[0]?.inputPreview).toBe('What is the weather in Paris?');
    expect(result.current.isError).toBe(false);
    unmount();
  });

  // Only the two legacy-server signals (404/500) may pin a session to full rows.
  // Transient conditions would hit the full endpoint too — they must propagate
  // and leave the client unpinned so light loading resumes once they clear.
  it.each([
    ['auth failure', 401],
    ['rate limiting', 429],
  ])('surfaces %s without falling back or pinning the client', async (_label, status) => {
    const fullRequests = vi.fn<() => void>();
    let lightFailures = 0;
    server.use(
      http.get(LIGHT_URL, () => {
        if (lightFailures === 0) {
          lightFailures += 1;
          return new HttpResponse(null, { status });
        }
        return HttpResponse.json(lightPage0);
      }),
      http.get(FULL_URL, () => {
        fullRequests();
        return HttpResponse.json(fullTracesPage0);
      }),
    );

    const first = renderTraces();
    await waitFor(() => expect(first.result.current.isError).toBe(true));
    expect(first.result.current.error?.message).toContain(`status: ${status}`);
    expect(fullRequests).not.toHaveBeenCalled();
    first.unmount();

    // The condition clears; the same client must still use the light endpoint.
    const second = renderTraces();
    await waitFor(() => expect(second.result.current.isLoading).toBe(false), { timeout: 5000 });
    expect(second.result.current.data?.spans[0]?.inputPreview).toBeDefined();
    expect(fullRequests).not.toHaveBeenCalled();
    second.unmount();
  });
});
