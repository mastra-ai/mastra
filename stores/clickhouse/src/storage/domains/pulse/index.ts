import type { ClickHouseClient } from '@clickhouse/client';
import { PulseStorage } from '@mastra/core/storage';
import type {
  FlowDetail,
  FlowIndexRow,
  FlowStatus,
  FlowSummary,
  FlowTimelineEntry,
  FlowTreeNode,
  ListFlowsArgs,
  ListFlowsResult,
  PulseRecord,
  PulseRelationshipRecord,
} from '@mastra/core/storage';
import { resolveClickhouseConfig } from '../../db';
import type { ClickhouseDomainConfig } from '../../db';

/**
 * ClickHouse implementation of the Pulse storage domain (experimental).
 *
 * Append-only MergeTree tables ordered by (trace_id, timestamp, seq); every
 * derived read (flows, status, tree, timeline, cost) is computed in SQL at
 * query time — the executable rules mirror `InMemoryPulseStorage`.
 */

const STALE_THRESHOLD_S = 30;
/** Aggregation guard for the derived flow list; real ingest would use a
 * materialized read model instead (see scale notes). */
const FLOW_SCAN_CAP = 1000;

/** Canonical Pulse DDL — the single source; @mastra/pulse's standalone
 * schema pins itself to these via a sync test. */
export const PULSES_DDL = `CREATE TABLE IF NOT EXISTS pulses (
  id             String,
  timestamp      DateTime64(3),
  seq            UInt64,
  type           Enum8('input' = 1, 'output' = 2, 'decision' = 3, 'state' = 4, 'error' = 5, 'progress' = 6, 'system' = 7),
  surface        LowCardinality(String),
  action         String,
  level          LowCardinality(String),
  text           String,
  data           String,
  attributes     String,
  metadata       String,
  trace_id       String,
  span_id        String,
  parent_span_id String,
  run_id         String,
  thread_id      String,
  resource_id    String,
  source         LowCardinality(String)
) ENGINE = MergeTree ORDER BY (trace_id, timestamp, seq)`;

export const RELATIONSHIPS_DDL = `CREATE TABLE IF NOT EXISTS relationships (
  id         String,
  timestamp  DateTime64(3),
  seq        UInt64,
  type       LowCardinality(String),
  from_kind  Enum8('pulse' = 1, 'flow' = 2, 'thread' = 3, 'model_input' = 4, 'content' = 5, 'definition' = 6, 'external' = 7),
  from_id    String,
  to_kind    Enum8('pulse' = 1, 'flow' = 2, 'thread' = 3, 'model_input' = 4, 'content' = 5, 'definition' = 6, 'external' = 7),
  to_id      String,
  from_system String DEFAULT '',
  to_system   String DEFAULT '',
  attributes String,
  metadata   String DEFAULT '{}',
  trace_id   String
) ENGINE = MergeTree ORDER BY (trace_id, timestamp, seq)`;

/**
 * Materialized flow-summary index (experimental, behind `pulse.flowIndex`).
 * Versioned upserts: ReplacingMergeTree keeps the highest `version` per
 * `flow_id`; reads use FINAL. `stale` is intentionally NOT a stored status —
 * the index cannot self-expire, so staleness is presented at read time from
 * `updated_at`.
 */
const FLOWS_DDL = `CREATE TABLE IF NOT EXISTS flows (
  flow_id     String,
  version     UInt64,
  started_at  DateTime64(3),
  ended_at    Nullable(DateTime64(3)),
  status      Enum8('running' = 1, 'completed' = 2, 'failed' = 3, 'aborted' = 4),
  duration_ms Nullable(Int64),
  thread_id   String,
  entity_name LowCardinality(String),
  pulse_count UInt64,
  cost_usd    Nullable(Float64),
  updated_at  DateTime64(3)
) ENGINE = ReplacingMergeTree(version) ORDER BY flow_id`;

function chTime(d: Date): string {
  return d.toISOString().replace('T', ' ').replace('Z', '');
}

/** Client may return 'YYYY-MM-DD HH:MM:SS.mmm' or ISO strings depending on settings. */
function parseTs(s: string): Date {
  if (s.includes('T')) return new Date(s.endsWith('Z') ? s : `${s}Z`);
  return new Date(`${s.replace(' ', 'T')}Z`);
}

function toPulseRow(r: PulseRecord) {
  return {
    id: r.id,
    timestamp: chTime(r.timestamp),
    seq: r.seq,
    type: r.type,
    surface: r.surface,
    action: r.action,
    level: r.level ?? '',
    text: r.text ?? '',
    data: JSON.stringify(r.data ?? {}),
    attributes: JSON.stringify(r.attributes ?? {}),
    metadata: JSON.stringify(r.metadata ?? {}),
    trace_id: r.traceId,
    span_id: r.spanId ?? '',
    parent_span_id: r.parentSpanId ?? '',
    run_id: r.runId ?? '',
    thread_id: r.threadId ?? '',
    resource_id: r.resourceId ?? '',
    source: r.source,
  };
}

