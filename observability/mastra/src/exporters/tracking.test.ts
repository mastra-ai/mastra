/**
 * Unit tests for TrackingExporter base class.
 *
 * These tests verify:
 * - Early queue processing (waiting for root, waiting for parent)
 * - Cascading async processing
 * - TTL and max attempts limits
 * - Delayed cleanup scheduling
 * - Soft and hard cap enforcement
 * - Shutdown behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TracingEvent, AnyExportedSpan, SpanErrorInfo } from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import { TrackingExporter } from './tracking';
import type { TraceData, TrackingExporterConfig } from './tracking';

// ============================================================================
// Inline Test Utilities (avoid cyclic dependency with @observability/test-utils)
// ============================================================================

interface TestTrackingExporterConfig extends TrackingExporterConfig {
  /** Simulate _buildSpan returning undefined for specific span IDs */
  failBuildSpanFor?: string[];
  /** Simulate _buildEvent returning undefined for specific span IDs */
  failBuildEventFor?: string[];
  /** Skip building root (like LangSmith) */
  skipRoot?: boolean;
}

type TestRootData = { type: 'root'; spanId: string };
type TestSpanData = { type: 'span'; spanId: string };
type TestEventData = { type: 'event'; spanId: string };
type TestMetadata = Record<string, unknown>;
type TestTraceData = TraceData<TestRootData, TestSpanData, TestEventData, TestMetadata>;

interface MethodCall {
  method: string;
  spanId: string;
  traceId: string;
  timestamp: Date;
  args?: Record<string, unknown>;
}

class TestTrackingExporter extends TrackingExporter<
  TestRootData,
  TestSpanData,
  TestEventData,
  TestMetadata,
  TestTrackingExporterConfig
