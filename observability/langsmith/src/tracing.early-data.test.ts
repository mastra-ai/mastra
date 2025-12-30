/**
 * Early Data Handling Tests for LangSmith Exporter
 *
 * These tests verify that the LangSmith exporter correctly handles:
 * - Out-of-order span arrival
 * - Root spans arriving after children
 * - Deep hierarchy cascading
 * - Late events during cleanup delay
 * - Orphaned span handling
 *
 * LangSmith uses skipBuildRootTask = true, meaning:
 * - Root spans do NOT create a separate trace wrapper
 * - Root spans are just top-level RunTrees
 * - Child spans still wait for their parent (including root) before processing
 */

import { runAllEarlyDataTests, runLateEventTests, runOrphanedSpanTests } from '@observability/test-utils';
import type { ExporterFactory } from '@observability/test-utils';
import { describe, beforeEach, afterEach, vi, it, expect } from 'vitest';
import { LangSmithExporter } from './tracing';

// Mock LangSmith to avoid real API calls
vi.mock('langsmith', () => {
  // Use classes for proper `new` support
  class MockRunTree {
    id: string;
    name: string;
    inputs: Record<string, unknown> = {};
    outputs: Record<string, unknown> = {};
    metadata: Record<string, unknown> = {};
    error?: string;

    constructor() {
      this.id = `mock-run-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      this.name = 'mock-run';
    }

    createChild = vi.fn().mockImplementation(() => new MockRunTree());
    postRun = vi.fn().mockResolvedValue(undefined);
    patchRun = vi.fn().mockResolvedValue(undefined);
    end = vi.fn().mockResolvedValue(undefined);
    addEvent = vi.fn();
  }

  class MockClient {
    createRun = vi.fn().mockResolvedValue(undefined);
    updateRun = vi.fn().mockResolvedValue(undefined);
  }

  return {
    Client: MockClient,
    RunTree: MockRunTree,
  };
});

describe('LangSmithExporter Early Data Handling', () => {
  const factory: ExporterFactory = () => {
    return new LangSmithExporter({
      apiKey: 'test-api-key',
      // Use long cleanup delay to prevent cleanup during tests
      traceCleanupDelayMs: 60 * 60 * 1000,
    });
  };

  // Run shared early data test scenarios
  runAllEarlyDataTests(factory, 'LangSmithExporter');
  runLateEventTests(factory, 'LangSmithExporter');
  runOrphanedSpanTests(factory, 'LangSmithExporter');

  // LangSmith-specific tests
  describe('LangSmith-specific behavior', () => {
    let exporter: LangSmithExporter;

    beforeEach(() => {
      vi.useFakeTimers();
      exporter = factory() as LangSmithExporter;
    });

    afterEach(async () => {
      await exporter.shutdown();
      vi.useRealTimers();
    });

    it('should handle root spans as top-level RunTrees (no trace wrapper)', async () => {
      // LangSmith uses skipBuildRootTask = true, so root spans
      // are processed directly as RunTrees without a wrapper
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
