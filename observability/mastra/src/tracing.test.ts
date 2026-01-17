import { RequestContext } from '@mastra/core/di';
import { MastraError } from '@mastra/core/error';
import { SpanType, SamplingStrategyType, TracingEventType } from '@mastra/core/observability';
import type {
  TracingEvent,
  ObservabilityExporter,
  ModelGenerationAttributes,
  ObservabilityInstance,
  ExportedSpan,
} from '@mastra/core/observability';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DefaultObservabilityInstance } from './instances';

// Custom matchers for OpenTelemetry ID validation
expect.extend({
  toBeValidSpanId(received: string) {
    const spanIdRegex = /^[a-f0-9]{16}$/;
    const pass = spanIdRegex.test(received);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid OpenTelemetry span ID (64-bit, 16 hex chars)`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid OpenTelemetry span ID (64-bit, 16 hex chars)`,
        pass: false,
      };
    }
  },

  toBeValidTraceId(received: string) {
    const traceIdRegex = /^[a-f0-9]{32}$/;
    const pass = traceIdRegex.test(received);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid OpenTelemetry trace ID (128-bit, 32 hex chars)`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid OpenTelemetry trace ID (128-bit, 32 hex chars)`,
        pass: false,
      };
    }
  },
});

// TypeScript declarations for custom matchers
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeValidSpanId(): T;
    toBeValidTraceId(): T;
  }
  interface AsymmetricMatchersContaining {
    toBeValidSpanId(): any;
    toBeValidTraceId(): any;
  }
}

// Mock console for exporter tests
const mockConsole = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};

vi.stubGlobal('console', mockConsole);

// Test exporter for capturing events
class TestExporter implements ObservabilityExporter {
  name = 'test-exporter';
  events: TracingEvent[] = [];

  async exportTracingEvent(event: TracingEvent): Promise<void> {
    this.events.push(event);
  }

  async shutdown(): Promise<void> {
    // no-op
  }

  reset(): void {
    this.events = [];
  }
}

