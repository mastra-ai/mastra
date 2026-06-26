import type { ListBranchesResponse, ListTracesResponse } from '@mastra/core/storage';
import type { InfiniteData } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import {
  getTracesNextPageParam,
  mergeDeltaIntoPage0,
  refreshPage0Rows,
  selectUniqueTraces,
  shouldResetAfterIdle,
} from '../use-traces';

type TracesPageResponse = ListTracesResponse | ListBranchesResponse;

function makeTracesPage(
  spans: Array<{ traceId: string; spanId?: string; name: string; metadata?: unknown; tags?: unknown }>,
  hasMore: boolean,
  deltaCursor?: string,
): ListTracesResponse {
  return {
    pagination: { total: 100, page: 0, perPage: 25, hasMore },
    spans,
    ...(deltaCursor !== undefined ? { deltaCursor } : {}),
  } as unknown as ListTracesResponse;
}

function makeBranchesPage(
  branches: Array<{ traceId: string; spanId: string; name: string; spanType?: string }>,
  hasMore: boolean,
  deltaCursor?: string,
): ListBranchesResponse {
  return {
    pagination: { total: 100, page: 0, perPage: 25, hasMore },
    branches,
    ...(deltaCursor !== undefined ? { deltaCursor } : {}),
  } as unknown as ListBranchesResponse;
}

function makeDeltaTracesResponse(
  spans: Array<{ traceId: string; spanId?: string; name: string }>,
  deltaCursor: string,
  hasMore = false,
): ListTracesResponse {
  return {
    delta: { limit: 100, hasMore },
    deltaCursor,
    spans,
  } as unknown as ListTracesResponse;
}

function makeDeltaBranchesResponse(
  branches: Array<{ traceId: string; spanId: string; name: string }>,
  deltaCursor: string,
  hasMore = false,
): ListBranchesResponse {
  return {
    delta: { limit: 100, hasMore },
    deltaCursor,
    branches,
  } as unknown as ListBranchesResponse;
}

function makeInfiniteData(pages: TracesPageResponse[]): InfiniteData<TracesPageResponse> {
  return { pages, pageParams: pages.map((_, idx) => idx) };
}

