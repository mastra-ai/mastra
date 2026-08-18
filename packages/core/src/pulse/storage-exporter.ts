import { randomUUID } from 'node:crypto';
import { MastraBase } from '../base';
import { RegisteredLogger } from '../logger';
import type { PulseRecord, PulseRelationshipRecord, PulseStorage } from '../storage/domains/pulse';
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
}

const RETRY_DELAY_MS = 250;
/** Accumulator cap — oldest flows are evicted (and logged) beyond this. */
const MAX_TRACKED_FLOWS = 10_000;
/** Buffered-record ceiling (pulses + relationships) — o11y uses the same 10k. */
const MAX_BUFFERED_RECORDS = 10_000;

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
  /** Flows evicted after their terminal upsert — late pulses bump nothing. */
  #endedFlows = new Set<string>();
  #flowVersion = 0;

  constructor(config: PulseStorageExporterConfig) {
    super({ component: RegisteredLogger.OBSERVABILITY, name: 'PulseStorageExporter' });
    this.#storage = config.storage;
    this.#batchSize = config.batchSize && config.batchSize > 0 ? config.batchSize : 200;
    this.#onDrop = config.onDrop;
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
    } else {
      this.#relationships.push(event.record);
    }
    if (this.#pulses.length + this.#relationships.length >= this.#batchSize) void this.flush();
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

  async #write(pulses: PulseRecord[], relationships: PulseRelationshipRecord[]): Promise<void> {
    const count = pulses.length + relationships.length;
    if (!count) return;
    const storage = await this.#resolveStorage();
    if (!storage) {
      this.#drop(count, 'no pulse storage available');
      return;
    }
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (pulses.length) await storage.batchCreatePulses(pulses);
        if (relationships.length) await storage.batchCreateRelationships(relationships);
        return;
      } catch (err) {
        lastError = err as Error;
        this.logger.debug(`[PulseStorageExporter] write failed (attempt ${attempt + 1}): ${lastError.message}`);
        if (attempt === 0) await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
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
    if (!pulses.length && !relationships.length) return this.#inflight;
    this.#pulses = [];
    this.#relationships = [];
    this.#inflight = this.#inflight.then(() => this.#write(pulses, relationships));
    return this.#inflight;
  }

  async shutdown(): Promise<void> {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = undefined;
    await this.flush();
  }
}
