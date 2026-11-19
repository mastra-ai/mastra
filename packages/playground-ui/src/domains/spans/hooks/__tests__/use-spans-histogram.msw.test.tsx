// @vitest-environment jsdom
import { MastraClientError } from '@mastra/client-js';
import type { AggregateSpansResponse, GetObservabilityCapabilitiesResponse } from '@mastra/client-js';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { spanAggregateCapabilities } from '../../__tests__/fixtures/spans';
import { useSpansHistogram } from '../use-spans-histogram';
import { server } from '@/test/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '@/test/render';

const DAY = 24 * 60 * 60 * 1000;
const to = '2026-11-18T00:00:00.000Z';
const timeRange = { from: new Date(Date.parse(to) - 30 * DAY).toISOString(), to };
const where = { op: 'hasAllTokens' as const, left: { path: 'all' }, right: { literal: 'weather' } };

const capabilities: GetObservabilityCapabilitiesResponse = {
  ...spanAggregateCapabilities,
  capabilities: {
    ...spanAggregateCapabilities.capabilities,
    spanAggregateTokenSearch: true,
    progressiveTokenSearch: true,
  },
};

const firstChunk: AggregateSpansResponse = {
  rows: [{ bucket: new Date(Date.parse(to) - DAY).toISOString(), measures: { count: 5, errorCount: 1 } }],
  truncated: false,
  searchedRange: { from: new Date(Date.parse(to) - 7 * DAY).toISOString(), to },
  continuation: '1',
  mergeable: true,
};

describe('useSpansHistogram', () => {
  it('reports the error that stopped a progressive search, keeping the chunks before it', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(capabilities)),
      http.post(`${TEST_BASE_URL}/api/observability/spans/aggregate`, async ({ request }) => {
        const body = (await request.json()) as { continuation?: string };
        return body.continuation
          ? HttpResponse.json({ name: 'search_too_expensive', message: 'Search took too long' }, { status: 504 })
          : HttpResponse.json(firstChunk);
      }),
    );

    const { result } = renderHookWithProviders(() => useSpansHistogram({ timeRange, where }));

    await waitFor(() => expect(result.current.progress?.failed).toBe(true));
    const progress = result.current.progress;
    expect(progress?.chunkError).toBeInstanceOf(MastraClientError);
    expect((progress?.chunkError as MastraClientError).status).toBe(504);
    expect(progress?.searchedRange).toEqual(firstChunk.searchedRange);
    expect(result.current.buckets.some(bucket => bucket.ok === 4 && bucket.errors === 1)).toBe(true);
  });
});
