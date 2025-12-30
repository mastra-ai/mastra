/**
 * =============================================================================
 * TRACKING EXPORTER - IMPLEMENTATION PLAN
 * =============================================================================
 *
 * This file contains the TrackingExporter base class which caches trace data
 * in a local memory map for vendor-specific exporters (Braintrust, Langfuse,
 * LangSmith, PostHog, etc.).
 *
 * -----------------------------------------------------------------------------
 * PROBLEM: EARLY DATA QUEUE
 * -----------------------------------------------------------------------------
 *
 * Currently, if span data arrives before its dependencies are ready, we queue
 * it to `earlyData`. However, this queue is never processed - events accumulate
 * and are lost.
 *
 * Spans can be queued to earlyData when:
 * 1. Root span doesn't exist yet (for exporters with skipBuildRootTask = false)
 * 2. Parent span doesn't exist yet (_buildSpan/_buildEvent returns undefined)
 *
 * Key insight: If the root span doesn't exist, no child spans can be processed
 * because parent spans can't exist without root. Therefore, we should NOT
 * attempt to process earlyData until the root span has been processed.
 *
 * -----------------------------------------------------------------------------
 * PROBLEM: IMMEDIATE CLEANUP
 * -----------------------------------------------------------------------------
 *
 * Currently, clearTraceData() is called immediately when activeSpanCount == 0.
 * This causes issues with:
 * - Late-arriving data (updates, events) having nowhere to go
 * - Early queue items still processing async when we clear
 * - Race conditions between setImmediate processing and cleanup
 *
 * -----------------------------------------------------------------------------
 * IMPLEMENTATION PLAN
 * -----------------------------------------------------------------------------
 *
 * ## 1. New Config Options (TrackingExporterConfig)
 *
 * ```typescript
 * interface TrackingExporterConfig extends BaseExporterConfig {
 *   // Early queue settings
 *   earlyQueueMaxAttempts?: number;      // default: 5
 *   earlyQueueTTLMs?: number;            // default: 30000 (30s)
 *
 *   // Cleanup settings
 *   traceCleanupDelayMs?: number;        // default: 30000 (30s)
 *   maxPendingCleanupTraces?: number;    // default: 100 (soft cap, activeSpanCount == 0 only)
 *   maxTotalTraces?: number;             // default: 500 (hard cap, kills oldest even if active)
 * }
 * ```
 *
 * ## 2. TraceData Changes
 *
 * ### New flag for root tracking:
 * - Add `#rootSpanProcessed: boolean`
 * - Set to true when span with `isRootSpan = true` is successfully processed
 * - Works for both `_buildRoot` path and `_buildSpan` path (skipBuildRootTask = true)
 * - Add method `isRootProcessed(): boolean`
 *
 * ### New early queue structure (replaces simple array):
 * ```typescript
 * interface QueuedEvent {
 *   event: TracingEvent;
 *   waitingFor: 'root' | string;  // 'root' or specific parentSpanId
 *   attempts: number;
 *   queuedAt: Date;
 * }
 *
 * #waitingForRoot: QueuedEvent[];
 * #waitingForParent: Map<string, QueuedEvent[]>;  // parentSpanId -> events
 * ```
 *
 * This Map structure enables O(1) lookups instead of O(n) queue scans.
 * When span X is created, we only look at `waitingForParent.get(X.id)`.
 *
 * ### New methods:
 * - `isRootProcessed(): boolean`
 * - `addToWaitingQueue(event, waitingFor): void`
 * - `getEventsWaitingFor(spanId): QueuedEvent[]`
 * - `getEventsWaitingForRoot(): QueuedEvent[]`
 * - `removeFromWaitingQueue(event): void`
 *
 * ## 3. TrackingExporter Changes
 *
 * ### Early queue processing (async via setImmediate):
 *
 * Trigger points:
 * - After root span is processed → `setImmediate(() => processWaitingForRoot())`
 * - After any span/event created → `setImmediate(() => processWaitingFor(spanId))`
 *
 * Processing logic:
 * ```
 * processWaitingFor(spanId):
 *   events = getEventsWaitingFor(spanId)
 *   for each event in events:
 *     if event.attempts >= maxAttempts || event.queuedAt + TTL < now:
 *       log warning, remove from queue
 *       continue
 *     event.attempts++
 *     result = tryProcess(event)
 *     if successful:
 *       remove from queue
 *       // Cascade: new span might unblock others
 *       setImmediate(() => processWaitingFor(newSpanId))
 * ```
 *
 * ### Delayed cleanup:
 *
 * ```
 * When activeSpanCount() == 0:
 *   scheduleCleanup(traceId)
 *
 * scheduleCleanup(traceId):
 *   if already scheduled for this traceId:
 *     cancel existing timer
 *   #pendingCleanups.set(traceId, setTimeout(() => {
 *     // Final flush of remaining early queue items
 *     // Log warnings for orphaned events
 *     clearTraceData(traceId)
 *   }, traceCleanupDelayMs))
 *
 * If new data arrives for traceId:
 *   cancel scheduled cleanup
 *   process the data
 *   if activeSpanCount() == 0:
 *     reschedule cleanup (timer reset)
 * ```
 *
 * ### Caps enforcement:
 *
 * Soft cap (maxPendingCleanupTraces):
 * - Only affects traces with activeSpanCount == 0
 * - When exceeded, force cleanup of oldest pending traces
 *
 * Hard cap (maxTotalTraces):
 * - Affects ALL traces, even active ones
 * - When exceeded, kill oldest traces first (call _abortSpan for active spans)
 * - Safety valve for memory leaks
 *
 * ### Shutdown behavior:
 * - Clear everything immediately (existing behavior)
 * - Cancel all pending cleanup timers
 * - Abort all active spans
 * - Log warnings for any remaining early queue items
 *
 * -----------------------------------------------------------------------------
 * EXPORTER BEHAVIOR REFERENCE
 * -----------------------------------------------------------------------------
 *
 * | Exporter   | skipBuildRootTask | When _buildSpan returns undefined      |
 * |------------|-------------------|----------------------------------------|
 * | Braintrust | false             | Parent span doesn't exist              |
 * | Langfuse   | false             | getParentOrRoot returns nothing        |
 * | LangSmith  | true              | Not root AND parent doesn't exist      |
 * | PostHog    | true              | Never returns undefined                |
 *
 * -----------------------------------------------------------------------------
 * TESTING PLAN
 * -----------------------------------------------------------------------------
 *
 * ## File Structure
 *
 * ```
 * observability/
 * ├── _test-utils/                    # Shared test utilities (new package)
 * │   ├── src/
 * │   │   ├── index.ts                # Exports all utilities
 * │   │   ├── trace-generator.ts      # Generate test traces
 * │   │   ├── test-exporter.ts        # TestTrackingExporter class
 * │   │   └── test-scenarios.ts       # Shared test scenario runners
 * │   └── package.json
 * │
 * ├── mastra/src/exporters/
 * │   ├── tracking.ts                 # This file
 * │   └── tracking.test.ts            # Unit tests for TrackingExporter
 * │
 * ├── braintrust/src/
 * │   └── tracing.early-data.test.ts  # Braintrust-specific early data tests
 * │
 * ├── langfuse/src/
 * │   └── tracing.early-data.test.ts  # Langfuse-specific early data tests
 * │
 * ├── langsmith/src/
 * │   └── tracing.early-data.test.ts  # LangSmith-specific early data tests
 * │
 * └── posthog/src/
 *     └── tracing.early-data.test.ts  # PostHog-specific early data tests
 * ```
 *
 * ## 1. Shared Test Utilities (observability/_test-utils)
 *
 * ### trace-generator.ts
 * ```typescript
 * // Generate a trace with configurable depth and breadth
 * function generateTrace(opts: {
 *   depth: number;
 *   breadth: number;
 *   includeEvents?: boolean;
 * }): TracingEvent[]
 *
 * // Shuffle events to simulate out-of-order arrival
 * function shuffleEvents(events: TracingEvent[]): TracingEvent[]
 *
 * // Send events with configurable delays
 * async function sendWithDelays(
 *   exporter: BaseExporter,
 *   events: TracingEvent[],
 *   delayMs: number
 * ): Promise<void>
 * ```
 *
 * ### test-exporter.ts
 * ```typescript
 * // Concrete test implementation of TrackingExporter for isolated testing
 * class TestTrackingExporter extends TrackingExporter<...> {
 *   // Expose internals for testing
 *   // Track calls to _buildRoot, _buildSpan, _buildEvent, etc.
 *   public buildRootCalls: Array<{span, traceData}>
 *   public buildSpanCalls: Array<{span, traceData}>
 *   public buildEventCalls: Array<{span, traceData}>
 *   // ... etc
 * }
 * ```
 *
 * ### test-scenarios.ts
 * ```typescript
 * // Shared test scenario runners that each exporter can use
 * export function runOutOfOrderSpanTests(exporterFactory: () => BaseExporter): void
 * export function runRootArrivesLastTests(exporterFactory: () => BaseExporter): void
 * export function runDeepHierarchyTests(exporterFactory: () => BaseExporter): void
 * export function runLateEventTests(exporterFactory: () => BaseExporter): void
 * export function runOrphanedSpanTests(exporterFactory: () => BaseExporter): void
 * export function runAllEarlyDataTests(exporterFactory: () => BaseExporter): void
 * ```
 *
 * ## 2. TrackingExporter Unit Tests (mastra/src/exporters/tracking.test.ts)
 *
 * Uses TestTrackingExporter from _test-utils for isolated testing.
 *
 * Test cases:
 * - Early queue structure (waitingForRoot, waitingForParent Map)
 * - rootSpanProcessed flag is set correctly for both paths
 * - Events queued when root missing (skipBuildRootTask = false)
 * - Events queued when parent missing
 * - Async processing triggers after root processed
 * - Async processing triggers after span/event created
 * - Cascading processing (A unblocks B, B unblocks C)
 * - Max attempts limit respected, events dropped with warning
 * - TTL limit respected, stale events dropped with warning
 * - Delayed cleanup scheduling and cancellation
 * - Timer reset on new data arrival
 * - Soft cap enforcement (pending cleanup traces)
 * - Hard cap enforcement (all traces, oldest killed first)
 * - Shutdown cancels timers and clears everything
 * - Orphaned events logged on final cleanup
 *
 * ## 3. Exporter-Specific Tests (in each exporter package)
 *
 * Each exporter package imports shared utilities and runs scenarios:
 *
 * ```typescript
 * // observability/braintrust/src/tracing.early-data.test.ts
 * import { runAllEarlyDataTests, generateTrace } from '@mastra/observability-test-utils';
 * import { BraintrustExporter } from './tracing';
 *
 * describe('BraintrustExporter early data handling', () => {
 *   runAllEarlyDataTests(() => new BraintrustExporter({ apiKey: 'test' }));
 *
 *   // Braintrust-specific tests if needed
 *   it('should handle braintrust-specific edge case', () => { ... });
 * });
 * ```
 *
 * ### Shared Scenarios (run by each exporter)
 *
 * - Out-of-order span arrival: child before parent, grandchild before child
 * - Root arrives last: multiple children, then root
 * - Deep hierarchy out of order: D, B, C, A (root) → cascade A→B→C→D
 * - Late event after span ended: event during cleanup delay window
 * - Very late data after cleanup: warning logged, handled gracefully
 * - Orphaned spans: parent never arrives, dropped after max attempts/TTL
 * - Mixed events and spans out of order
 *
 * =============================================================================
 */

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

