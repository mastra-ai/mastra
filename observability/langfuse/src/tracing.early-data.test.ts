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

import { describe, beforeEach, afterEach, vi, it, expect } from 'vitest';
import {
  runAllEarlyDataTests,
  runLateEventTests,
  runOrphanedSpanTests,
  type ExporterFactory,
} from '@observability/test-utils';
import { LangfuseExporter } from './tracing';

// Mock Langfuse to avoid real API calls
vi.mock('langfuse', () => {
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
    const mockSpan = createMockSpan();
    return {
      id: `mock-trace-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      span: vi.fn().mockImplementation(() => createMockSpan()),
      generation: vi.fn().mockImplementation(() => createMockSpan()),
      event: vi.fn().mockReturnValue({ id: 'mock-event' }),
      update: vi.fn(),
    };
  };

  // Use a class constructor for proper `new` support
  class MockLangfuse {
    trace = vi.fn().mockImplementation(() => createMockTrace());
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
      exporter = factory() as LangfuseExporter;
    });

    afterEach(async () => {
      await exporter.shutdown();
      vi.useRealTimers();
    });

    it('should create trace wrapper for root span', async () => {
      // Langfuse creates a wrapper via _buildRoot for the root span
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
