import { coreFeatures } from '@mastra/core/features';
import {
  encodeTraceQueryCursor,
  encodeTraceQueryDeltaCursor,
  getTraceQueryDeltaWatermark,
  parseQueryThreadsInput,
  parseTraceQueryRequest,
  planThreadQuery,
  planTraceQuery,
  TraceQueryExecutionError,
  TraceQueryResourceLimitError,
} from '@mastra/core/storage';
import type { TraceQueryResponse, TrustedThreadQueryPlan, TrustedTraceQueryPlan } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DbClient } from '../../../client';
import { compilePostgresThreadQuery, compilePostgresTraceQuery, queryThreads, queryTraces } from './trace-query';
import { ObservabilityStoragePostgresVNext } from '.';

const TIME_RANGE = { from: '2026-01-01T00:00:00.000Z', to: '2026-01-02T00:00:00.000Z' };

function plan(input: Record<string, unknown> = {}): TrustedTraceQueryPlan {
  return planTraceQuery(parseTraceQueryRequest({ timeRange: TIME_RANGE, ...input }));
}

function threadPlan(input: Record<string, unknown> = {}): TrustedThreadQueryPlan {
  return planThreadQuery(parseQueryThreadsInput({ traces: { timeRange: TIME_RANGE }, ...input }));
}

