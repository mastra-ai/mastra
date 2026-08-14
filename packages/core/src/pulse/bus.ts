import { MastraBase } from '../base';
import { RegisteredLogger } from '../logger';
import type { PulseBusEvent, PulseBusExporter, PulseDropEvent } from './types';

/**
 * PulseBus — dedicated event bus for the pulse pipeline (experimental).
 *
 * A deliberate copy of the ObservabilityBus pattern (see
 * observability/mastra/src/bus/) adapted for pre-shaped pulse events, so the
 * pulse pipeline can evolve independently of span observability:
 * - synchronous fan-out to exporters and subscribers; async handler promises
 *   tracked and drained by {@link flush} with an iteration guard
 * - exporter registry (dedupe by instance)
 * - drop events routed to exporters only (writer health, not user data)
 * - two-phase flush: drain delivery promises, then drain exporter buffers,
 *   looping when a buffer drain emits drop events
 *
 * No deepClean pass here: bridge-translated records derive from payloads the
 * observability pipeline already sanitized, and native emitters construct
 * small structured payloads (see RESEARCH-CORE R1).
 */

const MAX_FLUSH_ITERATIONS = 3;

export class PulseBus extends MastraBase {
  #exporters: PulseBusExporter[] = [];
  #subscribers = new Set<(event: PulseBusEvent) => void>();
  #pending = new Set<Promise<void>>();
  #dropsEmittedDuringFlush = 0;
  #flushDepth = 0;

  constructor() {
    super({ component: RegisteredLogger.OBSERVABILITY, name: 'PulseBus' });
  }

  registerExporter(exporter: PulseBusExporter): void {
    if (this.#exporters.includes(exporter)) return;
    this.#exporters.push(exporter);
  }

  unregisterExporter(exporter: PulseBusExporter): boolean {
    const index = this.#exporters.indexOf(exporter);
    if (index === -1) return false;
    this.#exporters.splice(index, 1);
    return true;
  }

  getExporters(): readonly PulseBusExporter[] {
    return [...this.#exporters];
  }

  /** Register a subscriber (future read-side consumers). Returns unsubscribe. */
  subscribe(handler: (event: PulseBusEvent) => void): () => void {
    this.#subscribers.add(handler);
    return () => {
      this.#subscribers.delete(handler);
    };
  }

  #track(result: void | Promise<void>): void {
    if (result && typeof (result as Promise<void>).then === 'function') {
      const promise = (result as Promise<void>).catch(err => {
        this.logger.error('[PulseBus] handler error:', err);
      });
      this.#pending.add(promise);
      void promise.finally(() => this.#pending.delete(promise));
    }
  }

  /** Dispatch an event to exporters and subscribers synchronously. */
  emit(event: PulseBusEvent): void {
    for (const exporter of this.#exporters) {
      try {
        this.#track(exporter.onPulseEvent(event));
      } catch (err) {
        this.logger.error('[PulseBus] exporter error:', err);
      }
    }
    for (const handler of this.#subscribers) {
      try {
        this.#track(handler(event) as void | Promise<void>);
      } catch (err) {
        this.logger.error('[PulseBus] subscriber error:', err);
      }
    }
  }

  /** Writer-health events: exporters only, never generic subscribers. */
  emitDropEvent(event: PulseDropEvent): void {
    if (this.#flushDepth > 0) this.#dropsEmittedDuringFlush++;
    for (const exporter of this.#exporters) {
      if (!exporter.onDroppedEvent) continue;
      try {
        this.#track(exporter.onDroppedEvent(event));
      } catch (err) {
        this.logger.error('[PulseBus] drop-handler error:', err);
      }
    }
  }

  async #drainPending(): Promise<void> {
    let iterations = 0;
    while (this.#pending.size > 0) {
      await Promise.allSettled([...this.#pending]);
      if (++iterations >= MAX_FLUSH_ITERATIONS) {
        this.logger.error(
          `[PulseBus] flush exceeded ${MAX_FLUSH_ITERATIONS} drain iterations — ${this.#pending.size} promises pending.`,
        );
        await Promise.allSettled([...this.#pending]);
        break;
      }
    }
  }

  async #flushExporterBuffers(): Promise<boolean> {
    const before = this.#dropsEmittedDuringFlush;
    this.#flushDepth++;
    try {
      await Promise.allSettled(this.#exporters.map(e => e.flush()));
      return this.#dropsEmittedDuringFlush > before;
    } finally {
      this.#flushDepth--;
    }
  }

  /** Two-phase flush: deliver everything, then drain writer buffers. */
  async flush(): Promise<void> {
    await this.#drainPending();
    for (let i = 0; i < MAX_FLUSH_ITERATIONS; i++) {
      const emittedDrops = await this.#flushExporterBuffers();
      if (!emittedDrops && this.#pending.size === 0) return;
      await this.#drainPending();
    }
    this.logger.error(`[PulseBus] flush exceeded ${MAX_FLUSH_ITERATIONS} buffer-drain iterations.`);
  }

  /** Flush, shut down exporters, clear subscribers. */
  async shutdown(): Promise<void> {
    await this.flush();
    await Promise.allSettled(this.#exporters.map(e => e.shutdown()));
    this.#subscribers.clear();
  }
}
