import type { ListBranchesResponse, ListTracesResponse } from '@mastra/core/storage';
import { describe, it, expect } from 'vitest';
import { getTracesNextPageParam, selectUniqueTraces } from '../use-traces';

function makeTracesPage(
  spans: Array<{ traceId: string; spanId?: string; name: string; metadata?: unknown; tags?: unknown }>,
  hasMore: boolean,
  threadTitles?: Record<string, string>,
): ListTracesResponse & { threadTitles?: Record<string, string> } {
  return {
    pagination: { total: 100, page: 0, perPage: 25, hasMore },
    spans,
    ...(threadTitles ? { threadTitles } : {}),
  } as unknown as ListTracesResponse & { threadTitles?: Record<string, string> };
}

function makeBranchesPage(
  branches: Array<{ traceId: string; spanId: string; name: string; spanType?: string }>,
  hasMore: boolean,
): ListBranchesResponse {
  return {
    pagination: { total: 100, page: 0, perPage: 25, hasMore },
    branches,
  } as unknown as ListBranchesResponse;
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

  it('merges threadTitles across pages', () => {
    const data = {
      pages: [
        makeTracesPage([{ traceId: 'aaa', name: 'Alpha' }], true, { aaa: 'Greeting thread' }),
        makeTracesPage([{ traceId: 'bbb', name: 'Bravo' }], false, { bbb: 'Support thread' }),
      ],
    };
    const result = selectUniqueTraces(data);
    expect(result.threadTitles).toEqual({ aaa: 'Greeting thread', bbb: 'Support thread' });
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
