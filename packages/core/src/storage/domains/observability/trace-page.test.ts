import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SpanType } from '../../../observability/types';
import { readTracePage, tracePageRequestSchema, tracePageResponseSchema } from './trace-page';
import type { TracePageSource, TracePageResponse } from './trace-page';
import type { SpanRecord } from './tracing';

const span = (spanId: string, parentSpanId: string | null = null, input?: unknown): SpanRecord => ({
  traceId: 'trace',
  spanId,
  parentSpanId,
  name: spanId,
  spanType: SpanType.AGENT_RUN,
  isEvent: false,
  startedAt: new Date('2026-11-01'),
  input,
});
function source(rows: SpanRecord[], matches: string[] = []): TracePageSource {
  return {
    scopeKey: 'org/project/user',
    structure: async () => rows,
    spans: async (_, ids) => rows.filter(row => ids.includes(row.spanId)),
    search: async () => matches,
  };
}
async function drain(src: TracePageSource, first: TracePageResponse): Promise<TracePageResponse[]> {
  const pages = [first];
  while (pages.at(-1)!.nextCursor) {
    if (pages.length > 100) throw new Error('Continuation failed to progress');
    pages.push((await readTracePage(src, 'trace', { cursor: pages.at(-1)!.nextCursor! }))!);
  }
  return pages;
}

