/**
 * Early Data Handling Tests for Langfuse Exporter
 *
 * These tests verify that the Langfuse exporter correctly handles:
 * - Out-of-order span arrival
 * - Root spans arriving after children
 * - Deep hierarchy cascading
 * - Late events during cleanup delay
 * - Orphaned span handling
 *
 * Langfuse uses skipBuildRootTask = false (default), meaning:
 * - Root spans create a trace wrapper via _buildRoot
 * - Child spans wait for root before processing
 */

import type { ExporterFactory } from '@observability/test-utils';
import {
  generateTrace,
  runAllEarlyDataTests,
  runLateEventTests,
  runOrphanedSpanTests,
  sendWithDelays,
} from '@observability/test-utils';
import { describe, beforeEach, afterEach, vi, it, expect } from 'vitest';
import { LangfuseExporter } from './tracing';

// Mock Langfuse to avoid real API calls
// Track mock function calls for assertions using vi.hoisted to avoid hoisting issues
const { mockLangfuseTrace } = vi.hoisted(() => {
  const createMockSpan = (): any => {
    const mockSpan: any = {
      id: `mock-span-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      span: vi.fn(),
      generation: vi.fn(),
      event: vi.fn(),
      update: vi.fn(),
      end: vi.fn(),
    };
    // Allow nested spans - create new instances for each call
    mockSpan.span.mockImplementation(() => createMockSpan());
    mockSpan.generation.mockImplementation(() => createMockSpan());
    mockSpan.event.mockReturnValue({ id: 'mock-event' });
    return mockSpan;
  };

  const createMockTrace = (): any => {
    return {
      id: `mock-trace-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      span: vi.fn().mockImplementation(() => createMockSpan()),
      generation: vi.fn().mockImplementation(() => createMockSpan()),
      event: vi.fn().mockReturnValue({ id: 'mock-event' }),
      update: vi.fn(),
    };
  };

  const mockLangfuseTrace = vi.fn().mockImplementation(() => createMockTrace());

  return { mockLangfuseTrace, createMockSpan, createMockTrace };
});

vi.mock('langfuse', () => {
  // Use a class constructor for proper `new` support
  class MockLangfuse {
    trace = mockLangfuseTrace;
    score = vi.fn().mockResolvedValue(undefined);
    flushAsync = vi.fn().mockResolvedValue(undefined);
    shutdownAsync = vi.fn().mockResolvedValue(undefined);
  }

  return {
    Langfuse: MockLangfuse,
  };
});

describe('LangfuseExporter Early Data Handling', () => {
  const factory: ExporterFactory = () => {
    return new LangfuseExporter({
      publicKey: 'test-public-key',
      secretKey: 'test-secret-key',
      // Use long cleanup delay to prevent cleanup during tests
      traceCleanupDelayMs: 60 * 60 * 1000,
    });
  };

  // Run shared early data test scenarios
  runAllEarlyDataTests(factory, 'LangfuseExporter');
  runLateEventTests(factory, 'LangfuseExporter');
  runOrphanedSpanTests(factory, 'LangfuseExporter');

  // Langfuse-specific tests
  describe('Langfuse-specific behavior', () => {
    let exporter: LangfuseExporter;

    beforeEach(() => {
      vi.useFakeTimers();
      // Clear mock call history
      mockLangfuseTrace.mockClear();
      exporter = factory() as LangfuseExporter;
    });

    afterEach(async () => {
      await exporter.shutdown();
      vi.useRealTimers();
    });

    it('should create trace wrapper for root span via langfuse.trace()', async () => {
      // Langfuse creates a wrapper via _buildRoot for the root span.
      // This test verifies langfuse.trace() is called for the root span.

      // Record initial call count after exporter initialization
      const initialTraceCalls = mockLangfuseTrace?.mock.calls.length ?? 0;

      // Generate a trace with root + 1 child
      const events = generateTrace({ depth: 2, breadth: 1, includeEvents: false });
      const rootStart = events.find(e => e.type === 'span_started' && e.exportedSpan.isRootSpan);
      const childStarts = events.filter(e => e.type === 'span_started' && !e.exportedSpan.isRootSpan);

      expect(rootStart).toBeDefined();
      expect(childStarts.length).toBeGreaterThan(0);

      // Process root span first (normal order)
      await sendWithDelays(exporter, [rootStart!]);
      // Advance timers to allow async processing
      await vi.advanceTimersByTimeAsync(100);

      // Verify langfuse.trace() was called for the root span
      const newTraceCalls = (mockLangfuseTrace?.mock.calls.length ?? 0) - initialTraceCalls;
      expect(newTraceCalls).toBeGreaterThan(0);

      // Verify the trace was created with the correct name
      const lastTraceCall = mockLangfuseTrace?.mock.calls[mockLangfuseTrace.mock.calls.length - 1];
      expect(lastTraceCall?.[0]).toEqual(
        expect.objectContaining({
          name: rootStart!.exportedSpan.name,
        }),
      );

      // Process child span - this should succeed if root was properly set up
      await sendWithDelays(exporter, [childStarts[0]]);
      await vi.advanceTimersByTimeAsync(100);

      // If we get here without errors, the trace wrapper was created correctly
      // and children can be attached to it
    });
  });
});
