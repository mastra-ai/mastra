import { randomUUID } from 'node:crypto';
import { TracingEventType } from '@mastra/core/observability';
import type {
  TracingEvent,
  LogEvent,
  MetricEvent,
  ScoreEvent,
  FeedbackEvent,
  ObservabilityDropEvent,
} from '@mastra/core/observability';
import { BaseExporter } from '@mastra/observability';
import type { BaseExporterConfig } from '@mastra/observability';

/**
 * PulseExporter — experimental event-first observability for Mastra.
 *
 * Translates every ObservabilityBus event family (spans, logs, metrics, scores,
 * feedback, drop meta-events) into append-only **pulse** and **relationship**
 * rows in ClickHouse. Nothing derived is stored: flows, trees, durations and
 * status are reconstructed at read time (see the schema/read-model in the
 * README). Cost is captured from metric events — it does not exist on spans.
 *
 * Row shapes follow the Pulse export-spec direction: `type` is a 7-value
 * semantic enum, `surface` a closed set, `data` a numeric-only map, `metadata`
 * a string map; correlation ids are mirrored into physical columns.
 */

/**
 * Structural subset of `@mastra/core/storage`'s `PulseStorage` domain. When
 * provided, the exporter writes through the storage abstraction instead of
 * the ClickHouse HTTP interface — the composite-store path.
 */
export interface PulseStorageLike {
  batchCreatePulses(records: PulseRecordShape[]): Promise<void>;
  batchCreateRelationships(records: PulseRelationshipShape[]): Promise<void>;
}

export interface PulseRecordShape {
  id: string;
  timestamp: Date;
  seq: number;
  type: PulseType;
  surface: string;
  action: string;
  level?: string;
  text?: string;
  data?: Record<string, number>;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, string>;
  traceId: string;
  spanId?: string;
  parentSpanId?: string;
  runId?: string;
  threadId?: string;
  resourceId?: string;
  source: string;
}

export interface PulseRelationshipShape {
  id: string;
  timestamp: Date;
  seq: number;
  type: string;
  from: { kind: EndpointKind; id: string };
  to: { kind: EndpointKind; id: string };
  attributes?: Record<string, unknown>;
  traceId: string;
}

export interface PulseExporterConfig extends BaseExporterConfig {
  /** Write through a Pulse storage domain (e.g. `PulseStorageClickhouse` from
   * `@mastra/clickhouse`). When set, `url`/`database` are not required. */
  storage?: PulseStorageLike;
  /** ClickHouse HTTP endpoint, e.g. `http://localhost:8123`. Required unless `storage` is set. */
  url?: string;
  /** Target database. Required unless `storage` is set. */
  database?: string;
  /** ClickHouse credentials (defaults: `default` / empty — ClickHouse defaults). */
  username?: string;
  password?: string;
  /** Rows buffered before a size-triggered flush. Default 200. */
  batchSize?: number;
  /** Time-triggered flush interval in ms. Default 2000. */
  flushIntervalMs?: number;
  /** Serialized payload cap for span input/output in bytes. Default 4096. */
  payloadCapBytes?: number;
}

const SURFACES = new Set([
  'agent',
  'agent_config',
  'agent_controller',
  'background_task',
  'channel',
  'content',
  'context',
  'eval',
  'execution',
  'experiment',
  'memory',
  'model',
  'notification',
  'processor',
  'run_control',
  'schedule',
  'signal',
  'signal_queue',
  'suspension',
  'task',
  'thread',
  'thread_control',
  'tool',
  'tool_approval',
  'tool_config',
  'workflow',
]);

const CORE_REL_TYPES = new Set([
  'origin_of',
  'flow_contains',
  'thread_contains_flow',
  'parent_of',
  'previous_flow',
  'resume_of',
  'external_parent',
  'uses_config_version',
  'uses_instruction_version',
  'uses_model_settings',
  'uses_tool_definition',
  'uses_definition',
  'enables_definition',
  'disables_definition',
  'introduced_content',
  'included_in_model_input',
  'removed_content',
  'replaced_content',
  'compacted_to',
  'queued_signal',
  'drained_signal',
  'queued_follow_up',
  'schedule_triggered',
  'scored_target',
]);

export type PulseType = 'input' | 'output' | 'decision' | 'state' | 'error' | 'progress' | 'system';
export type EndpointKind = 'pulse' | 'flow' | 'thread' | 'model_input' | 'content' | 'definition' | 'external';

