import { describe, expect, it, vi } from 'vitest';

// Model Core without the token-search capability marker.
vi.mock('@mastra/core/storage', async importOriginal => {
  const actual = await importOriginal<typeof import('@mastra/core/storage')>();
  return { ...actual, TRACE_QUERY_TOKEN_FIELDS: undefined };
});

const { getObservabilityStorageCapabilities } = await import('./observability-shared');

describe('text search with pre-search Core', () => {
  it('does not advertise search when Core cannot parse it, even if the store declares it', () => {
    const capabilities = getObservabilityStorageCapabilities({
      getFeatures: () => [
        'span-query',
        'trace-query',
        'span-query-token-search',
        'trace-query-token-search',
        'trace-aggregate',
        'span-aggregate',
        'trace-aggregate-token-search',
        'span-aggregate-token-search',
      ],
    } as Parameters<typeof getObservabilityStorageCapabilities>[0]);
    expect(capabilities).toMatchObject({
      spanQuery: true,
      traceQuery: true,
      spanQueryTokenSearch: false,
      traceQueryTokenSearch: false,
      traceAggregateTokenSearch: false,
      spanAggregateTokenSearch: false,
    });
  });
});
