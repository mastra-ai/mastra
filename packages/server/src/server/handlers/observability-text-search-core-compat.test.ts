import { Mastra } from '@mastra/core';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { HTTPException } from '../http-exception';
import { createTestServerContext } from './test-utils';

// Model the pre-search Core contract, retaining real schema validation and planning.
vi.mock('@mastra/core/storage', async importOriginal => {
  const actual = await importOriginal<typeof import('@mastra/core/storage')>();
  const legacyRequestSchema = actual.spanQueryRequestSchema.out.omit({ textSearch: true });
  return {
    ...actual,
    observabilityTextSearchSchema: undefined,
    planSpanQuery: (input: unknown, options: Parameters<typeof actual.planSpanQuery>[1]) =>
      actual.planSpanQuery(legacyRequestSchema.parse(input), options),
  };
});

const { QUERY_SPANS } = await import('./observability-new-endpoints');
const { getObservabilityStorageCapabilities } = await import('./observability-shared');

describe('text search with pre-search Core', () => {
  it('lets an ordinary span request reach the store capability check instead of failing old schema validation', async () => {
    const mastra = new Mastra({ storage: new InMemoryStore() });
    try {
      await QUERY_SPANS.handler({
        ...createTestServerContext({ mastra }),
        timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-08-02T00:00:00Z' },
      });
      throw new Error('Expected unsupported in-memory span queries');
    } catch (error) {
      expect(error).toBeInstanceOf(HTTPException);
      const response = (error as HTTPException).getResponse();
      expect(response.status).toBe(501);
      await expect(response.json()).resolves.toMatchObject({ code: 'SPAN_QUERY_UNSUPPORTED' });
    }
  });

  it('does not advertise search when Core cannot parse it, even if the store declares it', () => {
    const capabilities = getObservabilityStorageCapabilities({
      getFeatures: () => ['span-query', 'trace-query', 'span-query-text-search', 'trace-query-text-search'],
    } as Parameters<typeof getObservabilityStorageCapabilities>[0]);
    expect(capabilities).toMatchObject({
      spanQuery: true,
      traceQuery: true,
      spanQueryTextSearch: false,
      traceQueryTextSearch: false,
    });
  });
});
