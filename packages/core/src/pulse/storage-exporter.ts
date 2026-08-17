import { randomUUID } from 'node:crypto';
import { MastraBase } from '../base';
import { RegisteredLogger } from '../logger';
import type { FlowIndexRow, PulseRecord, PulseRelationshipRecord, PulseStorage } from '../storage/domains/pulse';
import { nextPulseSeq } from './seq';
import type { PulseBusEvent, PulseBusExporter, PulseDropEvent } from './types';

/**
 * PulseStorageExporter — the default pulse writer (experimental).
 *
 * Batches {@link PulseBusEvent}s from the PulseBus into a {@link PulseStorage}
 * domain with size- and time-triggered flushes. Failed batches retry once,
 * then are dropped and reported through `onDrop` — a write failure must never
 * propagate into the host run.
 *
 * Storage may be provided directly or as an async provider (Mastra passes
 * `() => storage.getStore('pulse')`, which is async). Resolution is lazy and
 * memoized: the first flush resolves it once; rows buffered before then are
 * written by that flush.
 */

export interface PulseStorageExporterConfig {
  /** The pulse storage domain, or an async provider resolved on first flush. */
  storage: PulseStorage | (() => Promise<PulseStorage | undefined> | PulseStorage | undefined);
  /** Rows buffered before a size-triggered flush. Default 200. */
  batchSize?: number;
  /** Time-triggered flush interval in ms. Default 2000. */
  flushIntervalMs?: number;
  /** Called when a batch is dropped after retry exhaustion. */
  onDrop?: (event: PulseDropEvent) => void;
  /**
   * Maintain the materialized flow-summary index (experimental). Requires an
   * adapter with `supportsFlowIndex()`; upserts happen on each flush. Default
   * false.
   */
  flowIndex?: boolean;
}

const RETRY_DELAY_MS = 250;
/** Accumulator cap — oldest flows are evicted (and logged) beyond this. */
const MAX_TRACKED_FLOWS = 10_000;
/** Buffered-record ceiling (pulses + relationships) — o11y uses the same 10k. */
const MAX_BUFFERED_RECORDS = 10_000;

/**
 * Per-flow writer-side accumulator for the flow index. APPROXIMATIONS
 * (accepted, documented for the experiment):
 * - `pulseCount`/`costUsd` only see records that pass through THIS exporter
 *   while the flow is tracked; late pulses arriving after the accumulator was
 *   evicted (one flush after the terminal upsert) bump nothing.
 * - a session abort arriving after the flow's accumulator was evicted is
 *   missed by the index (the derived read still sees it — runId join).
 */
interface FlowAccumulator {
  startedAt: Date;
  /** Max span-pulse timestamp seen for this flow. */
  lastTs: Date;
  rootStartAt?: Date;
  rootEndAt?: Date;
  threadId?: string;
  entityName?: string;
  pulseCount: number;
  costUsd?: number;
  hasError: boolean;
  rootCompleted: boolean;
  aborted: boolean;
  /** Run ids seen on this flow's span pulses — the abort's exact join key. */
  runIds: Set<string>;
  dirty: boolean;
  /** Terminal row already upserted in a previous flush → evict this flush. */
  terminalFlushed: boolean;
}

export class PulseStorageExporter extends MastraBase implements PulseBusExporter {
  name = 'pulse-storage';
  #storage: PulseStorage | (() => Promise<PulseStorage | undefined> | PulseStorage | undefined);
  #resolved: Promise<PulseStorage | undefined> | undefined;
  #batchSize: number;
  #onDrop: ((event: PulseDropEvent) => void) | undefined;
  #pulses: PulseRecord[] = [];
  #relationships: PulseRelationshipRecord[] = [];
  #inflight: Promise<void> = Promise.resolve();
  #timer: ReturnType<typeof setInterval> | undefined;
  #dropped = 0;
  #flowIndex: boolean;
  #flows = new Map<string, FlowAccumulator>();
  /** Flows evicted after their terminal upsert — late pulses bump nothing. */
  #endedFlows = new Set<string>();
  #flowVersion = 0;