export interface PulseRow {
  id: string;
  timestamp: string;
  seq: number;
  type: PulseType;
  surface: string;
  action: string;
  level: string;
  text: string;
  data: string;
  attributes: string;
  metadata: string;
  trace_id: string;
  span_id: string;
  parent_span_id: string;
  run_id: string;
  thread_id: string;
  resource_id: string;
  source: string;
}

export interface RelationshipRow {
  id: string;
  timestamp: string;
  seq: number;
  type: string;
  from_kind: EndpointKind;
  from_id: string;
  to_kind: EndpointKind;
  to_id: string;
  attributes: string;
  trace_id: string;
}

// Per-process monotonic lane so same-millisecond rows stay ordered across every
// writer in the process (exporter + session listener interleavings hold).
let SEQ = 0;
export function nextSeq(): number {
  return ++SEQ;
}

// ClickHouse DateTime64(3): 'YYYY-MM-DD HH:MM:SS.mmm' (UTC)
export function chTime(d?: Date): string {
  const t = d ?? new Date();
  return t.toISOString().replace('T', ' ').replace('Z', '');
}

/** Collect numeric leaves (dotted keys, depth-limited) — `data` is strictly numeric. */
function numericLeaves(obj: unknown, prefix = '', depth = 0, out: Record<string, number> = {}): Record<string, number> {
  if (obj == null || depth > 3 || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
    else if (v && typeof v === 'object' && !Array.isArray(v)) numericLeaves(v, key, depth + 1, out);
  }
  return out;
}

function metaStr(span: any, key: string): string {
  const v = span?.metadata?.[key];
  return v == null ? '' : String(v);
}

function surfaceAction(spanType: string): { surface: string; base: string } {
  switch (spanType) {
    case 'agent_run':
      return { surface: 'agent', base: 'run' };
    case 'model_generation':
      return { surface: 'model', base: 'generate' };
    case 'model_inference':
      return { surface: 'model', base: 'infer' };
    case 'model_step':
      return { surface: 'model', base: 'step' };
    case 'model_chunk':
      return { surface: 'model', base: 'chunk' };
    case 'tool_call':
    case 'mcp_tool_call':
    case 'client_tool_call':
    case 'provider_tool_call':
      return { surface: 'tool', base: 'call' };
    case 'workflow_run':
      return { surface: 'workflow', base: 'run' };
    case 'workflow_step':
      return { surface: 'workflow', base: 'step' };
    case 'memory_operation':
      return { surface: 'memory', base: 'operation' };
    case 'scorer_run':
      return { surface: 'eval', base: 'score' };
    case 'scorer_step':
      return { surface: 'eval', base: 'step' };
    case 'processor_run':
      return { surface: 'processor', base: 'run' };
    case 'workflow_conditional':
      return { surface: 'workflow', base: 'conditional' };
    case 'workflow_conditional_eval':
      return { surface: 'workflow', base: 'conditional_eval' };
    case 'workflow_parallel':
      return { surface: 'workflow', base: 'parallel' };
    case 'workflow_loop':
      return { surface: 'workflow', base: 'loop' };
    case 'workflow_sleep':
      return { surface: 'workflow', base: 'sleep' };
    case 'workflow_wait_event':
      return { surface: 'workflow', base: 'wait_event' };
    case 'rag_ingestion':
      return { surface: 'context', base: 'rag_ingestion' };
    case 'rag_embedding':
      return { surface: 'context', base: 'rag_embedding' };
    case 'rag_vector_operation':
      return { surface: 'context', base: 'rag_vector_operation' };
    case 'rag_action':
      return { surface: 'context', base: 'rag_action' };
    case 'graph_action':
      return { surface: 'context', base: 'graph_action' };
    case 'workspace_action':
      return { surface: 'task', base: 'workspace_action' };
    case 'skill_resolution':
      return { surface: 'agent_config', base: 'skill_resolution' };
    case 'mapping':
      return { surface: 'execution', base: 'mapping' };
    case 'generic':
      return { surface: 'execution', base: 'op' };
    default:
      return { surface: 'execution', base: spanType || 'event' };
  }
}

