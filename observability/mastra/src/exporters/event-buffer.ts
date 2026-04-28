import { TracingEventType } from '@mastra/core/observability';
import type { AnyExportedSpan, ObservabilityEvent } from '@mastra/core/observability';
import type { CreateSpanRecord, ObservabilityStorageStrategy, UpdateSpanRecord } from '@mastra/core/storage';

/** Mixin interface that tracks how many times a buffered event has been retried. */
export interface RetryCount {
  retryCount: number;
}

/** A partial span update record keyed by trace and span ID. */
export interface UpdateSpanPartial {
  traceId: string;
  spanId: string;
  updates: Partial<UpdateSpanRecord>;
}

/** An observability event augmented with retry tracking for the buffer. */
export type BufferedEvent = ObservabilityEvent & RetryCount;

/**
 * Buffers observability events (creates and updates) for batch flushing.
 * Handles strategy-aware routing of tracing events and tracks created spans
 * so updates can be deferred until their parent create has been flushed.
 */
export class EventBuffer {
  #preInit: BufferedEvent[] = [];
  #creates: BufferedEvent[] = [];
  #updates: BufferedEvent[] = [];
  #allCreatedSpans: Set<string> = new Set();
  #firstEventTime?: Date;
  #storageStrategy?: ObservabilityStorageStrategy;
  #maxRetries: number;

  constructor(args: { maxRetries: number }) {
    this.#maxRetries = args.maxRetries;
  }

  /** Initialize with a storage strategy and replay any pre-init events. */
  init(args: { strategy: ObservabilityStorageStrategy }): void {
    if (!this.#storageStrategy) {
      this.#storageStrategy = args.strategy;
      for (const event of this.#preInit) {
        this.addEvent(event);
      }
      this.#preInit = [];
    }
  }

  /** Clear the create and update buffers and reset the event timer. */
  reset() {
    this.#creates = [];
    this.#updates = [];
    this.#firstEventTime = undefined;
  }

  private setFirstEventTime(): void {
    if (!this.#firstEventTime) {
      this.#firstEventTime = new Date();
    }
  }

  private pushCreate(event: ObservabilityEvent): void {
    this.setFirstEventTime();
    this.#creates.push({ ...event, retryCount: 0 });
  }

  private pushUpdate(event: ObservabilityEvent): void {
    this.setFirstEventTime();
    this.#updates.push({ ...event, retryCount: 0 });
  }

  /** Route an event to the create or update buffer based on its type and the storage strategy. */
  addEvent(event: ObservabilityEvent) {
    if (!this.#storageStrategy) {
      this.#preInit.push({ ...event, retryCount: 0 });
      return;
    }

    switch (event.type) {
      case TracingEventType.SPAN_STARTED:
        // Strategy 'insert-only' ignores SPAN_STARTED events
        switch (this.#storageStrategy) {
          case 'realtime':
          case 'event-sourced':
          case 'batch-with-updates':
            this.pushCreate(event);
            break;
        }
        break;

      case TracingEventType.SPAN_UPDATED:
        // Strategies 'insert-only' and 'event-sourced' ignore SPAN_UPDATED events
        switch (this.#storageStrategy) {
          case 'realtime':
          case 'batch-with-updates':
            this.pushUpdate(event);
            break;
        }
        break;

      case TracingEventType.SPAN_ENDED:
        if (event.exportedSpan.isEvent) {
          this.pushCreate(event);
        } else {
          switch (this.#storageStrategy) {
            case 'realtime':
            case 'batch-with-updates':
              this.pushUpdate(event);
              break;
            default:
              this.pushCreate(event);
              break;
          }
        }
        break;

      default:
        // Non-tracing signals (metric, log, score, feedback) → creates
        this.pushCreate(event);
        break;
    }
  }

  /** Re-add failed create events to the buffer, dropping those that exceed max retries. */
  reAddCreates(events: BufferedEvent[]) {
    const retryable: BufferedEvent[] = [];

    for (const e of events) {
      if (++e.retryCount <= this.#maxRetries) {
        retryable.push(e);
      }
    }

    if (retryable.length > 0) {
      this.setFirstEventTime();
      this.#creates.push(...retryable);
    }
  }

  /** Re-add failed update events to the buffer, dropping those that exceed max retries. */
  reAddUpdates(events: BufferedEvent[]) {
    const retryable: BufferedEvent[] = [];

    for (const e of events) {
      if (++e.retryCount <= this.#maxRetries) {
        retryable.push(e);
      }
    }

    if (retryable.length > 0) {
      this.setFirstEventTime();
      this.#updates.push(...retryable);
    }
  }

  /** Snapshot of buffered create events. */
  get creates(): BufferedEvent[] {
    return [...this.#creates];
  }

  /** Snapshot of buffered update events. */
  get updates(): BufferedEvent[] {
    return [...this.#updates];
  }

  /** Total number of buffered events (creates + updates). */
  get totalSize(): number {
    return this.#creates.length + this.#updates.length;
  }

  /** Milliseconds since the first event was buffered in the current batch. */
  get elapsed(): number {
    if (!this.#firstEventTime) {
      return 0;
    }
    return Date.now() - this.#firstEventTime.getTime();
  }

  /**
   * Builds a unique span key for tracking
   */
  private buildSpanKey(span: CreateSpanRecord | UpdateSpanPartial | { traceId: string; spanId: string }): string {
    return `${span.traceId}:${span.spanId}`;
  }

  /** Track successfully created spans so updates can verify span existence before flushing. */
  addCreatedSpans(args: { records: CreateSpanRecord[] }): void {
    if (this.#storageStrategy === 'event-sourced' || this.#storageStrategy === 'insert-only') {
      // no need to track spans if strategy is 'insert-only' or 'event-sourced'
      return;
    }

    for (const createRecord of args.records) {
      // no need to track event spans
      if (!createRecord.isEvent) {
        this.#allCreatedSpans.add(this.buildSpanKey(createRecord));
      }
    }
  }

  /** Check whether a span's create record has already been flushed to storage. */
  spanExists(span: AnyExportedSpan): boolean {
    return this.#allCreatedSpans?.has(this.buildSpanKey({ traceId: span.traceId, spanId: span.id }));
  }

  /** Remove completed spans from tracking after their SPAN_ENDED updates are flushed. */
  endFinishedSpans(args: { records: UpdateSpanPartial[] }): void {
    if (this.#storageStrategy === 'event-sourced' || this.#storageStrategy === 'insert-only') {
      // no need to track spans if strategy is 'insert-only' or 'event-sourced'
      return;
    }
    args.records.forEach(r => {
      this.#allCreatedSpans.delete(this.buildSpanKey(r));
    });
  }
}
