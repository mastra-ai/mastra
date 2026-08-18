import { randomUUID } from 'node:crypto';
import type { PulseBusEvent, PulseBusExporter, PulseDropEvent } from '@mastra/core/pulse';
import type { PulseRecord, PulseRelationshipRecord } from '@mastra/core/storage';

/**
 * ClickHouseHttpPulseExporter — standalone ClickHouse writer for the pulse
 * pipeline (experimental).
 *
 * The pulse translation lives in `@mastra/core` (`PulseBridge` + the native
 * session forwarder, activated via `new Mastra({ pulse })`); the default
 * writer is core's `PulseStorageExporter` over the `pulse` storage domain.
 * This exporter is for users WITHOUT a composite store carrying a pulse
 * domain: register it as a pulse exporter and it batches pulse/relationship
 * records straight into ClickHouse over the HTTP interface (global fetch, no
 * client dependency).
 *
 * Size- and time-triggered flushes; failed inserts retry once, then the batch
 * is dropped and counted — a write failure must never propagate into the host
 * run.
 */

export interface ClickHouseHttpPulseExporterConfig {
  /** ClickHouse HTTP endpoint, e.g. `http://localhost:8123`. */
  url: string;
  /** Target database. */
  database: string;
  /** ClickHouse credentials (defaults: `default` / empty — ClickHouse defaults). */
  username?: string;
  password?: string;
  /** Rows buffered before a size-triggered flush. Default 200. */
  batchSize?: number;
  /** Time-triggered flush interval in ms. Default 2000. */
  flushIntervalMs?: number;
  /** Diagnostic sink for write failures. Default: silent. */
  logger?: { debug: (message: string) => void };
}

/** JSONEachRow shape of the `pulses` table. */
export interface PulseRow {
  id: string;
  timestamp: string;
  seq: number;
  type: string;
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

/** JSONEachRow shape of the `relationships` table. */
export interface RelationshipRow {
  id: string;
  timestamp: string;
  seq: number;
  type: string;
  from_kind: string;
  from_id: string;
  from_system: string;
  to_kind: string;
  to_id: string;
  to_system: string;
  attributes: string;
  metadata: string;
  trace_id: string;
}

// ClickHouse DateTime64(3): 'YYYY-MM-DD HH:MM:SS.mmm' (UTC)
export function chTime(d?: Date): string {
  const t = d ?? new Date();
  return t.toISOString().replace('T', ' ').replace('Z', '');
}

export function recordToPulseRow(record: PulseRecord): PulseRow {
  return {
    id: record.id,
    timestamp: chTime(record.timestamp),
    seq: record.seq,
    type: record.type,
    surface: record.surface,
    action: record.action,
    level: record.level ?? '',
    text: record.text ?? '',
    data: JSON.stringify(record.data ?? {}),
    attributes: JSON.stringify(record.attributes ?? {}),
    metadata: JSON.stringify(record.metadata ?? {}),
    trace_id: record.traceId,
    span_id: record.spanId ?? '',
    parent_span_id: record.parentSpanId ?? '',
    run_id: record.runId ?? '',
    thread_id: record.threadId ?? '',
    resource_id: record.resourceId ?? '',
    source: record.source,
  };
}

export function recordToRelationshipRow(record: PulseRelationshipRecord): RelationshipRow {
  return {
    id: record.id,
    timestamp: chTime(record.timestamp),
    seq: record.seq,
    type: record.type,
    from_kind: record.from.kind,
    from_id: record.from.id,
    from_system: record.from.system ?? '',
    to_kind: record.to.kind,
    to_id: record.to.id,
    to_system: record.to.system ?? '',
    attributes: JSON.stringify(record.attributes ?? {}),
    metadata: JSON.stringify(record.metadata ?? {}),
    trace_id: record.traceId,
  };
}

export class ClickHouseHttpPulseExporter implements PulseBusExporter {
  name = 'pulse-clickhouse-http';
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

  constructor(config: ClickHouseHttpPulseExporterConfig) {
    this.#url = (config.url ?? '').replace(/\/$/, '');
    this.#auth = `user=${encodeURIComponent(config.username ?? 'default')}&password=${encodeURIComponent(config.password ?? '')}`;
    this.#db = config.database ?? '';
    this.#batchSize = config.batchSize && config.batchSize > 0 ? config.batchSize : 200;
    const flushMs = config.flushIntervalMs && config.flushIntervalMs > 0 ? config.flushIntervalMs : 2000;
    this.#log = config.logger?.debug.bind(config.logger) ?? (() => {});
    this.#timer = setInterval(() => void this.flush(), flushMs);
    // Guarded: .unref() is Node-only; unguarded calls crash edge runtimes.
    if (typeof (this.#timer as any)?.unref === 'function') (this.#timer as any).unref();
  }

  /** Rows dropped after retry exhaustion (observability for lost writes). */
  get dropped(): number {
    return this.#dropped;
  }

  onPulseEvent(event: PulseBusEvent): void {
    if (event.type === 'pulse') this.#pulses.push(recordToPulseRow(event.record));
    else this.#rels.push(recordToRelationshipRow(event.record));
    if (this.#pulses.length + this.#rels.length >= this.#batchSize) void this.flush();
  }

  /** Writer-health events from the bus land as system pulses so loss is visible in-band. */
  onDroppedEvent(event: PulseDropEvent): void {
    this.#pulses.push({
      id: randomUUID(),
      timestamp: chTime(event.timestamp),
      seq: 0,
      type: 'system',
      surface: 'execution',
      action: 'events_dropped',
      level: '',
      text: '',
      data: JSON.stringify({ count: event.count ?? 0 }),
      attributes: JSON.stringify({ signal: event.signal, reason: event.reason, exporterName: event.exporterName }),
      metadata: '{}',
      trace_id: '',
      span_id: '',
      parent_span_id: '',
      run_id: '',
      thread_id: '',
      resource_id: '',
      source: 'drop',
    });
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

  /** Drain buffered rows; safe to call concurrently (inserts are chained). */
  async flush(): Promise<void> {
    const pulses = this.#pulses;
    const rels = this.#rels;
    if (!pulses.length && !rels.length) return this.#inflight;
    this.#pulses = [];
    this.#rels = [];
    this.#inflight = this.#inflight.then(async () => {
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
