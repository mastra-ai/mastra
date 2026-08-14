import { MastraBase } from '../base';
import { RegisteredLogger } from '../logger';
import type { FlowIndexRow, PulseRecord, PulseRelationshipRecord, PulseStorage } from '../storage/domains/pulse';
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
/**
 * Session-abort attribution window past the last span pulse — mirrors the
 * derived rule (abort_completed within [first, last + 2s] of a flow's window).
 */
const ABORT_WINDOW_MS = 2_000;

/**
 * Per-flow writer-side accumulator for the flow index. APPROXIMATIONS
 * (accepted, documented for the experiment):
 * - `pulseCount`/`costUsd` only see records that pass through THIS exporter
 *   while the flow is tracked; late pulses arriving after the accumulator was
 *   evicted (one flush after the terminal upsert) bump nothing.
 * - a session abort more than one flush cycle after the terminal upsert is
 *   missed by the index (the derived rule's 2s window usually falls inside
 *   one flush interval, so in practice both agree).
 */
interface FlowAccumulator {
  startedAt: Date;
  /** Max span-pulse timestamp — closes the abort-attribution window. */
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
    // Session-layer abort override: attribute to every tracked flow whose
    // window contains it — the same rule the derived read applies.
    if (record.source === 'session' && record.surface === 'run_control' && record.action === 'abort_completed') {
      if (!record.threadId) return;
      const ts = record.timestamp.getTime();
      for (const acc of this.#flows.values()) {
        if (
          acc.threadId === record.threadId &&
          !acc.aborted &&
          ts >= acc.startedAt.getTime() &&
          ts <= acc.lastTs.getTime() + ABORT_WINDOW_MS
        ) {
          acc.aborted = true;
          acc.dirty = true;
        }
      }
      return;
    }

    if (!record.traceId) return;
    const existing = this.#flows.get(record.traceId);

    // Non-span lanes never open a flow; they may only enrich a tracked one
    // (bridge-folded cost lives on span pulses, so this is a safety net).
    if (record.source !== 'span') {
      if (existing && typeof record.data?.cost_usd === 'number') {
        existing.costUsd = (existing.costUsd ?? 0) + record.data.cost_usd;
        existing.dirty = true;
      }
      return;
    }

    let acc = existing;
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
        dirty: false,
        terminalFlushed: false,
      };
      this.#flows.set(record.traceId, acc);
    }

    acc.pulseCount += 1;
    if (record.timestamp < acc.startedAt) acc.startedAt = record.timestamp;
    if (record.timestamp > acc.lastTs) acc.lastTs = record.timestamp;
    if (!acc.threadId && record.threadId) acc.threadId = record.threadId;
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
    this.logger.debug(`[PulseStorageExporter] dropped ${count} records (${reason}); total dropped ${this.#dropped}`);
    this.#onDrop?.({
      type: 'drop',
      signal: 'pulse',
      reason,
      count,
      timestamp: new Date(),
      exporterName: this.name,
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
    if (count) this.#drop(count, `write failed: ${lastError?.message ?? 'unknown error'}`);
    else this.logger.debug(`[PulseStorageExporter] flow-index upsert failed: ${lastError?.message ?? 'unknown error'}`);
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