describe('bounded trace exploration', () => {
  it.each(['界'.repeat(4096), '\u0000'.repeat(4096)])(
    'rejects tokens whose serialized bytes could overflow the cursor %#',
    async readToken => {
      const ids = Array.from({ length: 100 }, (_, i) => '界'.repeat(125) + String(i).padStart(3, '0'));
      const src: TracePageSource = {
        ...source(ids.map(id => span(id))),
        context: async () => ({
          readToken,
          lowerEndedAt: '2026-11-01T00:00:00.000Z',
          upperEndedAt: '2026-11-01T00:00:00.000Z',
          roots: [],
        }),
      };
      await expect(readTracePage(src, 'trace', { readToken, spanIds: ids, limit: 1 })).rejects.toMatchObject({
        code: 'INVALID_REQUEST',
      });
      await expect(readTracePage(src, 'trace', { spanIds: ids, limit: 1 })).rejects.toMatchObject({
        name: 'Error',
        message: 'Invalid trace context returned by source',
      });
    },
  );
  it.each(['x'.repeat(4096), '界'.repeat(1365), '\u0000'.repeat(682)])(
    'keeps maximum-size ID cursors usable with a byte-bounded token %#',
    async readToken => {
      const ids = Array.from({ length: 100 }, (_, i) => '界'.repeat(125) + String(i).padStart(3, '0'));
      const src: TracePageSource = {
        ...source(ids.map(id => span(id))),
        context: async () => ({
          readToken,
          lowerEndedAt: '2026-11-01T00:00:00.000Z',
          upperEndedAt: '2026-11-01T00:00:00.000Z',
          roots: [],
        }),
      };
      const first = (await readTracePage(src, 'trace', { spanIds: ids, readToken, limit: 50 }))!;
      expect(first.nextCursor!.length).toBeLessThanOrEqual(60000);
      expect(tracePageRequestSchema.safeParse({ cursor: first.nextCursor }).success).toBe(true);
      expect((await drain(src, first)).flatMap(page => page.nodes.map(node => node.spanId))).toEqual(ids);
    },
  );

  it('classifies invalid requests, forged tokens, and invalid source context separately', async () => {
    const src = source([span('a'), span('b')]);
    await expect(readTracePage(src, 'trace', { limit: 201 })).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    await expect(readTracePage(src, 'trace', { readToken: '界'.repeat(4096) })).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    });
    const first = (await readTracePage(src, 'trace', { limit: 1 }))!;
    const forged = JSON.parse(Buffer.from(first.nextCursor!, 'base64url').toString());
    forged.selection.readToken = '界'.repeat(4096);
    await expect(
      readTracePage(src, 'trace', { cursor: Buffer.from(JSON.stringify(forged)).toString('base64url') }),
    ).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
    for (const readToken of ['界'.repeat(4096), '\u0000'.repeat(4096)]) {
      const invalidSource: TracePageSource = {
        ...src,
        context: async () => ({
          readToken,
          lowerEndedAt: '2026-11-01T00:00:00.000Z',
          upperEndedAt: '2026-11-01T00:00:00.000Z',
          roots: [],
        }),
      };
      await expect(readTracePage(invalidSource, 'trace', { mode: 'context' })).rejects.toMatchObject({
        name: 'Error',
        message: 'Invalid trace context returned by source',
      });
    }
  });

  it('ignores extra source columns when fingerprinting execution families', async () => {
    const rows = [span('a'), span('b')];
    const src = source(rows);
    let discovery = 0;
    src.structure = async () => rows.map(row => ({ ...row, adapterDebug: ++discovery }));
    const first = (await readTracePage(src, 'trace', { includeFamilySummary: true, limit: 1 }))!;
    const second = await readTracePage(src, 'trace', { cursor: first.nextCursor! });
    expect(second!.nodes.map(node => node.spanId)).toEqual(['b']);
  });

  it('invalidates a family-summary cursor when a new execution arrives outside the visible selection', async () => {
    const rows = [span('root'), span('other')];
    const src = source(rows);
    const first = (await readTracePage(src, 'trace', { depth: 0, limit: 1, includeFamilySummary: true }))!;
    rows.push({ ...span('resume', 'root'), resumedFromSpanId: 'root', startedAt: new Date('2026-11-02') });
    await expect(readTracePage(src, 'trace', { cursor: first.nextCursor! })).rejects.toMatchObject({
      code: 'TRACE_CHANGED',
    });
  });

  it('preserves an unavailable original and does not promote unrelated nested executions', async () => {
    const src = source([
      { ...span('resume', 'missing'), resumedFromSpanId: 'missing' },
      span('root'),
      { ...span('tool', 'root'), spanType: SpanType.TOOL_CALL },
      { ...span('nested', 'tool'), resumedFromSpanId: 'root' },
    ]);
    const result = (await readTracePage(src, 'trace', { flattenResumes: true, includeFamilySummary: true }))!;
    expect(result.nodes.find(node => node.spanId === 'resume')).toMatchObject({
      displayParentSpanId: 'missing',
      parentState: 'unavailable',
      familySummary: { originalAvailable: false },
    });
    expect(result.nodes.find(node => node.spanId === 'nested')).toMatchObject({ displayParentSpanId: 'tool' });
  });

  it('uses startedAt and identity ties for current execution, retaining null outcomes and counting summary bytes', async () => {
    const src = source([
      { ...span('a'), outcome: 'success' },
      { ...span('z', 'a'), resumedFromSpanId: 'a', outcome: null, outputPreview: 'x'.repeat(70000) },
    ]);
    const result = await readTracePage(src, 'trace', { depth: 0, includeFamilySummary: true });
    expect(result!.nodes[0]!.familySummary).toMatchObject({ currentSpanId: 'z', outcome: null });
    await expect(
      readTracePage(src, 'trace', { depth: 0, includeFamilySummary: true, maxBytes: 65536 }),
    ).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });

  it('flattens only resumed executions when requested, preserving nested invocation boundaries and raw parents', async () => {
    const rows = [
      span('root'),
      { ...span('resume', 'root'), resumedFromSpanId: 'root' },
      { ...span('tool', 'resume'), spanType: SpanType.TOOL_CALL },
      span('inner', 'tool'),
      { ...span('inner-resume', 'inner'), resumedFromSpanId: 'inner' },
      span('leaf', 'inner-resume'),
    ];
    const src = source(rows, ['leaf']);
    const normal = await readTracePage(src, 'trace', { depth: 0 });
    expect(normal!.nodes.map(node => node.spanId)).toEqual(['root']);
    expect(normal!.nodes[0]).toMatchObject({ executionFamilyId: 'root', childCount: 1 });
    const flat = await readTracePage(src, 'trace', { depth: 0, flattenResumes: true });
    expect(flat!.nodes.map(node => node.spanId).sort()).toEqual(['resume', 'root']);
    expect(flat!.nodes.find(node => node.spanId === 'resume')).toMatchObject({
      parentSpanId: 'root',
      displayParentSpanId: null,
      executionFamilyId: 'root',
    });
    const branch = await readTracePage(src, 'trace', { anchorSpanId: 'tool', depth: 1, flattenResumes: true });
    expect(branch!.nodes.map(node => node.spanId).sort()).toEqual(['inner', 'inner-resume', 'tool']);
    expect(branch!.nodes.find(node => node.spanId === 'inner-resume')).toMatchObject({
      parentSpanId: 'inner',
      displayParentSpanId: 'tool',
      executionFamilyId: 'inner',
    });
    const search = await readTracePage(src, 'trace', { search: 'leaf', flattenResumes: true });
    expect(search!.nodes.map(node => node.spanId)).toEqual(['resume', 'tool', 'inner-resume', 'leaf']);
    const hydrated = await readTracePage(src, 'trace', { spanIds: ['inner-resume', 'absent'], flattenResumes: true });
    expect(hydrated!.nodes[0]).toMatchObject({ parentSpanId: 'inner', displayParentSpanId: 'tool' });
    expect(hydrated!.missingSpanIds).toEqual(['absent']);
  });

  it('summarizes the whole execution family beyond the selected page without replacing original fields', async () => {
    const rows = [
      { ...span('root'), outcome: 'suspend', outputPreview: 'initial' },
      {
        ...span('resume', 'root'),
        resumedFromSpanId: 'root',
        startedAt: new Date('2026-11-02'),
        outcome: 'success',
        outputPreview: 'done',
      },
      { ...span('nested', 'resume'), startedAt: new Date('2026-11-03'), outcome: 'error', outputPreview: 'unrelated' },
    ];
    const src = source(rows);
    const result = await readTracePage(src, 'trace', { depth: 0, includeFamilySummary: true });
    expect(result!.nodes).toHaveLength(1);
    expect(result!.nodes[0]).toMatchObject({
      outcome: 'suspend',
      outputPreview: 'initial',
      executionFamilyId: 'root',
      familySummary: {
        initialSpanId: 'root',
        currentSpanId: 'resume',
        executionCount: 2,
        originalAvailable: true,
        outcome: 'success',
        outputPreview: 'done',
      },
    });
    const full = await readTracePage(src, 'trace', { spanIds: ['root'], include: 'full', includeFamilySummary: true });
    expect(full!.nodes[0]!.details).toMatchObject({ outcome: 'suspend', outputPreview: 'initial' });
    expect(full!.nodes[0]!.familySummary).toEqual(result!.nodes[0]!.familySummary);
  });

  it('returns context separately and carries its read token through continuation', async () => {
    const rows = [
      { ...span('root-a'), userId: 'a' },
      { ...span('root-b'), userId: 'b' },
    ];
    const context = {
      readToken: 'fixed-window',
      lowerEndedAt: '2026-11-01T00:00:00.000Z',
      upperEndedAt: '2026-11-02T00:00:00.000Z',
      roots: rows.map(row => ({ spanId: row.spanId, userId: row.userId })),
    };
    const src: TracePageSource = {
      ...source(rows),
      context: async (_, token, includeRoots) => {
        if (token && includeRoots) throw new Error('Root metadata must only be read when opening a snapshot');
        if (token && token !== context.readToken) throw new Error('Wrong window');
        return { ...context, roots: includeRoots ? context.roots : [] };
      },
    };
    const only = await readTracePage(src, 'trace', { mode: 'context' });
    expect(only!.nodes).toEqual([]);
    expect(only!.traceContext).toEqual(context);
    const pages = await drain(src, (await readTracePage(src, 'trace', { limit: 1 }))!);
    expect(pages[0]!.traceContext).toEqual(context);
    expect(pages[1]!.traceContext).toBeUndefined();
    for (const node of pages.flatMap(page => page.nodes)) expect(node).not.toHaveProperty('userId');
    const bounded = await readTracePage(src, 'trace', {
      readToken: context.readToken,
      spanIds: ['root-a'],
      include: 'full',
    });
    expect(bounded!.traceContext).toBeUndefined();
    expect(bounded!.nodes[0]!.details!.userId).toBe('a');
    expect(tracePageRequestSchema.safeParse({ mode: 'context', readToken: context.readToken }).success).toBe(false);
  });

  it('rejects oversized context without returning an oversized empty page', async () => {
    const src: TracePageSource = {
      ...source([]),
      context: async () => ({
        readToken: 'fixed',
        lowerEndedAt: '2026-11-01T00:00:00.000Z',
        upperEndedAt: '2026-11-02T00:00:00.000Z',
        roots: [{ spanId: 'root', tags: ['x'.repeat(70000)] }],
      }),
    };
    await expect(readTracePage(src, 'trace', { mode: 'context', maxBytes: 65536 })).rejects.toMatchObject({
      code: 'LIMIT_EXCEEDED',
    });
    await expect(readTracePage(src, 'trace', { maxBytes: 65536 })).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
  });

  it('omits scope and links from full details without charging their bytes to the page', async () => {
    const record = { ...span('root'), scope: { hidden: 'x'.repeat(70000) }, links: [{ hidden: 'y'.repeat(70000) }] };
    const page = await readTracePage(source([record]), 'trace', { include: 'full', maxBytes: 65536 });
    expect(page!.nodes[0]!.details).not.toHaveProperty('scope');
    expect(page!.nodes[0]!.details).not.toHaveProperty('links');
    expect(record).toHaveProperty('scope');
    expect(record).toHaveProperty('links');
  });

  it.each(['structure', 'full'] as const)(
    'preserves execution diagnostics in %s pages without requiring payload hydration',
    async include => {
      const diagnostics = {
        model: 'gpt-6.1-sol',
        provider: 'openai',
        outcome: 'failed',
        stopReason: 'max_steps',
        stopReasonContext: { maxSteps: 10 },
        errorCount: 0,
        externalParentSpanId: 'external',
        resumedFromSpanId: 'previous',
        timeToFirstChunkMs: 0,
        timeToFirstTokenMs: 12,
        inputPreview: 'question',
        outputPreview: '',
        errorPreview: 'limit reached',
      };
      const record = {
        ...span('root', null, { large: 'payload' }),
        createdAt: new Date('2026-11-01'),
        updatedAt: null,
        ...diagnostics,
      };
      const page = await readTracePage(source([record]), 'trace', { include });
      expect(tracePageResponseSchema.parse(page).nodes[0]).toMatchObject(diagnostics);
      if (include === 'full') expect(page!.nodes[0]!.details).toEqual(record);
      else expect(page!.nodes[0]).not.toHaveProperty('details');
      expect(page!.nodes[0]).not.toHaveProperty('input');
    },
  );

  it.each(['inputPreview', 'stopReasonContext'] as const)(
    'counts %s toward the structure page byte budget',
    async field => {
      const value = 'x'.repeat(40000);
      const diagnostics = { [field]: field === 'stopReasonContext' ? { reason: value } : value };
      const src = source([
        { ...span('a'), ...diagnostics },
        { ...span('b'), ...diagnostics },
      ]);
      const pages = await drain(src, (await readTracePage(src, 'trace', { maxBytes: 65536 }))!);
      expect(pages.map(page => page.nodes.map(node => node.spanId))).toEqual([['a'], ['b']]);
      for (const page of pages) expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThanOrEqual(65536);
    },
  );

  it('loads a shallow breadth-first tree with deterministic sibling ordering and discoverable children', async () => {
    const src = source([span('z', 'root'), span('root'), span('deep', 'a'), span('a', 'root')]);
    const pages = await drain(src, (await readTracePage(src, 'trace', { depth: 1, limit: 2 }))!);
    expect(pages.flatMap(page => page.nodes.map(node => node.spanId))).toEqual(['root', 'a', 'z']);
    expect(pages[0]!.nodes[1]).toMatchObject({ childCount: 1 });
    expect(pages.at(-1)!.nextCursor).toBeUndefined();
    expect(pages[0]).not.toHaveProperty('version');
  });

  it('finds an unloaded deep match and continues its ancestor path across strict total node limits', async () => {
    const src = source(
      [span('root'), span('a', 'root'), span('b', 'a'), span('match', 'b'), span('other', 'root')],
      ['match'],
    );
    const pages = await drain(src, (await readTracePage(src, 'trace', { search: 'timeout', limit: 1 }))!);
    expect(pages.flatMap(page => page.nodes.map(node => [node.spanId, node.match]))).toEqual([
      ['root', false],
      ['a', false],
      ['b', false],
      ['match', true],
    ]);
    expect(pages.map(page => page.ancestorPaths)).toEqual(['continued', 'continued', 'continued', 'complete']);
  });

  it('deduplicates shared ancestors and distinguishes an unavailable parent from a root', async () => {
    const src = source([span('root', 'missing'), span('a', 'root'), span('b', 'root')], ['a', 'b']);
    const pages = await drain(src, (await readTracePage(src, 'trace', { search: 'error', limit: 2 }))!);
    expect(pages.flatMap(page => page.nodes.map(node => node.spanId))).toEqual(['root', 'a', 'b']);
    expect(pages[0]!.nodes[0]!.parentState).toBe('unavailable');
    expect(pages.at(-1)!.ancestorPaths).toBe('unavailable');
  });

  it('hydrates only explicit IDs, reports missing IDs, and preserves requested order across pages', async () => {
    const src = source([span('root'), span('a', 'root', { answer: 42 }), span('b', 'a')]);
    src.structure = async () => {
      throw new Error('Explicit IDs must not load topology');
    };

    const pages = await drain(
      src,
      (await readTracePage(src, 'trace', {
        spanIds: ['b', 'absent', 'a', 'b'],
        include: 'full',
        limit: 1,
      }))!,
    );
    expect(pages.flatMap(page => page.nodes.map(node => node.spanId))).toEqual(['b', 'a']);
    expect(pages[0]!.missingSpanIds).toEqual([]);
    expect(pages[1]!.missingSpanIds).toEqual(['absent']);
    expect(pages[1]!.nodes).toEqual([]);
    expect(pages[2]!.nodes[0]!.details?.input).toEqual({ answer: 42 });
    expect(pages[0]!.nodes[0]!.details?.spanId).toBe('b');
  });

  it('continues at the first unreturned payload when the byte budget fills', async () => {
    const src = source([span('a', null, 'x'.repeat(40000)), span('b', null, 'y'.repeat(40000))]);
    const pages = await drain(src, (await readTracePage(src, 'trace', { include: 'full', maxBytes: 65536 }))!);
    expect(pages.map(page => page.nodes.map(node => node.spanId))).toEqual([['a'], ['b']]);
    for (const page of pages) expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThanOrEqual(65536);
  });

  it('gives an actionable error for one oversized payload rather than a cursor that never advances', async () => {
    const src = source([span('a', null, 'x'.repeat(70000))]);
    await expect(readTracePage(src, 'trace', { include: 'full', maxBytes: 65536 })).rejects.toMatchObject({
      code: 'PAYLOAD_TOO_LARGE',
    });
    const structure = await readTracePage(src, 'trace', { maxBytes: 65536 });
    expect(structure!.nodes[0]!.details).toBeUndefined();
    expect(JSON.stringify(structure)).not.toContain('xxxxx');
  });

  it('rejects scope changes and late arrivals even when root activity is unchanged', async () => {
    const rows = [span('a'), span('b')];
    const src = source(rows);
    const first = (await readTracePage(src, 'trace', { limit: 1 }))!;
    const request = { cursor: first.nextCursor! };
    await expect(readTracePage({ ...src, scopeKey: 'another/org' }, 'trace', request)).rejects.toMatchObject({
      code: 'TRACE_CHANGED',
    });
    rows.push(span('aa'));
    await expect(readTracePage(src, 'trace', request)).rejects.toMatchObject({ code: 'TRACE_CHANGED' });
  });

  it('rejects cyclic topology and malformed or conflicting continuation requests', async () => {
    await expect(readTracePage(source([span('a', 'b'), span('b', 'a')]), 'trace', {})).rejects.toMatchObject({
      code: 'INVALID_TOPOLOGY',
    });
    await expect(readTracePage(source([]), 'trace', { cursor: 'bad' })).rejects.toMatchObject({
      code: 'INVALID_CURSOR',
    });
    expect(tracePageRequestSchema.safeParse({ cursor: 'cursor', include: 'full' }).success).toBe(false);
    expect(tracePageRequestSchema.safeParse({ spanIds: ['a'], depth: 2 }).success).toBe(false);
    expect(tracePageRequestSchema.safeParse({ search: 'foo', depth: 2 }).success).toBe(false);
  });
  it('can continue a maximum-size batch of multibyte identifiers', async () => {
    const ids = Array.from({ length: 100 }, (_, i) => '界'.repeat(125) + String(i));
    const src = source(ids.map(id => span(id)));
    const first = (await readTracePage(src, 'trace', { spanIds: ids, limit: 1 }))!;
    expect(first.nextCursor!.length).toBeLessThanOrEqual(60000);
    expect(Buffer.byteLength(JSON.stringify({ cursor: first.nextCursor }))).toBeLessThan(65536);
    const second = await readTracePage(src, 'trace', { cursor: first.nextCursor! });
    expect(second!.nodes[0]!.spanId).toBe(ids[1]);
  });
});