function toRelationshipRow(r: PulseRelationshipRecord) {
  return {
    id: r.id,
    timestamp: chTime(r.timestamp),
    seq: r.seq,
    type: r.type,
    from_kind: r.from.kind,
    from_id: r.from.id,
    to_kind: r.to.kind,
    to_id: r.to.id,
    from_system: r.from.system ?? '',
    to_system: r.to.system ?? '',
    attributes: JSON.stringify(r.attributes ?? {}),
    metadata: JSON.stringify(r.metadata ?? {}),
    trace_id: r.traceId,
  };
}

function toFlowIndexRow(r: FlowIndexRow) {
  return {
    flow_id: r.flowId,
    version: r.version,
    started_at: chTime(r.startedAt),
    ended_at: r.endedAt ? chTime(r.endedAt) : null,
    status: r.status,
    duration_ms: r.durationMs ?? null,
    thread_id: r.threadId ?? '',
    entity_name: r.entityName ?? '',
    pulse_count: r.pulseCount,
    cost_usd: r.costUsd ?? null,
    updated_at: chTime(new Date()),
  };
}

interface FlowIndexReadRow {
  flow_id: string;
  started_at: string;
  duration_ms: number | string | null;
  thread_id: string;
  entity_name: string;
  pulse_count: number | string;
  cost_usd: number | null;
  presented_status: FlowStatus;
}

interface FlowAggRow {
  flow_id: string;
  thread: string;
  started_at: string;
  ended_at: string;
  run_ms: number | null;
  pulse_count: string | number;
  status: FlowStatus;
  entity_name: string;
  cost_usd: number | null;
}

export class PulseStorageClickhouse extends PulseStorage {
  protected client: ClickHouseClient;

  constructor(config: ClickhouseDomainConfig) {
    super();
    const { client } = resolveClickhouseConfig(config);
    this.client = client;
  }

  async init(): Promise<void> {
    await this.client.command({ query: PULSES_DDL });
    await this.client.command({ query: RELATIONSHIPS_DDL });
    await this.client.command({ query: FLOWS_DDL });
  }

  async batchCreatePulses(records: PulseRecord[]): Promise<void> {
    if (!records.length) return;
    await this.client.insert({ table: 'pulses', values: records.map(toPulseRow), format: 'JSONEachRow' });
  }

