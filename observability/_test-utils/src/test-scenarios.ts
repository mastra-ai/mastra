/**
 * Shared test scenarios for early/late data handling.
 * These can be run against any TrackingExporter-based exporter.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TracingEvent } from '@mastra/core/observability';
import { generateTrace, reverseHierarchyOrder, sendWithDelays } from './trace-generator';

/**
 * Flush async processing (setImmediate callbacks) with fake timers.
 * Uses advanceTimersToNextTimerAsync to run each scheduled timer one at a time.
 */
async function flushAsync(times: number = 1): Promise<void> {
  for (let i = 0; i < times; i++) {
    await vi.advanceTimersToNextTimerAsync();
  }
}

export interface TestableExporter {
  exportTracingEvent: (event: TracingEvent) => Promise<void>;
  shutdown: () => Promise<void>;
  getTraceMapSize?: () => number;
}

export type ExporterFactory = () => TestableExporter;

/**
 * Run all early data handling tests for an exporter.
 */
export function runAllEarlyDataTests(factory: ExporterFactory, exporterName: string): void {
  runOutOfOrderSpanTests(factory, exporterName);
  runRootArrivesLastTests(factory, exporterName);
  runDeepHierarchyTests(factory, exporterName);
}

/**
 * Test out-of-order span arrival.
 */
export function runOutOfOrderSpanTests(factory: ExporterFactory, exporterName: string): void {
  describe(`${exporterName}: Out-of-order span arrival`, () => {
    let exporter: TestableExporter;

    beforeEach(() => {
      vi.useFakeTimers();
      exporter = factory();
    });

    afterEach(async () => {
      await exporter.shutdown();
      vi.useRealTimers();
    });

    it('should process spans when children arrive before parents', async () => {
      // Generate a trace and reverse order so children come first
      const events = generateTrace({ depth: 3, breadth: 2, includeEvents: false });
      const reversedEvents = reverseHierarchyOrder(events);

      // Send events
      await sendWithDelays(exporter, reversedEvents);

      // Allow async processing
      await flushAsync(10);

      // Advance timers to allow cleanup scheduling
      vi.advanceTimersByTime(1000);

      // All spans should eventually be processed
      // (verification depends on exporter implementation)
    });

    it('should handle interleaved start and end events', async () => {
      const events = generateTrace({ depth: 2, breadth: 3, includeEvents: true });

      // Interleave events: start1, start2, end1, start3, end2, end3...
      const starts = events.filter(e => e.type === 'span_started');
      const ends = events.filter(e => e.type === 'span_ended');

      const interleaved: TracingEvent[] = [];
      const maxLen = Math.max(starts.length, ends.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < starts.length) interleaved.push(starts[i]);
        if (i < ends.length) interleaved.push(ends[i]);
      }

      await sendWithDelays(exporter, interleaved);
      await flushAsync(10);
    });
  });
}

/**
 * Test root span arriving last.
 */
export function runRootArrivesLastTests(factory: ExporterFactory, exporterName: string): void {
  describe(`${exporterName}: Root arrives last`, () => {
    let exporter: TestableExporter;

    beforeEach(() => {
      vi.useFakeTimers();
      exporter = factory();
    });

    afterEach(async () => {
      await exporter.shutdown();
      vi.useRealTimers();
    });

    it('should queue children and process after root arrives', async () => {
      const events = generateTrace({ depth: 2, breadth: 2, includeEvents: false });

      // Find root and non-root events
      const rootStart = events.find(e => e.type === 'span_started' && e.exportedSpan.isRootSpan)!;
      const nonRootStarts = events.filter(e => e.type === 'span_started' && !e.exportedSpan.isRootSpan);
      const ends = events.filter(e => e.type === 'span_ended');

      // Send children first
      await sendWithDelays(exporter, nonRootStarts);

      // Children should be queued (can't process without root)
      // Now send root
      await exporter.exportTracingEvent(rootStart);

      // Allow async processing
      await flushAsync(10);

      // Send end events
      await sendWithDelays(exporter, ends);
      await flushAsync(5);
    });

    it('should handle multiple children waiting for root', async () => {
      // Generate a wide trace (many children at same level)
      const events = generateTrace({ depth: 2, breadth: 5, includeEvents: false });

      // Separate root from children
      const rootEvents = events.filter(e => e.exportedSpan.isRootSpan);
      const childEvents = events.filter(e => !e.exportedSpan.isRootSpan);

      // Send all children first
      await sendWithDelays(
        exporter,
        childEvents.filter(e => e.type === 'span_started'),
      );

      // Then send root
      await sendWithDelays(
        exporter,
        rootEvents.filter(e => e.type === 'span_started'),
      );

      await flushAsync(15);

      // Send end events
      await sendWithDelays(
        exporter,
        events.filter(e => e.type === 'span_ended'),
      );
      await flushAsync(5);
    });
  });
}

/**
 * Test deep hierarchy with out-of-order arrival.
 */
