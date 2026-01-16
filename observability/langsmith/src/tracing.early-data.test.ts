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

import type { ExporterFactory } from '@observability/test-utils';
import { runAllEarlyDataTests, runLateEventTests, runOrphanedSpanTests } from '@observability/test-utils';
import { describe, beforeEach, afterEach, vi, it, expect } from 'vitest';
import { LangSmithExporter } from './tracing';

// Mock LangSmith to avoid real API calls
// Track constructor calls for assertions
const runTreeConstructorCalls: any[] = [];
const clientConstructorCalls: any[] = [];

vi.mock('langsmith', () => {
  // Use classes for proper `new` support
  class MockRunTree {
    id: string;
    name: string;
    inputs: Record<string, unknown> = {};
    outputs: Record<string, unknown> = {};
    metadata: Record<string, unknown> = {};
    error?: string;
    config: any;

    constructor(config?: any) {
      runTreeConstructorCalls.push(config);
      this.config = config;
      this.id = `mock-run-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      this.name = config?.name ?? 'mock-run';
    }

    createChild = vi.fn().mockImplementation((childConfig?: any) => new MockRunTree(childConfig));
    postRun = vi.fn().mockResolvedValue(undefined);
    patchRun = vi.fn().mockResolvedValue(undefined);
    end = vi.fn().mockResolvedValue(undefined);
    addEvent = vi.fn();
  }

  class MockClient {
    config: any;

    constructor(config?: any) {
      clientConstructorCalls.push(config);
      this.config = config;
    }

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
      // Clear constructor call tracking
      runTreeConstructorCalls.length = 0;
      clientConstructorCalls.length = 0;
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

      // Clear any constructor calls from exporter initialization
      const initialRunTreeCalls = runTreeConstructorCalls.length;

      const events = generateTrace({ depth: 1, breadth: 1, includeEvents: false });
      const rootStart = events.find(e => e.type === 'span_started' && e.exportedSpan.isRootSpan);

      expect(rootStart).toBeDefined();
      expect(rootStart!.exportedSpan.isRootSpan).toBe(true);

      await sendWithDelays(exporter, [rootStart!]);
      // Advance timers to allow async processing
      await vi.advanceTimersByTimeAsync(100);

      // Verify RunTree was created for the root span (not a trace wrapper)
      const newRunTreeCalls = runTreeConstructorCalls.slice(initialRunTreeCalls);
      expect(newRunTreeCalls.length).toBeGreaterThan(0);

      // The first new RunTree should be for the root span with the span's name
      const rootRunTreeConfig = newRunTreeCalls[0];
      expect(rootRunTreeConfig).toBeDefined();
      expect(rootRunTreeConfig.name).toBe(rootStart!.exportedSpan.name);
      expect(rootRunTreeConfig.run_type).toBeDefined();
    });
  });
});