  async batchCreateRelationships(records: PulseRelationshipRecord[]): Promise<void> {
    if (!records.length) return;
    await this.client.insert({
      table: 'relationships',
      values: records.map(toRelationshipRow),
      format: 'JSONEachRow',
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.client.command({ query: 'TRUNCATE TABLE IF EXISTS pulses' });
    await this.client.command({ query: 'TRUNCATE TABLE IF EXISTS relationships' });
    await this.client.command({ query: 'TRUNCATE TABLE IF EXISTS flows' });
  }

  supportsFlowIndex(): boolean {
    return true;
  }

  async upsertFlowSummaries(rows: FlowIndexRow[]): Promise<void> {
    if (!rows.length) return;
    await this.client.insert({ table: 'flows', values: rows.map(toFlowIndexRow), format: 'JSONEachRow' });
  }

  async listFlowsFromIndex(args: ListFlowsArgs = {}): Promise<ListFlowsResult> {
    const { filter, pagination } = args;
    const page = pagination?.page ?? 0;
    const perPage = pagination?.perPage ?? 40;

    const conditions: string[] = [];
    const params: Record<string, unknown> = {};
    if (filter?.status) {
      conditions.push(`presented_status = {var_status:String}`);
      params.var_status = filter.status;
    }
    if (filter?.threadId) {
      conditions.push(`thread_id = {var_thread:String}`);
      params.var_thread = filter.threadId;
    }
    if (filter?.entityName) {
      conditions.push(`entity_name = {var_entity:String}`);
      params.var_entity = filter.entityName;
    }
    if (filter?.fromDate) {
      conditions.push(`started_at >= {var_from:DateTime64(3)}`);
      params.var_from = chTime(filter.fromDate);
    }
    if (filter?.toDate) {
      conditions.push(`started_at <= {var_to:DateTime64(3)}`);
      params.var_to = chTime(filter.toDate);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Read-side stale presentation: a running row not upserted for longer
    // than the threshold is served as stale (the index cannot self-expire).
    const presented = `
      SELECT flow_id, started_at, duration_ms, thread_id, entity_name, pulse_count, cost_usd,
             if(status = 'running' AND dateDiff('second', updated_at, now64(3)) > ${STALE_THRESHOLD_S},
                'stale', toString(status)) AS presented_status
      FROM flows FINAL`;

    const [pageResult, countResult] = await Promise.all([
      this.client.query({
        query: `SELECT * FROM (${presented}) ${where}
                ORDER BY started_at DESC
                LIMIT ${perPage} OFFSET ${page * perPage}`,
        query_params: params,
        format: 'JSONEachRow',
      }),
      this.client.query({
        query: `SELECT count() AS total FROM (${presented}) ${where}`,
        query_params: params,
        format: 'JSONEachRow',
      }),
    ]);

    const rows = await pageResult.json<FlowIndexReadRow>();
    const counts = await countResult.json<{ total: string | number }>();
    const total = counts[0]?.total ?? 0;

    return {
      flows: rows.map(r => ({
        flowId: r.flow_id,
        threadId: r.thread_id || undefined,
        startedAt: parseTs(r.started_at),
        durationMs: r.duration_ms != null ? Number(r.duration_ms) : null,
        status: r.presented_status,
        pulseCount: Number(r.pulse_count),
        costUsd: r.cost_usd != null ? Number(r.cost_usd) : undefined,
        entityName: r.entity_name || undefined,
      })),
      total: Number(total),
    };
  }

  /** Derived flow summaries (SQL mirror of the in-memory rules). */
  async #flowAggregates(flowId?: string): Promise<FlowAggRow[]> {
    const where = flowId ? `AND p.trace_id = {var_flow:String}` : '';
    const result = await this.client.query({
      query: `
        WITH exact_aborts AS (
          /* The abort names its run; the flow is aborted iff it contains
             that run. Exact join — no window guessing. */
          SELECT DISTINCT run_id
          FROM (SELECT * FROM pulses LIMIT 1 BY id)
          WHERE source = 'session' AND surface = 'run_control'
            AND action = 'abort_completed' AND run_id != ''
        ),
        costs AS (
          /* Single source: bridge-folded cost on the semantic model pulse. */
          SELECT trace_id,
                 sum(toFloat64OrZero(JSONExtractRaw(data, 'cost_usd'))) AS cost_usd
          FROM (SELECT * FROM pulses LIMIT 1 BY id)
          WHERE trace_id != '' AND source = 'span'
          GROUP BY trace_id
        )
        SELECT p.trace_id AS flow_id,
               anyIf(p.thread_id, p.thread_id != '') AS thread,
               min(p.timestamp) AS started_at,
               max(p.timestamp) AS ended_at,
               dateDiff('ms',
                 minIf(p.timestamp, endsWith(p.action, '_started') AND p.parent_span_id = ''),
                 maxIf(p.timestamp, (endsWith(p.action, '_completed') OR endsWith(p.action, '_failed')) AND p.parent_span_id = '')
               ) AS run_ms,
               count() AS pulse_count,
               anyIf(JSONExtractString(p.metadata, 'entityName'), JSONExtractString(p.metadata, 'entityName') != '') AS entity_name,
               any(c.cost_usd) AS cost_usd,
               multiIf(
                 hasAny(
                   groupUniqArrayIf(p.run_id, p.run_id != ''),
                   (SELECT groupUniqArray(run_id) FROM exact_aborts)
                 ), 'aborted',
                 endsWith(argMaxIf(p.action, (p.timestamp, p.seq), p.parent_span_id = '' AND (endsWith(p.action, '_completed') OR endsWith(p.action, '_failed'))), '_failed'), 'failed',
                 endsWith(argMaxIf(p.action, (p.timestamp, p.seq), p.parent_span_id = '' AND (endsWith(p.action, '_completed') OR endsWith(p.action, '_failed'))), '_completed'), 'completed',
                 dateDiff('second', max(p.timestamp), now64(3)) > ${STALE_THRESHOLD_S}, 'stale',
                 'running') AS status
        FROM (SELECT * FROM pulses LIMIT 1 BY id) p
        LEFT JOIN costs c ON c.trace_id = p.trace_id
        WHERE p.source = 'span' AND p.trace_id != '' ${where}
        GROUP BY p.trace_id
        ORDER BY min(p.timestamp) DESC
        LIMIT ${FLOW_SCAN_CAP}`,
      query_params: flowId ? { var_flow: flowId } : {},
      format: 'JSONEachRow',
    });
    return result.json<FlowAggRow>();
  }

  #toSummary(row: FlowAggRow): FlowSummary {
    const terminal = row.status === 'completed' || row.status === 'failed' || row.status === 'aborted';
    return {
      flowId: row.flow_id,
      threadId: row.thread || undefined,
      startedAt: parseTs(row.started_at),
      durationMs: terminal && row.run_ms != null ? Number(row.run_ms) : null,
      status: row.status,
      pulseCount: Number(row.pulse_count),
      costUsd: row.cost_usd ? Number(row.cost_usd) : undefined,
      entityName: row.entity_name || undefined,
    };
  }

  async listFlows(args: ListFlowsArgs = {}): Promise<ListFlowsResult> {
    const { filter, pagination } = args;
    const page = pagination?.page ?? 0;
    const perPage = pagination?.perPage ?? 40;
    let flows = (await this.#flowAggregates()).map(r => this.#toSummary(r));
    if (filter?.status) flows = flows.filter(f => f.status === filter.status);
    if (filter?.threadId) flows = flows.filter(f => f.threadId === filter.threadId);
    if (filter?.entityName) flows = flows.filter(f => f.entityName === filter.entityName);
    if (filter?.fromDate) flows = flows.filter(f => f.startedAt >= filter.fromDate!);
    if (filter?.toDate) flows = flows.filter(f => f.startedAt <= filter.toDate!);
    return { flows: flows.slice(page * perPage, (page + 1) * perPage), total: flows.length };
  }

  async getFlow(flowId: string): Promise<FlowDetail | null> {
    const [agg] = await this.#flowAggregates(flowId);
    if (!agg) return null;

    const spans = await this.client.query({
      query: `
        SELECT span_id,
               any(parent_span_id) AS parent,
               any(surface) AS surface,
               replaceRegexpOne(any(action), '_(started|completed|failed)$', '') AS base,
               min(timestamp) AS t0,
               maxIf(timestamp, endsWith(action, '_completed') OR endsWith(action, '_failed')) AS t1,
               countIf(endsWith(action, '_completed') OR endsWith(action, '_failed')) AS ended,
               countIf(type = 'error') AS errs
        FROM (SELECT * FROM pulses LIMIT 1 BY id)
        WHERE source = 'span' AND trace_id = {var_flow:String} AND span_id != ''
        GROUP BY span_id
        ORDER BY min(seq)`,
      query_params: { var_flow: flowId },
      format: 'JSONEachRow',
    });
    const tree: FlowTreeNode[] = (
      await spans.json<{
        span_id: string;
        parent: string;
        surface: string;
        base: string;
        t0: string;
        t1: string;
        ended: string | number;
        errs: string | number;
      }>()
    ).map(s => {
      const ended = Number(s.ended) > 0;
      const startedAt = parseTs(s.t0);
      const endedAt = ended ? parseTs(s.t1) : undefined;
      return {
        spanId: s.span_id,
        parentSpanId: s.parent || undefined,
        label: `${s.surface}.${s.base}`,
        startedAt,
        endedAt,
        durationMs: endedAt ? endedAt.getTime() - startedAt.getTime() : null,
        hasError: Number(s.errs) > 0,
      };
    });

    const defs = await this.client.query({
      query: `
        SELECT DISTINCT to_id FROM relationships
        WHERE trace_id = {var_flow:String} AND to_kind = 'definition' AND startsWith(type, 'uses_')`,
      query_params: { var_flow: flowId },
      format: 'JSONEachRow',
    });
    const definitions = (await defs.json<{ to_id: string }>()).map(d => d.to_id);

    return { ...this.#toSummary(agg), tree, definitions };
  }

  async getFlowTimeline(flowId: string): Promise<FlowTimelineEntry[]> {
    const result = await this.client.query({
      query: `
        WITH (SELECT anyIf(thread_id, thread_id != '') FROM pulses WHERE trace_id = {var_flow:String} AND source = 'span') AS flow_thread
        SELECT timestamp, seq, source, type, surface, action, run_id
        FROM (SELECT * FROM pulses LIMIT 1 BY id)
        WHERE trace_id = {var_flow:String}
           OR (flow_thread != '' AND thread_id = flow_thread AND source != 'span' AND trace_id = '')
        ORDER BY timestamp, seq
        LIMIT 2000`,
      query_params: { var_flow: flowId },
      format: 'JSONEachRow',
    });
    return (
      await result.json<{
        timestamp: string;
        seq: string | number;
        source: string;
        type: FlowTimelineEntry['type'];
        surface: string;
        action: string;
        run_id: string;
      }>()
    ).map(r => ({
      timestamp: parseTs(r.timestamp),
      seq: Number(r.seq),
      source: r.source,
      type: r.type,
      surface: r.surface,
      action: r.action,
      runId: r.run_id || undefined,
    }));
  }
}