export function runDeepHierarchyTests(factory: ExporterFactory, exporterName: string): void {
  describe(`${exporterName}: Deep hierarchy out of order`, () => {
    let exporter: TestableExporter;

    beforeEach(() => {
      vi.useFakeTimers();
      exporter = factory();
    });

    afterEach(async () => {
      await exporter.shutdown();
      vi.useRealTimers();
    });

    it('should cascade processing through deep hierarchy', async () => {
      // Generate a deep, narrow trace
      const events = generateTrace({ depth: 5, breadth: 1, includeEvents: false });
      const starts = events.filter(e => e.type === 'span_started');
      const ends = events.filter(e => e.type === 'span_ended');

      // Reverse the starts so deepest comes first
      const reversedStarts = [...starts].reverse();

      // Send in reverse order
      await sendWithDelays(exporter, reversedStarts);

      // Allow multiple rounds of async processing for cascade
      await flushAsync(20);

      // Send ends in normal order
      await sendWithDelays(exporter, ends);
      await flushAsync(5);
    });

    it('should handle D->B->C->A arrival order', async () => {
      // Manually create 4 spans: A (root) -> B -> C -> D
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

      // Send in order: D, B, C, A (worst case for queue)
      await exporter.exportTracingEvent(spanD);
      await exporter.exportTracingEvent(spanB);
      await exporter.exportTracingEvent(spanC);
      await exporter.exportTracingEvent(spanA);

      // Allow cascade processing: A enables B, B enables C, C enables D
      await flushAsync(20);

      // All should now be processed
    });
  });
}

/**
 * Test late event handling (events arriving after spans end).
 */
export function runLateEventTests(factory: ExporterFactory, exporterName: string): void {
  describe(`${exporterName}: Late event handling`, () => {
    let exporter: TestableExporter;

    beforeEach(() => {
      vi.useFakeTimers();
      exporter = factory();
    });

    afterEach(async () => {
      await exporter.shutdown();
      vi.useRealTimers();
    });

    it('should process events during cleanup delay window', async () => {
      const events = generateTrace({ depth: 2, breadth: 1, includeEvents: false });

      // Send all events normally
      await sendWithDelays(exporter, events);
      await flushAsync(5);

      // All spans have ended, cleanup is scheduled
      // Send a late event before cleanup fires
      const lateEvent: TracingEvent = {
        type: 'span_ended',
        exportedSpan: {
          id: 'late-event',
          traceId: events[0].exportedSpan.traceId,
          parentSpanId: events[0].exportedSpan.id,
          name: 'late-event',
          type: 'EVENT' as any,
          isRootSpan: false,
          isEvent: true,
          startTime: new Date(),
          endTime: new Date(),
        },
      };

      await exporter.exportTracingEvent(lateEvent);
      await flushAsync(5);

      // Event should have been processed
    });

    it('should handle data after cleanup completes', async () => {
      const events = generateTrace({ depth: 1, breadth: 1, includeEvents: false });

      // Send all events
      await sendWithDelays(exporter, events);
      await flushAsync(5);

      // Advance time past cleanup delay
      vi.advanceTimersByTime(60000); // 60 seconds

      // Try to send data for the (now cleaned up) trace
      const veryLateEvent: TracingEvent = {
        type: 'span_started',
        exportedSpan: {
          id: 'very-late-span',
          traceId: events[0].exportedSpan.traceId,
          name: 'very-late-span',
          type: 'TOOL_CALL' as any,
          isRootSpan: false,
          isEvent: false,
          startTime: new Date(),
        },
      };

      // Should not throw, should create new trace or handle gracefully
      await exporter.exportTracingEvent(veryLateEvent);
    });
  });
}

/**
 * Test orphaned span handling (parent never arrives).
 */
export function runOrphanedSpanTests(factory: ExporterFactory, exporterName: string): void {
  describe(`${exporterName}: Orphaned span handling`, () => {
    let exporter: TestableExporter;

    beforeEach(() => {
      vi.useFakeTimers();
      exporter = factory();
    });

    afterEach(async () => {
      await exporter.shutdown();
      vi.useRealTimers();
    });

    it('should drop spans after max attempts', async () => {
      // Send a child without ever sending the parent
      const orphanSpan: TracingEvent = {
        type: 'span_started',
        exportedSpan: {
          id: 'orphan-span',
          traceId: `orphan-trace-${Date.now()}`,
          parentSpanId: 'non-existent-parent',
          name: 'orphan-span',
          type: 'TOOL_CALL' as any,
          isRootSpan: false,
          isEvent: false,
          startTime: new Date(),
        },
      };

      await exporter.exportTracingEvent(orphanSpan);

      // Trigger many processing attempts
      for (let i = 0; i < 10; i++) {
        await flushAsync(5);
        vi.advanceTimersByTime(1000);
      }

      // Span should eventually be dropped (can't verify without access to logs)
    });

    it('should drop spans after TTL expiry', async () => {
      const orphanSpan: TracingEvent = {
        type: 'span_started',
        exportedSpan: {
          id: 'ttl-orphan-span',
          traceId: `ttl-orphan-trace-${Date.now()}`,
          parentSpanId: 'non-existent-parent',
          name: 'ttl-orphan-span',
          type: 'TOOL_CALL' as any,
          isRootSpan: false,
          isEvent: false,
          startTime: new Date(),
        },
      };

      await exporter.exportTracingEvent(orphanSpan);

      // Advance time past TTL (default 30 seconds)
      vi.advanceTimersByTime(35000);
      await flushAsync(5);

      // Span should be dropped due to TTL
    });
  });
}
