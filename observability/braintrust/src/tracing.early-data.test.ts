/**
 * Early Data Handling Tests for Braintrust Exporter
 *
 * These tests verify that the Braintrust exporter correctly handles:
 * - Out-of-order span arrival
 * - Root spans arriving after children
 * - Deep hierarchy cascading
 * - Late events during cleanup delay
 * - Orphaned span handling
 *
 * Braintrust uses skipBuildRootTask = false, meaning:
 * - Root spans create a trace wrapper via _buildRoot
 * - Child spans wait for root before processing
 */

import type { ExporterFactory } from '@observability/test-utils';
import { runAllEarlyDataTests, runLateEventTests, runOrphanedSpanTests } from '@observability/test-utils';
import { describe, beforeEach, afterEach, vi, it, expect } from 'vitest';
import { BraintrustExporter } from './tracing';

// Mock Braintrust to avoid real API calls
// Track mock function calls for assertions using vi.hoisted to avoid hoisting issues
const { mockLoggerStartSpan, mockInitLogger, createMockSpan } = vi.hoisted(() => {
  const createMockSpan = (): any => {
    const mockSpan: any = {
      id: `mock-span-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      startSpan: vi.fn(),
      log: vi.fn(),
      end: vi.fn(),
    };
    // Allow nested spans - create new instance for each call
    mockSpan.startSpan.mockImplementation(() => createMockSpan());
    return mockSpan;
  };

  const mockLoggerStartSpan = vi.fn().mockImplementation(() => createMockSpan());

  const mockLogger = {
    id: 'mock-logger',
    startSpan: mockLoggerStartSpan,
  };

  const mockInitLogger = vi.fn().mockResolvedValue(mockLogger);

  return { mockLoggerStartSpan, mockInitLogger, createMockSpan };
});

vi.mock('braintrust', () => {
  return {
    initLogger: mockInitLogger,
    currentSpan: vi.fn().mockReturnValue(createMockSpan()),
  };
});

describe('BraintrustExporter Early Data Handling', () => {
  const factory: ExporterFactory = () => {
    return new BraintrustExporter({
      apiKey: 'test-api-key',
      // Use long cleanup delay to prevent cleanup during tests
      traceCleanupDelayMs: 60 * 60 * 1000,
    });
  };

  // Run shared early data test scenarios
  runAllEarlyDataTests(factory, 'BraintrustExporter');
  runLateEventTests(factory, 'BraintrustExporter');
  runOrphanedSpanTests(factory, 'BraintrustExporter');

  // Braintrust-specific tests
  describe('Braintrust-specific behavior', () => {
    let exporter: BraintrustExporter;

    beforeEach(() => {
      vi.useFakeTimers();
      // Clear mock call history
      mockLoggerStartSpan?.mockClear();
      mockInitLogger?.mockClear();
      exporter = factory() as BraintrustExporter;
    });

    afterEach(async () => {
      await exporter.shutdown();
      vi.useRealTimers();
    });

    it('should create trace wrapper for root span via logger.startSpan', async () => {
      // Braintrust creates a wrapper via _buildRoot for the root span
      // This test verifies the root span is processed and logger.startSpan is called
      const { generateTrace, sendWithDelays } = await import('@observability/test-utils');

      // Record initial call count after exporter initialization
      const initialStartSpanCalls = mockLoggerStartSpan?.mock.calls.length ?? 0;

      const events = generateTrace({ depth: 1, breadth: 1, includeEvents: false });
      const rootStart = events.find(e => e.type === 'span_started' && e.exportedSpan.isRootSpan);

      expect(rootStart).toBeDefined();
      expect(rootStart!.exportedSpan.isRootSpan).toBe(true);

      await sendWithDelays(exporter, [rootStart!]);
      // Advance timers to allow async processing
      await vi.advanceTimersByTimeAsync(100);

      // Verify initLogger was called during exporter initialization
      expect(mockInitLogger).toHaveBeenCalled();

      // Verify logger.startSpan was called for the root span
      const newStartSpanCalls = (mockLoggerStartSpan?.mock.calls.length ?? 0) - initialStartSpanCalls;
      expect(newStartSpanCalls).toBeGreaterThan(0);

      // Verify the span was created with the correct name
      const lastCall = mockLoggerStartSpan?.mock.calls[mockLoggerStartSpan.mock.calls.length - 1];
      expect(lastCall?.[0]).toEqual(
        expect.objectContaining({
          name: rootStart!.exportedSpan.name,
        }),
      );
    });
  });
});