describe('trace page request boundaries', () => {
  it('accepts exactly 50000 topology rows and rejects the overflow sentinel', async () => {
    const rows = Array.from({ length: 50000 }, (_, i) => span(String(i).padStart(5, '0')));
    const page = (await readTracePage(source(rows), 'trace', { limit: 1 }))!;
    expect(page.nodes.map(node => node.spanId)).toEqual(['00000']);
    expect(page.nextCursor).toBeTruthy();
    rows.push(span('50000'));
    await expect(readTracePage(source(rows), 'trace', { limit: 1 })).rejects.toMatchObject({
      code: 'LIMIT_EXCEEDED',
    });
  });

  it.each([{ limit: 201 }, { maxBytes: 4194305 }])('rejects request budgets above the cap: %j', request => {
    expect(tracePageRequestSchema.safeParse(request).success).toBe(false);
  });
  it('accepts the maximum request budgets', () => {
    expect(tracePageRequestSchema.safeParse({ limit: 200, maxBytes: 4194304 }).success).toBe(true);
  });

  it.each([true, false])('requires search when ancestors is %s, including in cursors', async ancestors => {
    const src = source([span('a'), span('b', 'a')], ['b']);
    expect(tracePageRequestSchema.safeParse({ ancestors }).success).toBe(false);
    const page = (await readTracePage(src, 'trace', { limit: 1 }))!;
    const cursor = JSON.parse(Buffer.from(page.nextCursor!, 'base64url').toString());
    cursor.selection.ancestors = ancestors;
    await expect(
      readTracePage(src, 'trace', { cursor: Buffer.from(JSON.stringify(cursor)).toString('base64url') }),
    ).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
    const search = (await readTracePage(src, 'trace', { search: 'error', ancestors }))!;
    expect(search.nodes.map(node => node.spanId)).toEqual(ancestors ? ['a', 'b'] : ['b']);
    expect(search.ancestorPaths).toBe(ancestors ? 'complete' : 'not-requested');
  });

  it.each([{ limit: 1000 }, { maxBytes: 4194305 }, { spanIds: ['a', 'b'], search: 'error' }])(
    'revalidates selection in a forged cursor: %j',
    async changes => {
      const src = source([span('a'), span('b')]);
      const page = (await readTracePage(src, 'trace', { spanIds: ['a', 'b'], limit: 1 }))!;
      const cursor = JSON.parse(Buffer.from(page.nextCursor!, 'base64url').toString());
      Object.assign(cursor.selection, changes);
      // Even a recomputed fingerprint cannot authorize invalid selection or budgets.
      cursor.fingerprint = createHash('sha256')
        .update(JSON.stringify([src.scopeKey, 'trace', cursor.selection]))
        .digest('hex');
      await expect(
        readTracePage(src, 'trace', { cursor: Buffer.from(JSON.stringify(cursor)).toString('base64url') }),
      ).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
    },
  );

  it.each([0, -1, 1.5, 2, 3, 50001])('rejects a cursor offset outside the selection: %s', async offset => {
    const src = source([span('a'), span('b')]);
    const page = (await readTracePage(src, 'trace', { spanIds: ['a', 'b'], limit: 1 }))!;
    const cursor = JSON.parse(Buffer.from(page.nextCursor!, 'base64url').toString());
    cursor.offset = offset;
    await expect(
      readTracePage(src, 'trace', { cursor: Buffer.from(JSON.stringify(cursor)).toString('base64url') }),
    ).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
  });

  it('rejects non-base64url characters even when the decoder would ignore them', async () => {
    const src = source([span('a'), span('b')]);
    const page = (await readTracePage(src, 'trace', { limit: 1 }))!;
    await expect(readTracePage(src, 'trace', { cursor: `${page.nextCursor!}\n` })).rejects.toMatchObject({
      code: 'INVALID_CURSOR',
    });
  });

  it('limits cursor text before decoding an otherwise valid JSON continuation', async () => {
    const src = source([span('a'), span('b')]);
    const page = (await readTracePage(src, 'trace', { limit: 1 }))!;
    const json = Buffer.from(page.nextCursor!, 'base64url').toString();
    const cursor = Buffer.from(json + ' '.repeat(45001)).toString('base64url');
    expect(cursor.length).toBeGreaterThan(60000);
    await expect(readTracePage(src, 'trace', { cursor })).rejects.toThrow();
    expect(tracePageRequestSchema.safeParse({ cursor: 'a'.repeat(60000) }).success).toBe(true);
    expect(tracePageRequestSchema.safeParse({ cursor: 'a'.repeat(60001) }).success).toBe(false);
  });

  it('requires a restart if a selected span disappears during hydration', async () => {
    const src = source([span('a'), span('b')]);
    const readSpans = src.spans;
    src.spans = async (...args) => (await readSpans(...args)).filter(row => row.spanId !== 'b');
    await expect(readTracePage(src, 'trace', {})).rejects.toMatchObject({ code: 'TRACE_CHANGED' });
  });
});

