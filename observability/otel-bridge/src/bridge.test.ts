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
import { trace as otelTrace } from '@opentelemetry/api';
import { BasicTracerProvider, SimpleSpanProcessor, InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OtelBridge } from './bridge.js';

/**
 * Helper: register a real TracerProvider so the bridge gets valid span IDs.
 * Returns a cleanup function that unregisters the provider.
 */
function registerTracerProvider() {
  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  otelTrace.setGlobalTracerProvider(provider);
  return {
    exporter,
    cleanup: async () => {
      await provider.shutdown();
      otelTrace.disable();
    },
  };
}

describe('OtelBridge', () => {
  describe('createSpan', () => {
    describe('with TracerProvider', () => {
      let cleanup: () => Promise<void>;

      beforeEach(() => {
        const tp = registerTracerProvider();
        cleanup = tp.cleanup;
      });

      afterEach(async () => {
        await cleanup();
      });

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

        bridge.shutdown();
      });

      it('should return unique spanIds for different spans', () => {
        const bridge = new OtelBridge();

        const result1 = bridge.createSpan({
          type: SpanType.AGENT_RUN,
          name: 'agent-1',
          attributes: { agentId: 'a' },
        });
        const result2 = bridge.createSpan({
          type: SpanType.AGENT_RUN,
          name: 'agent-2',
          attributes: { agentId: 'b' },
        });

        expect(result1).toBeDefined();
        expect(result2).toBeDefined();
        expect(result1!.spanId).not.toBe(result2!.spanId);

        bridge.shutdown();
      });
    });

    describe('without TracerProvider (noop tracer)', () => {
      it('should return undefined when no TracerProvider is registered', () => {
        // With no TracerProvider, OTEL creates NonRecordingSpans with all-zero
        // IDs. The bridge should detect this and return undefined so DefaultSpan
        // falls back to its own unique ID generation.
        const bridge = new OtelBridge();

        const options: CreateSpanOptions<SpanType.AGENT_RUN> = {
          type: SpanType.AGENT_RUN,
          name: 'test-agent',
          attributes: { agentId: 'test' },
        };

        // Temporarily disable the global provider to ensure noop behavior.
        // The global API may still have a provider from other tests, so we
        // disable it to guarantee the noop path is exercised.
        otelTrace.disable();

        const result = bridge.createSpan(options);

        expect(result).toBeUndefined();

        bridge.shutdown();
      });
    });

    it('should handle errors gracefully and return undefined on failure', () => {
      const bridge = new OtelBridge();

      // Pass invalid options to trigger error path
      const result = bridge.createSpan(null as any);

      expect(result).toBeUndefined();

      bridge.shutdown();
    });
  });

  describe('executeInContext', () => {
    let cleanup: () => Promise<void>;

    beforeEach(() => {
      const tp = registerTracerProvider();
      cleanup = tp.cleanup;
    });

    afterEach(async () => {
      await cleanup();
    });

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
    let cleanup: () => Promise<void>;

    beforeEach(() => {
      const tp = registerTracerProvider();
      cleanup = tp.cleanup;
    });

    afterEach(async () => {
      await cleanup();
    });

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

      // Create a span (may or may not succeed depending on TracerProvider)
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
