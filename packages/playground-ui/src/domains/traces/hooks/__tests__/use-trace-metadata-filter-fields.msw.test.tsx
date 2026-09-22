// @vitest-environment jsdom
import type { GetTraceQueryFieldsArgs, GetTraceQueryValuesArgs } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { encodeTraceMetadataValue } from '../../trace-metadata-filter-codec';
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
      await waitFor(() => expect(first.result.current.fields).toHaveLength(6));
      expect(first.result.current.fields.map(field => field.path)).toEqual([
        'metadata.region',
        'metadata.customer.id',
        ['metadata', 'customer.id'],
        'metadata.retry.count',
        'metadata.flags.reviewed',
        'metadata.mixed',
      ]);
      expect(bodies).toEqual([{ timeRange, predicateScope: 'trace', limit: 100 }]);

      const [, nested, exact, number, boolean, mixed] = first.result.current.fields;
      expect(nested?.id).toBe('metadata.customer.id');
      expect(exact?.id).not.toBe(nested?.id);
      expect(exact?.label).toBe('["customer.id"]');
      expect(number).toMatchObject({
        type: 'number',
        operators: ['is', 'isNot', 'in', 'notIn', 'lt', 'lte', 'gt', 'gte', 'exists', 'notExists'],
      });
      expect(boolean).toMatchObject({
        type: 'boolean',
        operators: ['is', 'isNot', 'in', 'notIn', 'exists', 'notExists'],
      });
      expect(mixed).toMatchObject({ type: undefined, strict: true });

      first.unmount();
      const second = renderHook(() => useTraceMetadataFilterFields({ timeRange }), { wrapper });
      await waitFor(() => expect(second.result.current.fields).toHaveLength(6));
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
      await waitFor(() => expect(result.current.fields).toHaveLength(6));

      const [region] = result.current.fields;
      const options = await region?.suggestions({
        query: ' eu ',
        operatorId: 'is',
        signal: new AbortController().signal,
      });

      expect(options).toEqual([
        { value: 'eu-west', label: 'eu-west' },
        { value: 'us-east', label: 'us-east' },
      ]);
      expect(bodies).toEqual([
        { timeRange, predicateScope: 'trace', path: 'metadata.region', search: 'eu', limit: 100 },
      ]);
    });

    it('preserves nested paths, exact paths, and typed scalar suggestions in value requests', async () => {
      const bodies: GetTraceQueryValuesArgs[] = [];
      server.use(
        http.post(FIELDS_URL, () => HttpResponse.json(traceQueryFieldsFixture)),
        http.post(VALUES_URL, async ({ request }) => {
          const body = (await request.json()) as GetTraceQueryValuesArgs;
          bodies.push(body);
          const value = Array.isArray(body.path)
            ? 'literal-dot'
            : body.path === 'metadata.retry.count'
              ? 0
              : body.path === 'metadata.flags.reviewed'
                ? false
                : 'nested';
          return HttpResponse.json({ values: [{ value, count: 1 }], valuesTruncated: false });
        }),
      );

      const { result } = renderHook(() => useTraceMetadataFilterFields({ timeRange }), {
        wrapper: makeWrapper(newQueryClient()),
      });
      await waitFor(() => expect(result.current.fields).toHaveLength(6));

      const fields = result.current.fields.slice(1, 5);
      const options = await Promise.all(
        fields.map(field => field.suggestions({ query: '', operatorId: 'is', signal: new AbortController().signal })),
      );

      expect(options).toEqual([
        [{ value: 'nested', label: 'nested' }],
        [{ value: 'literal-dot', label: 'literal-dot' }],
        [{ value: encodeTraceMetadataValue(0), label: '0' }],
        [{ value: encodeTraceMetadataValue(false), label: 'false' }],
      ]);
      expect(bodies.map(body => body.path)).toEqual([
        'metadata.customer.id',
        ['metadata', 'customer.id'],
        'metadata.retry.count',
        'metadata.flags.reviewed',
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
      await waitFor(() => expect(result.current.fields).toHaveLength(6));

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
      await waitFor(() => expect(result.current.fields).toHaveLength(6));

      rerender({ range: { from: '2026-09-17T00:00:00.000Z', to: timeRange.to } });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.fields).toHaveLength(6);
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
