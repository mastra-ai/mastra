/**
 * Unit tests for OtelBridge
 *
 * Note: Full integration tests with real OTEL infrastructure are in
 * observability/_examples/agent-hub/src/integration.test.ts
 *
 * These unit tests focus on the bridge's core logic and API surface.
 */

import type { CreateSpanOptions } from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import { isSpanContextValid, trace } from '@opentelemetry/api';
import { tracing } from '@opentelemetry/sdk-node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OtelBridge } from './bridge.js';

// OTEL invalid (no-op) IDs, returned when no SDK / tracer provider is registered
const INVALID_SPAN_ID = '0000000000000000';
const INVALID_TRACE_ID = '00000000000000000000000000000000';

describe('OtelBridge', () => {
  // Register a real (in-memory) tracer provider for tests that need the bridge
  // to produce valid span contexts. Without this, the OTEL API falls back to a
  // no-op tracer whose spans carry all-zero IDs (see issue #15589 regression
  // tests below).
  let tracerProvider: tracing.BasicTracerProvider;

  beforeAll(() => {
    tracerProvider = new tracing.BasicTracerProvider();
    trace.setGlobalTracerProvider(tracerProvider);
  });

  afterAll(async () => {
    await tracerProvider.shutdown();
    trace.disable();
  });

  describe('createSpan', () => {
    it('should return spanIds with valid format when creating root span', () => {
      const bridge = new OtelBridge();

      const options: CreateSpanOptions<SpanType.AGENT_RUN> = {
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: { agentId: 'test' },
      };

      const result = bridge.createSpan(options);

      expect(result).toBeDefined();
      expect(result?.spanId).toBeDefined();
      expect(result?.traceId).toBeDefined();
      // OTEL span IDs are 16 hex chars, trace IDs are 32 hex chars
      expect(result?.spanId).toMatch(/^[0-9a-f]{16}$/);
      expect(result?.traceId).toMatch(/^[0-9a-f]{32}$/);
      // The all-zero IDs also match the hex regex above, so assert explicitly
      // that we got a valid (non-no-op) span context.
      expect(result?.spanId).not.toBe(INVALID_SPAN_ID);
      expect(result?.traceId).not.toBe(INVALID_TRACE_ID);

      bridge.shutdown();
    });

    it('should handle errors gracefully and return undefined on failure', () => {
      const bridge = new OtelBridge();

      // Pass invalid options to trigger error path
      const result = bridge.createSpan(null as any);

      expect(result).toBeUndefined();

      bridge.shutdown();
    });

    // Regression tests for https://github.com/mastra-ai/mastra/issues/15589
    //
    // When no OTEL SDK / tracer provider is registered, `trace.getTracer(...)`
    // returns a no-op tracer whose spans have INVALID_SPAN_ID / INVALID_TRACE_ID.
    // The bridge must NOT hand those zero IDs back to core — doing so causes all
    // spans to collapse onto the same ID, which breaks TrackingExporter's
    // parent-matching queue and pegs CPU at ~100% via setImmediate reschedules.
    describe('when no OTEL SDK is registered', () => {
      // Tear down the suite-level provider so the OTEL API falls back to its
      // no-op tracer, exactly reproducing a user who forgot to wire up sdk-node.
      beforeAll(() => {
        trace.disable();
      });

      afterAll(() => {
        trace.setGlobalTracerProvider(tracerProvider);
      });

      it('should return undefined (not zero IDs) so core can generate valid IDs', () => {
        // In this test environment, no SDK / tracer provider is registered,
        // so the OTEL API is in its no-op state. This mirrors a real user
        // who configures OtelBridge without also wiring up @opentelemetry/sdk-node.
        const bridge = new OtelBridge();

        const options: CreateSpanOptions<SpanType.AGENT_RUN> = {
          type: SpanType.AGENT_RUN,
          name: 'test-agent',
          attributes: { agentId: 'test' },
        };

        const result = bridge.createSpan(options);

        // Expected: bridge detects invalid span context and returns undefined,
        // letting DefaultSpan fall through to its own ID generator.
        expect(result).toBeUndefined();

        bridge.shutdown();
      });

      it('should not return the invalid (all-zero) OTEL span/trace IDs', () => {
        const bridge = new OtelBridge();

        const options: CreateSpanOptions<SpanType.AGENT_RUN> = {
          type: SpanType.AGENT_RUN,
          name: 'test-agent',
          attributes: { agentId: 'test' },
        };

        const result = bridge.createSpan(options);

        // If the bridge does return something, it must be a valid span context.
        if (result) {
          expect(result.spanId).not.toBe(INVALID_SPAN_ID);
          expect(result.traceId).not.toBe(INVALID_TRACE_ID);
          expect(
            isSpanContextValid({
              spanId: result.spanId,
              traceId: result.traceId,
              traceFlags: 0,
            }),
          ).toBe(true);
        }

        bridge.shutdown();
      });

      it('should consistently return undefined across multiple createSpan calls', () => {
        // With the bug, every span shared spanId "0000000000000000" and
        // traceId "00...00", which is what caused TrackingExporter to
        // infinite-loop trying to match children to parents. The fix makes
        // every call return undefined so core generates unique IDs itself.
        const bridge = new OtelBridge();

        const options: CreateSpanOptions<SpanType.AGENT_RUN> = {
          type: SpanType.AGENT_RUN,
          name: 'test-agent',
          attributes: { agentId: 'test' },
        };

        const a = bridge.createSpan(options);
        const b = bridge.createSpan(options);

        expect(a).toBeUndefined();
        expect(b).toBeUndefined();

        bridge.shutdown();
      });
    });
  });

  describe('executeInContext', () => {
    it('should execute function when span exists', async () => {
      const bridge = new OtelBridge();

      const options: CreateSpanOptions<SpanType.AGENT_RUN> = {
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: { agentId: 'test' },
      };

      const spanIds = bridge.createSpan(options);
      expect(spanIds).toBeDefined();

      let executed = false;
      const result = await bridge.executeInContext(spanIds!.spanId, async () => {
        executed = true;
        return 'test-result';
      });

      expect(executed).toBe(true);
      expect(result).toBe('test-result');

      bridge.shutdown();
    });

    it('should execute function even when span not found', async () => {
      const bridge = new OtelBridge();

      let executed = false;
      const result = await bridge.executeInContext('non-existent-span', async () => {
        executed = true;
        return 'still-works';
      });

      expect(executed).toBe(true);
      expect(result).toBe('still-works');

      bridge.shutdown();
    });
  });

  describe('executeInContextSync', () => {
    it('should execute sync function when span exists', () => {
      const bridge = new OtelBridge();

      const options: CreateSpanOptions<SpanType.AGENT_RUN> = {
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: { agentId: 'test' },
      };

      const spanIds = bridge.createSpan(options);
      expect(spanIds).toBeDefined();

      let executed = false;
      const result = bridge.executeInContextSync(spanIds!.spanId, () => {
        executed = true;
        return 42;
      });

      expect(executed).toBe(true);
      expect(result).toBe(42);

      bridge.shutdown();
    });

    it('should execute sync function even when span not found', () => {
      const bridge = new OtelBridge();

      let executed = false;
      const result = bridge.executeInContextSync('non-existent-span', () => {
        executed = true;
        return 42;
      });

      expect(executed).toBe(true);
      expect(result).toBe(42);

      bridge.shutdown();
    });
  });

  describe('shutdown', () => {
    it('should complete successfully', async () => {
      const bridge = new OtelBridge();

      // Create a span
      const options: CreateSpanOptions<SpanType.AGENT_RUN> = {
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: { agentId: 'test' },
      };

      bridge.createSpan(options);

      // Shutdown should not throw
      await expect(bridge.shutdown()).resolves.toBeUndefined();
    });
  });

  describe('bridge name', () => {
    it('should have name "otel"', () => {
      const bridge = new OtelBridge();
      expect(bridge.name).toBe('otel');
      bridge.shutdown();
    });
  });

  describe('Tags Support', () => {
    it('should include tags as mastra.tags attribute for root spans with tags', async () => {
      // This test verifies that tags are included in the OTEL span attributes
      // OtelBridge uses SpanConverter which should set mastra.tags on root spans
      const { SpanConverter } = await import('@mastra/otel-exporter');
      const converter = new SpanConverter({
        format: 'GenAI_v1_38_0',
        packageName: 'test',
      });

      const rootSpanWithTags = {
        id: 'root-with-tags',
        traceId: 'trace-with-tags',
        type: SpanType.AGENT_RUN,
        name: 'tagged-agent',
        startTime: new Date(),
        endTime: new Date(),
        isRootSpan: true,
        attributes: { agentId: 'agent-123' },
        tags: ['production', 'experiment-v2', 'user-request'],
      } as any;

      const readableSpan = await converter.convertSpan(rootSpanWithTags);

      // Tags should be present as mastra.tags attribute (JSON-stringified for backend compatibility)
      expect(readableSpan.attributes['mastra.tags']).toBeDefined();
      expect(readableSpan.attributes['mastra.tags']).toBe(
        JSON.stringify(['production', 'experiment-v2', 'user-request']),
      );
    });

    it('should not include mastra.tags attribute for child spans', async () => {
      const { SpanConverter } = await import('@mastra/otel-exporter');
      const converter = new SpanConverter({
        format: 'GenAI_v1_38_0',
        packageName: 'test',
      });

      const childSpanWithTags = {
        id: 'child-with-tags',
        traceId: 'trace-parent',
        parentSpanId: 'root-span-id',
        type: SpanType.TOOL_CALL,
        name: 'child-tool',
        startTime: new Date(),
        endTime: new Date(),
        isRootSpan: false,
        attributes: { toolId: 'calculator' },
        tags: ['should-not-appear'],
      } as any;

      const readableSpan = await converter.convertSpan(childSpanWithTags);

      // Tags should NOT be present on child spans
      expect(readableSpan.attributes['mastra.tags']).toBeUndefined();
    });

    it('should not include mastra.tags attribute when tags is empty or undefined', async () => {
      const { SpanConverter } = await import('@mastra/otel-exporter');
      const converter = new SpanConverter({
        format: 'GenAI_v1_38_0',
        packageName: 'test',
      });

      const rootSpanNoTags = {
        id: 'root-no-tags',
        traceId: 'trace-no-tags',
        type: SpanType.AGENT_RUN,
        name: 'agent-no-tags',
        startTime: new Date(),
        endTime: new Date(),
        isRootSpan: true,
        attributes: { agentId: 'agent-123' },
        tags: [],
      } as any;

      const readableSpan = await converter.convertSpan(rootSpanNoTags);

      // Tags should NOT be present when array is empty
      expect(readableSpan.attributes['mastra.tags']).toBeUndefined();
    });
  });
});
