import {
  parseTraceAggregateRequest,
  parseTraceQueryRequest,
  planTraceAggregate,
  planTraceQuery,
} from '@mastra/core/storage';
import type { TraceQueryTenantScope } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DuckDBConnection } from '../../db/index';
import { SPAN_EVENTS_DDL } from './ddl';
import { aggregateTraces } from './trace-aggregate';
import { compileDuckDBTraceQuery, queryTraces } from './trace-query';

const timeRange = { from: '2026-01-01T00:00:00.000Z', to: '2026-01-02T00:00:00.000Z' };

function narrowingScan(sql: string): string {
  const match = sql.match(/root_trace_ids AS \(([\s\S]*?)\n    \),/);
  if (!match) throw new Error('Expected a root_trace_ids narrowing scan');
  return match[1]!;
}

describe('DuckDB trace root pushdown', () => {
  it('pushes root-column conjuncts into the narrowing scan and keeps the full where on candidates', () => {
    const compiled = compileDuckDBTraceQuery(
      planTraceQuery(
        parseTraceQueryRequest({
          timeRange,
          where: {
            op: 'and',
            args: [
              { op: 'eq', left: { path: 'environment' }, right: { literal: 'prod' } },
              { op: 'in', value: { path: 'threadId' }, set: ['thread-1', 'thread-2'] },
              { op: 'eq', left: { path: 'metadata.tenant' }, right: { literal: 'acme' } },
              { op: 'eq', left: { path: 'status' }, right: { literal: 'error' } },
              { op: 'includes', path: 'tags', value: 'beta' },
              { spans: { some: { op: 'eq', left: { path: 'spanType' }, right: { literal: 'tool_call' } } } },
            ],
          },
        }),
        { scope: { organizationId: 'org-a' } },
      ),
    );

    const scan = narrowingScan(compiled.sql);
    expect(scan).toContain('FROM span_events r');
    expect(scan).toContain('r.parentSpanId IS NULL');
    expect(scan).toContain('r.timestamp >= CAST(? AS TIMESTAMP) AND r.timestamp < CAST(? AS TIMESTAMP)');
    expect(scan).toContain('r.endedAt IS NOT NULL');
    expect(scan).toContain('r.organizationId = ?');
    expect(scan).toContain('r.environment IS NOT DISTINCT FROM ?');
    expect(scan).toContain('r.threadId');
    expect(scan).not.toContain('metadata');
    expect(scan).not.toContain("'error'");
    expect(scan).not.toContain('tags');
    expect(scan).not.toContain('EXISTS');
    expect(compiled.sql).toContain('AND traceId IN (SELECT traceId FROM root_trace_ids)');
    expect(compiled.sql).toMatch(/candidates AS \([\s\S]*?r\.environment IS NOT DISTINCT FROM \?/);
    expect(compiled.values.slice(0, 6)).toEqual([
      timeRange.from,
      timeRange.to,
      'org-a',
      'prod',
      'thread-1',
      'thread-2',
    ]);
    expect(compiled.sql.match(/\?/g)).toHaveLength(compiled.values.length);
  });

  it('pushes nothing from a top-level or, but still narrows by window and tenant', () => {
    const compiled = compileDuckDBTraceQuery(
      planTraceQuery(
        parseTraceQueryRequest({
          timeRange,
          where: {
            op: 'or',
            args: [
              { op: 'eq', left: { path: 'environment' }, right: { literal: 'prod' } },
              { op: 'eq', left: { path: 'metadata.tenant' }, right: { literal: 'acme' } },
            ],
          },
        }),
      ),
    );

    const scan = narrowingScan(compiled.sql);
    expect(scan).toContain('r.timestamp >= CAST(? AS TIMESTAMP)');
    expect(scan).not.toContain('environment');
    expect(compiled.values.slice(0, 4)).toEqual([timeRange.from, timeRange.to, timeRange.from, timeRange.to]);
  });

  describe('execution', () => {
    let db: DuckDBConnection;
    let cursorId: number;

    beforeEach(async () => {
      db = new DuckDBConnection({ path: ':memory:' });
      cursorId = 0;
      await db.execute(SPAN_EVENTS_DDL);
    });
    afterEach(async () => db.close());

    /** Writes one completed version of a trace's root span; later versions supersede earlier ones. */
    async function rootVersion(
      traceId: string,
      fields: { environment?: string; organizationId?: string; startedAt?: string } = {},
    ) {
      const startedAt = fields.startedAt ?? '2026-01-01T10:00:00.000Z';
      const endedAt = new Date(Date.parse(startedAt) + 60_000).toISOString();
      for (const [eventType, timestamp] of [
        ['start', startedAt],
        ['end', endedAt],
      ] as const) {
        await db.execute(
          `INSERT INTO span_events (eventType, timestamp, cursorId, traceId, spanId, parentSpanId, name, spanType, isEvent, endedAt, environment, organizationId)
           VALUES (?, CAST(? AS TIMESTAMP), ?, ?, 'root', NULL, 'run', 'agent_run', false, CAST(? AS TIMESTAMP), ?, ?)`,
          [
            eventType,
            timestamp,
            ++cursorId,
            traceId,
            eventType === 'end' ? endedAt : null,
            fields.environment ?? null,
            fields.organizationId ?? null,
          ],
        );
      }
    }

    async function selected(where?: Record<string, unknown>, scope?: TraceQueryTenantScope) {
      const query = await queryTraces(
        db,
        planTraceQuery(parseTraceQueryRequest({ timeRange, where, pagination: { page: 0, perPage: 100 } }), {
          scope,
        }),
      );
      if (!('pagination' in query)) throw new Error('Expected a numbered page');
      const aggregate = await aggregateTraces(
        db,
        planTraceAggregate(parseTraceAggregateRequest({ timeRange, where, measures: ['count'] }), { scope }),
      );
      const traceIds = query.traces.map(trace => trace.traceId).sort();
      expect(aggregate.rows).toEqual(traceIds.length ? [{ measures: { count: traceIds.length } }] : []);
      expect(query.pagination.total).toBe(traceIds.length);
      return traceIds;
    }

    it('judges a pushed filter by the current root, not a superseded one', async () => {
      await rootVersion('superseded-match', { environment: 'prod' });
      await rootVersion('superseded-match', { environment: 'staging' });
      await rootVersion('current-match', { environment: 'staging' });
      await rootVersion('current-match', { environment: 'prod' });

      expect(await selected({ op: 'eq', left: { path: 'environment' }, right: { literal: 'prod' } })).toEqual([
        'current-match',
      ]);
      expect(await selected({ op: 'ne', left: { path: 'environment' }, right: { literal: 'prod' } })).toEqual([
        'superseded-match',
      ]);
    });

    it('judges the tenant scope by the current root, not a superseded one', async () => {
      await rootVersion('superseded-match', { organizationId: 'org-a' });
      await rootVersion('superseded-match', { organizationId: 'org-b' });
      await rootVersion('current-match', { organizationId: 'org-b' });
      await rootVersion('current-match', { organizationId: 'org-a' });

      expect(await selected(undefined, { organizationId: 'org-a' })).toEqual(['current-match']);
    });

    it('judges the time window by the current root, not a superseded one', async () => {
      await rootVersion('superseded-match', { startedAt: '2026-01-01T10:00:00.000Z' });
      await rootVersion('superseded-match', { startedAt: '2026-01-03T10:00:00.000Z' });
      await rootVersion('current-match', { startedAt: '2025-12-30T10:00:00.000Z' });
      await rootVersion('current-match', { startedAt: '2026-01-01T10:00:00.000Z' });

      expect(await selected()).toEqual(['current-match']);
    });
  });
});
