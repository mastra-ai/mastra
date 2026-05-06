import type { ListTracesResponse } from '@mastra/core/storage';
import { describe, it, expect } from 'vitest';
import { getTracesNextPageParam, selectUniqueTraces } from '../use-traces';

function makePage(spans: Array<{ traceId: string; name: string }>, hasMore: boolean): ListTracesResponse {
  return { pagination: { total: 100, page: 0, perPage: 25, hasMore }, spans } as unknown as ListTracesResponse;
}

describe('useTraces logic', () => {
  it('uses hasMore to determine next page', () => {
    expect(getTracesNextPageParam(makePage([], true), [], 2)).toBe(3);
    expect(getTracesNextPageParam(makePage([], false), [], 2)).toBeUndefined();
    expect(getTracesNextPageParam(undefined, [], 0)).toBeUndefined();
  });

  it('deduplicates across pages, keeping first occurrence', () => {
    const data = {
      pages: [
        makePage(
          [
            { traceId: 'aaa', name: 'Alpha' },
            { traceId: 'bbb', name: 'Bravo' },
          ],
          true,
        ),
        makePage(
          [
            { traceId: 'bbb', name: 'Bravo (stale)' },
            { traceId: 'ccc', name: 'Charlie' },
          ],
          false,
        ),
      ],
    };
    const result = selectUniqueTraces(data);
    expect(result.spans.map(s => s.traceId)).toEqual(['aaa', 'bbb', 'ccc']);
    expect(result.spans[1].name).toBe('Bravo');
  });

  it('handles pages with undefined spans gracefully', () => {
    const data = {
      pages: [
        { pagination: { total: 1, page: 0, perPage: 25, hasMore: false } } as unknown as ListTracesResponse,
        makePage([{ traceId: 'aaa', name: 'Alpha' }], false),
      ],
    };
    const result = selectUniqueTraces(data);
    expect(result.spans.map(s => s.traceId)).toEqual(['aaa']);
  });

  // ---- Issue #14005: Filter and search traces by metadata and tags ----

  it('preserves metadata and tags fields during deduplication', () => {
    const data = {
      pages: [
        makePage(
          [
            { traceId: 'aaa', name: 'Alpha', metadata: { orgId: 'org_1' }, tags: ['agent:test'] },
            { traceId: 'bbb', name: 'Bravo', metadata: { userId: 'u_1' }, tags: ['env:prod'] },
          ] as any,
          false,
        ),
      ],
    };
    const result = selectUniqueTraces(data);
    expect(result.spans).toHaveLength(2);
    // Verify metadata and tags survive the dedup pipeline
    expect((result.spans[0] as any).metadata).toEqual({ orgId: 'org_1' });
    expect((result.spans[0] as any).tags).toEqual(['agent:test']);
    expect((result.spans[1] as any).metadata).toEqual({ userId: 'u_1' });
    expect((result.spans[1] as any).tags).toEqual(['env:prod']);
  });
});