> {
  name = 'test-exporter';

  // Track all method calls for verification
  public calls: MethodCall[] = [];

  // Track built spans/events for verification
  public builtRoots: Map<string, TestRootData> = new Map();
  public builtSpans: Map<string, TestSpanData> = new Map();
  public builtEvents: Map<string, TestEventData> = new Map();
  public abortedSpans: Map<string, SpanErrorInfo> = new Map();

  // Track root span ID for parent checking
  private rootSpanId?: string;

  private failBuildSpanFor: Set<string>;
  private failBuildEventFor: Set<string>;

  constructor(config: TestTrackingExporterConfig = {}) {
    super(config);

    this.failBuildSpanFor = new Set(config.failBuildSpanFor ?? []);
    this.failBuildEventFor = new Set(config.failBuildEventFor ?? []);

    if (config.skipRoot) {
      this.skipBuildRootTask = true;
    }
  }

  // Allow test access to protected method
  public async exportTracingEvent(event: Parameters<typeof this._exportTracingEvent>[0]): Promise<void> {
    return this._exportTracingEvent(event);
  }

  // Get trace map size for verification
  public getTraceMapSize(): number {
    return this.traceMapSize();
  }

  protected override async _buildRoot(args: {
    span: AnyExportedSpan;
    traceData: TestTraceData;
  }): Promise<TestRootData | undefined> {
    this.calls.push({
      method: '_buildRoot',
      spanId: args.span.id,
      traceId: args.span.traceId,
      timestamp: new Date(),
    });

    const rootData: TestRootData = { type: 'root', spanId: args.span.id };
    this.builtRoots.set(args.span.id, rootData);
    this.rootSpanId = args.span.id;
    return rootData;
  }

  protected override async _buildSpan(args: {
    span: AnyExportedSpan;
    traceData: TestTraceData;
  }): Promise<TestSpanData | undefined> {
    this.calls.push({
      method: '_buildSpan',
      spanId: args.span.id,
      traceId: args.span.traceId,
      timestamp: new Date(),
    });

    // Simulate failure if configured
    if (this.failBuildSpanFor.has(args.span.id)) {
      return undefined;
    }

    // Check if parent exists (simulate real exporter behavior)
    // For non-root spans, we need the actual parent to exist (not just root)
    if (!args.span.isRootSpan) {
      const parentId = args.span.parentSpanId;
      if (parentId) {
        // Check if specific parent exists in spans
        const parent = args.traceData.getSpan({ spanId: parentId });
        // If parent doesn't exist in spans, check if parent is root
        if (!parent && parentId !== this.rootSpanId) {
          return undefined;
        }
      } else {
        // No parentId means direct child of root, check root exists
        if (!args.traceData.hasRoot() && !args.traceData.isRootProcessed()) {
          return undefined;
        }
      }
    }

    const spanData: TestSpanData = { type: 'span', spanId: args.span.id };
    this.builtSpans.set(args.span.id, spanData);

    // If this is a root span (skipRoot=true mode), track the root ID
    if (args.span.isRootSpan) {
      this.rootSpanId = args.span.id;
    }

    return spanData;
  }

  protected override async _buildEvent(args: {
    span: AnyExportedSpan;
    traceData: TestTraceData;
  }): Promise<TestEventData | undefined> {
    this.calls.push({
      method: '_buildEvent',
      spanId: args.span.id,
      traceId: args.span.traceId,
      timestamp: new Date(),
    });

    // Simulate failure if configured
    if (this.failBuildEventFor.has(args.span.id)) {
      return undefined;
    }

    // Check if parent exists (simulate real exporter behavior)
    const parent = args.traceData.getParentOrRoot({ span: args.span });
    if (!parent) {
      return undefined;
    }

    const eventData: TestEventData = { type: 'event', spanId: args.span.id };
    this.builtEvents.set(args.span.id, eventData);
    return eventData;
  }

  protected override async _updateSpan(args: { span: AnyExportedSpan; traceData: TestTraceData }): Promise<void> {
    this.calls.push({
      method: '_updateSpan',
      spanId: args.span.id,
      traceId: args.span.traceId,
      timestamp: new Date(),
    });
  }

  protected override async _finishSpan(args: { span: AnyExportedSpan; traceData: TestTraceData }): Promise<void> {
    this.calls.push({
      method: '_finishSpan',
      spanId: args.span.id,
      traceId: args.span.traceId,
      timestamp: new Date(),
    });
  }

  protected override async _abortSpan(args: {
    span: TestSpanData;
    traceData: TestTraceData;
    reason: SpanErrorInfo;
  }): Promise<void> {
    this.calls.push({
      method: '_abortSpan',
      spanId: args.span.spanId,
      traceId: 'unknown',
      timestamp: new Date(),
      args: { reason: args.reason },
    });

    this.abortedSpans.set(args.span.spanId, args.reason);
  }

  // Helper methods for test assertions
  public wasMethodCalledForSpan(method: string, spanId: string): boolean {
    return this.calls.some(c => c.method === method && c.spanId === spanId);
  }
}

// Trace generator utilities

interface GenerateTraceOptions {
  depth?: number;
  breadth?: number;
  includeEvents?: boolean;
  traceId?: string;
  baseTime?: Date;
  timeIncrementMs?: number;
}

interface SpanInfo {
  id: string;
  parentId?: string;
  depth: number;
  isRoot: boolean;
  isEvent: boolean;
}

let spanCounter = 0;

function generateSpanId(): string {
  return `span-${++spanCounter}-${Date.now()}`;
}