describe('Postgres advanced trace query', () => {
  let wasEnabled: boolean;
  beforeEach(() => {
    wasEnabled = coreFeatures.has('observability-delta-polling');
    coreFeatures.delete('observability-delta-polling');
  });
  afterEach(() => {
    if (wasEnabled) coreFeatures.add('observability-delta-polling');
    vi.restoreAllMocks();
  });
  it('rejects invalid trace-query timeout configuration at construction', () => {
    expect(
      () =>
        new ObservabilityStoragePostgresVNext({
          client: {} as DbClient,
          traceQueryTimeoutMs: Number.POSITIVE_INFINITY,
        }),
    ).toThrow('traceQueryTimeoutMs must be an integer between');
  });

  it('parameterizes literals and compiles one correlated existence check per collection clause', () => {
    const compiled = compilePostgresTraceQuery(
      'custom',
      plan({
        where: {
          scores: {
            some: {
              op: 'and',
              args: [
                { op: 'eq', left: { path: 'scorerId' }, right: { literal: "factuality' OR TRUE --" } },
                { op: 'eq', left: { path: 'scorerVersion' }, right: { literal: 'v2' } },
                { op: 'in', value: { path: 'scoreSource' }, set: ['automated'] },
                {
                  op: 'gte',
                  left: { path: 'timestamp' },
                  right: { literal: '2026-01-01T06:00:00-06:00' },
                },
                { op: 'lt', left: { path: 'score' }, right: { literal: 0.6 } },
                { op: 'exists', path: 'spanId' },
                { op: 'eq', left: { path: 'entityVersionId' }, right: { literal: 'entity-v2' } },
                { op: 'exists', path: 'parentEntityVersionId' },
                { op: 'notIn', value: { path: 'rootEntityVersionId' }, set: ['root-v2'] },
              ],
            },
          },
        },
      }),
    );

    expect(compiled.text).not.toContain("factuality' OR TRUE --");
    expect(compiled.values).toContain("factuality' OR TRUE --");
    expect(compiled.text).toContain(`current_scores AS MATERIALIZED (
    SELECT
      s."traceId",
      s."spanId",
      s."timestamp",
      s."scorerId",
      s."scorerVersion",
      s."scoreSource",
      s."score",
      s."entityVersionId",
      s."parentEntityVersionId",
      s."rootEntityVersionId"
    FROM`);
    expect(compiled.text.match(/EXISTS \(/g)).toHaveLength(3);
    expect(compiled.text).toContain('s."traceId" = r."traceId"');
    expect(compiled.text).toContain('SELECT 1 FROM "custom"."mastra_score_events" newer');
    expect(compiled.text).toContain('newer."scoreId" = s."scoreId"');
    expect(compiled.text).toContain('newer."cursorId" > s."cursorId"');
    expect(compiled.text).toContain('s."scorerVersion" IS NOT DISTINCT FROM');
    expect(compiled.text).toContain('s."scoreSource" IS NOT NULL');
    expect(compiled.text).toContain('s."timestamp" IS NOT NULL AND s."timestamp" >=');
    expect(compiled.text).toContain('s."spanId" IS NOT NULL');
    expect(compiled.text).toContain('s."entityVersionId" IS NOT DISTINCT FROM');
    expect(compiled.text).toContain('s."parentEntityVersionId" IS NOT NULL');
    expect(compiled.text).toContain('s."rootEntityVersionId" IS NULL OR s."rootEntityVersionId" NOT IN');
    expect(compiled.values).toContain('2026-01-01T12:00:00.000Z');
  });

  it('projects canonical span values and compiles one richer same-span existence check', () => {
    const compiled = compilePostgresTraceQuery(
      'public',
      plan({
        where: {
          spans: {
            some: {
              op: 'and',
              args: [
                { op: 'eq', left: { path: 'name' }, right: { literal: 'medication_lookup' } },
                { op: 'eq', left: { path: 'model' }, right: { literal: 'claude-sonnet-4-6' } },
                { op: 'eq', left: { path: 'provider' }, right: { literal: 'anthropic' } },
                {
                  op: 'gte',
                  left: { path: 'startedAt' },
                  right: { literal: '2026-01-01T06:00:00-06:00' },
                },
                { op: 'gt', left: { path: 'durationMs' }, right: { literal: 5000 } },
                { op: 'eq', left: { path: 'status' }, right: { literal: 'success' } },
                { op: 'exists', path: 'entityVersionId' },
              ],
            },
          },
        },
      }),
    );

    expect(compiled.text.match(/FROM current_spans s/g)).toHaveLength(1);
    expect(compiled.text).toContain(`jsonb_typeof(s."attributes" -> 'model') = 'string'`);
    expect(compiled.text).toContain(`jsonb_typeof(s."attributes" -> 'provider') = 'string'`);
    expect(compiled.text).toContain(`EXTRACT(EPOCH FROM (s."endedAt" - s."startedAt")) * 1000`);
    expect(compiled.text).toContain(`CASE WHEN s."error" IS NOT NULL THEN 'error' ELSE 'success' END AS "status"`);
    expect(compiled.text).toContain('s."name" IS NOT DISTINCT FROM');
    expect(compiled.text).toContain('s."model" IS NOT DISTINCT FROM');
    expect(compiled.text).toContain('s."provider" IS NOT DISTINCT FROM');
    expect(compiled.text).toContain('s."status" IS NOT DISTINCT FROM');
    expect(compiled.text).toContain('s."startedAt" IS NOT NULL AND s."startedAt" >=');
    expect(compiled.text).toContain('s."durationMs" IS NOT NULL AND s."durationMs" >');
    expect(compiled.text).toContain('s."entityVersionId" IS NOT NULL');
    expect(compiled.values).toEqual(
      expect.arrayContaining([
        'medication_lookup',
        'claude-sonnet-4-6',
        'anthropic',
        '2026-01-01T12:00:00.000Z',
        5000,
        'success',
      ]),
    );
  });

  it('parameterizes metadata keys and values with total missing semantics', () => {
    const key = ` message'id `;
    const value = `message' OR TRUE --`;
    const compiled = compilePostgresTraceQuery(
      'public',
      plan({
        where: {
          op: 'and',
          args: [
            { op: 'eq', left: { path: `metadata.${key}` }, right: { literal: value } },
            { op: 'notIn', value: { path: 'metadata.actorRole' }, set: ['assistant', 'tool'] },
            { op: 'notExists', path: 'metadata.parentMessageId' },
          ],
        },
      }),
    );

    expect(compiled.text).not.toContain(key);
    expect(compiled.text).not.toContain(value);
    expect(compiled.text).toContain(`jsonb_typeof(r."metadataSearch" -> $3) = 'string'`);
    expect(compiled.text).toContain(`r."metadataSearch" ->> $3`);
    expect(compiled.text).toContain(`jsonb_typeof(r."metadataRaw" -> $3) = 'string'`);
    expect(compiled.text).toContain(`NULLIF(btrim(r."metadataRaw" ->> $3), '')`);
    expect(compiled.text).toContain('IS NOT DISTINCT FROM $4');
    expect(compiled.text).toContain('IS NULL OR');
    expect(compiled.values).toEqual([
      TIME_RANGE.from,
      TIME_RANGE.to,
      key,
      value,
      'actorRole',
      'assistant',
      'tool',
      'parentMessageId',
      101,
    ]);
  });

  it('emits only referenced relation scopes and reuses each current-record reconstruction', () => {
    const spanClause = {
      spans: { some: { op: 'eq', left: { path: 'spanType' }, right: { literal: 'tool_call' } } },
    };
    const scoreClause = {
      scores: { some: { op: 'lt', left: { path: 'score' }, right: { literal: 0.6 } } },
    };
    const traceOnly = compilePostgresTraceQuery('public', plan()).text;
    const spanOnly = compilePostgresTraceQuery('public', plan({ where: spanClause })).text;
    const scoreOnly = compilePostgresTraceQuery('public', plan({ where: scoreClause })).text;
    const repeated = compilePostgresTraceQuery(
      'public',
      plan({ where: { op: 'and', args: [spanClause, spanClause, scoreClause, scoreClause] } }),
    ).text;

    expect(traceOnly).not.toContain('current_spans AS');
    expect(traceOnly).not.toContain('current_scores AS');
    expect(traceOnly).not.toContain('mastra_score_events');
    expect(spanOnly.match(/current_spans AS MATERIALIZED/g)).toHaveLength(1);
    expect(spanOnly).not.toContain('current_scores AS');
    expect(spanOnly).not.toContain('mastra_score_events');
    expect(scoreOnly.match(/current_scores AS MATERIALIZED/g)).toHaveLength(1);
    expect(scoreOnly).not.toContain('current_spans AS');
    expect(repeated.match(/current_spans AS MATERIALIZED/g)).toHaveLength(1);
    expect(repeated.match(/current_scores AS MATERIALIZED/g)).toHaveLength(1);
    expect(repeated.match(/FROM current_spans s/g)).toHaveLength(2);
    expect(repeated.match(/FROM current_scores s/g)).toHaveLength(2);
  });

  it('filters null-ended roots before projection and pagination', () => {
    const compiled = compilePostgresTraceQuery('public', plan());

    expect(compiled.text).toContain('NOT r."isPending"');
    expect(compiled.text).toContain('r."endedAt" IS NOT NULL');
  });

  it('compiles typed feedback relations with one correlated existence check per clause', () => {
    const compiled = compilePostgresTraceQuery(
      'public',
      plan({
        where: {
          op: 'and',
          args: [
            {
              feedback: {
                some: {
                  op: 'and',
                  args: [
                    { op: 'eq', left: { path: 'feedbackType' }, right: { literal: "rating' OR TRUE --" } },
                    { op: 'lt', left: { path: 'value' }, right: { literal: 0 } },
                    { op: 'gte', left: { path: 'timestamp' }, right: { literal: '2026-01-01T14:00:00+02:00' } },
                    { op: 'exists', path: 'value' },
                    { op: 'exists', path: 'comment' },
                  ],
                },
              },
            },
            { feedback: { none: { op: 'in', value: { path: 'value' }, set: ['bad', 'worse'] } } },
          ],
        },
      }),
    );

    expect(compiled.text.match(/current_feedback AS/g)).toHaveLength(1);
    expect(compiled.text.match(/FROM current_feedback s/g)).toHaveLength(2);
    expect(compiled.text).toContain('s."traceId" IS NOT NULL');
    expect(compiled.text).toContain('s."traceId" = r."traceId"');
    expect(compiled.text).toContain('s."valueNumber" IS NOT NULL AND s."valueNumber" <');
    expect(compiled.text).toContain('s."valueString" IS NOT NULL AND s."valueString" IN');
    expect(compiled.text).toContain('(s."valueString" IS NOT NULL OR s."valueNumber" IS NOT NULL)');
    expect(compiled.text).toContain('FROM "public"."mastra_feedback_events" s');
    expect(compiled.text).toContain('newer."feedbackId" = s."feedbackId"');
    expect(compiled.text).toContain('newer."cursorId" > s."cursorId"');
    expect(compiled.text).not.toContain("rating' OR TRUE --");
    expect(compiled.values).toContain("rating' OR TRUE --");
    expect(compiled.values).toContain('2026-01-01T12:00:00.000Z');
  });

  it('emits feedback scope only when referenced', () => {
    const traceOnly = compilePostgresTraceQuery('public', plan()).text;
    const feedbackOnly = compilePostgresTraceQuery(
      'public',
      plan({ where: { feedback: { some: { op: 'exists', path: 'value' } } } }),
    ).text;

    expect(traceOnly).not.toContain('current_feedback AS');
    expect(traceOnly).not.toContain('mastra_feedback_events');
    expect(feedbackOnly.match(/current_feedback AS/g)).toHaveLength(1);
  });

  it('uses total null semantics for negative predicates', () => {
    const compiled = compilePostgresTraceQuery(
      'public',
      plan({ where: { op: 'ne', left: { path: 'threadId' }, right: { literal: 'excluded' } } }),
    );

    expect(compiled.text).toContain('r."threadId" IS DISTINCT FROM $3');
  });

  it('matches the requested keyset order and always ties on traceId ascending', () => {
    const first = plan({ orderBy: [{ field: 'endedAt', direction: 'desc' }], page: { limit: 2 } });
    const after = plan({
      orderBy: [{ field: 'endedAt', direction: 'desc' }],
      page: {
        limit: 2,
        after: queryCursor(first, { sortValue: '2026-01-01T12:00:00.000Z', traceId: 'trace-b' }),
      },
    });
    const compiled = compilePostgresTraceQuery('public', after);

    expect(compiled.text).toContain('"endedAt" < $3');
    expect(compiled.text).toContain('"traceId" > $4');
    expect(compiled.text).toContain('ORDER BY "endedAt" DESC, "traceId" ASC');
    expect(compiled.values.at(-1)).toBe(3);
  });

  it('compiles grouped queries as distinct non-null thread IDs', () => {
    const compiled = compilePostgresTraceQuery('public', plan({ group: { by: ['threadId'] }, page: { limit: 4 } }));

    expect(compiled.text).toContain('WHERE "threadId" IS NOT NULL');
    expect(compiled.text).toContain('GROUP BY "threadId"');
    expect(compiled.text).toContain('ORDER BY "threadId" ASC');
    expect(compiled.values.at(-1)).toBe(5);
  });

  it('compiles list-compatible count and offset queries over the same candidates', () => {
    const pagePlan = plan({
      orderBy: [{ field: 'endedAt', direction: 'asc' }],
      pagination: { page: 2, perPage: 25 },
    });
    const count = compilePostgresTraceQuery('public', pagePlan, 'count');
    const data = compilePostgresTraceQuery('public', pagePlan);

    expect(count.text).toContain('SELECT COUNT(*)::text AS count\nFROM candidates');
    expect(data.text).toContain('ORDER BY "endedAt" ASC, "traceId" ASC');
    expect(data.text).toContain('LIMIT $3 OFFSET $4');
    expect(data.values).toEqual([TIME_RANGE.from, TIME_RANGE.to, 25, 50]);
    expect(count.text.split('candidates AS')[0]).toBe(data.text.split('candidates AS')[0]);
  });

  it('returns exact list-compatible pagination metadata inside the timeout transaction', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValueOnce(1_000).mockReturnValue(2_250.25);
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const any = vi
      .fn()
      .mockResolvedValueOnce([{ count: '3' }])
      .mockResolvedValueOnce([traceRow('trace-c', '2026-01-01T10:00:00.000Z')]);
    const tx = vi.fn(async callback => callback({ query, any }));
    const response = await queryTraces(
      { tx } as unknown as DbClient,
      'public',
      plan({ pagination: { page: 1, perPage: 2 } }),
      15_000,
    );
    now.mockRestore();

    expect(query).toHaveBeenNthCalledWith(1, 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    expect(query).toHaveBeenNthCalledWith(2, `SELECT set_config('statement_timeout', $1, true)`, ['15000ms']);
    expect(query).toHaveBeenNthCalledWith(3, `SELECT set_config('statement_timeout', $1, true)`, ['13749ms']);
    expect(query.mock.invocationCallOrder[1]).toBeLessThan(any.mock.invocationCallOrder[0]!);
    expect(any.mock.invocationCallOrder[0]).toBeLessThan(query.mock.invocationCallOrder[2]!);
    expect(query.mock.invocationCallOrder[2]).toBeLessThan(any.mock.invocationCallOrder[1]!);
    expect(any).toHaveBeenCalledTimes(2);
    expect(response).toMatchObject({
      traces: [{ traceId: 'trace-c' }],
      pagination: { total: 3, page: 1, perPage: 2, hasMore: false },
    });
    expect(response).not.toHaveProperty('page');
  });

  it('does not execute the page query when the count exhausts the timeout budget', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValueOnce(1_000).mockReturnValue(16_000);
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const any = vi.fn().mockResolvedValueOnce([{ count: '3' }]);
    const tx = vi.fn(async callback => callback({ query, any }));

    await expect(
      queryTraces({ tx } as unknown as DbClient, 'public', plan({ pagination: { page: 1, perPage: 2 } }), 15_000),
    ).rejects.toMatchObject({
      code: 'TRACE_QUERY_EXECUTION_TIMEOUT',
      message: 'The trace query exceeded its execution timeout',
    });
    now.mockRestore();

    expect(query).toHaveBeenCalledTimes(2);
    expect(any).toHaveBeenCalledTimes(1);
  });

  it('compiles thread qualification over full eligible roots with dependencies from both scopes', () => {
    const metadataKey = ` actor'role `;
    const metadataValue = `clinician' OR TRUE --`;
    const compiled = compilePostgresThreadQuery(
      'public',
      threadPlan({
        traces: {
          timeRange: TIME_RANGE,
          where: { spans: { some: { op: 'eq', left: { path: 'name' }, right: { literal: 'medication_lookup' } } } },
        },
        where: {
          op: 'and',
          args: [
            {
              traces: {
                some: {
                  op: 'and',
                  args: [
                    { op: 'eq', left: { path: `metadata.${metadataKey}` }, right: { literal: metadataValue } },
                    { scores: { some: { op: 'lt', left: { path: 'score' }, right: { literal: 0.6 } } } },
                  ],
                },
              },
            },
            {
              traces: {
                none: {
                  feedback: {
                    some: { op: 'eq', left: { path: 'feedbackType' }, right: { literal: 'clinical-review' } },
                  },
                },
              },
            },
          ],
        },
        page: { limit: 4 },
      }),
    );

    expect(compiled.text.match(/current_spans AS MATERIALIZED/g)).toHaveLength(1);
    expect(compiled.text.match(/current_scores AS MATERIALIZED/g)).toHaveLength(1);
    expect(compiled.text.match(/current_feedback AS MATERIALIZED/g)).toHaveLength(1);
    expect(compiled.text).toContain('eligible_roots AS MATERIALIZED');
    expect(compiled.text).toContain('SELECT *\n    FROM root_scope r');
    expect(compiled.text).toContain('SELECT 1 FROM eligible_roots r');
    expect(compiled.text).toContain('r."threadId" = t."threadId"');
    expect(compiled.text).toContain('NOT EXISTS (');
    expect(compiled.text).not.toContain(metadataKey);
    expect(compiled.text).not.toContain(metadataValue);
    expect(compiled.values).toEqual([
      TIME_RANGE.from,
      TIME_RANGE.to,
      'medication_lookup',
      metadataKey,
      metadataValue,
      0.6,
      'clinical-review',
      5,
    ]);
  });

  it('applies the thread cursor after qualification and fetches one lookahead row', () => {
    const first = threadPlan({ page: { limit: 1 } });
    const after = threadPlan({
      page: {
        limit: 1,
        after: encodeTraceQueryCursor(first, { result: 'threads', threadId: 'thread-1' }),
      },
    });
    const compiled = compilePostgresThreadQuery('public', after);

    expect(compiled.text).toContain('SELECT "threadId" COLLATE "C" AS "threadId"');
    expect(compiled.text).toContain('GROUP BY "threadId" COLLATE "C"');
    expect(compiled.text).toContain('FROM qualified_threads\nWHERE "threadId" > $3');
    expect(compiled.text).toContain('ORDER BY "threadId" ASC');
    expect(compiled.values).toEqual([TIME_RANGE.from, TIME_RANGE.to, 'thread-1', 2]);
  });

  it('fails closed when a trusted plan contains an unmapped field', () => {
    const trusted = plan({ where: { op: 'eq', left: { path: 'traceId' }, right: { literal: 'trace-a' } } });
    const invalid = {
      ...trusted,
      where: { type: 'comparison', field: 'rawSql', operator: 'eq', value: 'x' },
    } as unknown as TrustedTraceQueryPlan;

    expect(() => compilePostgresTraceQuery('public', invalid)).toThrow('Unsupported trusted trace-query field');

    const thread = threadPlan({
      where: { traces: { some: { op: 'eq', left: { path: 'traceId' }, right: { literal: 'trace-a' } } } },
    });
    const invalidThread = {
      ...thread,
      where: {
        type: 'relation',
        collection: 'traces',
        quantifier: 'some',
        predicate: { type: 'comparison', field: 'rawSql', operator: 'eq', value: 'x' },
      },
    } as unknown as TrustedThreadQueryPlan;
    expect(() => compilePostgresThreadQuery('public', invalidThread)).toThrow('Unsupported trusted trace-query field');
  });

  it('applies a transaction-local timeout and computes the next cursor from the last visible row', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const any = vi
      .fn()
      .mockResolvedValue([
        traceRow('trace-a', '2026-01-01T12:00:00.000Z'),
        traceRow('trace-b', '2026-01-01T11:00:00.000Z'),
      ]);
    const tx = vi.fn(async callback => callback({ query, any }));
    const response = await queryTraces({ tx } as unknown as DbClient, 'public', plan({ page: { limit: 1 } }), 15_000);

    expect(query).toHaveBeenCalledWith(`SELECT set_config('statement_timeout', $1, true)`, ['15000ms']);
    expect(response).toMatchObject({
      traces: [
        {
          traceId: 'trace-a',
          rootSpanId: 'root-trace-a',
          status: 'success',
        },
      ],
      page: { next: expect.any(String) },
    });
    expect(Object.keys(response.traces[0]!)).toHaveLength(16);
    expect(response.traces[0]).toMatchObject({
      name: 'Agent run',
      entityId: 'agent-1',
      parentSpanId: null,
      createdAt: '2026-01-01T12:00:00.000Z',
      metadata: { customer: { id: 'customer-1' }, count: 2 },
      inputPreview: 'Help with my order',
    });
    expect(response.traces[0]).not.toHaveProperty('input');
  });

  it('returns null for absent optional root span details', async () => {
    const row = {
      ...traceRow('trace-a', '2026-01-01T12:00:00.000Z'),
      entityId: null,
      metadata: null,
      input: null,
    };
    const any = vi.fn().mockResolvedValue([row]);
    const query = vi.fn();
    const tx = vi.fn(async callback => callback({ query, any }));
    const response = await queryTraces({ tx } as unknown as DbClient, 'public', plan(), 15_000);

    expect(response.traces[0]).toMatchObject({
      name: 'Agent run',
      entityId: null,
      parentSpanId: null,
      metadata: null,
      inputPreview: null,
    });
    expect(response.page.next).toBeNull();
  });

  it('reuses the transaction timeout and returns fixed thread identities with a next cursor', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const any = vi.fn().mockResolvedValue([{ threadId: 'thread-1' }, { threadId: 'thread-2' }]);
    const tx = vi.fn(async callback => callback({ query, any }));

    const response = await queryThreads(
      { tx } as unknown as DbClient,
      'public',
      threadPlan({ page: { limit: 1 } }),
      15_000,
    );

    expect(query).toHaveBeenCalledWith(`SELECT set_config('statement_timeout', $1, true)`, ['15000ms']);
    expect(response).toEqual({ threads: [{ threadId: 'thread-1' }], page: { next: expect.any(String) } });
    expect(Object.keys(response.threads[0]!)).toEqual(['threadId']);
  });

  it('never converts a null database timestamp into an epoch cursor', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const any = vi.fn().mockResolvedValue([{ ...traceRow('malformed', '2026-01-01T12:00:00.000Z'), endedAt: null }]);
    const tx = vi.fn(async callback => callback({ query, any }));

    await expect(queryTraces({ tx } as unknown as DbClient, 'public', plan(), 15_000)).rejects.toThrow(
      'Trace query returned a null timestamp',
    );
  });

  it('normalizes PostgreSQL resource exhaustion without exposing driver details', async () => {
    const tx = vi.fn().mockRejectedValue(Object.assign(new Error('out of memory: SELECT secret'), { code: '53200' }));

    await expect(queryTraces({ tx } as unknown as DbClient, 'public', plan(), 15_000)).rejects.toEqual(
      expect.objectContaining<Partial<TraceQueryResourceLimitError>>({
        code: 'TRACE_QUERY_RESOURCE_LIMIT',
        message: 'The trace query exceeded its resource limit',
      }),
    );
  });

  it('preserves resource-limit errors through the public vNext storage wrapper', async () => {
    const tx = vi.fn().mockRejectedValue(Object.assign(new Error('out of memory: SELECT secret'), { code: '53200' }));
    const storage = new ObservabilityStoragePostgresVNext({ client: { tx } as unknown as DbClient });

    await expect(storage.queryTraces(plan())).rejects.toBeInstanceOf(TraceQueryResourceLimitError);
  });

  it('normalizes PostgreSQL statement timeouts without exposing driver details', async () => {
    const driverError = Object.assign(new Error('canceling statement due to statement timeout: SELECT secret'), {
      code: '57014',
    });
    const tx = vi.fn().mockRejectedValue(driverError);

    await expect(queryTraces({ tx } as unknown as DbClient, 'public', plan(), 1)).rejects.toEqual(
      expect.objectContaining<Partial<TraceQueryExecutionError>>({
        code: 'TRACE_QUERY_EXECUTION_TIMEOUT',
        message: 'The trace query exceeded its execution timeout',
      }),
    );
  });
});