/**
 * Batching ClickHouse writer shared by the exporter and the session listener:
 * size- and time-triggered flushes over HTTP JSONEachRow (global fetch, no
 * client dependency). Failed inserts retry once, then the batch is dropped
 * and counted — a write failure must never propagate into the host run.
 */
function rowToRecord(row: PulseRow): PulseRecordShape {
  const parse = <T>(s: string, fallback: T): T => {
    try {
      return JSON.parse(s) as T;
    } catch {
      return fallback;
    }
  };
  return {
    id: row.id,
    timestamp: new Date(`${row.timestamp.replace(' ', 'T')}Z`),
    seq: row.seq,
    type: row.type,
    surface: row.surface,
    action: row.action,
    level: row.level || undefined,
    text: row.text || undefined,
    data: parse(row.data, {}),
    attributes: parse(row.attributes, {}),
    metadata: parse(row.metadata, {}),
    traceId: row.trace_id,
    spanId: row.span_id || undefined,
    parentSpanId: row.parent_span_id || undefined,
    runId: row.run_id || undefined,
    threadId: row.thread_id || undefined,
    resourceId: row.resource_id || undefined,
    source: row.source,
  };
}

function rowToRelationship(row: RelationshipRow): PulseRelationshipShape {
  return {
    id: row.id,
    timestamp: new Date(`${row.timestamp.replace(' ', 'T')}Z`),
    seq: row.seq,
    type: row.type,
    from: { kind: row.from_kind, id: row.from_id },
    to: { kind: row.to_kind, id: row.to_id },
    traceId: row.trace_id,
  };
}

export class PulseWriter {
  #storage: PulseStorageLike | undefined;
  #url: string;
  #auth: string;
  #db: string;
  #batchSize: number;
  #pulses: PulseRow[] = [];
  #rels: RelationshipRow[] = [];
  #inflight: Promise<void> = Promise.resolve();
  #timer: ReturnType<typeof setInterval> | undefined;
  #dropped = 0;
  #log: (msg: string) => void;

  constructor(config: PulseExporterConfig, log: (msg: string) => void = () => {}) {
    this.#storage = config.storage;
    this.#url = (config.url ?? '').replace(/\/$/, '');
    this.#auth = `user=${encodeURIComponent(config.username ?? 'default')}&password=${encodeURIComponent(config.password ?? '')}`;
    this.#db = config.database ?? '';
    this.#batchSize = config.batchSize && config.batchSize > 0 ? config.batchSize : 200;
    const flushMs = config.flushIntervalMs && config.flushIntervalMs > 0 ? config.flushIntervalMs : 2000;
    this.#log = log;
    this.#timer = setInterval(() => void this.flush(), flushMs);
    // Guarded: .unref() is Node-only; unguarded calls crash edge runtimes.
    if (typeof (this.#timer as any)?.unref === 'function') (this.#timer as any).unref();
  }

  /** Rows dropped after retry exhaustion (observability for lost writes). */
  get dropped(): number {
    return this.#dropped;
  }

  pushPulse(row: PulseRow): void {
    this.#pulses.push(row);
    this.#maybeFlush();
  }

  pushRelationship(row: RelationshipRow): void {
    this.#rels.push(row);
    this.#maybeFlush();
  }

  #maybeFlush(): void {
    if (this.#pulses.length + this.#rels.length >= this.#batchSize) void this.flush();
  }

  async #insert(table: string, rows: object[]): Promise<void> {
    if (!rows.length) return;
    const body = rows.map(r => JSON.stringify(r)).join('\n');
    const q = encodeURIComponent(`INSERT INTO ${this.#db}.${table} FORMAT JSONEachRow`);
    const url = `${this.#url}/?${this.#auth}&database=${this.#db}&query=${q}`;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, { method: 'POST', body });
        if (res.ok) return;
        this.#log(`pulse insert ${table} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
      } catch (err) {
        this.#log(`pulse insert ${table} error: ${(err as Error).message}`);
      }
      if (attempt === 0) await new Promise(r => setTimeout(r, 250));
    }
    this.#dropped += rows.length;
    this.#log(`pulse dropped ${rows.length} ${table} rows (total dropped: ${this.#dropped})`);
  }

  async #sinkToStorage(pulses: PulseRow[], rels: RelationshipRow[]): Promise<void> {
    const storage = this.#storage!;
    try {
      if (pulses.length) await storage.batchCreatePulses(pulses.map(rowToRecord));
      if (rels.length) await storage.batchCreateRelationships(rels.map(rowToRelationship));
    } catch (err) {
      this.#dropped += pulses.length + rels.length;
      this.#log(`pulse storage write failed, dropped ${pulses.length + rels.length} rows: ${(err as Error).message}`);
    }
  }

  /** Drain buffered rows; safe to call concurrently (inserts are chained). */
  async flush(): Promise<void> {
    const pulses = this.#pulses;
    const rels = this.#rels;
    if (!pulses.length && !rels.length) return this.#inflight;
    this.#pulses = [];
    this.#rels = [];
    this.#inflight = this.#inflight.then(async () => {
      if (this.#storage) {
        await this.#sinkToStorage(pulses, rels);
        return;
      }
      await this.#insert('pulses', pulses);
      await this.#insert('relationships', rels);
    });
    return this.#inflight;
  }

  async shutdown(): Promise<void> {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = undefined;
    await this.flush();
  }
}

