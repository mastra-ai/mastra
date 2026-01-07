/**
 * Trace-Level Sampling Tests
 *
 * These tests verify that sampling decisions are made at the trace level, not the span level.
 * When using ratio or custom sampling:
 * - The sampling decision should be made ONCE at the root span
 * - All child spans should inherit the parent's sampling decision
 * - If root span is sampled, all children should be sampled
 * - If root span is not sampled (NoOpSpan), all children should also be NoOpSpan
 *
 * Related issue: https://github.com/mastra-ai/mastra/issues/11504
 */

import { SpanType, SamplingStrategyType, TracingEventType } from '@mastra/core/observability';
import type { TracingEvent, ObservabilityExporter, CustomSamplerOptions } from '@mastra/core/observability';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DefaultObservabilityInstance } from './instances';

/**
 * Test exporter that captures all tracing events
 */
class TestExporter implements ObservabilityExporter {
  name = 'test-exporter';
  events: TracingEvent[] = [];

  async exportTracingEvent(event: TracingEvent): Promise<void> {
    this.events.push(event);
  }

  async shutdown(): Promise<void> {}

  reset(): void {
    this.events = [];
  }

  getSpanIds(): string[] {
    return this.events
      .filter(e => e.type === TracingEventType.SPAN_ENDED)
      .map(e => e.exportedSpan.id);
  }

  getTraceIds(): string[] {
    return [...new Set(this.events.map(e => e.exportedSpan.traceId))];
  }
}