it.each(['browse', 'hydrate', 'search', 'context'] as const)(
  'accounts for exact UTF-8 and JSON byte boundaries in %s pages',
  async mode => {
    const rows = [span('a', null, '界"\n'.repeat(4000)), span('b', 'a', '界"\n'.repeat(4000))];
    const src = source(rows, ['b']);
    if (mode === 'context')
      src.context = async () => ({
        readToken: 'window',
        lowerEndedAt: '2026-11-01T00:00:00.000Z',
        upperEndedAt: '2026-11-01T00:00:00.000Z',
        roots: [{ spanId: 'a', tags: ['界"\n'.repeat(500)] }],
      });
    const selection =
      mode === 'hydrate' ? { spanIds: ['missing"界', 'a', 'b'] } : mode === 'search' ? { search: 'error' } : {};
    const request = { ...selection, include: 'full' as const, maxBytes: 65536 };
    const sample = (await readTracePage(src, 'trace', request))!;
    rows[0]!.input += 'x'.repeat(65536 - Buffer.byteLength(JSON.stringify(sample)));
    const exact = (await readTracePage(src, 'trace', request))!;
    expect(Buffer.byteLength(JSON.stringify(exact))).toBe(65536);
    expect(exact.nodes.map(node => node.spanId)).toEqual(['a', 'b']);
    expect(exact.nextCursor).toBeUndefined();

    rows[0]!.input += 'x';
    const pages = await drain(src, (await readTracePage(src, 'trace', request))!);
    expect(pages).toHaveLength(2);
    expect(pages.flatMap(page => page.nodes.map(node => node.spanId))).toEqual(['a', 'b']);
    expect(pages.flatMap(page => page.missingSpanIds)).toEqual(mode === 'hydrate' ? ['missing"界'] : []);
    for (const page of pages) expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThanOrEqual(65536);
    if (mode === 'search') expect(pages.map(page => page.ancestorPaths)).toEqual(['continued', 'complete']);
  },
);

