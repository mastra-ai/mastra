// @vitest-environment jsdom
import type { GetTraceQueryFieldsArgs, GetTraceQueryValuesArgs } from '@mastra/client-js';
import { MastraClient } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useTraceQueryFields } from '../use-trace-query-fields';
import { createTraceQueryValuesResolver, useTraceQueryValues } from '../use-trace-query-values';
import { traceQueryFieldsFixture, traceQueryValuesFixture } from './fixtures/trace-query-discovery';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const FIELDS_URL = `${BASE_URL}/api/observability/traces/query/fields`;
const VALUES_URL = `${BASE_URL}/api/observability/traces/query/values`;

const timeRange = { from: '2026-09-01T00:00:00.000Z', to: '2026-09-18T00:00:00.000Z' };

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

describe('useTraceQueryFields', () => {
  describe('when the server reports observed metadata fields', () => {
    it('fetches the fields once on mount and serves the remount from cache', async () => {
      const bodies: GetTraceQueryFieldsArgs[] = [];
      server.use(
        http.post(FIELDS_URL, async ({ request }) => {
          bodies.push((await request.json()) as GetTraceQueryFieldsArgs);
          return HttpResponse.json(traceQueryFieldsFixture);
        }),
      );

      const queryClient = newQueryClient();
      const wrapper = makeWrapper(queryClient);

      const first = renderHook(() => useTraceQueryFields({ timeRange }), { wrapper });
      await waitFor(() => expect(first.result.current.metadataFields).toHaveLength(2));
      expect(first.result.current.metadataFields.map(field => field.path)).toEqual([
        'metadata.region',
        'metadata.tenant',
      ]);
      expect(bodies).toEqual([{ timeRange, predicateScope: 'trace', limit: 100 }]);

      first.unmount();
      const second = renderHook(() => useTraceQueryFields({ timeRange }), { wrapper });
      await waitFor(() => expect(second.result.current.metadataFields).toHaveLength(2));
      expect(bodies).toHaveLength(1);
    });
  });

  describe('when the time range changes after the first load', () => {
    it('keeps the previous fields instead of dropping back to loading', async () => {
      server.use(http.post(FIELDS_URL, () => HttpResponse.json(traceQueryFieldsFixture)));

      const { result, rerender } = renderHook(({ range }) => useTraceQueryFields({ timeRange: range }), {
        wrapper: makeWrapper(newQueryClient()),
        initialProps: { range: timeRange },
      });
      await waitFor(() => expect(result.current.metadataFields).toHaveLength(2));

      rerender({ range: { from: '2026-09-17T00:00:00.000Z', to: timeRange.to } });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.metadataFields).toHaveLength(2);
    });
  });

  describe('when the server does not support trace query discovery', () => {
    it('resolves to an empty field list instead of erroring', async () => {
      server.use(
        http.post(FIELDS_URL, () =>
          HttpResponse.json(
            {
              error: 'Trace query discovery requires a newer @mastra/core. Please upgrade.',
              code: 'TRACE_QUERY_DISCOVERY_UNSUPPORTED',
            },
            { status: 501 },
          ),
        ),
      );

      const { result } = renderHook(() => useTraceQueryFields({ timeRange }), {
        wrapper: makeWrapper(newQueryClient()),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.isError).toBe(false);
      expect(result.current.metadataFields).toEqual([]);
    });
  });

  describe('when the server rejects the discovery request for another reason', () => {
    it('surfaces the error instead of pretending discovery is unsupported', async () => {
      server.use(
        http.post(FIELDS_URL, () =>
          HttpResponse.json(
            { code: 'TRACE_QUERY_INVALID', message: 'The trace query is invalid', issues: [] },
            { status: 422 },
          ),
        ),
      );

      const { result } = renderHook(() => useTraceQueryFields({ timeRange }), {
        wrapper: makeWrapper(newQueryClient()),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.isError).toBe(true);
      expect(result.current.metadataFields).toEqual([]);
    });
  });
});

describe('createTraceQueryValuesResolver', () => {
  describe('when the user opens the value step and types a search', () => {
    it('posts the field path and search term and maps values to options', async () => {
      const bodies: GetTraceQueryValuesArgs[] = [];
      server.use(
        http.post(VALUES_URL, async ({ request }) => {
          bodies.push((await request.json()) as GetTraceQueryValuesArgs);
          return HttpResponse.json(traceQueryValuesFixture);
        }),
      );

      const resolver = createTraceQueryValuesResolver({
        client: new MastraClient({ baseUrl: BASE_URL }),
        queryClient: newQueryClient(),
        timeRange,
        path: 'metadata.region',
      });

      const options = await resolver({ query: ' eu ', operatorId: 'is', signal: new AbortController().signal });

      expect(options).toEqual([{ value: 'eu-west' }, { value: 'us-east' }]);
      expect(bodies).toEqual([
        { timeRange, predicateScope: 'trace', path: 'metadata.region', search: 'eu', limit: 100 },
      ]);
    });
  });

  describe('when the same search is resolved again', () => {
    it('serves the second lookup from the React Query cache', async () => {
      let requests = 0;
      server.use(
        http.post(VALUES_URL, () => {
          requests++;
          return HttpResponse.json(traceQueryValuesFixture);
        }),
      );

      const resolver = createTraceQueryValuesResolver({
        client: new MastraClient({ baseUrl: BASE_URL }),
        queryClient: newQueryClient(),
        timeRange,
        path: 'metadata.region',
      });

      await resolver({ query: '', operatorId: 'is', signal: new AbortController().signal });
      await resolver({ query: '', operatorId: 'is', signal: new AbortController().signal });

      expect(requests).toBe(1);
    });
  });

  describe('when the FilterBar aborts a stale lookup', () => {
    it('rejects the aborted call and does not cache a result for it', async () => {
      let requests = 0;
      server.use(
        http.post(VALUES_URL, async () => {
          requests++;
          await new Promise(resolve => setTimeout(resolve, 50));
          return HttpResponse.json(traceQueryValuesFixture);
        }),
      );

      const queryClient = newQueryClient();
      const resolver = createTraceQueryValuesResolver({
        client: new MastraClient({ baseUrl: BASE_URL }),
        queryClient,
        timeRange,
        path: 'metadata.region',
      });

      const controller = new AbortController();
      const pending = resolver({ query: 'e', operatorId: 'is', signal: controller.signal });
      controller.abort();

      await expect(pending).rejects.toThrow();
      expect(
        queryClient.getQueryData(['trace-query-values', timeRange.from, timeRange.to, 'metadata.region', 'e']),
      ).toBe(undefined);
      expect(requests).toBeLessThanOrEqual(1);
    });
  });
});

describe('useTraceQueryValues', () => {
  describe('when enabled for a metadata field', () => {
    it('returns the discovered values as filter options', async () => {
      server.use(http.post(VALUES_URL, () => HttpResponse.json(traceQueryValuesFixture)));

      const { result } = renderHook(() => useTraceQueryValues({ timeRange, path: 'metadata.region' }), {
        wrapper: makeWrapper(newQueryClient()),
      });

      await waitFor(() => expect(result.current.data).toEqual([{ value: 'eu-west' }, { value: 'us-east' }]));
    });
  });
});
