/**
 * TrackingExporter base class for vendor-specific observability exporters.
 *
 * Provides common functionality for caching trace data in memory, handling
 * out-of-order span arrival via queuing, delayed cleanup, and memory management.
 */

import { TracingEventType } from '@mastra/core/observability';
import type { TracingEvent, AnyExportedSpan, SpanErrorInfo } from '@mastra/core/observability';
import type { BaseExporterConfig } from './base';
import { BaseExporter } from './base';

/**
 * Represents an event waiting in the early queue for its dependencies.
 */
export interface QueuedEvent {
  /** The original tracing event */
  event: TracingEvent;
  /** What this event is waiting for: 'root' or a specific parentSpanId */
  waitingFor: 'root' | string;
  /** Number of times we've attempted to process this event */
  attempts: number;
  /** When this event was queued */
  queuedAt: Date;
}

export interface TrackingExporterConfig extends BaseExporterConfig {
  /**
   * Maximum number of attempts to process a queued event before dropping it.
   * @default 5
   */
  earlyQueueMaxAttempts?: number;

  /**
   * Time-to-live in milliseconds for queued events. Events older than this are dropped.
   * @default 30000 (30 seconds)
   */
  earlyQueueTTLMs?: number;

  /**
   * Delay in milliseconds before cleaning up trace data after all spans have ended.
   * This allows late-arriving data to still be processed.
   * @default 30000 (30 seconds)
   */
  traceCleanupDelayMs?: number;

  /**
   * Soft cap on number of traces with activeSpanCount == 0 awaiting cleanup.
   * When exceeded, oldest pending traces are force-cleaned.
   * @default 100
   */
  maxPendingCleanupTraces?: number;

  /**
   * Hard cap on total number of traces (including active ones).
   * When exceeded, oldest traces are killed (active spans aborted).
   * Safety valve for memory leaks.
   * @default 500
   */
  maxTotalTraces?: number;
}

/**
 * Per-trace data container that stores vendor-specific span/event objects and
 * manages the waiting queue for out-of-order event processing.
 *
 * @typeParam TRootData - Vendor-specific root/trace object type (e.g., Langfuse trace, Braintrust logger)
 * @typeParam TSpanData - Vendor-specific span object type (e.g., LangSmith RunTree, Braintrust Span)
 * @typeParam TEventData - Vendor-specific event object type
 * @typeParam TMetadata - Vendor-specific metadata type for spans
 */
export class TraceData<TRootData, TSpanData, TEventData, TMetadata> {
  /** The vendor-specific root/trace object */
  #rootSpan?: TRootData;
  /** The span ID of the root span */
  #rootSpanId?: string;
  /** Whether a span with isRootSpan=true has been successfully processed */
  #rootSpanProcessed: boolean;
  /** Maps eventId to vendor-specific event objects */
  #events: Map<string, TEventData>;
  /** Maps spanId to vendor-specific span objects */
  #spans: Map<string, TSpanData>;
  /** Maps spanId to parentSpanId, representing the span hierarchy */
  #tree: Map<string, string | undefined>;
  /** Set of span IDs that have started but not yet ended */
  #activeSpanIds: Set<string>;
  /** Maps spanId to vendor-specific metadata */
  #metadata: Map<string, TMetadata>;
  /** Arbitrary key-value storage for per-trace data */
  #extraData: Map<string, unknown>;
  /** Events waiting for the root span to be processed */
  #waitingForRoot: QueuedEvent[];
  /** Events waiting for specific parent spans, keyed by parentSpanId */
  #waitingForParent: Map<string, QueuedEvent[]>;

  /** When this trace data was created, used for cap enforcement */
  readonly createdAt: Date;

  constructor() {
    this.#events = new Map();
    this.#spans = new Map();
    this.#activeSpanIds = new Set();
    this.#tree = new Map();
    this.#metadata = new Map();
    this.#extraData = new Map();
    this.#rootSpanProcessed = false;
    this.#waitingForRoot = [];
    this.#waitingForParent = new Map();
    this.createdAt = new Date();
  }

  /**
   * Check if this trace has a root span registered.
   * @returns True if addRoot() has been called
   */
  hasRoot(): boolean {
    return !!this.#rootSpanId;
  }

  /**
   * Register the root span for this trace.
   * @param args.rootId - The span ID of the root span
   * @param args.rootData - The vendor-specific root object
   */
  addRoot(args: { rootId: string; rootData: TRootData }): void {
    this.#rootSpanId = args.rootId;
    this.#rootSpan = args.rootData;
    this.#rootSpanProcessed = true;
  }

  /**
   * Get the vendor-specific root object.
   * @returns The root object, or undefined if not yet set
   */
  getRoot(): TRootData | undefined {
    return this.#rootSpan;
  }

  /**
   * Check if a span with isRootSpan=true has been successfully processed.
   * Set via addRoot() or markRootSpanProcessed().
   * @returns True if the root span has been processed
   */
  isRootProcessed(): boolean {
    return this.#rootSpanProcessed;
  }

  /**
   * Mark that the root span has been processed.
   * Used by exporters with skipBuildRootTask=true where root goes through _buildSpan
   * instead of _buildRoot.
   */
  markRootSpanProcessed(): void {
    this.#rootSpanProcessed = true;
  }

  /**
   * Store an arbitrary value in per-trace storage.
   * @param key - Storage key
   * @param value - Value to store
   */
  setExtraValue(key: string, value: unknown): void {
    this.#extraData.set(key, value);
  }