  constructor(config: PulseStorageExporterConfig) {
    super({ component: RegisteredLogger.OBSERVABILITY, name: 'PulseStorageExporter' });
    this.#storage = config.storage;
    this.#batchSize = config.batchSize && config.batchSize > 0 ? config.batchSize : 200;
    this.#onDrop = config.onDrop;
    this.#flowIndex = config.flowIndex ?? false;
    const flushMs = config.flushIntervalMs && config.flushIntervalMs > 0 ? config.flushIntervalMs : 2000;
    this.#timer = setInterval(() => void this.flush(), flushMs);
    // Guarded: .unref() is Node-only; unguarded calls crash edge runtimes.
    if (typeof (this.#timer as any)?.unref === 'function') (this.#timer as any).unref();
  }

  /** Rows dropped after retry exhaustion (observability for lost writes). */
  get dropped(): number {
    return this.#dropped;
  }

  onPulseEvent(event: PulseBusEvent): void {
    // Bounded buffers (mirrors the o11y exporters' maxBufferSize): when a
    // flush cannot keep up (storage down + retry latency), drop the oldest
    // rather than grow without limit.
    const buffered = this.#pulses.length + this.#relationships.length;
    if (buffered >= MAX_BUFFERED_RECORDS) {
      const evicted = this.#pulses.length ? this.#pulses.shift() : this.#relationships.shift();
      if (evicted) this.#drop(1, 'buffer overflow');
    }
    if (event.type === 'pulse') {
      this.#pulses.push(event.record);
      if (this.#flowIndex) this.#accumulate(event.record);
    } else {
      this.#relationships.push(event.record);
    }
    if (this.#pulses.length + this.#relationships.length >= this.#batchSize) void this.flush();
  }

  /** Fold one pulse into the per-flow accumulators (writer-side derivation). */
  #accumulate(record: PulseRecord): void {
    // Session-layer abort override: an exact join — the abort names its run,
    // and only the flow containing that run is marked. Every real abort path
    // stamps the runId (engine + deleteSession; smoke-verified).
    if (record.source === 'session' && record.surface === 'run_control' && record.action === 'abort_completed') {
      if (!record.runId) return;
      for (const acc of this.#flows.values()) {
        if (!acc.aborted && acc.runIds.has(record.runId)) {
          acc.aborted = true;
          acc.dirty = true;
        }
      }
      return;
    }

    if (!record.traceId) return;
    // Non-span lanes never open nor enrich a flow — cost lives only on the
    // bridge-folded span pulse.
    if (record.source !== 'span') return;

    let acc = this.#flows.get(record.traceId);
    if (!acc) {
      // A pulse arriving after the flow's terminal row was evicted must not
      // re-open it as `running` — it bumps nothing (documented approximation).
      if (this.#endedFlows.has(record.traceId)) return;
      if (this.#flows.size >= MAX_TRACKED_FLOWS) {
        const oldest = this.#flows.keys().next().value as string;
        this.#flows.delete(oldest);
        this.logger.warn(
          `[PulseStorageExporter] flow-index accumulator cap (${MAX_TRACKED_FLOWS}) reached; evicted oldest flow ${oldest}`,
        );
      }
      acc = {
        startedAt: record.timestamp,
        lastTs: record.timestamp,
        pulseCount: 0,
        hasError: false,
        rootCompleted: false,
        aborted: false,
        runIds: new Set(),
        dirty: false,
        terminalFlushed: false,
      };
      this.#flows.set(record.traceId, acc);
    }

    acc.pulseCount += 1;
    if (record.timestamp < acc.startedAt) acc.startedAt = record.timestamp;
    if (record.timestamp > acc.lastTs) acc.lastTs = record.timestamp;
    if (!acc.threadId && record.threadId) acc.threadId = record.threadId;
    if (record.runId) acc.runIds.add(record.runId);
    if (!acc.entityName && record.metadata?.entityName) acc.entityName = record.metadata.entityName;
    if (typeof record.data?.cost_usd === 'number') acc.costUsd = (acc.costUsd ?? 0) + record.data.cost_usd;
    if (record.type === 'error') acc.hasError = true;
    if (!record.parentSpanId) {
      if (record.action.endsWith('_started') && !acc.rootStartAt) acc.rootStartAt = record.timestamp;
      if (record.action.endsWith('_completed') || record.action.endsWith('_failed')) {
        acc.rootEndAt = record.timestamp;
        if (record.action.endsWith('_completed')) acc.rootCompleted = true;
      }
    }
    acc.dirty = true;
  }

  /** Status precedence mirrors the derived rule (stale is read-side only). */
  #accStatus(acc: FlowAccumulator): FlowIndexRow['status'] {
    if (acc.aborted) return 'aborted';
    if (acc.hasError) return 'failed';
    if (acc.rootCompleted) return 'completed';
    return 'running';
  }

  /**
   * Snapshot dirty accumulators as versioned index rows; evict flows whose
   * terminal row was already upserted in a previous flush (late records for
   * them bump nothing — documented approximation).
   */
  #collectFlowRows(): FlowIndexRow[] {
    if (!this.#flowIndex || !this.#flows.size) return [];
    const rows: FlowIndexRow[] = [];
    for (const [flowId, acc] of this.#flows) {
      const status = this.#accStatus(acc);
      const terminal = status !== 'running';
      if (acc.dirty) {
        acc.dirty = false;
        rows.push({
          flowId,
          version: ++this.#flowVersion,
          startedAt: acc.startedAt,
          endedAt: terminal && acc.rootEndAt ? acc.rootEndAt : undefined,
          status,
          durationMs:
            terminal && acc.rootStartAt && acc.rootEndAt ? acc.rootEndAt.getTime() - acc.rootStartAt.getTime() : null,
          threadId: acc.threadId,
          entityName: acc.entityName,
          pulseCount: acc.pulseCount,
          costUsd: acc.costUsd,
        });
      }
      if (terminal) {
        if (acc.terminalFlushed) {
          this.#flows.delete(flowId);
          this.#endedFlows.add(flowId);
          if (this.#endedFlows.size > MAX_TRACKED_FLOWS) {
            this.#endedFlows.delete(this.#endedFlows.keys().next().value as string);
          }
        } else {
          acc.terminalFlushed = true;
        }
      }
    }
    return rows;
  }

  #resolveStorage(): Promise<PulseStorage | undefined> {
    if (!this.#resolved) {
      this.#resolved = (async () => {
        const source = this.#storage;
        try {
          return typeof source === 'function' ? await source() : source;
        } catch (err) {
          this.logger.error(`[PulseStorageExporter] storage resolution failed: ${(err as Error).message}`);
          return undefined;
        }
      })();
    }
    return this.#resolved;
  }

