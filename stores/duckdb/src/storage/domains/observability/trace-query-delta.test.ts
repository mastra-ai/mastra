import { coreFeatures } from '@mastra/core/features';
import { encodeTraceQueryDeltaCursor, parseTraceQueryRequest, planTraceQuery } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DuckDBConnection } from '../../db/index';
import { SPAN_EVENTS_DDL } from './ddl';
import { queryTraces } from './trace-query';

const timeRange = { from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z' };
const makePlan = (input: Record<string, unknown>) => planTraceQuery(parseTraceQueryRequest({ timeRange, ...input }));

describe('DuckDB trace query delta execution', () => {
  let db: DuckDBConnection;
  let cursorId: number;
  beforeEach(async () => {
    db = new DuckDBConnection({ path: ':memory:' });
    cursorId = 0;
    await db.execute(SPAN_EVENTS_DDL);
  });
  afterEach(async () => db.close());

  async function event(traceId: string, eventType: 'start' | 'end', parentSpanId: string | null = null) {
    const timestamp = eventType === 'start' ? '2026-01-01T10:00:00Z' : '2026-01-01T11:00:00Z';
    await db.execute(
      `INSERT INTO span_events (eventType, timestamp, cursorId, traceId, spanId, parentSpanId, name, spanType, isEvent, endedAt)
       VALUES (?, CAST(? AS TIMESTAMP), ?, ?, ?, ?, 'run', 'agent_run', false, CAST(? AS TIMESTAMP))`,
      [
        eventType,
        timestamp,
        ++cursorId,
        traceId,
        parentSpanId ? 'child' : 'root',
        parentSpanId,
        eventType === 'end' ? timestamp : null,
      ],
    );
  }

  it('hands an empty numbered page off to completion polling, preserving ties and lookahead', async () => {
    await event('a', 'start');
    const page = await queryTraces(db, makePlan({ pagination: { page: 0, perPage: 10 } }));
    expect(page).toMatchObject({ traces: [], pagination: { total: 0 }, deltaCursor: expect.any(String) });
    if (!('deltaCursor' in page)) throw new Error('Expected numbered cursor');
    await event('a', 'end');
    await event('b', 'start');
    await event('b', 'end');
    const first = await queryTraces(db, makePlan({ mode: 'delta', after: page.deltaCursor, limit: 1 }));
    expect(first).toMatchObject({ traces: [{ traceId: 'a' }], delta: { limit: 1, hasMore: true } });
    if (!('deltaCursor' in first)) throw new Error('Expected delta cursor');
    const second = await queryTraces(db, makePlan({ mode: 'delta', after: first.deltaCursor, limit: 1 }));
    expect(second).toMatchObject({ traces: [{ traceId: 'b' }], delta: { hasMore: false } });
    if (!('deltaCursor' in second)) throw new Error('Expected delta cursor');
    const empty = await queryTraces(db, makePlan({ mode: 'delta', after: second.deltaCursor }));
    expect(empty).toMatchObject({ traces: [], delta: { hasMore: false }, deltaCursor: second.deltaCursor });
  });

  it('bootstraps at the head and ignores child-only updates', async () => {
    await event('a', 'start');
    await event('a', 'end');
    const initial = await queryTraces(db, makePlan({ mode: 'delta' }));
    expect(initial).toMatchObject({ traces: [], delta: { hasMore: false } });
    if (!('deltaCursor' in initial)) throw new Error('Expected delta cursor');
    await event('a', 'start', 'root');
    await event('a', 'end', 'root');
    expect(await queryTraces(db, makePlan({ mode: 'delta', after: initial.deltaCursor }))).toMatchObject({
      traces: [],
    });
  });

  it('applies recursive predicates before lookahead and advances past nonmatching roots', async () => {
    const where = { op: 'not', arg: { op: 'eq', left: { path: 'traceId' }, right: { literal: 'excluded' } } };
    const initial = await queryTraces(db, makePlan({ mode: 'delta', where }));
    if (!('deltaCursor' in initial)) throw new Error('Expected delta cursor');
    await event('excluded', 'start');
    await event('excluded', 'end');
    const empty = await queryTraces(db, makePlan({ mode: 'delta', where, after: initial.deltaCursor, limit: 1 }));
    expect(empty).toMatchObject({ traces: [], delta: { hasMore: false } });
    if (!('deltaCursor' in empty)) throw new Error('Expected delta cursor');
    expect(empty.deltaCursor).not.toEqual(initial.deltaCursor);
    await event('included', 'start');
    await event('included', 'end');
    expect(await queryTraces(db, makePlan({ mode: 'delta', where, after: empty.deltaCursor, limit: 1 }))).toMatchObject(
      {
        traces: [{ traceId: 'included' }],
        delta: { hasMore: false },
      },
    );
  });

  it('coalesces repeated root writes before applying the batch limit', async () => {
    const initial = await queryTraces(db, makePlan({ mode: 'delta' }));
    if (!('deltaCursor' in initial)) throw new Error('Expected delta cursor');
    await event('a', 'start');
    await event('a', 'end');
    await event('a', 'start');
    await event('a', 'end');
    expect(await queryTraces(db, makePlan({ mode: 'delta', after: initial.deltaCursor, limit: 1 }))).toMatchObject({
      traces: [{ traceId: 'a' }],
      delta: { hasMore: false },
    });
  });

  it('rejects foreign adapters and malformed native watermarks before querying', async () => {
    const initial = makePlan({ mode: 'delta' });
    if (initial.paginationMode !== 'delta') throw new Error('Expected delta plan');
    for (const [adapter, watermark] of [
      ['pg', '1'],
      ['duckdb', 'invalid'],
      ['duckdb', '9223372036854775808'],
    ]) {
      const after = encodeTraceQueryDeltaCursor(initial, adapter!, watermark!);
      await expect(queryTraces(db, makePlan({ mode: 'delta', after }))).rejects.toThrow();
    }
  });

  it('preserves feature gating and omits numbered cursors when disabled', async () => {
    const enabled = coreFeatures.has('observability-delta-polling');
    coreFeatures.delete('observability-delta-polling');
    try {
      await expect(queryTraces(db, makePlan({ mode: 'delta' }))).rejects.toThrow('does not support');
      expect(await queryTraces(db, makePlan({ pagination: { page: 0, perPage: 10 } }))).not.toHaveProperty(
        'deltaCursor',
      );
    } finally {
      if (enabled) coreFeatures.add('observability-delta-polling');
    }
  });
});