describe('useTraces logic', () => {
  it('uses hasMore to determine next page', () => {
    expect(getTracesNextPageParam(makeTracesPage([], true), [], 2)).toBe(3);
    expect(getTracesNextPageParam(makeTracesPage([], false), [], 2)).toBeUndefined();
    expect(getTracesNextPageParam(undefined, [], 0)).toBeUndefined();
  });

  it('deduplicates across pages, keeping first occurrence', () => {
    const data = {
      pages: [
        makeTracesPage(
          [
            { traceId: 'aaa', name: 'Alpha' },
            { traceId: 'bbb', name: 'Bravo' },
          ],
          true,
        ),
        makeTracesPage(
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
        makeTracesPage([{ traceId: 'aaa', name: 'Alpha' }], false),
      ],
    };
    const result = selectUniqueTraces(data);
    expect(result.spans.map(s => s.traceId)).toEqual(['aaa']);
  });

  // ---- Issue #14005: Filter and search traces by metadata and tags ----

  it('preserves metadata and tags fields during deduplication', () => {
    const data = {
      pages: [
        makeTracesPage(
          [
            { traceId: 'aaa', name: 'Alpha', metadata: { orgId: 'org_1' }, tags: ['agent:test'] },
            { traceId: 'bbb', name: 'Bravo', metadata: { userId: 'u_1' }, tags: ['env:prod'] },
          ],
          false,
        ),
      ],
    };
    const result = selectUniqueTraces(data);
    expect(result.spans).toHaveLength(2);
    expect((result.spans[0] as { metadata?: unknown }).metadata).toEqual({ orgId: 'org_1' });
    expect((result.spans[0] as { tags?: unknown }).tags).toEqual(['agent:test']);
    expect((result.spans[1] as { metadata?: unknown }).metadata).toEqual({ userId: 'u_1' });
    expect((result.spans[1] as { tags?: unknown }).tags).toEqual(['env:prod']);
  });

  // ---- Branches mode ----

  it('reads rows from `branches` when the page is a ListBranchesResponse', () => {
    const data = {
      pages: [
        makeBranchesPage(
          [
            { traceId: 't1', spanId: 's1', name: 'agent-run', spanType: 'AGENT_RUN' },
            { traceId: 't1', spanId: 's2', name: 'tool-call', spanType: 'TOOL_CALL' },
          ],
          false,
        ),
      ],
    };
    const result = selectUniqueTraces(data);
    expect(result.spans.map(s => `${s.traceId}:${s.spanId}`)).toEqual(['t1:s1', 't1:s2']);
  });

  it('keeps branches sharing a traceId as distinct rows (dedup is by traceId + spanId)', () => {
    const data = {
      pages: [
        makeBranchesPage(
          [
            { traceId: 't1', spanId: 's1', name: 'workflow-run' },
            { traceId: 't1', spanId: 's2', name: 'agent-run' },
            { traceId: 't1', spanId: 's3', name: 'tool-call' },
          ],
          false,
        ),
      ],
    };
    const result = selectUniqueTraces(data);
    expect(result.spans).toHaveLength(3);
  });

  it('deduplicates branches across pages by traceId + spanId', () => {
    const data = {
      pages: [
        makeBranchesPage(
          [
            { traceId: 't1', spanId: 's1', name: 'agent-run' },
            { traceId: 't1', spanId: 's2', name: 'tool-call' },
          ],
          true,
        ),
        makeBranchesPage(
          [
            { traceId: 't1', spanId: 's2', name: 'tool-call (stale)' },
            { traceId: 't2', spanId: 's3', name: 'agent-run' },
          ],
          false,
        ),
      ],
    };
    const result = selectUniqueTraces(data);
    expect(result.spans.map(s => `${s.traceId}:${s.spanId}`)).toEqual(['t1:s1', 't1:s2', 't2:s3']);
    expect(result.spans[1].name).toBe('tool-call');
  });

  it('uses hasMore from ListBranchesResponse pagination', () => {
    expect(getTracesNextPageParam(makeBranchesPage([], true), [], 0)).toBe(1);
    expect(getTracesNextPageParam(makeBranchesPage([], false), [], 0)).toBeUndefined();
  });
});

describe('selectUniqueTraces — deltaCursor extension', () => {
  it("surfaces page 0's deltaCursor", () => {
    const data = {
      pages: [makeTracesPage([{ traceId: 'aaa', name: 'Alpha' }], false, 'cursor-42')],
    };
    expect(selectUniqueTraces(data).deltaCursor).toBe('cursor-42');
  });

  it('returns undefined deltaCursor when page 0 has no cursor (legacy server)', () => {
    const data = { pages: [makeTracesPage([{ traceId: 'aaa', name: 'Alpha' }], false)] };
    expect(selectUniqueTraces(data).deltaCursor).toBeUndefined();
  });

  it('reads the cursor only from page 0, not later pages', () => {
    const data = {
      pages: [
        makeTracesPage([{ traceId: 'aaa', name: 'Alpha' }], true, 'cursor-first'),
        makeTracesPage([{ traceId: 'bbb', name: 'Bravo' }], false, 'cursor-second'),
      ],
    };
    expect(selectUniqueTraces(data).deltaCursor).toBe('cursor-first');
  });
});

describe('mergeDeltaIntoPage0', () => {
  it('prepends delta spans into page 0 (traces mode)', () => {
    const old = makeInfiniteData([makeTracesPage([{ traceId: 'aaa', name: 'Alpha' }], false, 'c1')]);
    const delta = makeDeltaTracesResponse([{ traceId: 'bbb', name: 'Bravo' }], 'c2');
    const merged = mergeDeltaIntoPage0(old, delta, 'traces');
    const firstPage = merged?.pages[0] as ListTracesResponse;
    expect(firstPage.spans.map(s => s.traceId)).toEqual(['bbb', 'aaa']);
    expect(firstPage.deltaCursor).toBe('c2');
  });

  it('prepends delta branches into page 0 (branches mode)', () => {
    const old = makeInfiniteData([makeBranchesPage([{ traceId: 't1', spanId: 's1', name: 'agent-run' }], false, 'c1')]);
    const delta = makeDeltaBranchesResponse([{ traceId: 't2', spanId: 's2', name: 'tool-call' }], 'c2');
    const merged = mergeDeltaIntoPage0(old, delta, 'branches');
    const firstPage = merged?.pages[0] as ListBranchesResponse;
    expect(firstPage.branches.map(b => `${b.traceId}:${b.spanId}`)).toEqual(['t2:s2', 't1:s1']);
    expect(firstPage.deltaCursor).toBe('c2');
  });

  it('advances cursor even when delta returns no new rows', () => {
    const old = makeInfiniteData([makeTracesPage([{ traceId: 'aaa', name: 'Alpha' }], false, 'c1')]);
    const delta = makeDeltaTracesResponse([], 'c2');
    const merged = mergeDeltaIntoPage0(old, delta, 'traces');
    const firstPage = merged?.pages[0] as ListTracesResponse;
    expect(firstPage.spans.map(s => s.traceId)).toEqual(['aaa']);
    expect(firstPage.deltaCursor).toBe('c2');
  });

  it("keeps existing cursor when delta doesn't include one", () => {
    const old = makeInfiniteData([makeTracesPage([{ traceId: 'aaa', name: 'Alpha' }], false, 'c1')]);
    const delta = {
      delta: { limit: 100, hasMore: false },
      spans: [{ traceId: 'bbb', name: 'Bravo' }],
    } as unknown as ListTracesResponse;
    const merged = mergeDeltaIntoPage0(old, delta, 'traces');
    expect((merged?.pages[0] as ListTracesResponse).deltaCursor).toBe('c1');
  });

  it('sorts merged page 0 by startedAt DESC (delta rows are in cursor order, not startedAt)', () => {
    const old = makeInfiniteData([
      makeTracesPage([{ traceId: 'aaa', name: 'Alpha', startedAt: '2026-05-01T12:00:00Z' } as never], false, 'c1'),
    ]);
    const delta = {
      delta: { limit: 100, hasMore: false },
      deltaCursor: 'c2',
      spans: [
        { traceId: 'bbb', name: 'Bravo (older)', startedAt: '2026-05-01T11:00:00Z' },
        { traceId: 'ccc', name: 'Charlie (newer)', startedAt: '2026-05-01T13:00:00Z' },
      ],
    } as unknown as ListTracesResponse;
    const merged = mergeDeltaIntoPage0(old, delta, 'traces');
    const firstPage = merged?.pages[0] as ListTracesResponse;
    expect(firstPage.spans.map(s => s.traceId)).toEqual(['ccc', 'aaa', 'bbb']);
  });

  it('leaves later pages untouched', () => {
    const old = makeInfiniteData([
      makeTracesPage([{ traceId: 'aaa', name: 'Alpha' }], true, 'c1'),
      makeTracesPage([{ traceId: 'bbb', name: 'Bravo' }], false),
    ]);
    const delta = makeDeltaTracesResponse([{ traceId: 'ccc', name: 'Charlie' }], 'c2');
    const merged = mergeDeltaIntoPage0(old, delta, 'traces');
    expect((merged?.pages[1] as ListTracesResponse).spans.map(s => s.traceId)).toEqual(['bbb']);
  });

  it('returns input unchanged when there are no pages yet', () => {
    const old = makeInfiniteData([]);
    const delta = makeDeltaTracesResponse([{ traceId: 'aaa', name: 'Alpha' }], 'c1');
    expect(mergeDeltaIntoPage0(old, delta, 'traces')).toBe(old);
  });

  it('returns undefined when called with undefined input', () => {
    const delta = makeDeltaTracesResponse([], 'c1');
    expect(mergeDeltaIntoPage0(undefined, delta, 'traces')).toBeUndefined();
  });
});

describe('refreshPage0Rows', () => {
  it('replaces existing rows by traceId:spanId (traces mode)', () => {
    const old = makeInfiniteData([
      makeTracesPage(
        [
          { traceId: 'aaa', spanId: 's1', name: 'Alpha (running)' },
          { traceId: 'bbb', spanId: 's2', name: 'Bravo (running)' },
        ],
        false,
        'c1',
      ),
    ]);
    const refreshed = makeTracesPage(
      [
        { traceId: 'aaa', spanId: 's1', name: 'Alpha (success)' },
        { traceId: 'bbb', spanId: 's2', name: 'Bravo (success)' },
      ],
      false,
      'c1',
    );
    const result = refreshPage0Rows(old, refreshed, 'traces');
    const firstPage = result?.pages[0] as ListTracesResponse;
    expect(firstPage.spans.map(s => s.name)).toEqual(['Alpha (success)', 'Bravo (success)']);
  });

  it('replaces existing rows by traceId:spanId (branches mode)', () => {
    const old = makeInfiniteData([
      makeBranchesPage(
        [
          { traceId: 't1', spanId: 's1', name: 'agent-run (running)' },
          { traceId: 't1', spanId: 's2', name: 'tool-call (running)' },
        ],
        false,
        'c1',
      ),
    ]);
    const refreshed = makeBranchesPage(
      [
        { traceId: 't1', spanId: 's1', name: 'agent-run (success)' },
        { traceId: 't1', spanId: 's2', name: 'tool-call (success)' },
      ],
      false,
      'c1',
    );
    const result = refreshPage0Rows(old, refreshed, 'branches');
    const firstPage = result?.pages[0] as ListBranchesResponse;
    expect(firstPage.branches.map(b => b.name)).toEqual(['agent-run (success)', 'tool-call (success)']);
  });

  it("preserves rows the refresh response doesn't include (delta-accumulated)", () => {
    const old = makeInfiniteData([
      makeTracesPage(
        [
          { traceId: 'delta-only', spanId: 's0', name: 'Delta Row' },
          { traceId: 'aaa', spanId: 's1', name: 'Alpha (running)' },
        ],
        false,
        'c1',
      ),
    ]);
    const refreshed = makeTracesPage([{ traceId: 'aaa', spanId: 's1', name: 'Alpha (success)' }], false, 'c1');
    const result = refreshPage0Rows(old, refreshed, 'traces');
    const firstPage = result?.pages[0] as ListTracesResponse;
    expect(firstPage.spans.map(s => s.traceId)).toEqual(['delta-only', 'aaa']);
    expect(firstPage.spans[1].name).toBe('Alpha (success)');
  });

  it('does not add new rows the refresh response contains but the cache does not', () => {
    const old = makeInfiniteData([makeTracesPage([{ traceId: 'aaa', spanId: 's1', name: 'Alpha' }], false, 'c1')]);
    const refreshed = makeTracesPage(
      [
        { traceId: 'aaa', spanId: 's1', name: 'Alpha' },
        { traceId: 'new', spanId: 's-new', name: 'New (server saw it, we didn`t)' },
      ],
      false,
      'c1',
    );
    const result = refreshPage0Rows(old, refreshed, 'traces');
    const firstPage = result?.pages[0] as ListTracesResponse;
    expect(firstPage.spans.map(s => s.traceId)).toEqual(['aaa']);
  });

  it('returns input unchanged when refresh response has no rows', () => {
    const old = makeInfiniteData([makeTracesPage([{ traceId: 'aaa', spanId: 's1', name: 'Alpha' }], false, 'c1')]);
    const refreshed = makeTracesPage([], false, 'c1');
    expect(refreshPage0Rows(old, refreshed, 'traces')).toBe(old);
  });

  it('returns input unchanged when there are no pages yet', () => {
    const old = makeInfiniteData([]);
    const refreshed = makeTracesPage([{ traceId: 'aaa', spanId: 's1', name: 'Alpha' }], false, 'c1');
    expect(refreshPage0Rows(old, refreshed, 'traces')).toBe(old);
  });

  it('returns undefined when called with undefined input', () => {
    const refreshed = makeTracesPage([], false, 'c1');
    expect(refreshPage0Rows(undefined, refreshed, 'traces')).toBeUndefined();
  });
});

describe('shouldResetAfterIdle', () => {
  const threshold = 15 * 60_000;

  it('returns false when nothing has loaded yet (lastSuccessAt = 0)', () => {
    expect(shouldResetAfterIdle(0, Date.now(), threshold)).toBe(false);
  });

  it('returns false when within the threshold', () => {
    const now = 1_000_000_000;
    expect(shouldResetAfterIdle(now - threshold + 1, now, threshold)).toBe(false);
  });

  it('returns false right at the threshold boundary (exclusive)', () => {
    const now = 1_000_000_000;
    expect(shouldResetAfterIdle(now - threshold, now, threshold)).toBe(false);
  });

  it('returns true when past the threshold', () => {
    const now = 1_000_000_000;
    expect(shouldResetAfterIdle(now - threshold - 1, now, threshold)).toBe(true);
  });
});