describe('Tracing', () => {
  let testExporter: TestExporter;

  beforeEach(() => {
    vi.resetAllMocks();

    // Reset test exporter
    testExporter = new TestExporter();
  });

  describe('DefaultObservabilityInstance', () => {
    it('should create and start spans with type safety', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      // Agent span
      const agentSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: {
          agentId: 'agent-123',
          instructions: 'Test instructions',
          maxSteps: 5,
        },
      });

      expect(agentSpan.id).toBeValidSpanId();
      expect(agentSpan.name).toBe('test-agent');
      expect(agentSpan.type).toBe(SpanType.AGENT_RUN);
      expect(agentSpan.attributes?.agentId).toBe('agent-123');
      expect(agentSpan.startTime).toBeInstanceOf(Date);
      expect(agentSpan.endTime).toBeUndefined();
      expect(agentSpan.traceId).toBeValidTraceId();
    });

    it('should create child spans with different types', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      const agentSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'parent-agent',
        attributes: { agentId: 'agent-123' },
      });

      const toolSpan = agentSpan.createChildSpan({
        type: SpanType.TOOL_CALL,
        name: 'child-tool',
        attributes: {
          toolId: 'tool-456',
          success: true,
        },
      });

      expect(toolSpan.id).toBeValidSpanId();
      expect(toolSpan.type).toBe(SpanType.TOOL_CALL);
      expect(toolSpan.attributes?.toolId).toBe('tool-456');
      expect(toolSpan.traceId).toBe(agentSpan.traceId); // Child spans inherit trace ID
    });

    it('should correctly set parent relationships and isRootSpan property', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      // Create root span
      const rootSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'root-agent',
        attributes: { agentId: 'agent-123' },
      });

      // Root span should have no parent and isRootSpan should be true
      expect(rootSpan.parent).toBeUndefined();
      expect(rootSpan.isRootSpan).toBe(true);

      // Create child span
      const childSpan = rootSpan.createChildSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'child-llm',
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
        },
      });

      // Child span should have parent and isRootSpan should be false
      expect(childSpan.parent).toBe(rootSpan);
      expect(childSpan.isRootSpan).toBe(false);

      // Create grandchild span
      const grandchildSpan = childSpan.createChildSpan({
        type: SpanType.TOOL_CALL,
        name: 'grandchild-tool',
        attributes: {
          toolId: 'calculator',
        },
      });

      // Grandchild should have correct parent and isRootSpan should be false
      expect(grandchildSpan.parent).toBe(childSpan);
      expect(grandchildSpan.isRootSpan).toBe(false);
    });

    it('should maintain consistent traceId across span hierarchy', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      // Create root span
      const rootSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'root-agent',
        attributes: { agentId: 'agent-123' },
      });

      // Create child span
      const childSpan = rootSpan.createChildSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'child-llm',
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
        },
      });

      // Create grandchild span
      const grandchildSpan = childSpan.createChildSpan({
        type: SpanType.TOOL_CALL,
        name: 'grandchild-tool',
        attributes: {
          toolId: 'calculator',
        },
      });

      // All spans should have the same traceId
      expect(rootSpan.traceId).toBeValidTraceId();
      expect(childSpan.traceId).toBe(rootSpan.traceId);
      expect(grandchildSpan.traceId).toBe(rootSpan.traceId);

      // But different span IDs
      expect(rootSpan.id).not.toBe(childSpan.id);
      expect(childSpan.id).not.toBe(grandchildSpan.id);
      expect(rootSpan.id).not.toBe(grandchildSpan.id);
    });

    it('should emit events throughout span lifecycle', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      const span = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-llm',
        attributes: { model: 'gpt-4', provider: 'openai' },
      });

      // Should emit span_started
      expect(testExporter.events).toHaveLength(1);
      expect(testExporter.events[0].type).toBe(TracingEventType.SPAN_STARTED);
      expect(testExporter.events[0].exportedSpan.id).toBe(span.id);

      // Update span - cast to LLM attributes type for usage field
      span.update({ attributes: { usage: { totalTokens: 100 } } });

      // Should emit span_updated
      expect(testExporter.events).toHaveLength(2);
      expect(testExporter.events[1].type).toBe(TracingEventType.SPAN_UPDATED);
      expect((testExporter.events[1].exportedSpan.attributes as ModelGenerationAttributes).usage?.totalTokens).toBe(
        100,
      );

      // End span
      span.end({ attributes: { usage: { totalTokens: 150 } } });

      // Should emit span_ended
      expect(testExporter.events).toHaveLength(3);
      expect(testExporter.events[2].type).toBe(TracingEventType.SPAN_ENDED);
      expect(testExporter.events[2].exportedSpan.endTime).toBeInstanceOf(Date);
      expect((testExporter.events[2].exportedSpan.attributes as ModelGenerationAttributes).usage?.totalTokens).toBe(
        150,
      );
    });

    it('should handle errors with default endSpan=true', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      const span = tracing.startSpan({
        type: SpanType.TOOL_CALL,
        name: 'error-tool',
        attributes: { toolId: 'failing-tool' },
      });

      const error = new MastraError({
        id: 'TOOL_ERROR',
        text: 'Tool failed',
        domain: 'TOOL',
        category: 'SYSTEM',
        details: { reason: 'timeout' },
      });

      // Error should end span by default
      span.error({ error });

      expect(span.endTime).toBeInstanceOf(Date);
      expect(span.errorInfo?.message).toBe('Tool failed');
      expect(span.errorInfo?.id).toBe('TOOL_ERROR');
      expect(span.errorInfo?.category).toBe('SYSTEM');

      // Should emit span_ended
      expect(testExporter.events).toHaveLength(2); // start + end
      expect(testExporter.events[1].type).toBe(TracingEventType.SPAN_ENDED);
    });

    it('should handle errors with explicit endSpan=false', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      const span = tracing.startSpan({
        type: SpanType.TOOL_CALL,
        name: 'recoverable-tool',
        attributes: { toolId: 'retry-tool' },
      });

      const error = new Error('Recoverable error');

      // Error should NOT end span when explicitly set to false
      span.error({ error, endSpan: false });

      expect(span.endTime).toBeUndefined();
      expect(span.errorInfo?.message).toBe('Recoverable error');

      // Should emit span_updated (not ended)
      expect(testExporter.events).toHaveLength(2); // start + update
      expect(testExporter.events[1].type).toBe(TracingEventType.SPAN_UPDATED);
    });
  });

  describe('Sampling Strategies', () => {
    it('should always sample with ALWAYS strategy', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      const span = tracing.startSpan({
        type: SpanType.GENERIC,
        name: 'test-span',
        attributes: {},
      });

      expect(span.id).toBeValidSpanId();
      expect(testExporter.events).toHaveLength(1);
    });

    it('should never sample with NEVER strategy', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.NEVER },
        exporters: [testExporter],
      });

      const span = tracing.startSpan({
        type: SpanType.GENERIC,
        name: 'test-span',
        attributes: {},
      });

      expect(span.id).toBe('no-op'); // No-op span created
      expect(testExporter.events).toHaveLength(0);
    });

    it('should sample based on ratio', () => {
      // Mock Math.random to control sampling
      const mockRandom = vi.spyOn(Math, 'random');

      // Test probability = 0.5
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.RATIO, probability: 0.5 },
        exporters: [testExporter],
      });

      // First call: random = 0.3 < 0.5 -> should sample
      mockRandom.mockReturnValueOnce(0.3);
      const span1 = tracing.startSpan({
        type: SpanType.GENERIC,
        name: 'test-1',
        attributes: {},
      });
      expect(span1.id).toBeValidSpanId();

      // Second call: random = 0.8 > 0.5 -> should not sample
      mockRandom.mockReturnValueOnce(0.8);
      const span2 = tracing.startSpan({
        type: SpanType.GENERIC,
        name: 'test-2',
        attributes: {},
      });
      expect(span2.id).toBe('no-op');

      mockRandom.mockRestore();
    });

    it('should use custom sampler', () => {
      const shouldSample = (): boolean => {
        return false;
      };

      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.CUSTOM, sampler: shouldSample },
        exporters: [testExporter],
      });

      const span = tracing.startSpan({
        type: SpanType.GENERIC,
        name: 'test-span',
      });

      expect(span.id).toBe('no-op'); // Custom sampler rejected
      expect(testExporter.events).toHaveLength(0);
    });

    it('should handle invalid ratio probability', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.RATIO, probability: 1.5 }, // Invalid > 1
        exporters: [testExporter],
      });

      const span = tracing.startSpan({
        type: SpanType.GENERIC,
        name: 'test-span',
        attributes: {},
      });

      // Should default to no sampling for invalid probability
      expect(span.id).toBe('no-op');
    });

    it('should handle parent relationships correctly in NoOp spans', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.NEVER }, // Force NoOp spans
        exporters: [testExporter],
      });

      // Create root NoOp span
      const rootSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'no-op-root',
        attributes: { agentId: 'agent-123' },
      });

      // Should be NoOp span with correct properties
      expect(rootSpan.id).toBe('no-op');
      expect(rootSpan.parent).toBeUndefined();
      expect(rootSpan.isRootSpan).toBe(true);

      // Create child NoOp span
      const childSpan = rootSpan.createChildSpan({
        type: SpanType.TOOL_CALL,
        name: 'no-op-child',
        attributes: { toolId: 'tool-456' },
      });

      // Child should also be NoOp with correct parent relationship
      expect(childSpan.id).toBe('no-op');
      expect(childSpan.parent).toBe(rootSpan);
      expect(childSpan.isRootSpan).toBe(false);

      // No events should be emitted for NoOp spans
      expect(testExporter.events).toHaveLength(0);
    });
  });

  describe('Exporter Behavior', () => {
    it('should handle exporter errors gracefully', async () => {
      const failingExporter: ObservabilityExporter = {
        name: 'failing-exporter',
        exportTracingEvent: vi.fn().mockRejectedValue(new Error('Export failed')),
        shutdown: vi.fn().mockResolvedValue(undefined),
      };

      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [failingExporter, testExporter], // One fails, one succeeds
      });

      tracing.startSpan({
        type: SpanType.GENERIC,
        name: 'test-span',
        attributes: {},
      });

      // Wait for async export to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should continue with other exporters despite failure
      expect(testExporter.events).toHaveLength(1);
      expect(failingExporter.exportTracingEvent).toHaveBeenCalled();
    });

    it('should shutdown all components', async () => {
      const mockExporter = {
        name: 'mock-exporter',
        exportTracingEvent: vi.fn(),
        shutdown: vi.fn().mockResolvedValue(undefined),
      };

      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [mockExporter],
      });

      await tracing.shutdown();

      expect(mockExporter.shutdown).toHaveBeenCalled();
    });
  });

  describe('Type Safety', () => {
    it('should enforce correct attribute types for different span types', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      // Agent attributes
      const agentSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'agent-test',
        attributes: {
          agentId: 'agent-123',
          instructions: 'Test agent',
          maxSteps: 10,
        },
      });

      expect(agentSpan.attributes?.agentId).toBe('agent-123');

      // LLM attributes
      const llmSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'llm-test',
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
          usage: { totalTokens: 100 },
          streaming: false,
        },
      });

      expect(llmSpan.attributes?.model).toBe('gpt-4');

      // Tool attributes
      const toolSpan = tracing.startSpan({
        type: SpanType.TOOL_CALL,
        name: 'tool-test',
        attributes: {
          toolId: 'calculator',
          success: true,
        },
      });

      expect(toolSpan.attributes?.toolId).toBe('calculator');
    });
  });

  describe('Event Spans', () => {
    let observability: ObservabilityInstance;
    let testExporter: TestExporter;

    beforeEach(() => {
      testExporter = new TestExporter();
      observability = new DefaultObservabilityInstance({
        serviceName: 'test-event-spans',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });
    });

    it('should create event spans with isEvent=true and no input', () => {
      const rootSpan = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: {
          agentId: 'agent-123',
        },
      });

      const eventSpan = rootSpan.createEventSpan({
        type: SpanType.MODEL_CHUNK,
        name: 'llm chunk: text-delta',
        output: 'Hello world',
        attributes: {
          chunkType: 'text-delta',
        },
      });

      // Event span should have isEvent=true
      expect(eventSpan.isEvent).toBe(true);

      // Event span should not have input (only output)
      expect(eventSpan.input).toBeUndefined();
      expect(eventSpan.output).toBe('Hello world');

      // Event span should have proper attributes
      expect(eventSpan.attributes?.chunkType).toBe('text-delta');

      // Event span should be properly linked to parent
      expect(eventSpan.parent).toBe(rootSpan);
      expect(eventSpan.traceId).toBe(rootSpan.traceId);

      rootSpan.end();
    });

    it('should emit only span_ended event on creation (no span_started)', () => {
      const rootSpan = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: {
          agentId: 'agent-123',
        },
      });

      // Clear events from root span creation
      testExporter.events = [];

      const eventSpan = rootSpan.createEventSpan({
        type: SpanType.MODEL_CHUNK,
        name: 'llm chunk: text-delta',
        output: 'Hello',
        attributes: {
          chunkType: 'text-delta',
        },
      });

      // Should have emitted exactly one event: span_ended
      expect(testExporter.events).toHaveLength(1);
      expect(testExporter.events[0].type).toBe(TracingEventType.SPAN_ENDED);
      expect(testExporter.events[0].exportedSpan).toStrictEqual(eventSpan.exportSpan());

      rootSpan.end();
    });

    it('should have endTime undefined for event spans', () => {
      const rootSpan = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: {
          agentId: 'agent-123',
        },
      });

      const eventSpan = rootSpan.createEventSpan({
        type: SpanType.MODEL_CHUNK,
        name: 'llm chunk: text-delta',
        output: 'Hello',
        attributes: {
          chunkType: 'text-delta',
        },
      });

      // Event spans should not have endTime (event occurs at startTime)
      expect(eventSpan.endTime).toBeUndefined();
      expect(eventSpan.startTime).toBeDefined();

      rootSpan.end();
    });

    it('should never emit span_started or span_updated events for event spans', () => {
      const rootSpan = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: {
          agentId: 'agent-123',
        },
      });

      // Clear initial events
      testExporter.events = [];

      const eventSpan = rootSpan.createEventSpan({
        type: SpanType.MODEL_CHUNK,
        name: 'llm chunk: text-delta',
        output: 'Hello',
        attributes: {
          chunkType: 'text-delta',
        },
      });

      // Try to call update on event span (should be no-op)
      eventSpan.update({
        output: 'Updated hello',
        attributes: { chunkType: 'updated-delta' },
      });

      // Try to call end on event span (should be no-op)
      eventSpan.end({ output: 'Final hello' });

      // Should still only have the initial span_ended event
      expect(testExporter.events).toHaveLength(1);
      expect(testExporter.events[0].type).toBe(TracingEventType.SPAN_ENDED);

      // Event should not include any span_started or span_updated events
      const eventTypes = testExporter.events.map(e => e.type);
      expect(eventTypes).not.toContain(TracingEventType.SPAN_STARTED);
      expect(eventTypes).not.toContain(TracingEventType.SPAN_UPDATED);

      rootSpan.end();
    });

    it('should support all span types as event spans', () => {
      const rootSpan = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: {
          agentId: 'agent-123',
        },
      });

      // Test different span types as events
      const llmChunkEvent = rootSpan.createEventSpan({
        type: SpanType.MODEL_CHUNK,
        name: 'llm chunk event',
        output: 'chunk data',
        attributes: {
          chunkType: 'text-delta',
        },
      });

      const toolCallEvent = rootSpan.createEventSpan({
        type: SpanType.TOOL_CALL,
        name: 'tool call event',
        output: { result: 'success' },
        attributes: {
          toolId: 'calculator',
          success: true,
        },
      });

      const genericEvent = rootSpan.createEventSpan({
        type: SpanType.GENERIC,
        name: 'generic event',
        output: 'generic output',
        attributes: {},
      });

      // All should be event spans
      expect(llmChunkEvent.isEvent).toBe(true);
      expect(toolCallEvent.isEvent).toBe(true);
      expect(genericEvent.isEvent).toBe(true);

      // All should have proper type safety
      expect(llmChunkEvent.type).toBe(SpanType.MODEL_CHUNK);
      expect(toolCallEvent.type).toBe(SpanType.TOOL_CALL);
      expect(genericEvent.type).toBe(SpanType.GENERIC);

      rootSpan.end();
    });

    it('should maintain proper span hierarchy with event spans', () => {
      const rootSpan = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: {
          agentId: 'agent-123',
        },
      });

      const llmSpan = rootSpan.createChildSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'llm generation',
        attributes: {
          model: 'gpt-4',
          streaming: true,
        },
      });

      const eventSpan1 = llmSpan.createEventSpan({
        type: SpanType.MODEL_CHUNK,
        name: 'chunk 1',
        output: 'Hello',
        attributes: {
          chunkType: 'text-delta',
        },
      });

      const eventSpan2 = llmSpan.createEventSpan({
        type: SpanType.MODEL_CHUNK,
        name: 'chunk 2',
        output: ' world',
        attributes: {
          chunkType: 'text-delta',
        },
      });

      // Event spans should have llmSpan as parent
      expect(eventSpan1.parent).toBe(llmSpan);
      expect(eventSpan2.parent).toBe(llmSpan);

      // All spans should share the same traceId
      expect(eventSpan1.traceId).toBe(rootSpan.traceId);
      expect(eventSpan2.traceId).toBe(rootSpan.traceId);
      expect(llmSpan.traceId).toBe(rootSpan.traceId);

      // Event spans should not be root spans
      expect(eventSpan1.isRootSpan).toBe(false);
      expect(eventSpan2.isRootSpan).toBe(false);

      // Only rootSpan should be root
      expect(rootSpan.isRootSpan).toBe(true);
      expect(llmSpan.isRootSpan).toBe(false);

      llmSpan.end();
      rootSpan.end();
    });

    it('should handle metadata correctly in event spans', () => {
      const rootSpan = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: {
          agentId: 'agent-123',
        },
      });

      const eventSpan = rootSpan.createEventSpan({
        type: SpanType.MODEL_CHUNK,
        name: 'llm chunk with metadata',
        output: 'Hello world',
        attributes: {
          chunkType: 'text-delta',
        },
        metadata: {
          sequenceNumber: 1,
          tokenCount: 2,
          model: 'gpt-4',
        },
      });

      // Event span should have metadata
      expect(eventSpan.metadata).toEqual({
        sequenceNumber: 1,
        tokenCount: 2,
        model: 'gpt-4',
      });

      rootSpan.end();
    });

    it('should preserve event span properties in exports', () => {
      const rootSpan = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: {
          agentId: 'agent-123',
        },
      });

      // Clear initial events
      testExporter.events = [];

      rootSpan.createEventSpan({
        type: SpanType.MODEL_CHUNK,
        name: 'exported event span',
        output: { text: 'Hello', chunkSize: 5 },
        attributes: {
          chunkType: 'text-delta',
          sequenceNumber: 42,
        },
        metadata: {
          model: 'gpt-4',
          temperature: 0.7,
        },
      });

      // Should have exported the event span
      expect(testExporter.events).toHaveLength(1);
      const exportedEvent = testExporter.events[0];
      const exportedSpan = exportedEvent.exportedSpan as ExportedSpan<SpanType.MODEL_CHUNK>;

      // Verify exported span properties
      expect(exportedSpan.isEvent).toBe(true);
      expect(exportedSpan.type).toBe(SpanType.MODEL_CHUNK);
      expect(exportedSpan.name).toBe('exported event span');
      expect(exportedSpan.output).toEqual({ text: 'Hello', chunkSize: 5 });
      expect(exportedSpan.input).toBeUndefined();
      expect(exportedSpan.endTime).toBeUndefined();
      expect(exportedSpan.attributes?.chunkType).toBe('text-delta');
      expect(exportedSpan.attributes?.sequenceNumber).toBe(42);
      expect(exportedSpan.metadata?.model).toBe('gpt-4');
      expect(exportedSpan.metadata?.temperature).toBe(0.7);

      rootSpan.end();
    });

    it('should handle error scenarios gracefully for event spans', () => {
      const rootSpan = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: {
          agentId: 'agent-123',
        },
      });

      // Create event span with error
      const eventSpan = rootSpan.createEventSpan({
        type: SpanType.MODEL_CHUNK,
        name: 'error event span',
        output: null,
        attributes: {
          chunkType: 'error',
        },
      });

      // Try to record error on event span (should be no-op since event spans can't be updated)
      const testError = new MastraError({
        id: 'TEST_ERROR',
        domain: 'TOOL',
        category: 'USER',
        details: { test: true },
      });

      eventSpan.error({
        error: testError,
        endSpan: false, // This should be ignored for event spans
      });

      // Event span should still be properly formed
      expect(eventSpan.isEvent).toBe(true);
      expect(eventSpan.name).toBe('error event span');

      // Error info should not be set (since events can't be updated)
      expect(eventSpan.errorInfo).toBeUndefined();

      rootSpan.end();
    });
  });

  describe('External Trace and Parent Span IDs', () => {
    it('should accept external trace ID for root spans', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      const traceId = '0123456789abcdef0123456789abcdef';

      const span = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'agent with external trace',
        attributes: {
          agentId: 'agent-1',
        },
        traceId,
      });

      expect(span.traceId).toBe(traceId);
      expect(span.id).toBeValidSpanId();
      expect(span.getParentSpanId()).toBeUndefined();

      span.end();
    });

    it('should accept external parent span ID for root spans', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      const traceId = '0123456789abcdef0123456789abcdef';
      const parentSpanId = '0123456789abcdef';

      const span = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'agent with external parent',
        attributes: {
          agentId: 'agent-1',
        },
        traceId,
        parentSpanId,
      });

      expect(span.traceId).toBe(traceId);
      expect(span.id).toBeValidSpanId();
      expect(span.getParentSpanId()).toBe(parentSpanId);

      span.end();

      // Verify it's exported correctly
      const endEvent = testExporter.events.find(e => e.type === TracingEventType.SPAN_ENDED);
      expect(endEvent).toBeDefined();
      expect(endEvent?.exportedSpan.parentSpanId).toBe(parentSpanId);
    });

    it('should log error and generate new trace ID for invalid trace ID', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      const span = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'agent with invalid trace',
        attributes: {
          agentId: 'agent-1',
        },
        traceId: 'invalid-trace-id',
      });

      // Should log error
      expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining('[Mastra Tracing] Invalid traceId'));

      // Should generate a new valid trace ID
      expect(span.traceId).toBeValidTraceId();
      expect(span.traceId).not.toBe('invalid-trace-id');

      span.end();
    });

    it('should log error and generate new trace ID for trace ID that is too long', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      const tooLongTraceId = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0';

      const span = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'agent with too long trace',
        attributes: {
          agentId: 'agent-1',
        },
        traceId: tooLongTraceId,
      });

      // Should log error
      expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining('[Mastra Tracing] Invalid traceId'));

      // Should generate a new valid trace ID
      expect(span.traceId).toBeValidTraceId();
      expect(span.traceId).not.toBe(tooLongTraceId);

      span.end();
    });

    it('should log error and ignore invalid parent span ID', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      const validTraceId = '0123456789abcdef0123456789abcdef';

      const span = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'agent with invalid parent',
        attributes: {
          agentId: 'agent-1',
        },
        traceId: validTraceId,
        parentSpanId: 'invalid-span-id',
      });

      // Should log error
      expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining('[Mastra Tracing] Invalid parentSpanId'));

      // Should use the valid trace ID
      expect(span.traceId).toBe(validTraceId);

      // Should ignore the invalid parent span ID
      expect(span.getParentSpanId()).toBeUndefined();

      span.end();
    });

    it('should log error and ignore parent span ID that is too long', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      const validTraceId = '0123456789abcdef0123456789abcdef';
      const tooLongParentSpanId = '0123456789abcdef0123456789abcdef';

      const span = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'agent with too long parent',
        attributes: {
          agentId: 'agent-1',
        },
        traceId: validTraceId,
        parentSpanId: tooLongParentSpanId,
      });

      // Should log error
      expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining('[Mastra Tracing] Invalid parentSpanId'));

      // Should use the valid trace ID
      expect(span.traceId).toBe(validTraceId);

      // Should ignore the invalid parent span ID
      expect(span.getParentSpanId()).toBeUndefined();

      span.end();
    });

    it('should accept shorter trace and span IDs', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      const shortTraceId = 'abc123'; // 6 chars
      const shortSpanId = 'def456'; // 6 chars

      const span = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'agent with short IDs',
        attributes: {
          agentId: 'agent-1',
        },
        traceId: shortTraceId,
        parentSpanId: shortSpanId,
      });

      expect(span.traceId).toBe(shortTraceId);
      expect(span.getParentSpanId()).toBe(shortSpanId);

      span.end();
    });

    it('should create child spans with inherited trace ID from external trace', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      const traceId = 'fedcba9876543210fedcba9876543210';

      const rootSpan = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'root with external trace',
        attributes: {
          agentId: 'agent-1',
        },
        traceId,
      });

      const childSpan = rootSpan.createChildSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'child llm call',
        attributes: {
          model: 'gpt-4',
        },
      });

      expect(rootSpan.traceId).toBe(traceId);
      expect(childSpan.traceId).toBe(traceId);
      expect(childSpan.getParentSpanId()).toBe(rootSpan.id);

      childSpan.end();
      rootSpan.end();
    });

    it('should allow parent span ID without trace ID (generates new trace)', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      const parentSpanId = 'fedcba9876543210';

      const span = observability.startSpan({
        type: SpanType.WORKFLOW_RUN,
        name: 'workflow with external parent only',
        attributes: {
          workflowId: 'workflow-1',
        },
        parentSpanId,
      });

      // Should generate a new trace ID
      expect(span.traceId).toBeValidTraceId();
      // Should use the external parent span ID
      expect(span.getParentSpanId()).toBe(parentSpanId);

      span.end();
    });

    it('should ignore external IDs when span has a parent object', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-tracing',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      const rootSpan = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'root span',
        attributes: {
          agentId: 'agent-1',
        },
      });

      const childSpan = rootSpan.createChildSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'child span',
        attributes: {
          model: 'gpt-4',
        },
      });

      // Child should use parent's trace ID, not external IDs
      expect(childSpan.traceId).toBe(rootSpan.traceId);
      expect(childSpan.getParentSpanId()).toBe(rootSpan.id);

      childSpan.end();
      rootSpan.end();
    });
  });
  describe('Tags Support', () => {
    it('should set tags on root spans via tracingOptions', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test',
        exporters: [testExporter],
      });

      const span = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: { agentId: 'agent-1' },
        tracingOptions: {
          tags: ['production', 'experiment-v2', 'user-request'],
        },
      });

      expect(span.tags).toEqual(['production', 'experiment-v2', 'user-request']);
      expect(span.isRootSpan).toBe(true);

      span.end();
    });

    it('should not set tags on child spans', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test',
        exporters: [testExporter],
      });

      const rootSpan = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'parent-agent',
        attributes: { agentId: 'agent-1' },
        tracingOptions: {
          tags: ['root-tag'],
        },
      });

      const childSpan = rootSpan.createChildSpan({
        type: SpanType.TOOL_CALL,
        name: 'child-tool',
        attributes: { toolId: 'tool-1' },
      });

      // Root span should have tags
      expect(rootSpan.tags).toEqual(['root-tag']);

      // Child span should NOT have tags (even if we tried to set them via tracingOptions)
      expect(childSpan.tags).toBeUndefined();
      expect(childSpan.isRootSpan).toBe(false);

      rootSpan.end();
    });

    it('should include tags in exported root span', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test',
        exporters: [testExporter],
      });

      const span = observability.startSpan({
        type: SpanType.WORKFLOW_RUN,
        name: 'test-workflow',
        attributes: { workflowId: 'wf-123' },
        tracingOptions: {
          tags: ['batch-processing', 'priority-high'],
        },
      });

      // Check exported span from started event
      expect(testExporter.events).toHaveLength(1);
      const startedEvent = testExporter.events[0];
      expect(startedEvent.type).toBe(TracingEventType.SPAN_STARTED);
      expect(startedEvent.exportedSpan.tags).toEqual(['batch-processing', 'priority-high']);
      expect(startedEvent.exportedSpan.isRootSpan).toBe(true);

      span.end();

      // Check exported span from ended event
      expect(testExporter.events).toHaveLength(2);
      const endedEvent = testExporter.events[1];
      expect(endedEvent.type).toBe(TracingEventType.SPAN_ENDED);
      expect(endedEvent.exportedSpan.tags).toEqual(['batch-processing', 'priority-high']);
    });

    it('should not include tags in exported child spans', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test',
        exporters: [testExporter],
      });

      const rootSpan = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'root-agent',
        attributes: { agentId: 'agent-1' },
        tracingOptions: {
          tags: ['root-only-tag'],
        },
      });

      testExporter.events = []; // Clear root span events

      const childSpan = rootSpan.createChildSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'child-llm',
        attributes: { model: 'gpt-4' },
      });

      childSpan.end();

      // Child span exports should NOT have tags
      for (const event of testExporter.events) {
        expect(event.exportedSpan.tags).toBeUndefined();
        expect(event.exportedSpan.isRootSpan).toBe(false);
      }

      rootSpan.end();
    });

    it('should handle empty tags array', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test',
        exporters: [testExporter],
      });

      const span = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: { agentId: 'agent-1' },
        tracingOptions: {
          tags: [],
        },
      });

      // Empty array should result in undefined tags (not empty array)
      expect(span.tags).toBeUndefined();

      span.end();

      // Exported span should not have tags property when empty
      const endedEvent = testExporter.events.find(e => e.type === TracingEventType.SPAN_ENDED);
      expect(endedEvent?.exportedSpan.tags).toBeUndefined();
    });

    it('should handle undefined tags', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test',
        exporters: [testExporter],
      });

      const span = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: { agentId: 'agent-1' },
        tracingOptions: {
          // No tags specified
        },
      });

      expect(span.tags).toBeUndefined();

      span.end();
    });

    it('should handle tags with tracingOptions metadata', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test',
        exporters: [testExporter],
      });

      const span = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: { agentId: 'agent-1' },
        tracingOptions: {
          tags: ['test-tag', 'another-tag'],
          metadata: { customField: 'custom-value' },
        },
      });

      // Both tags and metadata should be set
      expect(span.tags).toEqual(['test-tag', 'another-tag']);
      expect(span.metadata).toEqual({ customField: 'custom-value' });

      span.end();
    });

    it('should preserve tags across span lifecycle', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test',
        exporters: [testExporter],
      });

      const span = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: { agentId: 'agent-1' },
        tracingOptions: {
          tags: ['lifecycle-test'],
        },
      });

      // Tags should be present after start
      expect(span.tags).toEqual(['lifecycle-test']);

      // Update the span
      span.update({ output: { result: 'updated' } });

      // Tags should still be present
      expect(span.tags).toEqual(['lifecycle-test']);

      // Check the updated event
      const updateEvent = testExporter.events.find(e => e.type === TracingEventType.SPAN_UPDATED);
      expect(updateEvent?.exportedSpan.tags).toEqual(['lifecycle-test']);

      span.end();

      // Tags should be in ended event
      const endEvent = testExporter.events.find(e => e.type === TracingEventType.SPAN_ENDED);
      expect(endEvent?.exportedSpan.tags).toEqual(['lifecycle-test']);
    });
  });

  describe('TraceState and metadata extraction from RequestContext', () => {
    it('should extract metadata from RequestContext using configured keys', () => {
      // Create tracing with configured metadata keys
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test',
        requestContextKeys: ['userId', 'environment'],
        exporters: [testExporter],
      });

      // Create request context with test data
      const requestContext = new RequestContext();
      requestContext.set('userId', 'user-123');
      requestContext.set('environment', 'production');
      requestContext.set('otherData', 'not-extracted');

      // Start span with request context
      const span = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: {
          agentId: 'agent-1',
        },
        requestContext,
      });

      // Verify metadata was extracted
      expect(span.metadata).toEqual({
        userId: 'user-123',
        environment: 'production',
      });

      span.end();
    });

    it('should merge configured keys with per-request keys', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test',
        requestContextKeys: ['userId', 'environment'],
        exporters: [testExporter],
      });

      const requestContext = new RequestContext();
      requestContext.set('userId', 'user-123');
      requestContext.set('environment', 'production');
      requestContext.set('experimentId', 'exp-789');

      const span = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: {
          agentId: 'agent-1',
        },
        requestContext,
        tracingOptions: {
          requestContextKeys: ['experimentId'],
        },
      });

      // Verify both configured and per-request keys were extracted
      expect(span.metadata).toEqual({
        userId: 'user-123',
        environment: 'production',
        experimentId: 'exp-789',
      });

      span.end();
    });

    it('should support nested value extraction using dot notation', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test',
        requestContextKeys: ['user.id', 'session.data.experimentId'],
        exporters: [testExporter],
      });

      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-456', name: 'Test User' });
      requestContext.set('session', { data: { experimentId: 'exp-999' } });

      const span = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: {
          agentId: 'agent-1',
        },
        requestContext,
      });

      // Verify nested values were extracted
      expect(span.metadata).toEqual({
        user: { id: 'user-456' },
        session: { data: { experimentId: 'exp-999' } },
      });

      span.end();
    });

    it('should inherit TraceState in child spans', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test',
        requestContextKeys: ['userId'],
        exporters: [testExporter],
      });

      const requestContext = new RequestContext();
      requestContext.set('userId', 'user-123');
      requestContext.set('toolData', 'tool-specific');

      // Create root span
      const rootSpan = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: {
          agentId: 'agent-1',
        },
        requestContext,
      });

      // Create child span - should inherit TraceState
      const childSpan = rootSpan.createChildSpan({
        type: SpanType.TOOL_CALL,
        name: 'tool-call',
        attributes: {
          toolId: 'tool-1',
        },
      });

      // Verify TraceState was inherited
      expect(childSpan.traceState).toEqual(rootSpan.traceState);
      expect(childSpan.traceState?.requestContextKeys).toEqual(['userId']);

      rootSpan.end();
    });

    it('should extract metadata in child spans when requestContext is passed', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test',
        requestContextKeys: ['userId', 'sessionId'],
        exporters: [testExporter],
      });

      const requestContext = new RequestContext();
      requestContext.set('userId', 'user-123');
      requestContext.set('sessionId', 'session-456');
      requestContext.set('requestId', 'request-789');

      // Create root span with RequestContext
      const rootSpan = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: {
          agentId: 'agent-1',
        },
        requestContext,
      });

      // Root span should have extracted metadata
      expect(rootSpan.metadata).toEqual({
        userId: 'user-123',
        sessionId: 'session-456',
      });

      // Create child span WITH requestContext passed
      const childSpan = rootSpan.createChildSpan({
        type: SpanType.TOOL_CALL,
        name: 'tool-call',
        attributes: {
          toolId: 'tool-1',
        },
        requestContext, // Pass RequestContext to child
      });

      // Child span should also have extracted metadata
      expect(childSpan.metadata).toEqual({
        userId: 'user-123',
        sessionId: 'session-456',
      });
      expect(childSpan.traceState).toEqual(rootSpan.traceState);

      // Create another child WITHOUT requestContext
      const childSpanNoContext = rootSpan.createChildSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'llm-call',
        attributes: {
          model: 'gpt-4',
        },
      });

      // This child should NOT have extracted metadata
      expect(childSpanNoContext.metadata).toBeUndefined();
      expect(childSpanNoContext.traceState).toEqual(rootSpan.traceState);

      rootSpan.end();
    });

    it('should prioritize explicit metadata over extracted metadata', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test',
        requestContextKeys: ['userId'],
        exporters: [testExporter],
      });

      const requestContext = new RequestContext();
      requestContext.set('userId', 'user-from-context');

      const span = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: {
          agentId: 'agent-1',
        },
        requestContext,
        metadata: {
          userId: 'user-explicit',
          customField: 'custom-value',
        },
      });

      // Verify explicit metadata takes precedence
      expect(span.metadata).toEqual({
        userId: 'user-explicit',
        customField: 'custom-value',
      });

      span.end();
    });

    it('should handle missing RequestContext gracefully', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test',
        requestContextKeys: ['userId'],
        exporters: [testExporter],
      });

      const span = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: {
          agentId: 'agent-1',
        },
        // No requestContext provided
      });

      // Should not have metadata from RequestContext
      expect(span.metadata).toBeUndefined();

      span.end();
    });

    it('should skip undefined values in RequestContext', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test',
        requestContextKeys: ['userId', 'missingKey'],
        exporters: [testExporter],
      });

      const requestContext = new RequestContext();
      requestContext.set('userId', 'user-123');
      // missingKey is not set

      const span = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: {
          agentId: 'agent-1',
        },
        requestContext,
      });

      // Should only include userId
      expect(span.metadata).toEqual({
        userId: 'user-123',
      });

      span.end();
    });
  });

  describe('hideInput/hideOutput Support', () => {
    it('should hide input from exported spans when hideInput is true', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test',
        exporters: [testExporter],
      });

      const span = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: { agentId: 'agent-1' },
        input: { sensitiveData: 'secret-value' },
        tracingOptions: {
          hideInput: true,
        },
      });

      // Input should be stored on the span itself
      expect(span.input).toEqual({ sensitiveData: 'secret-value' });

      // But exported span should have input hidden
      const startedEvent = testExporter.events.find(e => e.type === TracingEventType.SPAN_STARTED);
      expect(startedEvent?.exportedSpan.input).toBeUndefined();

      span.end({ output: { result: 'success' } });

      // Ended event should also have input hidden
      const endedEvent = testExporter.events.find(e => e.type === TracingEventType.SPAN_ENDED);
      expect(endedEvent?.exportedSpan.input).toBeUndefined();
      // Output should still be present since hideOutput is not set
      expect(endedEvent?.exportedSpan.output).toEqual({ result: 'success' });
    });

    it('should hide output from exported spans when hideOutput is true', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test',
        exporters: [testExporter],
      });

      const span = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: { agentId: 'agent-1' },
        input: { query: 'test query' },
        tracingOptions: {
          hideOutput: true,
        },
      });

      // Input should be present in exported span
      const startedEvent = testExporter.events.find(e => e.type === TracingEventType.SPAN_STARTED);
      expect(startedEvent?.exportedSpan.input).toEqual({ query: 'test query' });

      span.end({ output: { sensitiveResult: 'secret-result' } });

      // Output should be stored on the span itself
      expect(span.output).toEqual({ sensitiveResult: 'secret-result' });

      // Ended event should have output hidden
      const endedEvent = testExporter.events.find(e => e.type === TracingEventType.SPAN_ENDED);
      expect(endedEvent?.exportedSpan.output).toBeUndefined();
      // Input should still be present since hideInput is not set
      expect(endedEvent?.exportedSpan.input).toEqual({ query: 'test query' });
    });

    it('should hide both input and output when both options are true', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test',
        exporters: [testExporter],
      });

      const span = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: { agentId: 'agent-1' },
        input: { sensitiveInput: 'secret-input' },
        tracingOptions: {
          hideInput: true,
          hideOutput: true,
        },
      });

      span.end({ output: { sensitiveOutput: 'secret-output' } });

      // Both input and output should be hidden in exported span
      const endedEvent = testExporter.events.find(e => e.type === TracingEventType.SPAN_ENDED);
      expect(endedEvent?.exportedSpan.input).toBeUndefined();
      expect(endedEvent?.exportedSpan.output).toBeUndefined();
    });

    it('should inherit hideInput/hideOutput in child spans via TraceState', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test',
        exporters: [testExporter],
      });

      const rootSpan = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'parent-agent',
        attributes: { agentId: 'agent-1' },
        input: { parentInput: 'parent-secret' },
        tracingOptions: {
          hideInput: true,
          hideOutput: true,
        },
      });

      // Verify TraceState has hideInput/hideOutput
      expect(rootSpan.traceState?.hideInput).toBe(true);
      expect(rootSpan.traceState?.hideOutput).toBe(true);

      testExporter.events = []; // Clear root span events

      const childSpan = rootSpan.createChildSpan({
        type: SpanType.TOOL_CALL,
        name: 'child-tool',
        attributes: { toolId: 'tool-1' },
        input: { childInput: 'child-secret' },
      });

      // Child span should inherit TraceState
      expect(childSpan.traceState?.hideInput).toBe(true);
      expect(childSpan.traceState?.hideOutput).toBe(true);

      childSpan.end({ output: { childOutput: 'child-result' } });

      // Child span exports should also have input/output hidden
      const startedEvent = testExporter.events.find(e => e.type === TracingEventType.SPAN_STARTED);
      expect(startedEvent?.exportedSpan.input).toBeUndefined();

      const endedEvent = testExporter.events.find(e => e.type === TracingEventType.SPAN_ENDED);
      expect(endedEvent?.exportedSpan.input).toBeUndefined();
      expect(endedEvent?.exportedSpan.output).toBeUndefined();

      rootSpan.end();
    });

    it('should not hide input/output when options are false or not set', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test',
        exporters: [testExporter],
      });

      const span = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: { agentId: 'agent-1' },
        input: { normalInput: 'visible-input' },
        tracingOptions: {
          hideInput: false,
          hideOutput: false,
        },
      });

      span.end({ output: { normalOutput: 'visible-output' } });

      const endedEvent = testExporter.events.find(e => e.type === TracingEventType.SPAN_ENDED);
      expect(endedEvent?.exportedSpan.input).toEqual({ normalInput: 'visible-input' });
      expect(endedEvent?.exportedSpan.output).toEqual({ normalOutput: 'visible-output' });
    });

    it('should work with hideInput/hideOutput combined with other tracingOptions', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test',
        exporters: [testExporter],
      });

      const span = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: { agentId: 'agent-1' },
        input: { sensitiveInput: 'secret' },
        tracingOptions: {
          hideInput: true,
          tags: ['test-tag', 'sensitive-operation'],
          metadata: { operationType: 'secret-operation' },
        },
      });

      span.end({ output: { result: 'success' } });

      const endedEvent = testExporter.events.find(e => e.type === TracingEventType.SPAN_ENDED);
      // Input should be hidden
      expect(endedEvent?.exportedSpan.input).toBeUndefined();
      // Output should still be present
      expect(endedEvent?.exportedSpan.output).toEqual({ result: 'success' });
      // Tags and metadata should work normally
      expect(endedEvent?.exportedSpan.tags).toEqual(['test-tag', 'sensitive-operation']);
      expect(endedEvent?.exportedSpan.metadata).toEqual({ operationType: 'secret-operation' });
    });

    it('should handle hideInput/hideOutput in updated spans', () => {
      const observability = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test',
        exporters: [testExporter],
      });

      const span = observability.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: { agentId: 'agent-1' },
        input: { initialInput: 'secret' },
        tracingOptions: {
          hideInput: true,
          hideOutput: true,
        },
      });

      testExporter.events = [];

      // Update the span
      span.update({
        input: { updatedInput: 'new-secret' },
        output: { intermediateOutput: 'partial-result' },
      });

      // Updated event should have input/output hidden
      const updateEvent = testExporter.events.find(e => e.type === TracingEventType.SPAN_UPDATED);
      expect(updateEvent?.exportedSpan.input).toBeUndefined();
      expect(updateEvent?.exportedSpan.output).toBeUndefined();

      span.end();
    });
  });
});
