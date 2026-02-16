import { describe, it, expect } from 'vitest';

// Mirrors getNextPageParam from use-traces.tsx
function getNextPageParam(
  lastPage: { pagination?: { hasMore?: boolean } } | undefined,
  _allPages: unknown,
  lastPageParam: number,
) {
  if (lastPage?.pagination?.hasMore) {
    return lastPageParam + 1;
  }
  return undefined;
}

// Mirrors select from use-traces.tsx
function selectTraces(data: { pages: Array<{ spans?: Array<{ traceId: string; name: string }> }> }) {
  const seen = new Set<string>();
  return data.pages
    .flatMap(page => page.spans ?? [])
    .filter(span => {
      if (seen.has(span.traceId)) return false;
      seen.add(span.traceId);
      return true;
    });
}

describe('useTraces logic', () => {
  it('uses hasMore to determine next page', () => {
    expect(getNextPageParam({ pagination: { hasMore: true } }, [], 2)).toBe(3);
    expect(getNextPageParam({ pagination: { hasMore: false } }, [], 2)).toBeUndefined();
    expect(getNextPageParam(undefined, [], 0)).toBeUndefined();
  });

  it('deduplicates across pages, keeping first occurrence', () => {
    // Simulates offset pagination drift: page 1 overlaps with page 0
    const data = {
      pages: [
        {
          spans: [
            { traceId: 'aaa', name: 'Alpha' },
            { traceId: 'bbb', name: 'Bravo' },
          ],
        },
        {
          spans: [
            { traceId: 'bbb', name: 'Bravo (stale)' },
            { traceId: 'ccc', name: 'Charlie' },
          ],
        },
      ],
    };
    const result = selectTraces(data);
    expect(result.map(s => s.traceId)).toEqual(['aaa', 'bbb', 'ccc']);
    expect(result[1].name).toBe('Bravo');
  });
});