export class PulseExporter extends BaseExporter {
  name = 'pulse';
  #writer: PulseWriter | undefined;
  #payloadCap: number;
  #unmappedSpanTypes = new Set<string>();
  #skippedUpdates = 0;

  /**
   * SPAN_UPDATED events are intentionally not translated (each carries a full
   * snapshot; start/end pairs cover the model). Counted so the loss is
   * quantifiable — update/dedupe semantics are an open spec question.
   */
  get skippedUpdateCount(): number {
    return this.#skippedUpdates;
  }

  /** Internal writer — shared with `attachPulseSession`. */
  get writer(): PulseWriter | undefined {
    return this.#writer;
  }

  constructor(config: PulseExporterConfig) {
    super(config);
    this.#payloadCap = config.payloadCapBytes && config.payloadCapBytes > 0 ? config.payloadCapBytes : 4096;
    if (!config?.storage && (!config?.url || !config?.database)) {
      this.setDisabled('PulseExporter requires either `storage` or `url` + `database`');
      return;
    }
    this.#writer = new PulseWriter(config, msg => this.logger.debug(msg));
  }

  /** Size-cap a payload: never export unbounded message arrays. */
  #capped(value: unknown): unknown {
    if (value == null) return undefined;
    let s: string;
    try {
      s = JSON.stringify(value);
    } catch {
      return { truncated: true, preview: String(value).slice(0, this.#payloadCap) };
    }
    if (s == null) return undefined;
    if (s.length <= this.#payloadCap) return value;
    return { truncated: true, preview: s.slice(0, this.#payloadCap) };
  }

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    const writer = this.#writer;
    const span: any = event.exportedSpan;
    if (!writer || !span) return;

    const { surface, base } = surfaceAction(span.type);
    const mapped = SURFACES.has(surface);
    if (!mapped) this.#unmappedSpanTypes.add(String(span.type));
    const traceId = span.traceId ?? '';
    const spanId = span.id ?? '';
    const isStart = event.type === TracingEventType.SPAN_STARTED;
    const isEnd = event.type === TracingEventType.SPAN_ENDED;
    if (!isStart && !isEnd) {
      this.#skippedUpdates++;
      return;
    }

    const hasError = Boolean(span.errorInfo);
    const isEventSpan = Boolean(span.isEvent);

    // Semantic type mapping: starts announce state; ends with output are
    // outputs; errors are errors; instantaneous event spans are progress.
    let type: PulseType;
    let action: string;
    if (isEventSpan) {
      type = 'progress';
      action = base;
    } else if (isStart) {
      type = 'state';
      action = `${base}_started`;
    } else if (hasError) {
      type = 'error';
      action = `${base}_failed`;
    } else {
      type = span.output != null ? 'output' : 'state';
      action = `${base}_completed`;
    }

    const ts = chTime(isEnd && !isEventSpan ? span.endTime : span.startTime);

    const attributes: Record<string, unknown> = { ...(span.attributes ?? {}) };
    if (!mapped) attributes.spanType = span.type;
    if (isStart || isEventSpan) {
      const input = this.#capped(span.input);
      if (input !== undefined) attributes.input = input;
    }
    if (isEnd) {
      const output = this.#capped(span.output);
      if (output !== undefined) attributes.output = output;
      if (hasError) attributes.error = this.#capped(span.errorInfo);
    }
    const data = numericLeaves(span.attributes?.usage, 'usage');
    numericLeaves(span.attributes?.internalUsage, 'internal_usage', 0, data);

    const metadata: Record<string, string> = {};
    for (const key of ['runId', 'threadId', 'resourceId', 'environment'] as const) {
      const v = metaStr(span, key);
      if (v) metadata[key] = v;
    }
    for (const key of ['entityId', 'entityName', 'entityType'] as const) {
      if (span[key] != null) metadata[key] = String(span[key]);
    }
    if (span.metadata?.resumed) metadata.resumed = 'true';
    if (span.metadata?.resumedFromSpanId) metadata.resumedFromSpanId = String(span.metadata.resumedFromSpanId);

    writer.pushPulse({
      id: randomUUID(),
      timestamp: ts,
      seq: nextSeq(),
      type,
      surface,
      action,
      level: hasError ? 'error' : '',
      text: span.name ?? '',
      data: JSON.stringify(data),
      attributes: JSON.stringify(attributes),
      metadata: JSON.stringify(metadata),
      trace_id: traceId,
      span_id: spanId,
      parent_span_id: span.parentSpanId ?? '',
      run_id: metaStr(span, 'runId'),
      thread_id: metaStr(span, 'threadId'),
      resource_id: metaStr(span, 'resourceId'),
      source: 'span',
    });

    if (isEnd || isEventSpan) {
      const rel = (type: string, fromKind: EndpointKind, fromId: string, toKind: EndpointKind, toId: string) => {
        writer.pushRelationship({
          id: randomUUID(),
          timestamp: ts,
          seq: nextSeq(),
          type: CORE_REL_TYPES.has(type) ? type : `candidate:${type}`,
          from_kind: fromKind,
          from_id: fromId,
          to_kind: toKind,
          to_id: toId,
          attributes: '{}',
          trace_id: traceId,
        });
      };
      if (span.isRootSpan) rel('origin_of', 'pulse', spanId, 'flow', traceId);
      if (span.parentSpanId) rel('parent_of', 'pulse', span.parentSpanId, 'pulse', spanId);
      // Resumed runs start a new root in the SAME trace, parented to the
      // suspended span — the `resume_of` semantic derives for free.
      const resumedFrom = span.metadata?.resumedFromSpanId;
      if (resumedFrom) rel('resume_of', 'pulse', spanId, 'pulse', String(resumedFrom));
      if (span.type === 'model_generation' || span.type === 'model_inference') {
        const model = span.attributes?.model;
        const provider = span.attributes?.provider;
        if (model) rel('uses_model_settings', 'pulse', spanId, 'definition', `model:${provider ?? ''}/${model}`);
        const tools = span.attributes?.tools;
        if (Array.isArray(tools)) {
          for (const t of tools) {
            const tn = typeof t === 'string' ? t : t?.name;
            if (tn) rel('uses_tool_definition', 'pulse', spanId, 'definition', `tool:${tn}`);
          }
        }
      }
    }
  }

  // ── Non-span event families. Note: these bypass SensitiveDataFilter
  // upstream (they only receive deepClean) — an inherited pipeline property,
  // not compensated for here.

  #baseRow(source: string, traceId?: string, spanId?: string) {
    return {
      id: randomUUID(),
      timestamp: chTime(),
      seq: nextSeq(),
      level: '',
      text: '',
      data: '{}',
      attributes: '{}',
      metadata: '{}',
      trace_id: traceId ?? '',
      span_id: spanId ?? '',
      parent_span_id: '',
      run_id: '',
      thread_id: '',
      resource_id: '',
      source,
    };
  }

  onLogEvent(event: LogEvent): void {
    const w = this.#writer;
    const log: any = event.log;
    if (!w || !log) return;
    const level = String(log.level ?? 'info');
    w.pushPulse({
      ...this.#baseRow('log', log.traceId, log.spanId),
      timestamp: chTime(log.timestamp ? new Date(log.timestamp) : undefined),
      type: level === 'error' || level === 'fatal' ? 'error' : 'system',
      surface: 'execution',
      action: 'log',
      level: level === 'fatal' ? 'error' : level,
      text: String(log.message ?? ''),
      attributes: JSON.stringify(log.data ?? {}),
    });
  }

  onMetricEvent(event: MetricEvent): void {
    const w = this.#writer;
    const metric: any = event.metric;
    if (!w || !metric) return;
    const name = String(metric.name ?? 'metric');
    const data: Record<string, number> = {};
    if (typeof metric.value === 'number' && Number.isFinite(metric.value)) data.value = metric.value;
    // Cost arrives on metric events — it does not exist on span attributes.
    const cost = metric.costContext?.estimatedCost;
    if (typeof cost === 'number' && Number.isFinite(cost)) data.estimated_cost_usd = cost;
    w.pushPulse({
      ...this.#baseRow('metric', metric.traceId, metric.spanId),
      timestamp: chTime(metric.timestamp ? new Date(metric.timestamp) : undefined),
      type: 'state',
      surface: /token|model|inference|generation/.test(name) ? 'model' : 'execution',
      action: name,
      data: JSON.stringify(data),
      attributes: JSON.stringify(metric.labels ?? {}),
    });
  }

  onScoreEvent(event: ScoreEvent): void {
    const w = this.#writer;
    const score: any = event.score;
    if (!w || !score) return;
    const pulseId = randomUUID();
    w.pushPulse({
      ...this.#baseRow('score', score.traceId, score.spanId),
      id: pulseId,
      timestamp: chTime(score.timestamp ? new Date(score.timestamp) : undefined),
      type: 'output',
      surface: 'eval',
      action: 'score_recorded',
      data: JSON.stringify(typeof score.score === 'number' ? { score: score.score } : {}),
      attributes: JSON.stringify({
        scorerId: score.scorerId,
        scorerName: score.scorerName,
        reason: score.reason,
        scoreSource: score.scoreSource,
      }),
    });
    if (score.spanId || score.traceId) {
      w.pushRelationship({
        id: randomUUID(),
        timestamp: chTime(),
        seq: nextSeq(),
        type: 'scored_target',
        from_kind: 'pulse',
        from_id: pulseId,
        to_kind: score.spanId ? 'pulse' : 'flow',
        to_id: score.spanId ?? score.traceId,
        attributes: '{}',
        trace_id: score.traceId ?? '',
      });
    }
  }

  onFeedbackEvent(event: FeedbackEvent): void {
    const w = this.#writer;
    const feedback: any = event.feedback;
    if (!w || !feedback) return;
    const pulseId = randomUUID();
    w.pushPulse({
      ...this.#baseRow('feedback', feedback.traceId, feedback.spanId),
      id: pulseId,
      timestamp: chTime(feedback.timestamp ? new Date(feedback.timestamp) : undefined),
      type: 'input',
      surface: 'eval',
      action: 'feedback_recorded',
      data: JSON.stringify(typeof feedback.value === 'number' ? { value: feedback.value } : {}),
      attributes: JSON.stringify({
        feedbackType: feedback.feedbackType,
        value: feedback.value,
        comment: feedback.comment,
        feedbackUserId: feedback.feedbackUserId,
      }),
    });
    if (feedback.spanId || feedback.traceId) {
      w.pushRelationship({
        id: randomUUID(),
        timestamp: chTime(),
        seq: nextSeq(),
        type: 'scored_target',
        from_kind: 'pulse',
        from_id: pulseId,
        to_kind: feedback.spanId ? 'pulse' : 'flow',
        to_id: feedback.spanId ?? feedback.traceId,
        attributes: JSON.stringify({ kind: 'feedback' }),
        trace_id: feedback.traceId ?? '',
      });
    }
  }

  onDroppedEvent(event: ObservabilityDropEvent): void {
    const w = this.#writer;
    if (!w || !event) return;
    w.pushPulse({
      ...this.#baseRow('drop'),
      type: 'system',
      surface: 'execution',
      action: 'events_dropped',
      data: JSON.stringify({ count: event.count ?? 0 }),
      attributes: JSON.stringify({
        signal: event.signal,
        reason: event.reason,
        exporterName: event.exporterName,
      }),
    });
  }

  override async flush(): Promise<void> {
    await this.#writer?.flush();
  }

  override async shutdown(): Promise<void> {
    if (this.#unmappedSpanTypes.size) {
      this.logger.debug(`pulse unmapped span types: ${[...this.#unmappedSpanTypes].join(', ')}`);
    }
    if (this.#skippedUpdates) {
      this.logger.debug(`pulse skipped ${this.#skippedUpdates} span_updated events`);
    }
    await this.#writer?.shutdown();
  }
}