export class TraceData<TRootData, TSpanData, TEventData, TMetadata> {
  #rootSpan?: TRootData;
  #rootSpanId?: string;
  #rootSpanProcessed: boolean; // Whether a span with isRootSpan=true has been processed
  #events: Map<string, TEventData>; // Maps eventId to vendor-specific events
  #spans: Map<string, TSpanData>; // Maps spanId to vendor-specific spans
  #tree: Map<string, string | undefined>; // Maps spanId to parentSpanId
  #activeSpanIds: Set<string>; // Set of span IDs that have started but not yet ended
  #metadata: Map<string, TMetadata>; // Map of id to vendor-specific metadata
  #extraData: Map<string, unknown>; // Any extra data to be stored on a per-trace level

  // Early queue: events waiting for dependencies
  #waitingForRoot: QueuedEvent[]; // Events waiting for root span to be processed
  #waitingForParent: Map<string, QueuedEvent[]>; // Events waiting for specific parent spanId

  // Timestamp for tracking trace age (for cap enforcement)
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

  hasRoot(): boolean {
    return !!this.#rootSpanId;
  }

  addRoot(args: { rootId: string; rootData: TRootData }): void {
    this.#rootSpanId = args.rootId;
    this.#rootSpan = args.rootData;
    this.#rootSpanProcessed = true;
  }