it('reads each explicit ID only on its own page and survives unrelated arrivals', async () => {
  const rows = Array.from({ length: 100 }, (_, i) => span(String(i), null, 'large payload'));
  let reads = 0;
  const src = source(rows);
  src.spans = async (_, ids, projection) => {
    expect(ids).toHaveLength(1);
    expect(projection).toBe('full');
    reads += ids.length;
    return rows.filter(row => ids.includes(row.spanId));
  };
  const first = (await readTracePage(src, 'trace', {
    spanIds: rows.map(row => row.spanId),
    limit: 1,
    include: 'full',
  }))!;
  rows.push(span('unrelated'));
  const pages = await drain(src, first);
  expect(reads).toBe(100);
  expect(pages.flatMap(page => page.nodes)).toHaveLength(100);
});

it('continues an anchored subtree through unrelated arrivals but rejects relevant changes', async () => {
  const rows = [span('root'), span('a', 'root'), span('b', 'a'), span('other', 'root')];
  const src = source(rows);
  const first = (await readTracePage(src, 'trace', { anchorSpanId: 'a', limit: 1 }))!;
  rows.push(span('unrelated', 'other'));
  expect((await readTracePage(src, 'trace', { cursor: first.nextCursor! }))!.nodes[0]!.spanId).toBe('b');
  rows.push(span('new-child', 'a'));
  await expect(readTracePage(src, 'trace', { cursor: first.nextCursor! })).rejects.toMatchObject({
    code: 'TRACE_CHANGED',
  });
});

