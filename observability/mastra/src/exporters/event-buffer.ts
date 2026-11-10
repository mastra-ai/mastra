import { TracingEventType } from '@mastra/core/observability';
import type { AnyExportedSpan, ObservabilityEvent } from '@mastra/core/observability';
import type { CreateSpanRecord, ObservabilityStorageStrategy, UpdateSpanRecord } from '@mastra/core/storage';
import type { StorageByteTracker } from './storage-byte-tracker';

/** Mixin interface that tracks how many times a buffered event has been retried. */
export interface RetryCount {
  retryCount: number;
}

/**
 * How many ended spans a buffer remembers, so a long-lived worker doesn't grow the set forever.
 * A second end of a forgotten span looks like a span that isn't stored yet, so it's retried before it's dropped.
 */
const MAX_ENDED_SPANS = 10_000;

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
  /** Span ends storage didn't apply, each held until its retry time. Outside `totalSize`, so they can't trigger a flush. */
  #heldRetries: { event: BufferedEvent; retryAt: number }[] = [];
  #allCreatedSpans: Set<string> = new Set();
  /** Spans whose SPAN_STARTED this buffer has seen but whose create isn't confirmed yet */
  #pendingCreateSpans: Set<string> = new Set();
  /** Spans whose end storage accepted, oldest first */
  #endedSpans: Set<string> = new Set();
  #firstEventTime?: Date;
  #storageStrategy?: ObservabilityStorageStrategy;
  #maxRetries: number;
  #byteTracker?: StorageByteTracker;
  #preferUpdates = false;

  constructor(args: { maxRetries: number; byteTracker?: StorageByteTracker }) {
    this.#maxRetries = args.maxRetries;
    this.#byteTracker = args.byteTracker;
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
    const buffered = this.#byteTracker ? this.#byteTracker.capture(event) : { ...event, retryCount: 0 };
    this.setFirstEventTime();
    this.#creates.push(buffered);
  }

  private pushUpdate(event: ObservabilityEvent): void {
    const buffered = this.#byteTracker ? this.#byteTracker.capture(event) : { ...event, retryCount: 0 };
    this.setFirstEventTime();
    this.#updates.push(buffered);
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
          case 'batch-with-updates':
            this.pushCreate(event);
            if (!event.exportedSpan.isEvent) {
              this.#pendingCreateSpans.add(this.exportedSpanKey(event.exportedSpan));
            }
            break;
          case 'event-sourced':
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

  /** Re-add failed create events to the buffer, returning events that exceed max retries. */
  reAddCreates(events: BufferedEvent[]): BufferedEvent[] {
    const retryable: BufferedEvent[] = [];
    const dropped: BufferedEvent[] = [];

    for (const e of events) {
      if (++e.retryCount <= this.#maxRetries) {
        retryable.push(e);
        this.#byteTracker?.enqueue(e);
      } else {
        dropped.push(e);
      }
    }

    if (retryable.length > 0) {
      this.setFirstEventTime();
      this.#creates.push(...retryable);
    }

    return dropped;
  }

  /** Re-add failed update events to the buffer, returning events that exceed max retries. */
  reAddUpdates(events: BufferedEvent[]): BufferedEvent[] {
    const retryable: BufferedEvent[] = [];
    const dropped: BufferedEvent[] = [];

    for (const e of events) {
      if (++e.retryCount <= this.#maxRetries) {
        retryable.push(e);
        this.#byteTracker?.enqueue(e);
      } else {
        dropped.push(e);
      }
    }

    if (retryable.length > 0) {
      this.setFirstEventTime();
      this.#updates.push(...retryable);
    }

    return dropped;
  }

  /** Hold span ends storage didn't apply until their retry time, returning events that exceed max retries. */
  holdForRetry(events: BufferedEvent[], retryDelay: (retryCount: number) => number): BufferedEvent[] {
    const now = Date.now();
    const dropped: BufferedEvent[] = [];

    for (const event of events) {
      if (++event.retryCount <= this.#maxRetries) {
        this.#heldRetries.push({ event, retryAt: now + retryDelay(event.retryCount) });
      } else {
        dropped.push(event);
      }
    }

    return dropped;
  }

  /** Move held ends whose retry time is at or before `until` into the update buffer. */
  releaseHeldRetries(until = Date.now()): void {
    const due = this.#heldRetries.filter(held => held.retryAt <= until);
    if (due.length === 0) return;

    this.#heldRetries = this.#heldRetries.filter(held => held.retryAt > until);
    this.setFirstEventTime();
    for (const { event } of due) {
      this.#byteTracker?.enqueue(event);
      this.#updates.push(event);
    }
  }

  /** Remove and return every held end. */
  takeHeldRetries(): BufferedEvent[] {
    const events = this.#heldRetries.map(held => held.event);
    this.#heldRetries = [];
    this.releaseByteBatch(events);
    return events;
  }

  /** Epoch milliseconds of the earliest held retry. */
  get nextRetryAt(): number | undefined {
    return this.#heldRetries.reduce<number | undefined>(
      (earliest, { retryAt }) => (earliest === undefined ? retryAt : Math.min(earliest, retryAt)),
      undefined,
    );
  }

  /** Alternate creates and eligible updates so either queue can make progress under load. */
  takeByteBatch(maxRecords: number): { creates: BufferedEvent[]; updates: BufferedEvent[] } {
    const tracker = this.#byteTracker!;
    const creates: BufferedEvent[] = [];
    const updates: BufferedEvent[] = [];
    const selectedUpdates = new Set<number>();
    let updateIndex = 0;
    let bytes = 0;
    while (creates.length + updates.length < maxRecords && bytes < tracker.config.maxBatchBytes) {
      // Waiting on a create isn't a failed storage operation. Leave these entries
      // in place, with their retry count unchanged, until their create settles.
      while (updateIndex < this.#updates.length) {
        const event = this.#updates[updateIndex]!;
        if (!('exportedSpan' in event) || !this.isAwaitingCreate(event.exportedSpan)) break;
        updateIndex++;
      }
      const create = this.#creates[creates.length];
      const update = this.#updates[updateIndex];
      if (!create && !update) break;
      const takeUpdate = !!update && (!create || this.#preferUpdates);
      const event = takeUpdate ? update! : create!;
      if (takeUpdate) {
        updates.push(event);
        selectedUpdates.add(updateIndex++);
      } else {
        creates.push(event);
      }
      this.#preferUpdates = !takeUpdate;
      tracker.dequeue(event);
      bytes += tracker.size(event);
    }
    this.#creates.splice(0, creates.length);
    this.#updates = this.#updates.filter((_, index) => !selectedUpdates.has(index));
    if (this.totalSize === 0) this.#firstEventTime = undefined;
    return { creates, updates };
  }

  /** Retries, deferred updates and held ends remain reserved; everything else has finished or been dropped. */
  releaseByteBatch(events: BufferedEvent[]): void {
    if (!this.#byteTracker) return;
    const held = new Set(this.#heldRetries.map(retry => retry.event));
    for (const event of events) {
      if (held.has(event) || !this.#byteTracker.releaseIfUnqueued(event)) continue;
      this.forgetDroppedCreates([event]);
      if (event.type === TracingEventType.SPAN_ENDED) {
        this.endFinishedSpans({
          records: [{ traceId: event.exportedSpan.traceId, spanId: event.exportedSpan.id, updates: {} }],
        });
      }
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

  private exportedSpanKey(span: AnyExportedSpan): string {
    return this.buildSpanKey({ traceId: span.traceId, spanId: span.id });
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
        const key = this.buildSpanKey(createRecord);
        this.#pendingCreateSpans.delete(key);
        this.#allCreatedSpans.add(key);
      }
    }
  }

  /** Stop waiting on creates that were dropped, so their updates aren't held back for them. */
  forgetDroppedCreates(events: BufferedEvent[]): void {
    for (const event of events) {
      if (event.type === TracingEventType.SPAN_STARTED) {
        this.#pendingCreateSpans.delete(this.exportedSpanKey(event.exportedSpan));
      }
    }
  }

  /** Check whether a span's create record has already been flushed to storage. */
  spanExists(span: AnyExportedSpan): boolean {
    return this.#allCreatedSpans.has(this.exportedSpanKey(span));
  }

  /** Check whether this buffer saw the span's SPAN_STARTED but its create hasn't been confirmed yet. */
  isAwaitingCreate(span: AnyExportedSpan): boolean {
    return this.#pendingCreateSpans.has(this.exportedSpanKey(span));
  }

  /** Remember spans whose end storage accepted, forgetting the oldest once the set is full. */
  rememberEndedSpans(spans: { traceId: string; spanId: string }[]): void {
    for (const span of spans) {
      this.#endedSpans.add(this.buildSpanKey(span));
    }
    for (const key of this.#endedSpans) {
      if (this.#endedSpans.size <= MAX_ENDED_SPANS) break;
      this.#endedSpans.delete(key);
    }
  }

  /** Check whether storage accepted this span's end through this buffer. */
  wasEnded(span: AnyExportedSpan): boolean {
    return this.#endedSpans.has(this.exportedSpanKey(span));
  }

  /** Remove completed spans from tracking after their SPAN_ENDED updates are flushed. */
  endFinishedSpans(args: { records: UpdateSpanPartial[] }): void {
    if (this.#storageStrategy === 'event-sourced' || this.#storageStrategy === 'insert-only') {
      // no need to track spans if strategy is 'insert-only' or 'event-sourced'
      return;
    }
    args.records.forEach(r => {
      const key = this.buildSpanKey(r);
      this.#allCreatedSpans.delete(key);
      this.#pendingCreateSpans.delete(key);
    });
  }
}