  getRoot(): TRootData | undefined {
    return this.#rootSpan;
  }

  /**
   * Returns true if a span with isRootSpan=true has been successfully processed.
   * This is set via addRoot() or markRootSpanProcessed().
   */
  isRootProcessed(): boolean {
    return this.#rootSpanProcessed;
  }

  /**
   * Mark that the root span has been processed.
   * Used by exporters with skipBuildRootTask=true where root goes through _buildSpan.
   */
  markRootSpanProcessed(): void {
    this.#rootSpanProcessed = true;
  }

  setExtraValue(key: string, value: unknown): void {
    this.#extraData.set(key, value);
  }

  hasExtraValue(key: string): boolean {
    return this.#extraData.has(key);
  }

  getExtraValue(key: string): unknown | undefined {
    return this.#extraData.get(key);
  }

  // ============================================================================
  // Early Queue Methods
  // ============================================================================

  /**
   * Add an event to the waiting queue.
   * @param event - The tracing event to queue
   * @param waitingFor - 'root' or a specific parentSpanId
   */
  addToWaitingQueue(args: { event: TracingEvent; waitingFor: 'root' | string }): void {
    const queuedEvent: QueuedEvent = {
      event: args.event,
      waitingFor: args.waitingFor,
      attempts: 0,
      queuedAt: new Date(),
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
   * Returns the array (which can be mutated for processing).
   */
  getEventsWaitingForRoot(): QueuedEvent[] {
    return this.#waitingForRoot;
  }

  /**
   * Get all events waiting for a specific parent span.
   * Returns the array (which can be mutated for processing).
   */
  getEventsWaitingFor(args: { spanId: string }): QueuedEvent[] {
    return this.#waitingForParent.get(args.spanId) ?? [];
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
   * Get all queued events (for cleanup/logging purposes).
   */
  getAllQueuedEvents(): QueuedEvent[] {
    const all: QueuedEvent[] = [...this.#waitingForRoot];
    for (const queue of this.#waitingForParent.values()) {
      all.push(...queue);
    }
    return all;
  }

  /**
   * @deprecated Use addToWaitingQueue instead. This is kept for backward compatibility.
   */
  addEarly(args: { event: TracingEvent }): void {
    // Determine what this event is waiting for
    const parentSpanId = args.event.exportedSpan.parentSpanId;
    if (!this.#rootSpanProcessed) {
      this.addToWaitingQueue({ event: args.event, waitingFor: 'root' });
    } else if (parentSpanId) {
      this.addToWaitingQueue({ event: args.event, waitingFor: parentSpanId });
    } else {
      // Root span but root already processed - shouldn't happen, queue for root anyway
      this.addToWaitingQueue({ event: args.event, waitingFor: 'root' });
    }
  }

  addBranch(args: { spanId: string; parentSpanId: string | undefined }): void {
    this.#tree.set(args.spanId, args.parentSpanId);
  }

  getParentId(args: { spanId: string }): string | undefined {
    return this.#tree.get(args.spanId);
  }

  addSpan(args: { spanId: string; spanData: TSpanData }): void {
    this.#spans.set(args.spanId, args.spanData);
    this.#activeSpanIds.add(args.spanId); //Track span as active
  }

  hasSpan(args: { spanId: string }): boolean {
    const { spanId } = args;
    return this.#spans.has(spanId);
  }

  getSpan(args: { spanId: string }): TSpanData | undefined {
    const { spanId } = args;
    return this.#spans.get(spanId);
  }

  endSpan(args: { spanId: string }): void {
    this.#activeSpanIds.delete(args.spanId);
  }

  isActiveSpan(args: { spanId: string }): boolean {
    return this.#activeSpanIds.has(args.spanId);
  }

  activeSpanCount(): number {
    return this.#activeSpanIds.size;
  }

  get activeSpanIds(): string[] {
    return [...this.#activeSpanIds];
  }

  addEvent(args: { eventId: string; eventData: TEventData }) {
    this.#events.set(args.eventId, args.eventData);
  }

  // TODO: ideally this would add to the span metadata if it already existed
  // and not just completely overwrite it.
  // Maybe the type here should be different?
  addMetadata(args: { spanId: string; metadata: TMetadata }): void {
    this.#metadata.set(args.spanId, args.metadata);
  }

  getMetadata(args: { spanId: string }): TMetadata | undefined {
    return this.#metadata.get(args.spanId);
  }

  getParent(args: { span: AnyExportedSpan }): TSpanData | TEventData | undefined {
    const parentId = args.span.parentSpanId;
    // if parentId is undefined, then span is the rootSpan (and has no parent)
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

  getParentOrRoot(args: { span: AnyExportedSpan }): TRootData | TSpanData | TEventData | undefined {
    return this.getParent(args) ?? this.getRoot();
  }
}

/**
 * Abstract base class for exporters that track trace/span state.
 *
 * @typeParam TTraceData - The type of data stored per trace (must extend BaseTraceData)
 * @typeParam TConfig - Configuration type (must extend TrackingExporterConfig)
 */
// Default configuration values
const DEFAULT_EARLY_QUEUE_MAX_ATTEMPTS = 5;
const DEFAULT_EARLY_QUEUE_TTL_MS = 30000; // 30 seconds
const DEFAULT_TRACE_CLEANUP_DELAY_MS = 30000; // 30 seconds
const DEFAULT_MAX_PENDING_CLEANUP_TRACES = 100;
const DEFAULT_MAX_TOTAL_TRACES = 500;

export abstract class TrackingExporter<
  TRootData,
  TSpanData,
  TEventData,
  TMetadata,
  TConfig extends TrackingExporterConfig,
> extends BaseExporter {
  /**
   * Map of traceId to trace-specific data.
   * Contains vendor SDK objects, span maps, and active span tracking.
   */
  #traceMap = new Map<string, TraceData<TRootData, TSpanData, TEventData, TMetadata>>();
  #shutdownStarted = false;

  /**
   * Map of traceId to scheduled cleanup timeout.
   * Used for delayed cleanup after all spans end.
   */
  #pendingCleanups = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Tracks insertion order of traces for cap enforcement.
   * Oldest traces are at the beginning.
   */
  #traceInsertionOrder: string[] = [];

  /**
   * Subclass configuration (typed for subclass-specific options)
   */
  protected readonly config: TConfig;

  // Resolved config values with defaults
  readonly #earlyQueueMaxAttempts: number;
  readonly #earlyQueueTTLMs: number;
  readonly #traceCleanupDelayMs: number;
  readonly #maxPendingCleanupTraces: number;
  readonly #maxTotalTraces: number;

  constructor(config: TConfig) {
    super(config);
    this.config = config;

    // Resolve config with defaults
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
          traceData.addToWaitingQueue({ event: queuedEvent.event, waitingFor: parentId });
        } else {
          toKeep.push(queuedEvent);
        }
      }
    }

    // Update the queue with remaining events
    traceData.clearWaitingForRoot();
    for (const event of toKeep) {
      traceData.addToWaitingQueue({ event: event.event, waitingFor: 'root' });
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
      traceData.addToWaitingQueue({ event: event.event, waitingFor: spanId });
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

    // Remove from trace map and insertion order
    this.#traceMap.delete(traceId);
    const orderIndex = this.#traceInsertionOrder.indexOf(traceId);
    if (orderIndex !== -1) {
      this.#traceInsertionOrder.splice(orderIndex, 1);
    }

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

    // Remove oldest pending cleanups
    let removed = 0;
    for (const traceId of this.#traceInsertionOrder) {
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
   */
  async #enforceHardCap(): Promise<void> {
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
    // Use a copy of the array since we're modifying it
    for (const traceId of [...this.#traceInsertionOrder]) {
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
  }

  // ============================================================================
  // Lifecycle Hooks
  // ============================================================================

  protected async _preExportTracingEvent(event: TracingEvent): Promise<TracingEvent> {
    return event;
  }

  protected async _postExportTracingEvent(): Promise<void> {}

  protected abstract _buildRoot(args: {
    span: AnyExportedSpan;
    traceData: TraceData<TRootData, TSpanData, TEventData, TMetadata>;
  }): Promise<TRootData | undefined>;

  protected abstract _buildEvent(args: {
    span: AnyExportedSpan;
    traceData: TraceData<TRootData, TSpanData, TEventData, TMetadata>;
  }): Promise<TEventData | undefined>;

  protected abstract _buildSpan(args: {
    span: AnyExportedSpan;
    traceData: TraceData<TRootData, TSpanData, TEventData, TMetadata>;
  }): Promise<TSpanData | undefined>;

  protected abstract _updateSpan(args: {
    span: AnyExportedSpan;
    traceData: TraceData<TRootData, TSpanData, TEventData, TMetadata>;
  }): Promise<void>;

  protected abstract _finishSpan(args: {
    span: AnyExportedSpan;
    traceData: TraceData<TRootData, TSpanData, TEventData, TMetadata>;
  }): Promise<void>;

  protected abstract _abortSpan(args: {
    span: TSpanData;
    traceData: TraceData<TRootData, TSpanData, TEventData, TMetadata>;
    reason: SpanErrorInfo;
  }): Promise<void>;

  protected skipBuildRootTask = false;
  protected skipSpanUpdateEvents = false;
  protected skipCachingEventSpans = false;

  private getMethod(event: TracingEvent): 'handleEventSpan' | 'handleSpanStart' | 'handleSpanUpdate' | 'handleSpanEnd' {
    if (!event.exportedSpan.isEvent) {
      switch (event.type) {
        case 'span_started':
          return 'handleSpanStart';
        case 'span_updated':
          return 'handleSpanUpdate';
        case 'span_ended':
          return 'handleSpanEnd';
      }
    }
    return 'handleEventSpan';
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

  /**
   * Get trace data for a span, creating one if not found.
   * Also cancels any pending cleanup for this trace (new data arrived).
   *
   * @param context - The span context for logging
   * @returns The trace data
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
      // Track insertion order for cap enforcement
      this.#traceInsertionOrder.push(traceId);
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
   * @deprecated Use #scheduleCleanup instead. Immediate cleanup is no longer recommended.
   * This method is kept for backward compatibility but now schedules cleanup instead.
   */
  protected clearTraceData(args: { traceId: string; method: string }): void {
    const { traceId } = args;
    // For backward compatibility, schedule cleanup instead of immediate deletion
    this.#scheduleCleanup(traceId);
  }

  protected traceMapSize(): number {
    return this.#traceMap.size;
  }

  protected async _preShutdown(): Promise<void> {}

  protected async _postShutdown(): Promise<void> {}

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
    this.#traceInsertionOrder = [];
    await this._postShutdown();
    await super.shutdown();
  }
}
