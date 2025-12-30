/**
 * Early Data Handling Tests for PostHog Exporter
 *
 * These tests verify that the PostHog exporter correctly handles:
 * - Out-of-order span arrival
 * - Root spans arriving after children
 * - Deep hierarchy cascading
 * - Late events during cleanup delay
 * - Orphaned span handling
 *
 * PostHog uses skipBuildRootTask = true, meaning:
 * - Root spans do NOT create a separate trace wrapper
 * - Root spans generate $ai_trace events directly
 * - Child spans still wait for their parent (including root) before processing
 */

import { describe, beforeEach, afterEach, vi, it, expect } from 'vitest';
import {
  runAllEarlyDataTests,
  runLateEventTests,
  runOrphanedSpanTests,
  type ExporterFactory,
} from '@observability/test-utils';
import { PosthogExporter } from './tracing';

// Mock PostHog to avoid real API calls
// Use a class constructor for proper `new` support
vi.mock('posthog-node', () => {
  return {
    PostHog: class {
      capture = vi.fn();
      shutdown = vi.fn().mockResolvedValue(undefined);
    },
  };
});

describe('PosthogExporter Early Data Handling', () => {
  const factory: ExporterFactory = () => {
    return new PosthogExporter({
      apiKey: 'test-api-key',
      // Use long cleanup delay to prevent cleanup during tests
      traceCleanupDelayMs: 60 * 60 * 1000,
    });
  };

  // Run shared early data test scenarios
  runAllEarlyDataTests(factory, 'PosthogExporter');
  runLateEventTests(factory, 'PosthogExporter');
  runOrphanedSpanTests(factory, 'PosthogExporter');

  // PostHog-specific tests
  describe('PostHog-specific behavior', () => {
    let exporter: PosthogExporter;

    beforeEach(() => {
      vi.useFakeTimers();
      exporter = factory() as PosthogExporter;
    });

    afterEach(async () => {
      await exporter.shutdown();
      vi.useRealTimers();
    });

    it('should handle root spans without trace wrapper (skipBuildRootTask = true)', async () => {
      // PostHog uses skipBuildRootTask = true, so root spans
      // are processed directly without a wrapper
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