  #drop(count: number, reason: string): void {
    this.#dropped += count;
    this.logger.warn(`[PulseStorageExporter] dropped ${count} records (${reason}); total dropped ${this.#dropped}`);
    this.#onDrop?.({
      type: 'drop',
      signal: 'pulse',
      reason,
      count,
      timestamp: new Date(),
      exporterName: this.name,
    });
  }

  /**
   * Make the hole visible in the data itself: a drop event becomes a
   * `events_dropped` pulse row written with the NEXT successful batch. The
   * row is queued directly (not via the bus) and never re-queues on its own
   * failure — a drop-of-the-drop only counts, so this cannot recurse.
   */
  onDroppedEvent(event: PulseDropEvent): void {
    // Merge into an already-queued drop row (there is at most one resident):
    // during a persistent outage this aggregates counts instead of growing.
    const queued = this.#pulses.find(p => p.source === 'drop' && p.action === 'events_dropped');
    if (queued) {
      queued.data = { count: (queued.data?.count ?? 0) + (event.count ?? 0) };
      return;
    }
    this.#pulses.push({
      id: randomUUID(),
      timestamp: event.timestamp ?? new Date(),
      seq: nextPulseSeq(),
      type: 'system',
      surface: 'execution',
      action: 'events_dropped',
      data: { count: event.count ?? 0 },
      attributes: { reason: event.reason, exporterName: event.exporterName },
      traceId: '',
      source: 'drop',
    });
  }

  async #write(
    pulses: PulseRecord[],
    relationships: PulseRelationshipRecord[],
    flowRows: FlowIndexRow[],
  ): Promise<void> {
    const count = pulses.length + relationships.length;
    if (!count && !flowRows.length) return;
    const storage = await this.#resolveStorage();
    if (!storage) {
      if (count) this.#drop(count, 'no pulse storage available');
      return;
    }
    // Versioned upserts are idempotent, so retrying the whole batch is safe.
    const upsertRows =
      flowRows.length && storage.supportsFlowIndex() && storage.upsertFlowSummaries ? flowRows : undefined;
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (pulses.length) await storage.batchCreatePulses(pulses);
        if (relationships.length) await storage.batchCreateRelationships(relationships);
        if (upsertRows) await storage.upsertFlowSummaries!(upsertRows);
        return;
      } catch (err) {
        lastError = err as Error;
        this.logger.debug(`[PulseStorageExporter] write failed (attempt ${attempt + 1}): ${lastError.message}`);
        if (attempt === 0) await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
    if (!count) {
      this.logger.debug(`[PulseStorageExporter] flow-index upsert failed: ${lastError?.message ?? 'unknown error'}`);
      return;
    }

    // Batch failed twice. One poison record (unserializable attribute, oversized
    // row) must not take the whole batch down — fall back to per-record writes
    // and drop only what individually fails. Drop-marker rows are re-queued
    // instead of counted, so the drop signal itself never inflates the count.
    let lost = 0;
    for (const record of pulses) {
      if (record.source === 'drop') {
        this.onDroppedEvent({
          type: 'drop',
          signal: 'pulse',
          reason: 'requeued after batch failure',
          count: record.data?.count ?? 0,
          timestamp: record.timestamp,
          exporterName: this.name,
        });
        continue;
      }
      try {
        await storage.batchCreatePulses([record]);
      } catch {
        lost++;
      }
    }
    for (const record of relationships) {
      try {
        await storage.batchCreateRelationships([record]);
      } catch {
        lost++;
      }
    }
    if (lost) this.#drop(lost, `write failed: ${lastError?.message ?? 'unknown error'}`);
  }

  /** Drain buffered records; safe to call concurrently (writes are chained). */
  async flush(): Promise<void> {
    const pulses = this.#pulses;
    const relationships = this.#relationships;
    const flowRows = this.#collectFlowRows();
    if (!pulses.length && !relationships.length && !flowRows.length) return this.#inflight;
    this.#pulses = [];
    this.#relationships = [];
    this.#inflight = this.#inflight.then(() => this.#write(pulses, relationships, flowRows));
    return this.#inflight;
  }

  async shutdown(): Promise<void> {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = undefined;
    await this.flush();
  }
}
