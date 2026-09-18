// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyTracePropertyFilterTokens,
  getTracePropertyFilterTokens,
  getPreservedTraceFilterParams,
} from '../../trace-filters';
import { buildTraceQueryRequest } from '../../trace-query-filters';
import { useMetadataFilterFields } from '../use-metadata-filter-fields';
import { metadataFields, metadataValues } from './fixtures/metadata-filters';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const timeRange = { from: '2026-08-01T00:00:00.000Z', to: '2026-08-02T00:00:00.000Z' };

afterEach(cleanup);

describe('metadata filter fields', () => {
  describe('when discovery returns nested paths and typed scalar values', () => {
    it('preserves path segments and scalar types through selection, URL persistence, and query construction', async () => {
      server.use(
        http.post(`${BASE_URL}/api/observability/traces/query/fields`, async ({ request }) => {
          expect(await request.json()).toMatchObject({ timeRange, predicateScope: 'trace' });
          return HttpResponse.json(metadataFields);
        }),
        http.post(`${BASE_URL}/api/observability/traces/query/values`, async ({ request }) => {
          expect(await request.json()).toMatchObject({ timeRange, path: ['metadata', 'customer', 'a.b'] });
          return HttpResponse.json(metadataValues);
        }),
      );
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const wrapper = ({ children }: { children: ReactNode }) => (
        <MastraReactProvider baseUrl={BASE_URL}>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </MastraReactProvider>
      );
      const { result } = renderHook(() => useMetadataFilterFields(timeRange), { wrapper });
      await waitFor(() => expect(result.current.fields).toHaveLength(1));
      const field = result.current.fields[0];
      if (!field) throw new Error('Expected a discovered metadata field');
      expect(field.label).toBe('Metadata ["customer","a.b"]');
      if (typeof field.suggestions !== 'function') throw new Error('Expected value discovery');
      const suggestions = await field.suggestions({
        query: '',
        operatorId: 'is',
        signal: new AbortController().signal,
      });
      expect(suggestions.map(option => option.value)).toEqual(['false', '0', '""']);
      for (const [index, option] of suggestions.entries()) {
        const expectedValue = metadataValues.values[index];
        if (!expectedValue) throw new Error('Expected a matching scalar value fixture');
        const params = new URLSearchParams();
        applyTracePropertyFilterTokens(params, [{ fieldId: field.id, value: option.value }]);
        const tokens = getTracePropertyFilterTokens(getPreservedTraceFilterParams(params));
        expect(buildTraceQueryRequest({ tokens, now: new Date(timeRange.to) }).where).toEqual({
          op: 'and',
          args: [
            {
              op: 'eq',
              left: { path: ['metadata', 'customer', 'a.b'] },
              right: { literal: expectedValue.value },
            },
          ],
        });
      }
      queryClient.clear();
    });
  });
});
