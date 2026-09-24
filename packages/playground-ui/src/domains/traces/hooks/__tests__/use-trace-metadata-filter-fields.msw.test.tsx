// @vitest-environment jsdom
import type { GetTraceQueryFieldsArgs, GetTraceQueryValuesArgs } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useTraceMetadataFilterFields } from '../use-trace-metadata-filter-fields';
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

describe('useTraceMetadataFilterFields', () => {
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

      const first = renderHook(() => useTraceMetadataFilterFields({ timeRange }), { wrapper });
      await waitFor(() => expect(first.result.current.fields).toHaveLength(2));
      expect(first.result.current.fields.map(field => field.path)).toEqual(['metadata.region', 'metadata.tenant']);
      expect(bodies).toEqual([{ timeRange, predicateScope: 'trace', limit: 100 }]);

      first.unmount();
      const second = renderHook(() => useTraceMetadataFilterFields({ timeRange }), { wrapper });
      await waitFor(() => expect(second.result.current.fields).toHaveLength(2));
      expect(bodies).toHaveLength(1);
    });

    it('resolves a field’s values from the server when its suggestions resolver is invoked', async () => {
      const bodies: GetTraceQueryValuesArgs[] = [];
      server.use(
        http.post(FIELDS_URL, () => HttpResponse.json(traceQueryFieldsFixture)),
        http.post(VALUES_URL, async ({ request }) => {
          bodies.push((await request.json()) as GetTraceQueryValuesArgs);
          return HttpResponse.json(traceQueryValuesFixture);
        }),
      );

      const { result } = renderHook(() => useTraceMetadataFilterFields({ timeRange }), {
        wrapper: makeWrapper(newQueryClient()),
      });
      await waitFor(() => expect(result.current.fields).toHaveLength(2));

      const [region] = result.current.fields;
      const options = await region?.suggestions({
        query: ' eu ',
        operatorId: 'is',
        signal: new AbortController().signal,
      });

      expect(options).toEqual([{ value: 'eu-west' }, { value: 'us-east' }]);
      expect(bodies).toEqual([
        { timeRange, predicateScope: 'trace', path: 'metadata.region', search: 'eu', limit: 100 },
      ]);
    });

    it('rejects the value lookup when the signal is aborted', async () => {
      server.use(
        http.post(FIELDS_URL, () => HttpResponse.json(traceQueryFieldsFixture)),
        http.post(VALUES_URL, () => HttpResponse.json(traceQueryValuesFixture)),
      );

      const { result } = renderHook(() => useTraceMetadataFilterFields({ timeRange }), {
        wrapper: makeWrapper(newQueryClient()),
      });
      await waitFor(() => expect(result.current.fields).toHaveLength(2));

      const controller = new AbortController();
      controller.abort();

      const [region] = result.current.fields;
      await expect(region?.suggestions({ query: '', operatorId: 'is', signal: controller.signal })).rejects.toThrow();
    });
  });

  describe('when the time range changes after the first load', () => {
    it('keeps the previous fields instead of dropping back to loading', async () => {
      server.use(http.post(FIELDS_URL, () => HttpResponse.json(traceQueryFieldsFixture)));

      const { result, rerender } = renderHook(({ range }) => useTraceMetadataFilterFields({ timeRange: range }), {
        wrapper: makeWrapper(newQueryClient()),
        initialProps: { range: timeRange },
      });
      await waitFor(() => expect(result.current.fields).toHaveLength(2));

      rerender({ range: { from: '2026-09-17T00:00:00.000Z', to: timeRange.to } });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.fields).toHaveLength(2);
    });
  });

  describe('when disabled', () => {
    it('never requests the discovery endpoint and exposes no fields', async () => {
      let requests = 0;
      server.use(
        http.post(FIELDS_URL, () => {
          requests++;
          return HttpResponse.json(traceQueryFieldsFixture);
        }),
      );

      const { result } = renderHook(() => useTraceMetadataFilterFields({ timeRange, enabled: false }), {
        wrapper: makeWrapper(newQueryClient()),
      });
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(requests).toBe(0);
      expect(result.current.fields).toEqual([]);
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

      const { result } = renderHook(() => useTraceMetadataFilterFields({ timeRange }), {
        wrapper: makeWrapper(newQueryClient()),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.error).toBeNull();
      expect(result.current.fields).toEqual([]);
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

      const { result } = renderHook(() => useTraceMetadataFilterFields({ timeRange }), {
        wrapper: makeWrapper(newQueryClient()),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.error).not.toBeNull();
      expect(result.current.fields).toEqual([]);
    });
  });
});