  /**
   * Check if a key exists in per-trace storage.
   * @param key - Storage key
   * @returns True if the key exists
   */
  hasExtraValue(key: string): boolean {
    return this.#extraData.has(key);
  }

  /**
   * Get a value from per-trace storage.
   * @param key - Storage key
   * @returns The stored value, or undefined if not found
   */
  getExtraValue(key: string): unknown {
    return this.#extraData.get(key);
  }

  // ============================================================================
  // Early Queue Methods
  // ============================================================================

  /**
   * Add an event to the waiting queue.
   * @param args.event - The tracing event to queue
   * @param args.waitingFor - 'root' or a specific parentSpanId
   * @param args.attempts - Optional: preserve attempts count when re-queuing
   * @param args.queuedAt - Optional: preserve original queue time when re-queuing
   */
  addToWaitingQueue(args: {
    event: TracingEvent;
    waitingFor: 'root' | string;
    attempts?: number;
    queuedAt?: Date;
  }): void {
    const queuedEvent: QueuedEvent = {
      event: args.event,
      waitingFor: args.waitingFor,
      attempts: args.attempts ?? 0,
      queuedAt: args.queuedAt ?? new Date(),
    };

    if (args.waitingFor === 'root') {
      this.#waitingForRoot.push(queuedEvent);
    } else {
      const queue = this.#waitingForParent.get(args.waitingFor) ?? [];
      queue.push(queuedEvent);
      this.#waitingForParent.set(args.waitingFor, queue);
    }
  }

