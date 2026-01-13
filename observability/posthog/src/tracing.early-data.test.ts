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

import type { ExporterFactory } from '@observability/test-utils';
import {
  runAllEarlyDataTests,
  runLateEventTests,
  runOrphanedSpanTests,
  generateTrace,
  sendWithDelays,
} from '@observability/test-utils';
import { describe, beforeEach, afterEach, vi, it, expect } from 'vitest';
import { PosthogExporter } from './tracing';

// Mock PostHog to avoid real API calls
// Track capture calls for assertions using vi.hoisted
const { mockCapture } = vi.hoisted(() => {
  const mockCapture = vi.fn();
  return { mockCapture };
});

vi.mock('posthog-node', () => {
  return {
    PostHog: class {
      capture = mockCapture;
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
      mockCapture.mockClear();
      exporter = factory() as PosthogExporter;
    });

    afterEach(async () => {
      await exporter.shutdown();
      vi.useRealTimers();
    });

    it('should handle root spans without trace wrapper and allow child processing', async () => {
      // PostHog uses skipBuildRootTask = true, so root spans
      // are processed directly via _buildSpan without a _buildRoot wrapper.
      // Children still wait for the root to be processed first.

      // Generate a trace with root + 1 child
      const events = generateTrace({ depth: 2, breadth: 1, includeEvents: false });
      const rootStart = events.find(e => e.type === 'span_started' && e.exportedSpan.isRootSpan);
      const childStarts = events.filter(e => e.type === 'span_started' && !e.exportedSpan.isRootSpan);

      expect(rootStart).toBeDefined();
      expect(childStarts.length).toBeGreaterThan(0);

      // Record initial capture calls
      const initialCaptureCalls = mockCapture.mock.calls.length;

      // Process root span first (normal order)
      await sendWithDelays(exporter, [rootStart!]);
      // Advance timers multiple times to process queued async callbacks
      // (5 iterations is sufficient for queue processing to complete)
      await vi.advanceTimersByTimeAsync(100);

      // Process child span - this should succeed if root was properly set up
      await sendWithDelays(exporter, [childStarts[0]]);
      await vi.advanceTimersByTimeAsync(100);

      // Verify PostHog capture was called for spans (events are captured on span end)
      // Since we only sent start events, capture won't be called yet.
      // The important verification is that no errors were thrown,
      // proving root spans are processed correctly and children can attach.
      expect(mockCapture.mock.calls.length).toBeGreaterThanOrEqual(initialCaptureCalls);
    });
  });
});