describe('Trace-Level Sampling (Issue #11504)', () => {
  let testExporter: TestExporter;

  beforeEach(() => {
    testExporter = new TestExporter();
  });

  describe('Ratio Sampling', () => {
    it('should sample ALL spans in a trace when root span is sampled', () => {
      // Use 100% sampling to ensure root span is always sampled
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.RATIO, probability: 1.0 },
        exporters: [testExporter],
      });

      // Create a hierarchy: root -> child1 -> grandchild, root -> child2
      const rootSpan = tracing.startSpan({
        type: SpanType.WORKFLOW_RUN,
        name: 'root-workflow',
        attributes: { workflowId: 'wf-1' },
      });

      const child1Span = rootSpan.createChildSpan({
        type: SpanType.WORKFLOW_STEP,
        name: 'step-1',
        attributes: { stepId: 'step-1' },
      });

      const grandchildSpan = child1Span.createChildSpan({
        type: SpanType.TOOL_CALL,
        name: 'tool-1',
        attributes: { toolId: 'tool-1' },
      });

      const child2Span = rootSpan.createChildSpan({
        type: SpanType.WORKFLOW_STEP,
        name: 'step-2',
        attributes: { stepId: 'step-2' },
      });

      // End all spans
      grandchildSpan.end({});
      child1Span.end({});
      child2Span.end({});
      rootSpan.end({});

      // All spans should be valid (not NoOpSpan)
      expect(rootSpan.isValid).toBe(true);
      expect(child1Span.isValid).toBe(true);
      expect(grandchildSpan.isValid).toBe(true);
      expect(child2Span.isValid).toBe(true);

      // All spans should share the same traceId
      const traceIds = testExporter.getTraceIds();
      expect(traceIds).toHaveLength(1);

      // All 4 spans should be exported
      const spanIds = testExporter.getSpanIds();
      expect(spanIds).toHaveLength(4);
    });

    it('should NOT sample ANY spans when root span is not sampled', () => {
      // Use 0% sampling to ensure root span is never sampled
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.RATIO, probability: 0.0 },
        exporters: [testExporter],
      });

      // Create a hierarchy: root -> child -> grandchild
      const rootSpan = tracing.startSpan({
        type: SpanType.WORKFLOW_RUN,
        name: 'root-workflow',
        attributes: { workflowId: 'wf-1' },
      });

      const childSpan = rootSpan.createChildSpan({
        type: SpanType.WORKFLOW_STEP,
        name: 'step-1',
        attributes: { stepId: 'step-1' },
      });

      const grandchildSpan = childSpan.createChildSpan({
        type: SpanType.TOOL_CALL,
        name: 'tool-1',
        attributes: { toolId: 'tool-1' },
      });

      // End all spans
      grandchildSpan.end({});
      childSpan.end({});
      rootSpan.end({});

      // All spans should be NoOpSpan (not valid)
      expect(rootSpan.isValid).toBe(false);
      expect(childSpan.isValid).toBe(false);
      expect(grandchildSpan.isValid).toBe(false);

      // No spans should be exported
      expect(testExporter.events).toHaveLength(0);
    });

    it('should produce complete traces, not fragmented ones, with ratio sampling', () => {
      // This test verifies that we don't get partial traces where some spans
      // are sampled and others are not within the same trace.

      // We'll run multiple traces and verify each trace is either fully sampled or fully not sampled
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.RATIO, probability: 0.5 },
        exporters: [testExporter],
      });

      const completedTraces: Array<{
        rootSampled: boolean;
        childSampled: boolean;
        grandchildSampled: boolean;
      }> = [];

      // Run 20 traces to get a mix of sampled and not sampled
      for (let i = 0; i < 20; i++) {
        const rootSpan = tracing.startSpan({
          type: SpanType.WORKFLOW_RUN,
          name: `root-${i}`,
          attributes: { workflowId: `wf-${i}` },
        });

        const childSpan = rootSpan.createChildSpan({
          type: SpanType.WORKFLOW_STEP,
          name: `step-${i}`,
          attributes: { stepId: `step-${i}` },
        });

        const grandchildSpan = childSpan.createChildSpan({
          type: SpanType.TOOL_CALL,
          name: `tool-${i}`,
          attributes: { toolId: `tool-${i}` },
        });

        grandchildSpan.end({});
        childSpan.end({});
        rootSpan.end({});

        completedTraces.push({
          rootSampled: rootSpan.isValid,
          childSampled: childSpan.isValid,
          grandchildSampled: grandchildSpan.isValid,
        });
      }

      // For each trace, all spans should have the same sampling decision
      for (const trace of completedTraces) {
        // This is the key assertion: child and grandchild should match root's sampling decision
        expect(trace.childSampled).toBe(trace.rootSampled);
        expect(trace.grandchildSampled).toBe(trace.rootSampled);
      }

      // Verify we got a mix (with 50% probability and 20 trials, very unlikely to get all same)
      const sampledCount = completedTraces.filter(t => t.rootSampled).length;
      // Allow for statistical variance but expect some of each
      expect(sampledCount).toBeGreaterThan(0);
      expect(sampledCount).toBeLessThan(20);
    });
  });

  describe('Custom Sampling', () => {
    it('should only call custom sampler for root spans, not child spans', () => {
      const samplerMock = vi.fn().mockReturnValue(true);

      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.CUSTOM, sampler: samplerMock },
        exporters: [testExporter],
      });

      // Create root span
      const rootSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'agent-1',
        attributes: { agentId: 'agent-1' },
      });

      // Sampler should be called once for root span
      expect(samplerMock).toHaveBeenCalledTimes(1);

      // Create child spans
      const child1 = rootSpan.createChildSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'llm-1',
        attributes: { modelId: 'model-1' },
      });

      const child2 = rootSpan.createChildSpan({
        type: SpanType.TOOL_CALL,
        name: 'tool-1',
        attributes: { toolId: 'tool-1' },
      });

      const grandchild = child1.createChildSpan({
        type: SpanType.MODEL_STEP,
        name: 'step-1',
        attributes: {},
      });

      // Sampler should NOT be called again for child spans
      // It should still be 1 (only called for root)
      expect(samplerMock).toHaveBeenCalledTimes(1);

      // All spans should be valid since root was sampled
      expect(rootSpan.isValid).toBe(true);
      expect(child1.isValid).toBe(true);
      expect(child2.isValid).toBe(true);
      expect(grandchild.isValid).toBe(true);

      // End spans
      grandchild.end({});
      child1.end({});
      child2.end({});
      rootSpan.end({});
    });

    it('should propagate not-sampled decision to all child spans', () => {
      // Custom sampler that always returns false
      const samplerMock = vi.fn().mockReturnValue(false);

      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.CUSTOM, sampler: samplerMock },
        exporters: [testExporter],
      });

      // Create root span (will not be sampled)
      const rootSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'agent-1',
        attributes: { agentId: 'agent-1' },
      });

      expect(rootSpan.isValid).toBe(false);

      // Create child spans - they should all be NoOpSpan
      const child1 = rootSpan.createChildSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'llm-1',
        attributes: { modelId: 'model-1' },
      });

      const grandchild = child1.createChildSpan({
        type: SpanType.MODEL_STEP,
        name: 'step-1',
        attributes: {},
      });

      // All child spans should be NoOpSpan
      expect(child1.isValid).toBe(false);
      expect(grandchild.isValid).toBe(false);

      // Sampler should only be called once (for root)
      expect(samplerMock).toHaveBeenCalledTimes(1);

      // No spans should be exported
      expect(testExporter.events).toHaveLength(0);
    });

    it('should pass customSamplerOptions only for root span decisions', () => {
      const samplerMock = vi.fn().mockReturnValue(true);
      const requestContext = new Map([['userTier', 'premium']]);

      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.CUSTOM, sampler: samplerMock },
        exporters: [testExporter],
      });

      // Create root span with custom sampler options
      const rootSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'agent-1',
        attributes: { agentId: 'agent-1' },
        customSamplerOptions: {
          requestContext: { get: (key: string) => requestContext.get(key) } as any,
          metadata: { customField: 'value' },
        },
      });

      // Verify sampler was called with the options
      expect(samplerMock).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { customField: 'value' },
        }),
      );

      // Create child span - sampler should not be called again
      const childSpan = rootSpan.createChildSpan({
        type: SpanType.TOOL_CALL,
        name: 'tool-1',
        attributes: { toolId: 'tool-1' },
      });

      // Sampler should still only have been called once
      expect(samplerMock).toHaveBeenCalledTimes(1);

      expect(rootSpan.isValid).toBe(true);
      expect(childSpan.isValid).toBe(true);

      childSpan.end({});
      rootSpan.end({});
    });
  });

  describe('Mixed Scenarios', () => {
    it('should handle deep nesting with consistent sampling', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.RATIO, probability: 1.0 },
        exporters: [testExporter],
      });

      // Create a deep hierarchy (5 levels)
      const level0 = tracing.startSpan({
        type: SpanType.WORKFLOW_RUN,
        name: 'level-0',
        attributes: { workflowId: 'wf-0' },
      });

      const level1 = level0.createChildSpan({
        type: SpanType.WORKFLOW_STEP,
        name: 'level-1',
        attributes: { stepId: 'step-1' },
      });

      const level2 = level1.createChildSpan({
        type: SpanType.AGENT_RUN,
        name: 'level-2',
        attributes: { agentId: 'agent-1' },
      });

      const level3 = level2.createChildSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'level-3',
        attributes: { modelId: 'model-1' },
      });

      const level4 = level3.createChildSpan({
        type: SpanType.MODEL_STEP,
        name: 'level-4',
        attributes: {},
      });

      // All should be valid
      expect(level0.isValid).toBe(true);
      expect(level1.isValid).toBe(true);
      expect(level2.isValid).toBe(true);
      expect(level3.isValid).toBe(true);
      expect(level4.isValid).toBe(true);

      // All should share the same traceId
      expect(level1.traceId).toBe(level0.traceId);
      expect(level2.traceId).toBe(level0.traceId);
      expect(level3.traceId).toBe(level0.traceId);
      expect(level4.traceId).toBe(level0.traceId);

      // End all
      level4.end({});
      level3.end({});
      level2.end({});
      level1.end({});
      level0.end({});

      // 5 spans should be exported
      expect(testExporter.getSpanIds()).toHaveLength(5);
    });

    it('should handle sibling spans with consistent sampling', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.RATIO, probability: 1.0 },
        exporters: [testExporter],
      });

      const rootSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'agent',
        attributes: { agentId: 'agent-1' },
      });

      // Create multiple sibling child spans
      const siblings = [];
      for (let i = 0; i < 5; i++) {
        const sibling = rootSpan.createChildSpan({
          type: SpanType.TOOL_CALL,
          name: `tool-${i}`,
          attributes: { toolId: `tool-${i}` },
        });
        siblings.push(sibling);
      }

      // All siblings should be valid
      for (const sibling of siblings) {
        expect(sibling.isValid).toBe(true);
        expect(sibling.traceId).toBe(rootSpan.traceId);
      }

      // End all
      for (const sibling of siblings) {
        sibling.end({});
      }
      rootSpan.end({});

      // 6 spans (1 root + 5 siblings)
      expect(testExporter.getSpanIds()).toHaveLength(6);
    });

    it('should work with event spans (zero-duration spans)', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.RATIO, probability: 1.0 },
        exporters: [testExporter],
      });

      const rootSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'agent',
        attributes: { agentId: 'agent-1' },
      });

      // Create an event span (using createEventSpan)
      const eventSpan = rootSpan.createEventSpan({
        type: SpanType.MODEL_CHUNK,
        name: 'chunk-event',
        attributes: {},
        output: { chunk: 'some data' },
      });

      expect(rootSpan.isValid).toBe(true);
      expect(eventSpan.isValid).toBe(true);
      expect(eventSpan.traceId).toBe(rootSpan.traceId);

      rootSpan.end({});

      // Both should be exported
      expect(testExporter.events.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle ALWAYS sampling strategy correctly', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      const rootSpan = tracing.startSpan({
        type: SpanType.WORKFLOW_RUN,
        name: 'workflow',
        attributes: { workflowId: 'wf-1' },
      });

      const childSpan = rootSpan.createChildSpan({
        type: SpanType.WORKFLOW_STEP,
        name: 'step',
        attributes: { stepId: 'step-1' },
      });

      expect(rootSpan.isValid).toBe(true);
      expect(childSpan.isValid).toBe(true);

      childSpan.end({});
      rootSpan.end({});

      expect(testExporter.getSpanIds()).toHaveLength(2);
    });

    it('should handle NEVER sampling strategy correctly', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test-service',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.NEVER },
        exporters: [testExporter],
      });

      const rootSpan = tracing.startSpan({
        type: SpanType.WORKFLOW_RUN,
        name: 'workflow',
        attributes: { workflowId: 'wf-1' },
      });

      const childSpan = rootSpan.createChildSpan({
        type: SpanType.WORKFLOW_STEP,
        name: 'step',
        attributes: { stepId: 'step-1' },
      });

      expect(rootSpan.isValid).toBe(false);
      expect(childSpan.isValid).toBe(false);

      childSpan.end({});
      rootSpan.end({});

      expect(testExporter.events).toHaveLength(0);
    });
  });
});
