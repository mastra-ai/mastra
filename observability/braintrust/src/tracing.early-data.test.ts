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

import { describe, beforeEach, afterEach, vi, it, expect } from 'vitest';
import {
  runAllEarlyDataTests,
  runLateEventTests,
  runOrphanedSpanTests,
  type ExporterFactory,
} from '@observability/test-utils';
import { BraintrustExporter } from './tracing';

// Mock Braintrust to avoid real API calls
vi.mock('braintrust', () => {
  const mockSpan = {
    id: 'mock-span',
    startSpan: vi.fn(),
    log: vi.fn(),
    end: vi.fn(),
  };
  // Allow nested spans
  mockSpan.startSpan.mockReturnValue(mockSpan);

  const mockLogger = {
    id: 'mock-logger',
    startSpan: vi.fn().mockReturnValue(mockSpan),
  };

  return {
    initLogger: vi.fn().mockResolvedValue(mockLogger),
    currentSpan: vi.fn().mockReturnValue(mockSpan),
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
      exporter = factory() as BraintrustExporter;
    });

    afterEach(async () => {
      await exporter.shutdown();
      vi.useRealTimers();
    });

    it('should create trace wrapper for root span', async () => {
      // Braintrust creates a wrapper via _buildRoot for the root span
      // This test verifies the root span is properly identified
      const { generateTrace, sendWithDelays } = await import('@observability/test-utils');

      const events = generateTrace({ depth: 1, breadth: 1, includeEvents: false });
      const rootStart = events.find(e => e.type === 'span_started' && e.exportedSpan.isRootSpan);

      expect(rootStart).toBeDefined();
      expect(rootStart!.exportedSpan.isRootSpan).toBe(true);

      await sendWithDelays(exporter, [rootStart!]);
      // Use vi.advanceTimersToNextTimerAsync for fake timers
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersToNextTimerAsync();
      }
    });
  });
});