  /**
   * Get all events waiting for the root span.
   * Returns a copy of the internal array.
   */
  getEventsWaitingForRoot(): QueuedEvent[] {
    return [...this.#waitingForRoot];
  }

  /**
   * Get all events waiting for a specific parent span.
   * Returns a copy of the internal array.
   */
  getEventsWaitingFor(args: { spanId: string }): QueuedEvent[] {
    return [...(this.#waitingForParent.get(args.spanId) ?? [])];
  }

  /**
   * Clear the waiting-for-root queue.
   */
  clearWaitingForRoot(): void {
    this.#waitingForRoot = [];
  }

  /**
   * Clear the waiting queue for a specific parent span.
   */
  clearWaitingFor(args: { spanId: string }): void {
    this.#waitingForParent.delete(args.spanId);
  }

  /**
   * Get total count of events in all waiting queues.
   */
  waitingQueueSize(): number {
    let count = this.#waitingForRoot.length;
    for (const queue of this.#waitingForParent.values()) {
      count += queue.length;
    }
    return count;
  }

  /**
   * Get all queued events across all waiting queues.
   * Used for cleanup and logging orphaned events.
   * @returns Array of all queued events
   */
  getAllQueuedEvents(): QueuedEvent[] {
    const all: QueuedEvent[] = [...this.#waitingForRoot];
    for (const queue of this.#waitingForParent.values()) {
      all.push(...queue);
    }
    return all;
  }

  // ============================================================================
  // Span Tree Methods
  // ============================================================================

  /**
   * Record the parent-child relationship for a span.
   * @param args.spanId - The child span ID
   * @param args.parentSpanId - The parent span ID, or undefined for root spans
   */
  addBranch(args: { spanId: string; parentSpanId: string | undefined }): void {
    this.#tree.set(args.spanId, args.parentSpanId);
  }

  /**
   * Get the parent span ID for a given span.
   * @param args.spanId - The span ID to look up
   * @returns The parent span ID, or undefined if root or not found
   */
  getParentId(args: { spanId: string }): string | undefined {
    return this.#tree.get(args.spanId);
  }

  // ============================================================================
  // Span Management Methods
  // ============================================================================

  /**
   * Register a span and mark it as active.
   * @param args.spanId - The span ID
   * @param args.spanData - The vendor-specific span object
   */
  addSpan(args: { spanId: string; spanData: TSpanData }): void {
    this.#spans.set(args.spanId, args.spanData);
    this.#activeSpanIds.add(args.spanId);
  }

  /**
   * Check if a span exists (regardless of active state).
   * @param args.spanId - The span ID to check
   * @returns True if the span exists
   */
  hasSpan(args: { spanId: string }): boolean {
    return this.#spans.has(args.spanId);
  }

  /**
   * Get a span by ID.
   * @param args.spanId - The span ID to look up
   * @returns The vendor-specific span object, or undefined if not found
   */
  getSpan(args: { spanId: string }): TSpanData | undefined {
    return this.#spans.get(args.spanId);
  }

  /**
   * Mark a span as ended (no longer active).
   * @param args.spanId - The span ID to mark as ended
   */
  endSpan(args: { spanId: string }): void {
    this.#activeSpanIds.delete(args.spanId);
  }

  /**
   * Check if a span is currently active (started but not ended).
   * @param args.spanId - The span ID to check
   * @returns True if the span is active
   */
  isActiveSpan(args: { spanId: string }): boolean {
    return this.#activeSpanIds.has(args.spanId);
  }

  /**
   * Get the count of currently active spans.
   * @returns Number of active spans
   */
  activeSpanCount(): number {
    return this.#activeSpanIds.size;
  }

  /**
   * Get all active span IDs.
   * @returns Array of active span IDs
   */
  get activeSpanIds(): string[] {
    return [...this.#activeSpanIds];
  }

  // ============================================================================
  // Event Management Methods
  // ============================================================================

  /**
   * Register an event.
   * @param args.eventId - The event ID
   * @param args.eventData - The vendor-specific event object
   */
  addEvent(args: { eventId: string; eventData: TEventData }): void {
    this.#events.set(args.eventId, args.eventData);
  }

  // ============================================================================
  // Metadata Methods
  // ============================================================================

  /**
   * Store vendor-specific metadata for a span.
   * Note: This overwrites any existing metadata for the span.
   * @param args.spanId - The span ID
   * @param args.metadata - The vendor-specific metadata
   */
  addMetadata(args: { spanId: string; metadata: TMetadata }): void {
    this.#metadata.set(args.spanId, args.metadata);
  }

  /**
   * Get vendor-specific metadata for a span.
   * @param args.spanId - The span ID
   * @returns The metadata, or undefined if not found
   */
  getMetadata(args: { spanId: string }): TMetadata | undefined {
    return this.#metadata.get(args.spanId);
  }

  // ============================================================================
  // Parent Lookup Methods
  // ============================================================================

  /**
   * Get the parent span or event for a given span.
   * Looks up in both spans and events maps.
   * @param args.span - The span to find the parent for
   * @returns The parent span/event object, or undefined if root or not found
   */
  getParent(args: { span: AnyExportedSpan }): TSpanData | TEventData | undefined {
    const parentId = args.span.parentSpanId;
    if (parentId) {
      if (this.#spans.has(parentId)) {
        return this.#spans.get(parentId);
      }
      if (this.#events.has(parentId)) {
        return this.#events.get(parentId);
      }
    }
    return undefined;
  }

  /**
   * Get the parent span/event or fall back to the root object.
   * Useful for vendors that attach child spans to either parent spans or the trace root.
   * @param args.span - The span to find the parent for
   * @returns The parent span/event, the root object, or undefined
   */
  getParentOrRoot(args: { span: AnyExportedSpan }): TRootData | TSpanData | TEventData | undefined {
    return this.getParent(args) ?? this.getRoot();
  }
}

// Default configuration values
const DEFAULT_EARLY_QUEUE_MAX_ATTEMPTS = 5;
const DEFAULT_EARLY_QUEUE_TTL_MS = 30000; // 30 seconds
const DEFAULT_TRACE_CLEANUP_DELAY_MS = 30000; // 30 seconds
const DEFAULT_MAX_PENDING_CLEANUP_TRACES = 100;
const DEFAULT_MAX_TOTAL_TRACES = 500;

/**
 * Abstract base class for vendor-specific observability exporters that need to
 * track trace and span state in memory.
 *
 * This class provides:
 * - Per-trace data caching via TraceData instances
 * - Out-of-order span handling via waiting queues (for when children arrive before parents)
 * - Delayed cleanup to handle late-arriving data
 * - Memory management via configurable soft/hard caps on trace count
 * - Graceful shutdown with span abortion
 *
 * Subclasses must implement the abstract methods to handle vendor-specific
 * span/event creation and lifecycle.
 *
 * @typeParam TRootData - Vendor-specific root/trace object type
 * @typeParam TSpanData - Vendor-specific span object type
 * @typeParam TEventData - Vendor-specific event object type
 * @typeParam TMetadata - Vendor-specific metadata type
 * @typeParam TConfig - Configuration type (must extend TrackingExporterConfig)
 *
 * @example
 * ```typescript
 * class MyExporter extends TrackingExporter<MyRoot, MySpan, MyEvent, MyMeta, MyConfig> {
 *   name = 'my-exporter';
 *
 *   protected async _buildRoot(args) { ... }
 *   protected async _buildSpan(args) { ... }
 *   protected async _buildEvent(args) { ... }
 *   protected async _updateSpan(args) { ... }
 *   protected async _finishSpan(args) { ... }
 *   protected async _abortSpan(args) { ... }
 * }
 * ```
 */
export abstract class TrackingExporter<
  TRootData,
  TSpanData,
  TEventData,
  TMetadata,
  TConfig extends TrackingExporterConfig,
> extends BaseExporter {
  /** Map of traceId to per-trace data container */
  #traceMap = new Map<string, TraceData<TRootData, TSpanData, TEventData, TMetadata>>();
  /** Flag to prevent processing during shutdown */
  #shutdownStarted = false;
  /** Flag to prevent concurrent hard cap enforcement */
  #hardCapEnforcementInProgress = false;
  /** Map of traceId to scheduled cleanup timeout */
  #pendingCleanups = new Map<string, ReturnType<typeof setTimeout>>();
  // Note: #traceMap maintains insertion order (JS Map spec), so we use
  // #traceMap.keys() to iterate traces oldest-first for cap enforcement.

  /** Subclass configuration with resolved values */
  protected readonly config: TConfig;

  /** Maximum attempts to process a queued event before dropping */
  readonly #earlyQueueMaxAttempts: number;
  /** TTL in milliseconds for queued events */
  readonly #earlyQueueTTLMs: number;
  /** Delay before cleaning up completed traces */
  readonly #traceCleanupDelayMs: number;
  /** Soft cap on traces awaiting cleanup */
  readonly #maxPendingCleanupTraces: number;
  /** Hard cap on total traces (will abort active spans if exceeded) */
  readonly #maxTotalTraces: number;

  constructor(config: TConfig) {
    super(config);
    this.config = config;

    this.#earlyQueueMaxAttempts = config.earlyQueueMaxAttempts ?? DEFAULT_EARLY_QUEUE_MAX_ATTEMPTS;
    this.#earlyQueueTTLMs = config.earlyQueueTTLMs ?? DEFAULT_EARLY_QUEUE_TTL_MS;
    this.#traceCleanupDelayMs = config.traceCleanupDelayMs ?? DEFAULT_TRACE_CLEANUP_DELAY_MS;
    this.#maxPendingCleanupTraces = config.maxPendingCleanupTraces ?? DEFAULT_MAX_PENDING_CLEANUP_TRACES;
    this.#maxTotalTraces = config.maxTotalTraces ?? DEFAULT_MAX_TOTAL_TRACES;
  }

  // ============================================================================
  // Early Queue Processing
  // ============================================================================

  /**
   * Schedule async processing of events waiting for root span.
   * Called after root span is successfully processed.
   */
  #scheduleProcessWaitingForRoot(traceId: string): void {
    setImmediate(() => {
      this.#processWaitingForRoot(traceId).catch(error => {
        this.logger.error(`${this.name}: Error processing waiting-for-root queue`, { error, traceId });
      });
    });
  }

  /**
   * Schedule async processing of events waiting for a specific parent span.
   * Called after a span/event is successfully created.
   */
  #scheduleProcessWaitingFor(traceId: string, spanId: string): void {
    setImmediate(() => {
      this.#processWaitingFor(traceId, spanId).catch(error => {
        this.logger.error(`${this.name}: Error processing waiting queue`, { error, traceId, spanId });
      });
    });
  }

  /**
   * Process all events waiting for root span.
   */
  async #processWaitingForRoot(traceId: string): Promise<void> {
    if (this.#shutdownStarted) return;

    const traceData = this.#traceMap.get(traceId);
    if (!traceData) return;

    const queue = traceData.getEventsWaitingForRoot();
    if (queue.length === 0) return;

    this.logger.debug(`${this.name}: Processing ${queue.length} events waiting for root`, { traceId });

    // Process events, collecting ones to keep
    const toKeep: QueuedEvent[] = [];
    const now = Date.now();

    for (const queuedEvent of queue) {
      // Check TTL
      if (now - queuedEvent.queuedAt.getTime() > this.#earlyQueueTTLMs) {
        this.logger.warn(`${this.name}: Dropping event due to TTL expiry`, {
          traceId,
          spanId: queuedEvent.event.exportedSpan.id,
          waitingFor: queuedEvent.waitingFor,
          queuedAt: queuedEvent.queuedAt,
          attempts: queuedEvent.attempts,
        });
        continue;
      }

      // Check max attempts
      if (queuedEvent.attempts >= this.#earlyQueueMaxAttempts) {
        this.logger.warn(`${this.name}: Dropping event due to max attempts`, {
          traceId,
          spanId: queuedEvent.event.exportedSpan.id,
          waitingFor: queuedEvent.waitingFor,
          attempts: queuedEvent.attempts,
        });
        continue;
      }

      // Try to process
      queuedEvent.attempts++;
      const processed = await this.#tryProcessQueuedEvent(queuedEvent, traceData);

      if (!processed) {
        // Move to waiting-for-parent if we now know the parent
        const parentId = queuedEvent.event.exportedSpan.parentSpanId;
        if (parentId && traceData.isRootProcessed()) {
          // Preserve attempts and queuedAt when moving between queues
          traceData.addToWaitingQueue({
            event: queuedEvent.event,
            waitingFor: parentId,
            attempts: queuedEvent.attempts,
            queuedAt: queuedEvent.queuedAt,
          });
        } else {
          toKeep.push(queuedEvent);
        }
      }
    }

    // Update the queue with remaining events
    traceData.clearWaitingForRoot();
    for (const event of toKeep) {
      // Preserve attempts and queuedAt when re-adding to queue
      traceData.addToWaitingQueue({
        event: event.event,
        waitingFor: 'root',
        attempts: event.attempts,
        queuedAt: event.queuedAt,
      });
    }
  }

  /**
   * Process events waiting for a specific parent span.
   */
  async #processWaitingFor(traceId: string, spanId: string): Promise<void> {
    if (this.#shutdownStarted) return;

    const traceData = this.#traceMap.get(traceId);
    if (!traceData) return;

    const queue = traceData.getEventsWaitingFor({ spanId });
    if (queue.length === 0) return;

    this.logger.debug(`${this.name}: Processing ${queue.length} events waiting for span`, { traceId, spanId });

    const toKeep: QueuedEvent[] = [];
    const now = Date.now();

    for (const queuedEvent of queue) {
      // Check TTL
      if (now - queuedEvent.queuedAt.getTime() > this.#earlyQueueTTLMs) {
        this.logger.warn(`${this.name}: Dropping event due to TTL expiry`, {
          traceId,
          spanId: queuedEvent.event.exportedSpan.id,
          waitingFor: queuedEvent.waitingFor,
          queuedAt: queuedEvent.queuedAt,
          attempts: queuedEvent.attempts,
        });
        continue;
      }

      // Check max attempts
      if (queuedEvent.attempts >= this.#earlyQueueMaxAttempts) {
        this.logger.warn(`${this.name}: Dropping event due to max attempts`, {
          traceId,
          spanId: queuedEvent.event.exportedSpan.id,
          waitingFor: queuedEvent.waitingFor,
          attempts: queuedEvent.attempts,
        });
        continue;
      }

      // Try to process
      queuedEvent.attempts++;
      const processed = await this.#tryProcessQueuedEvent(queuedEvent, traceData);

      if (!processed) {
        toKeep.push(queuedEvent);
      }
    }

    // Update the queue
    traceData.clearWaitingFor({ spanId });
    for (const event of toKeep) {
      // Preserve attempts and queuedAt when re-adding to queue
      traceData.addToWaitingQueue({
        event: event.event,
        waitingFor: spanId,
        attempts: event.attempts,
        queuedAt: event.queuedAt,
      });
    }
  }

  /**
   * Try to process a queued event.
   * Returns true if successfully processed, false if still waiting for dependencies.
   */
  async #tryProcessQueuedEvent(
    queuedEvent: QueuedEvent,
    traceData: TraceData<TRootData, TSpanData, TEventData, TMetadata>,
  ): Promise<boolean> {
    const { event } = queuedEvent;
    const { exportedSpan } = event;

    // Determine method
    const method = this.getMethod(event);

    try {
      switch (method) {
        case 'handleEventSpan': {
          traceData.addBranch({ spanId: exportedSpan.id, parentSpanId: exportedSpan.parentSpanId });
          const eventData = await this._buildEvent({ span: exportedSpan, traceData });
          if (eventData) {
            if (!this.skipCachingEventSpans) {
              traceData.addEvent({ eventId: exportedSpan.id, eventData });
            }
            // Successfully processed - schedule processing of events waiting for this one
            this.#scheduleProcessWaitingFor(exportedSpan.traceId, exportedSpan.id);
            return true;
          }
          return false;
        }

        case 'handleSpanStart': {
          traceData.addBranch({ spanId: exportedSpan.id, parentSpanId: exportedSpan.parentSpanId });
          const spanData = await this._buildSpan({ span: exportedSpan, traceData });
          if (spanData) {
            traceData.addSpan({ spanId: exportedSpan.id, spanData });
            // Mark root as processed if this is the root span
            if (exportedSpan.isRootSpan) {
              traceData.markRootSpanProcessed();
            }
            // Successfully processed - schedule processing of events waiting for this one
            this.#scheduleProcessWaitingFor(exportedSpan.traceId, exportedSpan.id);
            return true;
          }
          return false;
        }

        case 'handleSpanUpdate': {
          await this._updateSpan({ span: exportedSpan, traceData });
          return true;
        }

        case 'handleSpanEnd': {
          traceData.endSpan({ spanId: exportedSpan.id });
          await this._finishSpan({ span: exportedSpan, traceData });
          // Check if we should schedule cleanup
          if (traceData.activeSpanCount() === 0) {
            this.#scheduleCleanup(exportedSpan.traceId);
          }
          return true;
        }
        default:
          // Should never happen - exhaustive switch
          return false;
      }
    } catch (error) {
      this.logger.error(`${this.name}: Error processing queued event`, { error, event, method });
      return false;
    }
  }

  // ============================================================================
  // Delayed Cleanup
  // ============================================================================

  /**
   * Schedule cleanup of trace data after a delay.
   * Allows late-arriving data to still be processed.
   */
  #scheduleCleanup(traceId: string): void {
    // Cancel any existing scheduled cleanup for this trace
    this.#cancelScheduledCleanup(traceId);

    this.logger.debug(`${this.name}: Scheduling cleanup in ${this.#traceCleanupDelayMs}ms`, { traceId });

    const timeout = setTimeout(() => {
      this.#pendingCleanups.delete(traceId);
      this.#performCleanup(traceId);
    }, this.#traceCleanupDelayMs);

    this.#pendingCleanups.set(traceId, timeout);

    // Enforce soft cap on pending cleanups
    this.#enforcePendingCleanupCap();
  }

  /**
   * Cancel a scheduled cleanup for a trace.
   */
  #cancelScheduledCleanup(traceId: string): void {
    const existingTimeout = this.#pendingCleanups.get(traceId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.#pendingCleanups.delete(traceId);
      this.logger.debug(`${this.name}: Cancelled scheduled cleanup`, { traceId });
    }
  }

  /**
   * Perform the actual cleanup of trace data.
   */
  #performCleanup(traceId: string): void {
    const traceData = this.#traceMap.get(traceId);
    if (!traceData) return;

    // Log any orphaned events in the queue
    const orphanedEvents = traceData.getAllQueuedEvents();
    if (orphanedEvents.length > 0) {
      this.logger.warn(`${this.name}: Dropping ${orphanedEvents.length} orphaned events on cleanup`, {
        traceId,
        orphanedEvents: orphanedEvents.map(e => ({
          spanId: e.event.exportedSpan.id,
          waitingFor: e.waitingFor,
          attempts: e.attempts,
          queuedAt: e.queuedAt,
        })),
      });
    }

    // Remove from trace map (O(1) - Map maintains insertion order automatically)
    this.#traceMap.delete(traceId);

    this.logger.debug(`${this.name}: Cleaned up trace data`, { traceId });
  }

  // ============================================================================
  // Cap Enforcement
  // ============================================================================

  /**
   * Enforce soft cap on pending cleanup traces.
   * Only removes traces with activeSpanCount == 0.
   */
  #enforcePendingCleanupCap(): void {
    if (this.#pendingCleanups.size <= this.#maxPendingCleanupTraces) {
      return;
    }

    const toRemove = this.#pendingCleanups.size - this.#maxPendingCleanupTraces;
    this.logger.warn(`${this.name}: Pending cleanup cap exceeded, force-cleaning ${toRemove} traces`, {
      pendingCount: this.#pendingCleanups.size,
      cap: this.#maxPendingCleanupTraces,
    });

    // Remove oldest pending cleanups (Map.keys() iterates in insertion order)
    let removed = 0;
    for (const traceId of this.#traceMap.keys()) {
      if (removed >= toRemove) break;

      if (this.#pendingCleanups.has(traceId)) {
        this.#cancelScheduledCleanup(traceId);
        this.#performCleanup(traceId);
        removed++;
      }
    }
  }

  /**
   * Enforce hard cap on total traces.
   * Will kill even active traces if necessary.
   * Uses a flag to prevent concurrent executions when called fire-and-forget.
   */
  async #enforceHardCap(): Promise<void> {
    // Skip if already under cap or enforcement already in progress
    if (this.#traceMap.size <= this.#maxTotalTraces || this.#hardCapEnforcementInProgress) {
      return;
    }

    this.#hardCapEnforcementInProgress = true;
    try {
      // Re-check after acquiring the flag (another call may have just finished)
      if (this.#traceMap.size <= this.#maxTotalTraces) {
        return;
      }

      const toRemove = this.#traceMap.size - this.#maxTotalTraces;
      this.logger.warn(`${this.name}: Total trace cap exceeded, killing ${toRemove} oldest traces`, {
        traceCount: this.#traceMap.size,
        cap: this.#maxTotalTraces,
      });

      const reason: SpanErrorInfo = {
        id: 'TRACE_CAP_EXCEEDED',
        message: 'Trace killed due to memory cap enforcement.',
        domain: 'MASTRA_OBSERVABILITY',
        category: 'SYSTEM',
      };

      let removed = 0;
      // Use a copy of keys since we're modifying the map during iteration
      for (const traceId of [...this.#traceMap.keys()]) {
        if (removed >= toRemove) break;

        const traceData = this.#traceMap.get(traceId);
        if (traceData) {
          // Abort any active spans
          for (const spanId of traceData.activeSpanIds) {
            const span = traceData.getSpan({ spanId });
            if (span) {
              await this._abortSpan({ span, traceData, reason });
            }
          }

          // Cancel any pending cleanup and remove
          this.#cancelScheduledCleanup(traceId);
          this.#performCleanup(traceId);
          removed++;
        }
      }
    } finally {
      this.#hardCapEnforcementInProgress = false;
    }
  }

  // ============================================================================
  // Lifecycle Hooks (Override in subclass)
  // ============================================================================

  /**
   * Hook called before processing each tracing event.
   * Override to transform or enrich the event before processing.
   * @param event - The incoming tracing event
   * @returns The (possibly modified) event to process
   */
  protected async _preExportTracingEvent(event: TracingEvent): Promise<TracingEvent> {
    return event;
  }

  /**
   * Hook called after processing each tracing event.
   * Override to perform post-processing actions like flushing.
   */
  protected async _postExportTracingEvent(): Promise<void> {}

  // ============================================================================
  // Abstract Methods (Must implement in subclass)
  // ============================================================================

  /**
   * Build the vendor-specific root/trace object for a new trace.
   * Called when the first span of a trace arrives (if skipBuildRootTask is false).
   *
   * @param args.span - The root span data
   * @param args.traceData - The trace data container
   * @returns The vendor-specific root object, or undefined if unable to create
   */
  protected abstract _buildRoot(args: {
    span: AnyExportedSpan;
    traceData: TraceData<TRootData, TSpanData, TEventData, TMetadata>;
  }): Promise<TRootData | undefined>;

  /**
   * Build a vendor-specific event object.
   * Events are zero-duration spans used for logging discrete occurrences.
   *
   * @param args.span - The event span data
   * @param args.traceData - The trace data container
   * @returns The vendor-specific event object, or undefined if parent not ready
   */
  protected abstract _buildEvent(args: {
    span: AnyExportedSpan;
    traceData: TraceData<TRootData, TSpanData, TEventData, TMetadata>;
  }): Promise<TEventData | undefined>;

  /**
   * Build a vendor-specific span object when a span starts.
   * Should create the span in the vendor system and return the SDK object.
   *
   * @param args.span - The span data
   * @param args.traceData - The trace data container
   * @returns The vendor-specific span object, or undefined if parent not ready
   */
  protected abstract _buildSpan(args: {
    span: AnyExportedSpan;
    traceData: TraceData<TRootData, TSpanData, TEventData, TMetadata>;
  }): Promise<TSpanData | undefined>;

  /**
   * Update a span with new data (called on span_updated events).
   * Should update the vendor span with any new attributes, metrics, etc.
   *
   * @param args.span - The updated span data
   * @param args.traceData - The trace data container
   */
  protected abstract _updateSpan(args: {
    span: AnyExportedSpan;
    traceData: TraceData<TRootData, TSpanData, TEventData, TMetadata>;
  }): Promise<void>;

  /**
   * Finish a span (called on span_ended events).
   * Should close/end the span in the vendor system with final data.
   *
   * @param args.span - The ended span data
   * @param args.traceData - The trace data container
   */
  protected abstract _finishSpan(args: {
    span: AnyExportedSpan;
    traceData: TraceData<TRootData, TSpanData, TEventData, TMetadata>;
  }): Promise<void>;

  /**
   * Abort a span due to shutdown or memory cap enforcement.
   * Should mark the span as failed/aborted in the vendor system.
   *
   * @param args.span - The vendor-specific span object to abort
   * @param args.traceData - The trace data container
   * @param args.reason - Error info describing why the span was aborted
   */
  protected abstract _abortSpan(args: {
    span: TSpanData;
    traceData: TraceData<TRootData, TSpanData, TEventData, TMetadata>;
    reason: SpanErrorInfo;
  }): Promise<void>;

  // ============================================================================
  // Behavior Flags (Override in subclass as needed)
  // ============================================================================

  /**
   * If true, skip calling _buildRoot and let root spans go through _buildSpan.
   * Use when the vendor doesn't have a separate trace/root concept.
   * @default false
   */
  protected skipBuildRootTask = false;

  /**
   * If true, skip processing span_updated events entirely.
   * Use when the vendor doesn't support incremental span updates.
   * @default false
   */
  protected skipSpanUpdateEvents = false;

  /**
   * If true, don't cache event spans in TraceData.
   * Use when events can't be parents of other spans.
   * @default false
   */
  protected skipCachingEventSpans = false;

  private getMethod(event: TracingEvent): 'handleEventSpan' | 'handleSpanStart' | 'handleSpanUpdate' | 'handleSpanEnd' {
    if (event.exportedSpan.isEvent) {
      return 'handleEventSpan';
    }
    const eventType = event.type;
    switch (eventType) {
      case TracingEventType.SPAN_STARTED:
        return 'handleSpanStart';
      case TracingEventType.SPAN_UPDATED:
        return 'handleSpanUpdate';
      case TracingEventType.SPAN_ENDED:
        return 'handleSpanEnd';
      default: {
        // Exhaustive check - TypeScript will error if new TracingEventType values are added
        const _exhaustiveCheck: never = eventType;
        throw new Error(`Unhandled event type: ${_exhaustiveCheck}`);
      }
    }
  }

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    if (this.#shutdownStarted) {
      return;
    }

    const method = this.getMethod(event);
    if (method == 'handleSpanUpdate' && this.skipSpanUpdateEvents) {
      return;
    }

    const traceId = event.exportedSpan.traceId;
    const traceData = this.getTraceData({ traceId, method });

    const { exportedSpan } = await this._preExportTracingEvent(event);

    // Handle root span building for exporters that need it
    if (!this.skipBuildRootTask && !traceData.hasRoot()) {
      if (exportedSpan.isRootSpan) {
        this.logger.debug(`${this.name}: Building root`, {
          traceId: exportedSpan.traceId,
          spanId: exportedSpan.id,
        });
        const rootData = await this._buildRoot({ span: exportedSpan, traceData });
        if (rootData) {
          this.logger.debug(`${this.name}: Adding root`, {
            traceId: exportedSpan.traceId,
            spanId: exportedSpan.id,
          });
          traceData.addRoot({ rootId: exportedSpan.id, rootData });
          // Root is now processed, trigger async processing of waiting events
          this.#scheduleProcessWaitingForRoot(traceId);
        }
        // Note: Root span still continues to handleSpanStart below to track
        // the span as active and call _buildSpan for vendor-specific handling
      } else {
        this.logger.debug(`${this.name}: Root does not exist, adding span to waiting queue.`, {
          traceId: exportedSpan.traceId,
          spanId: exportedSpan.id,
        });
        traceData.addToWaitingQueue({ event, waitingFor: 'root' });
        return;
      }
    }

    if (exportedSpan.metadata && this.name in exportedSpan.metadata) {
      const metadata = exportedSpan.metadata[this.name] as TMetadata;
      this.logger.debug(`${this.name}: Found provider metadata in span`, {
        traceId: exportedSpan.traceId,
        spanId: exportedSpan.id,
        metadata,
      });
      traceData.addMetadata({ spanId: exportedSpan.id, metadata });
    }

    try {
      switch (method) {
        case 'handleEventSpan': {
          this.logger.debug(`${this.name}: handling event`, {
            traceId: exportedSpan.traceId,
            spanId: exportedSpan.id,
          });
          traceData.addBranch({ spanId: exportedSpan.id, parentSpanId: exportedSpan.parentSpanId });
          const eventData = await this._buildEvent({ span: exportedSpan, traceData });
          if (eventData) {
            if (!this.skipCachingEventSpans) {
              this.logger.debug(`${this.name}: adding event to traceData`, {
                traceId: exportedSpan.traceId,
                spanId: exportedSpan.id,
              });
              traceData.addEvent({ eventId: exportedSpan.id, eventData });
            }
            // Event created successfully, trigger processing of any waiting events
            this.#scheduleProcessWaitingFor(traceId, exportedSpan.id);
          } else {
            // Parent doesn't exist, queue for later
            const parentId = exportedSpan.parentSpanId;
            this.logger.debug(`${this.name}: adding event to waiting queue`, {
              traceId: exportedSpan.traceId,
              spanId: exportedSpan.id,
              waitingFor: parentId ?? 'root',
            });
            traceData.addToWaitingQueue({ event, waitingFor: parentId ?? 'root' });
          }
          break;
        }
        case 'handleSpanStart': {
          this.logger.debug(`${this.name}: handling span start`, {
            traceId: exportedSpan.traceId,
            spanId: exportedSpan.id,
          });
          traceData.addBranch({ spanId: exportedSpan.id, parentSpanId: exportedSpan.parentSpanId });
          const spanData = await this._buildSpan({ span: exportedSpan, traceData });
          if (spanData) {
            this.logger.debug(`${this.name}: adding span to traceData`, {
              traceId: exportedSpan.traceId,
              spanId: exportedSpan.id,
            });
            traceData.addSpan({ spanId: exportedSpan.id, spanData });
            // Mark root as processed for skipBuildRootTask exporters
            if (exportedSpan.isRootSpan) {
              traceData.markRootSpanProcessed();
              this.#scheduleProcessWaitingForRoot(traceId);
            }
            // Span created successfully, trigger processing of any waiting events
            this.#scheduleProcessWaitingFor(traceId, exportedSpan.id);
          } else {
            // Parent doesn't exist, queue for later
            const parentId = exportedSpan.parentSpanId;
            this.logger.debug(`${this.name}: adding span to waiting queue`, {
              traceId: exportedSpan.traceId,
              waitingFor: parentId ?? 'root',
            });
            traceData.addToWaitingQueue({ event, waitingFor: parentId ?? 'root' });
          }
          break;
        }
        case 'handleSpanUpdate':
          this.logger.debug(`${this.name}: handling span update`, {
            traceId: exportedSpan.traceId,
            spanId: exportedSpan.id,
          });
          await this._updateSpan({ span: exportedSpan, traceData });
          break;
        case 'handleSpanEnd':
          this.logger.debug(`${this.name}: handling span end`, {
            traceId: exportedSpan.traceId,
            spanId: exportedSpan.id,
          });
          traceData.endSpan({ spanId: exportedSpan.id });
          await this._finishSpan({ span: exportedSpan, traceData });
          // Schedule cleanup when all spans have ended
          if (traceData.activeSpanCount() === 0) {
            this.#scheduleCleanup(traceId);
          }
          break;
      }
    } catch (error) {
      this.logger.error(`${this.name}: exporter error`, { error, event, method });
    }

    // Reschedule cleanup if all spans have ended
    // This handles the case where late data arrives after all spans ended
    // (getTraceData cancels any existing cleanup, so we need to reschedule)
    if (traceData.activeSpanCount() === 0) {
      this.#scheduleCleanup(traceId);
    }

    await this._postExportTracingEvent();
  }

  // ============================================================================
  // Protected Helpers
  // ============================================================================

  /**
   * Get or create the TraceData container for a trace.
   * Also cancels any pending cleanup since new data has arrived.
   *
   * @param args.traceId - The trace ID
   * @param args.method - The calling method name (for logging)
   * @returns The TraceData container for this trace
   */
  protected getTraceData(args: {
    traceId: string;
    method: string;
  }): TraceData<TRootData, TSpanData, TEventData, TMetadata> {
    const { traceId, method } = args;

    // Cancel any scheduled cleanup - new data has arrived
    this.#cancelScheduledCleanup(traceId);

    if (!this.#traceMap.has(traceId)) {
      this.#traceMap.set(traceId, new TraceData());
      // Note: Map.set() maintains insertion order automatically
      this.logger.debug(`${this.name}: Created new trace data cache`, {
        traceId,
        method,
      });

      // Enforce hard cap on total traces
      this.#enforceHardCap().catch(error => {
        this.logger.error(`${this.name}: Error enforcing hard cap`, { error });
      });
    }
    return this.#traceMap.get(traceId)!;
  }

  /**
   * Get the current number of traces being tracked.
   * @returns The trace count
   */
  protected traceMapSize(): number {
    return this.#traceMap.size;
  }

  // ============================================================================
  // Shutdown Hooks (Override in subclass as needed)
  // ============================================================================

  /**
   * Hook called at the start of shutdown, before cancelling timers and aborting spans.
   * Override to perform vendor-specific pre-shutdown tasks.
   */
  protected async _preShutdown(): Promise<void> {}

  /**
   * Hook called at the end of shutdown, after all spans are aborted.
   * Override to perform vendor-specific cleanup (e.g., flushing).
   */
  protected async _postShutdown(): Promise<void> {}

  /**
   * Gracefully shut down the exporter.
   * Cancels all pending cleanup timers, aborts all active spans, and clears state.
   */
  async shutdown(): Promise<void> {
    if (this.isDisabled) {
      return;
    }

    this.#shutdownStarted = true;
    await this._preShutdown();

    // Cancel all pending cleanup timers
    for (const [traceId, timeout] of this.#pendingCleanups) {
      clearTimeout(timeout);
      this.logger.debug(`${this.name}: Cancelled pending cleanup on shutdown`, { traceId });
    }
    this.#pendingCleanups.clear();

    // End all active spans
    const reason: SpanErrorInfo = {
      id: 'SHUTDOWN',
      message: 'Observability is shutting down.',
      domain: 'MASTRA_OBSERVABILITY',
      category: 'SYSTEM',
    };

    for (const [traceId, traceData] of this.#traceMap) {
      // Log any orphaned events
      const orphanedEvents = traceData.getAllQueuedEvents();
      if (orphanedEvents.length > 0) {
        this.logger.warn(`${this.name}: Dropping ${orphanedEvents.length} orphaned events on shutdown`, {
          traceId,
          orphanedEvents: orphanedEvents.map(e => ({
            spanId: e.event.exportedSpan.id,
            waitingFor: e.waitingFor,
            attempts: e.attempts,
          })),
        });
      }

      // Abort active spans
      for (const spanId of traceData.activeSpanIds) {
        const span = traceData.getSpan({ spanId });
        if (span) {
          await this._abortSpan({ span, traceData, reason });
        }
      }
    }

    this.#traceMap.clear();
    await this._postShutdown();
    await super.shutdown();
  }
}