function queryCursor(plan: TrustedTraceQueryPlan, values: { sortValue: string; traceId: string }): string {
  if (plan.result !== 'traces') throw new Error('Expected a trace plan');
  return encodeTraceQueryCursor(plan, { result: 'traces', ...values });
}

function traceRow(traceId: string, startedAt: string) {
  return {
    traceId,
    rootSpanId: `root-${traceId}`,
    name: 'Agent run',
    entityId: 'agent-1',
    parentSpanId: null,
    metadata: { customer: { id: 'customer-1' }, count: 2 },
    input: { messages: [{ role: 'user', content: 'Help with my order' }] },
    threadId: null,
    resourceId: null,
    startedAt: new Date(startedAt),
    endedAt: new Date(new Date(startedAt).getTime() + 1_000),
    entityName: null,
    entityType: null,
    environment: null,
    status: 'success',
  };
}

describe('Postgres advanced trace delta polling', () => {
  let wasEnabled: boolean;
  beforeEach(() => {
    wasEnabled = coreFeatures.has('observability-delta-polling');
    coreFeatures.add('observability-delta-polling');
  });
  afterEach(() => {
    if (!wasEnabled) coreFeatures.delete('observability-delta-polling');
    vi.restoreAllMocks();
  });

  function deltaPlan(watermark?: string, adapter = 'pg') {
    const initial = plan({ mode: 'delta', limit: 1 });
    return plan({
      mode: 'delta',
      limit: 1,
      ...(watermark === undefined
        ? {}
        : {
            after: encodeTraceQueryDeltaCursor(initial, adapter, watermark),
          }),
    });
  }

  function nativeCursor(response: TraceQueryResponse) {
    if (!('deltaCursor' in response)) throw new Error('Expected delta cursor');
    const continuation = plan({ mode: 'delta', after: response.deltaCursor });
    if (continuation.paginationMode !== 'delta') throw new Error('Expected delta plan');
    return getTraceQueryDeltaWatermark(continuation, 'pg');
  }

  it('bootstraps at the safe horizon without selecting roots', async () => {
    const one = vi.fn().mockResolvedValue({ xactId: '100' });
    const any = vi.fn();
    const query = vi.fn();
    const tx = vi.fn(async callback => callback({ one, any, query }));
    const response = await queryTraces({ tx } as unknown as DbClient, 'public', deltaPlan(), 15000);
    expect(response).toMatchObject({ traces: [], delta: { limit: 1, hasMore: false } });
    expect(nativeCursor(response)).toBe('100:0');
    expect(any).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  });

  it('filters and deduplicates completed roots before watermark ordering and limiting', () => {
    const compiled = compilePostgresTraceQuery('public', deltaPlan('100:4'), 'data', '200');
    expect(compiled.text).toContain('newer."cursorId" > r."cursorId"');
    expect(compiled.text).toContain('NOT r."isPending"');
    expect(compiled.text).toContain('r."endedAt" IS NOT NULL');
    expect(compiled.text).toContain('(r."xactId", r."cursorId") > ($3::xid8, $4::bigint)');
    expect(compiled.text).toContain('"xactId" < $5::xid8');
    expect(compiled.text).toContain('ORDER BY "xactId" ASC, "cursorId" ASC');
    expect(compiled.values).toEqual([TIME_RANGE.from, TIME_RANGE.to, '100', '4', '200', 2]);
  });

  it('continues from the last emitted pair when more matching roots remain', async () => {
    const one = vi.fn().mockResolvedValue({ xactId: '200' });
    const any = vi.fn().mockResolvedValue([
      { ...traceRow('a', '2026-01-01T10:00:00.000Z'), xactId: '120', cursorId: '8' },
      { ...traceRow('b', '2026-01-01T10:00:00.000Z'), xactId: '120', cursorId: '9' },
    ]);
    const tx = vi.fn(async callback => callback({ one, any, query: vi.fn() }));
    const response = await queryTraces({ tx } as unknown as DbClient, 'public', deltaPlan('100:0'), 15000);
    expect(response).toMatchObject({ traces: [{ traceId: 'a' }], delta: { limit: 1, hasMore: true } });
    expect(nativeCursor(response)).toBe('120:8');
    expect(response).not.toHaveProperty('page');
    expect(response).not.toHaveProperty('pagination');
  });

  it('advances empty continuations to the safely observed horizon', async () => {
    const tx = vi.fn(async callback =>
      callback({
        one: vi.fn().mockResolvedValue({ xactId: '200' }),
        any: vi.fn().mockResolvedValue([]),
        query: vi.fn(),
      }),
    );
    const response = await queryTraces({ tx } as unknown as DbClient, 'public', deltaPlan('100:0'), 15000);
    expect(nativeCursor(response)).toBe('200:0');
  });

  it('captures the numbered handoff before count and data in the same snapshot', async () => {
    const one = vi.fn().mockResolvedValue({ xactId: '200' });
    const any = vi
      .fn()
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([]);
    const tx = vi.fn(async callback => callback({ one, any, query: vi.fn() }));
    const response = await queryTraces({ tx } as unknown as DbClient, 'public', plan({ pagination: {} }), 15000);
    expect(nativeCursor(response)).toBe('200:0');
    expect(one.mock.invocationCallOrder[0]).toBeLessThan(any.mock.invocationCallOrder[0]!);
    expect(response).toMatchObject({ traces: [], pagination: { total: 0 } });
  });

  it('rejects invalid native watermarks and adapter mismatches before opening a transaction', async () => {
    const tx = vi.fn();
    for (const invalid of [deltaPlan('invalid'), deltaPlan('100:0', 'duckdb')]) {
      await expect(queryTraces({ tx } as unknown as DbClient, 'public', invalid, 15000)).rejects.toThrow();
    }
    expect(tx).not.toHaveBeenCalled();
  });

  it('preserves the feature gate and the shared deadline after reading the horizon', async () => {
    coreFeatures.delete('observability-delta-polling');
    await expect(queryTraces({} as DbClient, 'public', deltaPlan(), 15000)).rejects.toThrow();
    coreFeatures.add('observability-delta-polling');
    vi.spyOn(performance, 'now').mockReturnValueOnce(1000).mockReturnValue(16000);
    const any = vi.fn();
    const tx = vi.fn(async callback =>
      callback({
        one: vi.fn().mockResolvedValue({ xactId: '200' }),
        any,
        query: vi.fn(),
      }),
    );
    await expect(
      queryTraces({ tx } as unknown as DbClient, 'public', deltaPlan('100:0'), 15000),
    ).rejects.toBeInstanceOf(TraceQueryExecutionError);
    expect(any).not.toHaveBeenCalled();
  });
});