it('requests only topology columns then page summaries for structure browsing', async () => {
  const rows = [span('a'), span('b')];
  const src = source(rows);
  src.structure = async (_, limit) => {
    expect(limit).toBe(50001);
    return rows.map(({ traceId, spanId, parentSpanId, startedAt, spanType, resumedFromSpanId }) => ({
      traceId,
      spanId,
      parentSpanId,
      startedAt,
      spanType,
      resumedFromSpanId,
    }));
  };
  src.spans = async (_, ids, include) => {
    expect(ids).toEqual(['a']);
    expect(include).toBe('structure');
    return rows.filter(row => ids.includes(row.spanId));
  };
  expect((await readTracePage(src, 'trace', { limit: 1 }))!.nodes[0]!.name).toBe('a');
});

it('continues explicit IDs across a response byte boundary without skipping unread payloads', async () => {
  const src = source([span('a', null, 'x'.repeat(40000)), span('b', null, 'y'.repeat(40000))]);
  const pages = await drain(
    src,
    (await readTracePage(src, 'trace', { spanIds: ['absent', 'a', 'b'], include: 'full', maxBytes: 65536 }))!,
  );
  expect(pages.flatMap(page => page.nodes.map(node => node.spanId))).toEqual(['a', 'b']);
  expect(pages.flatMap(page => page.missingSpanIds)).toEqual(['absent']);
});