function generateTraceId(): string {
  return `trace-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function createExportedSpan(args: {
  id: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  type: SpanType;
  isRootSpan: boolean;
  isEvent: boolean;
  startTime: Date;
  endTime?: Date;
  input?: unknown;
  output?: unknown;
}): AnyExportedSpan {
  return {
    id: args.id,
    traceId: args.traceId,
    parentSpanId: args.parentSpanId,
    name: args.name,
    type: args.type,
    isRootSpan: args.isRootSpan,
    isEvent: args.isEvent,
    startTime: args.startTime,
    endTime: args.endTime,
    input: args.input,
    output: args.output,
    tags: args.isRootSpan ? ['test-trace'] : undefined,
  };
}

function createTracingEvent(type: 'span_started' | 'span_updated' | 'span_ended', span: AnyExportedSpan): TracingEvent {
  return { type, exportedSpan: span };
}

function generateSpanTree(opts: GenerateTraceOptions): SpanInfo[] {
  const depth = opts.depth ?? 3;
  const breadth = opts.breadth ?? 2;
  const includeEvents = opts.includeEvents ?? true;

  const spans: SpanInfo[] = [];

  function addSpan(parentId: string | undefined, currentDepth: number, isEvent: boolean = false): string {
    const id = generateSpanId();
    spans.push({
      id,
      parentId,
      depth: currentDepth,
      isRoot: currentDepth === 0 && !isEvent,
      isEvent,
    });
    return id;
  }

  function buildTree(parentId: string | undefined, currentDepth: number): void {
    if (currentDepth >= depth) return;

    for (let i = 0; i < breadth; i++) {
      const spanId = addSpan(parentId, currentDepth);

      if (includeEvents && currentDepth > 0) {
        addSpan(spanId, currentDepth, true);
      }

      buildTree(spanId, currentDepth + 1);
    }
  }

  const rootId = addSpan(undefined, 0);
  buildTree(rootId, 1);

  return spans;
}

function generateTrace(opts: GenerateTraceOptions = {}): TracingEvent[] {
  const traceId = opts.traceId ?? generateTraceId();
  const baseTime = opts.baseTime ?? new Date();
  const timeIncrement = opts.timeIncrementMs ?? 100;

  const spanTree = generateSpanTree(opts);
  const events: TracingEvent[] = [];
  let currentTime = baseTime.getTime();

  for (const spanInfo of spanTree) {
    const startTime = new Date(currentTime);
    currentTime += timeIncrement;

    const span = createExportedSpan({
      id: spanInfo.id,
      traceId,
      parentSpanId: spanInfo.parentId,
      name: spanInfo.isEvent ? `event-${spanInfo.id}` : `span-${spanInfo.id}`,
      type: spanInfo.isEvent ? SpanType.EVENT : spanInfo.isRoot ? SpanType.AGENT_RUN : SpanType.TOOL_CALL,
      isRootSpan: spanInfo.isRoot,
      isEvent: spanInfo.isEvent,
      startTime,
      input: { test: 'input' },
    });

    if (spanInfo.isEvent) {
      events.push(createTracingEvent('span_ended', { ...span, endTime: startTime }));
    } else {
      events.push(createTracingEvent('span_started', span));
    }
  }

  const nonEventSpans = spanTree.filter(s => !s.isEvent);
  for (let i = nonEventSpans.length - 1; i >= 0; i--) {
    const spanInfo = nonEventSpans[i];
    const endTime = new Date(currentTime);
    currentTime += timeIncrement;

    const span = createExportedSpan({
      id: spanInfo.id,
      traceId,
      parentSpanId: spanInfo.parentId,
      name: `span-${spanInfo.id}`,
      type: spanInfo.isRoot ? SpanType.AGENT_RUN : SpanType.TOOL_CALL,
      isRootSpan: spanInfo.isRoot,
      isEvent: false,
      startTime: new Date(baseTime.getTime()),
      endTime,
      output: { test: 'output' },
    });

    events.push(createTracingEvent('span_ended', span));
  }

  return events;
}

function reverseHierarchyOrder(events: TracingEvent[]): TracingEvent[] {
  const startEvents = events.filter(e => e.type === 'span_started');
  const endEvents = events.filter(e => e.type === 'span_ended' && !e.exportedSpan.isEvent);
  const eventSpans = events.filter(e => e.exportedSpan.isEvent);

  const reversedStarts = [...startEvents].reverse();
  const reversedEvents = [...eventSpans].reverse();

  return [...reversedStarts, ...reversedEvents, ...endEvents];
}

async function sendWithDelays(
  exporter: { exportTracingEvent: (event: TracingEvent) => Promise<void> },
  events: TracingEvent[],
  delayMs: number = 0,
): Promise<void> {
  for (const event of events) {
    await exporter.exportTracingEvent(event);
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

// ============================================================================
// Tests
// ============================================================================

/**
 * Flush async processing (setImmediate callbacks) with fake timers.
 * Uses advanceTimersToNextTimerAsync to run each scheduled timer one at a time.
 * For tests that don't want cleanup timers to fire, use long cleanup delays.
 */
async function flushAsync(times: number = 1): Promise<void> {
  for (let i = 0; i < times; i++) {
    // advanceTimersToNextTimer runs the next scheduled timer/immediate
    // This includes both setImmediate and setTimeout callbacks
    await vi.advanceTimersToNextTimerAsync();
  }
}

describe('TrackingExporter', () => {
  let exporter: TestTrackingExporter;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    if (exporter) {
      await exporter.shutdown();
    }
    vi.useRealTimers();
  });

  describe('Root span processing', () => {
    beforeEach(() => {
      // Use a very long cleanup delay to prevent cleanup from firing during queue processing
      exporter = new TestTrackingExporter({ traceCleanupDelayMs: 60 * 60 * 1000 });
    });

    it('should process root span and trigger queue processing', async () => {
      const events = generateTrace({ depth: 2, breadth: 1, includeEvents: false });
      const rootEvent = events.find(e => e.type === 'span_started' && e.exportedSpan.isRootSpan)!;

      await exporter.exportTracingEvent(rootEvent);
      await flushAsync(3);

      expect(exporter.builtRoots.size).toBe(1);
      expect(exporter.wasMethodCalledForSpan('_buildRoot', rootEvent.exportedSpan.id)).toBe(true);
    });

    it('should queue child spans until root arrives', async () => {
      const events = generateTrace({ depth: 2, breadth: 1, includeEvents: false });
      const starts = events.filter(e => e.type === 'span_started');
      const rootStart = starts.find(e => e.exportedSpan.isRootSpan)!;
      const childStarts = starts.filter(e => !e.exportedSpan.isRootSpan);

      // Send child first
      await exporter.exportTracingEvent(childStarts[0]);
      await flushAsync(3);

      // Child should be queued, not built
      expect(exporter.builtSpans.size).toBe(0);

      // Now send root
      await exporter.exportTracingEvent(rootStart);
      await flushAsync(5);

      // Root should be built (in both builtRoots and builtSpans) and child should be processed
      // Root goes through _buildRoot (builtRoots) AND _buildSpan (builtSpans)
      expect(exporter.builtRoots.size).toBe(1);
      expect(exporter.builtSpans.size).toBe(2); // root + child
    });

    it('should handle multiple children waiting for root', async () => {
      const events = generateTrace({ depth: 2, breadth: 3, includeEvents: false });
      const starts = events.filter(e => e.type === 'span_started');
      const rootStart = starts.find(e => e.exportedSpan.isRootSpan)!;
      const childStarts = starts.filter(e => !e.exportedSpan.isRootSpan);

      // Send all children first
      for (const child of childStarts) {
        await exporter.exportTracingEvent(child);
      }
      await flushAsync(3);

      // No children should be built yet
      expect(exporter.builtSpans.size).toBe(0);

      // Send root
      await exporter.exportTracingEvent(rootStart);
      await flushAsync(10);

      // All should now be built
      // Root goes through _buildRoot (builtRoots) AND _buildSpan (builtSpans)
      expect(exporter.builtRoots.size).toBe(1);
      expect(exporter.builtSpans.size).toBe(childStarts.length + 1); // children + root
    });
  });

  describe('Cascading queue processing', () => {
    beforeEach(() => {
      // Use a very long cleanup delay to prevent cleanup from firing during queue processing
      exporter = new TestTrackingExporter({ traceCleanupDelayMs: 60 * 60 * 1000 });
    });

    it('should cascade processing through deep hierarchy', async () => {
      // Create A (root) -> B -> C -> D hierarchy manually
      const traceId = `test-trace-${Date.now()}`;
      const now = new Date();

      const spanA: TracingEvent = {
        type: 'span_started',
        exportedSpan: {
          id: 'span-A',
          traceId,
          name: 'span-A',
          type: 'AGENT_RUN' as any,
          isRootSpan: true,
          isEvent: false,
          startTime: now,
        },
      };

      const spanB: TracingEvent = {
        type: 'span_started',
        exportedSpan: {
          id: 'span-B',
          traceId,
          parentSpanId: 'span-A',
          name: 'span-B',
          type: 'TOOL_CALL' as any,
          isRootSpan: false,
          isEvent: false,
          startTime: new Date(now.getTime() + 100),
        },
      };

      const spanC: TracingEvent = {
        type: 'span_started',
        exportedSpan: {
          id: 'span-C',
          traceId,
          parentSpanId: 'span-B',
          name: 'span-C',
          type: 'TOOL_CALL' as any,
          isRootSpan: false,
          isEvent: false,
          startTime: new Date(now.getTime() + 200),
        },
      };

      const spanD: TracingEvent = {
        type: 'span_started',
        exportedSpan: {
          id: 'span-D',
          traceId,
          parentSpanId: 'span-C',
          name: 'span-D',
          type: 'TOOL_CALL' as any,
          isRootSpan: false,
          isEvent: false,
          startTime: new Date(now.getTime() + 300),
        },
      };

      // Send in reverse order: D, C, B, A
      await exporter.exportTracingEvent(spanD);
      await exporter.exportTracingEvent(spanC);
      await exporter.exportTracingEvent(spanB);
      await exporter.exportTracingEvent(spanA);

      // Allow cascading: A enables B, B enables C, C enables D
      await flushAsync(15);

      // All should be built
      expect(exporter.builtRoots.has('span-A')).toBe(true);
      expect(exporter.builtSpans.has('span-B')).toBe(true);
      expect(exporter.builtSpans.has('span-C')).toBe(true);
      expect(exporter.builtSpans.has('span-D')).toBe(true);
    });

    it('should handle D->B->C->A arrival order', async () => {
      const traceId = `test-trace-${Date.now()}`;
      const now = new Date();

      const spanA: TracingEvent = {
        type: 'span_started',
        exportedSpan: {
          id: 'span-A',
          traceId,
          name: 'span-A',
          type: 'AGENT_RUN' as any,
          isRootSpan: true,
          isEvent: false,
          startTime: now,
        },
      };

      const spanB: TracingEvent = {
        type: 'span_started',
        exportedSpan: {
          id: 'span-B',
          traceId,
          parentSpanId: 'span-A',
          name: 'span-B',
          type: 'TOOL_CALL' as any,
          isRootSpan: false,
          isEvent: false,
          startTime: new Date(now.getTime() + 100),
        },
      };

      const spanC: TracingEvent = {
        type: 'span_started',
        exportedSpan: {
          id: 'span-C',
          traceId,
          parentSpanId: 'span-B',
          name: 'span-C',
          type: 'TOOL_CALL' as any,
          isRootSpan: false,
          isEvent: false,
          startTime: new Date(now.getTime() + 200),
        },
      };

      const spanD: TracingEvent = {
        type: 'span_started',
        exportedSpan: {
          id: 'span-D',
          traceId,
          parentSpanId: 'span-C',
          name: 'span-D',
          type: 'TOOL_CALL' as any,
          isRootSpan: false,
          isEvent: false,
          startTime: new Date(now.getTime() + 300),
        },
      };

      // Send in order: D, B, C, A (worst case)
      await exporter.exportTracingEvent(spanD);
      await exporter.exportTracingEvent(spanB);
      await exporter.exportTracingEvent(spanC);
      await exporter.exportTracingEvent(spanA);

      // Allow cascading
      await flushAsync(15);

      // All should be built
      expect(exporter.builtRoots.has('span-A')).toBe(true);
      expect(exporter.builtSpans.has('span-B')).toBe(true);
      expect(exporter.builtSpans.has('span-C')).toBe(true);
      expect(exporter.builtSpans.has('span-D')).toBe(true);
    });
  });

  describe('Out-of-order event arrival', () => {
    beforeEach(() => {
      // Use a very long cleanup delay to prevent cleanup from firing during queue processing
      exporter = new TestTrackingExporter({ traceCleanupDelayMs: 60 * 60 * 1000 });
    });

    it('should process spans when children arrive before parents', async () => {
      const events = generateTrace({ depth: 3, breadth: 2, includeEvents: false });
      const reversedEvents = reverseHierarchyOrder(events);

      await sendWithDelays(exporter, reversedEvents);
      await flushAsync(15);

      // All spans should eventually be processed
      expect(exporter.builtRoots.size).toBe(1);
      expect(exporter.builtSpans.size).toBeGreaterThan(0);
    });
  });

  describe('TTL and max attempts limits', () => {
    it('should drop events after TTL expiry', async () => {
      exporter = new TestTrackingExporter({
        earlyQueueTTLMs: 1000, // 1 second TTL
        earlyQueueMaxAttempts: 100, // High max attempts so TTL is the limiting factor
        traceCleanupDelayMs: 60 * 60 * 1000, // Long cleanup delay
      });

      const traceId = `test-trace-${Date.now()}`;
      const orphanSpan: TracingEvent = {
        type: 'span_started',
        exportedSpan: {
          id: 'orphan-span',
          traceId,
          parentSpanId: 'non-existent-parent',
          name: 'orphan-span',
          type: 'TOOL_CALL' as any,
          isRootSpan: false,
          isEvent: false,
          startTime: new Date(),
        },
      };

      // Send root so queue processing can happen
      const rootSpan: TracingEvent = {
        type: 'span_started',
        exportedSpan: {
          id: 'root-span',
          traceId,
          name: 'root-span',
          type: 'AGENT_RUN' as any,
          isRootSpan: true,
          isEvent: false,
          startTime: new Date(),
        },
      };

      await exporter.exportTracingEvent(rootSpan);
      await exporter.exportTracingEvent(orphanSpan);
      await flushAsync(3);

      // Advance time past TTL
      vi.advanceTimersByTime(2000);
      await flushAsync(5);

      // The orphan span should NOT be built (parent never arrives)
      expect(exporter.builtSpans.has('orphan-span')).toBe(false);
    });

    it('should drop events after max attempts', async () => {
      exporter = new TestTrackingExporter({
        earlyQueueMaxAttempts: 2,
        earlyQueueTTLMs: 60000, // Long TTL so max attempts is the limiting factor
        traceCleanupDelayMs: 60 * 60 * 1000, // Long cleanup delay
      });

      const traceId = `test-trace-${Date.now()}`;
      const orphanSpan: TracingEvent = {
        type: 'span_started',
        exportedSpan: {
          id: 'orphan-span',
          traceId,
          parentSpanId: 'non-existent-parent',
          name: 'orphan-span',
          type: 'TOOL_CALL' as any,
          isRootSpan: false,
          isEvent: false,
          startTime: new Date(),
        },
      };

      // Send root so queue processing can happen
      const rootSpan: TracingEvent = {
        type: 'span_started',
        exportedSpan: {
          id: 'root-span',
          traceId,
          name: 'root-span',
          type: 'AGENT_RUN' as any,
          isRootSpan: true,
          isEvent: false,
          startTime: new Date(),
        },
      };

      await exporter.exportTracingEvent(rootSpan);
      await exporter.exportTracingEvent(orphanSpan);

      // Trigger multiple processing attempts
      for (let i = 0; i < 5; i++) {
        await flushAsync(3);
        vi.advanceTimersByTime(100);
      }

      // The orphan span should NOT be built
      expect(exporter.builtSpans.has('orphan-span')).toBe(false);
    });
  });

  describe('Delayed cleanup', () => {
    // These tests use real timers with short delays to test actual timer behavior
    // We restore real timers specifically for these tests

    it('should schedule cleanup after all spans end', async () => {
      // Use real timers for this test
      vi.useRealTimers();

      exporter = new TestTrackingExporter({
        traceCleanupDelayMs: 100, // Short delay for testing
      });

      const events = generateTrace({ depth: 1, breadth: 1, includeEvents: false });

      await sendWithDelays(exporter, events);
      // Give async processing time to complete
      await new Promise(resolve => setTimeout(resolve, 20));

      // Trace should still exist (cleanup timer scheduled but not fired yet)
      expect(exporter.getTraceMapSize()).toBe(1);

      // Wait past cleanup delay
      await new Promise(resolve => setTimeout(resolve, 150));

      // Trace should be cleaned up
      expect(exporter.getTraceMapSize()).toBe(0);

      // Restore fake timers for afterEach cleanup
      vi.useFakeTimers();
    });

    it('should reset cleanup timer on new data arrival', async () => {
      // Use real timers for this test
      vi.useRealTimers();

      exporter = new TestTrackingExporter({
        traceCleanupDelayMs: 100, // Short delay for testing
      });

      const events = generateTrace({ depth: 1, breadth: 1, includeEvents: false });

      await sendWithDelays(exporter, events);
      // Give async processing time to complete
      await new Promise(resolve => setTimeout(resolve, 20));

      // Trace should still exist
      expect(exporter.getTraceMapSize()).toBe(1);

      // Wait halfway through cleanup delay
      await new Promise(resolve => setTimeout(resolve, 50));

      // Send a late event (this should reset the timer)
      const rootEvent = events.find(e => e.exportedSpan.isRootSpan)!;
      const lateEvent: TracingEvent = {
        type: 'span_ended',
        exportedSpan: {
          id: 'late-event',
          traceId: rootEvent.exportedSpan.traceId,
          parentSpanId: rootEvent.exportedSpan.id,
          name: 'late-event',
          type: 'EVENT' as any,
          isRootSpan: false,
          isEvent: true,
          startTime: new Date(),
          endTime: new Date(),
        },
      };

      await exporter.exportTracingEvent(lateEvent);
      await new Promise(resolve => setTimeout(resolve, 20));

      // Wait another 50ms (total 100ms from start, but only 50ms from late event)
      await new Promise(resolve => setTimeout(resolve, 50));

      // Trace should still exist (timer was reset when late event arrived)
      expect(exporter.getTraceMapSize()).toBe(1);

      // Wait past the new cleanup delay (need 100ms from last reset)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Now trace should be cleaned up
      expect(exporter.getTraceMapSize()).toBe(0);

      // Restore fake timers for afterEach cleanup
      vi.useFakeTimers();
    });
  });

  describe('Cap enforcement', () => {
    it('should enforce soft cap on pending cleanups', async () => {
      exporter = new TestTrackingExporter({
        traceCleanupDelayMs: 60 * 60 * 1000, // Long cleanup delay
        maxPendingCleanupTraces: 3,
      });

      // Create 5 traces that all end immediately
      for (let i = 0; i < 5; i++) {
        const traceId = `trace-${i}`;
        const rootStart: TracingEvent = {
          type: 'span_started',
          exportedSpan: {
            id: `root-${i}`,
            traceId,
            name: `root-${i}`,
            type: 'AGENT_RUN' as any,
            isRootSpan: true,
            isEvent: false,
            startTime: new Date(),
          },
        };
        const rootEnd: TracingEvent = {
          type: 'span_ended',
          exportedSpan: {
            ...rootStart.exportedSpan,
            endTime: new Date(),
          },
        };

        await exporter.exportTracingEvent(rootStart);
        await exporter.exportTracingEvent(rootEnd);
        await flushAsync(3);
      }

      // Soft cap is 3, so oldest 2 should be cleaned up immediately
      expect(exporter.getTraceMapSize()).toBeLessThanOrEqual(3);
    });

    it('should enforce hard cap on total traces', async () => {
      exporter = new TestTrackingExporter({
        maxTotalTraces: 3,
        traceCleanupDelayMs: 60 * 60 * 1000, // Long cleanup delay
      });

      // Create 5 traces that stay active
      for (let i = 0; i < 5; i++) {
        const traceId = `trace-${i}`;
        const rootStart: TracingEvent = {
          type: 'span_started',
          exportedSpan: {
            id: `root-${i}`,
            traceId,
            name: `root-${i}`,
            type: 'AGENT_RUN' as any,
            isRootSpan: true,
            isEvent: false,
            startTime: new Date(),
          },
        };

        await exporter.exportTracingEvent(rootStart);
        await flushAsync(3);
      }

      // Hard cap is 3, so oldest traces should be killed
      expect(exporter.getTraceMapSize()).toBeLessThanOrEqual(3);
    });
  });

  describe('Shutdown behavior', () => {
    it('should cancel pending cleanups on shutdown', async () => {
      // Use real timers for this test
      vi.useRealTimers();

      exporter = new TestTrackingExporter({
        traceCleanupDelayMs: 1000, // 1 second - enough time to shutdown before cleanup fires
      });

      const events = generateTrace({ depth: 1, breadth: 1, includeEvents: false });
      await sendWithDelays(exporter, events);
      // Give async processing time to complete
      await new Promise(resolve => setTimeout(resolve, 20));

      // Trace should exist (cleanup not triggered yet due to delay)
      expect(exporter.getTraceMapSize()).toBe(1);

      // Shutdown - should clean up immediately without waiting for timer
      await exporter.shutdown();

      // Trace should be cleaned up immediately by shutdown
      expect(exporter.getTraceMapSize()).toBe(0);

      // Restore fake timers for afterEach cleanup
      vi.useFakeTimers();
    });

    it('should stop processing after shutdown starts', async () => {
      exporter = new TestTrackingExporter({ traceCleanupDelayMs: 60 * 60 * 1000 });

      // Start shutdown
      await exporter.shutdown();

      // Try to send an event
      const events = generateTrace({ depth: 1, breadth: 1, includeEvents: false });
      await exporter.exportTracingEvent(events[0]);
      await flushAsync(3);

      // Nothing should be built
      expect(exporter.builtRoots.size).toBe(0);
      expect(exporter.builtSpans.size).toBe(0);
    });
  });

  describe('Skip root task mode (like LangSmith)', () => {
    it('should process root span through _buildSpan when skipRoot=true', async () => {
      exporter = new TestTrackingExporter({ skipRoot: true, traceCleanupDelayMs: 60 * 60 * 1000 });

      const events = generateTrace({ depth: 2, breadth: 1, includeEvents: false });
      const rootStart = events.find(e => e.type === 'span_started' && e.exportedSpan.isRootSpan)!;

      await exporter.exportTracingEvent(rootStart);
      await flushAsync(3);

      // Root should be built as a span, not as root
      expect(exporter.builtRoots.size).toBe(0);
      expect(exporter.builtSpans.has(rootStart.exportedSpan.id)).toBe(true);
    });

    it('should still trigger queue processing when root marked processed via _buildSpan', async () => {
      // Use real timers for this test to ensure setImmediate callbacks run properly
      vi.useRealTimers();

      exporter = new TestTrackingExporter({ skipRoot: true, traceCleanupDelayMs: 60 * 60 * 1000 });

      const events = generateTrace({ depth: 2, breadth: 1, includeEvents: false });
      const starts = events.filter(e => e.type === 'span_started');
      const rootStart = starts.find(e => e.exportedSpan.isRootSpan)!;
      const childStarts = starts.filter(e => !e.exportedSpan.isRootSpan);

      // Send child first
      await exporter.exportTracingEvent(childStarts[0]);
      // Give async processing time to complete
      await new Promise(resolve => setTimeout(resolve, 20));

      // Child should be queued (waiting for root)
      expect(exporter.builtSpans.has(childStarts[0].exportedSpan.id)).toBe(false);

      // Send root
      await exporter.exportTracingEvent(rootStart);
      // Give async processing time to cascade through queues
      await new Promise(resolve => setTimeout(resolve, 50));

      // Both should now be built
      expect(exporter.builtSpans.has(rootStart.exportedSpan.id)).toBe(true);
      expect(exporter.builtSpans.has(childStarts[0].exportedSpan.id)).toBe(true);

      // Restore fake timers for afterEach cleanup
      vi.useFakeTimers();
    });
  });
});
