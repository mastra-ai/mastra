import { ReadableStream } from 'node:stream/web';
import type { ObservabilityExporter, TracingEvent, ExportedSpan } from '@mastra/core/observability';
import { SpanType, SamplingStrategyType, TracingEventType } from '@mastra/core/observability';
import { beforeEach, describe, expect, it } from 'vitest';

import { DefaultObservabilityInstance } from './instances';
import { ModelSpanTracker } from './model-tracing';

/**
 * Simple test exporter for capturing events
 */
class TestExporter implements ObservabilityExporter {
  name = 'test-exporter';
  events: TracingEvent[] = [];

  async exportTracingEvent(event: TracingEvent): Promise<void> {
    this.events.push(event);
  }

  async shutdown(): Promise<void> {
    this.events = [];
  }

  getSpansByName(name: string): ExportedSpan[] {
    return this.events
      .filter(e => e.type === TracingEventType.SPAN_ENDED && e.exportedSpan.name === name)
      .map(e => e.exportedSpan);
  }

  getSpansByType(type: SpanType): ExportedSpan[] {
    return this.events
      .filter(e => e.type === TracingEventType.SPAN_ENDED && e.exportedSpan.type === type)
      .map(e => e.exportedSpan);
  }
}

/**
 * Helper to create a readable stream from an array of chunks
 */
function createMockStream<T>(chunks: T[]): ReadableStream<T> {
  let index = 0;
  return new ReadableStream<T>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index]!);
        index++;
      } else {
        controller.close();
      }
    },
  });
}

/**
 * Helper to consume a stream and return all chunks
 */
async function consumeStream<T>(stream: ReadableStream<T>): Promise<T[]> {
  const chunks: T[] = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return chunks;
}

describe('ModelSpanTracker', () => {
  let testExporter: TestExporter;
  let tracing: DefaultObservabilityInstance;

  beforeEach(() => {
    testExporter = new TestExporter();
    tracing = new DefaultObservabilityInstance({
      serviceName: 'test-tracing',
      name: 'test-instance',
      sampling: { type: SamplingStrategyType.ALWAYS },
      exporters: [testExporter],
    });
  });

  describe('tool-output consolidation for sub-agent streaming', () => {
    it('should consolidate multiple tool-output text-delta chunks into a single tool-result span', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      // Simulate streaming chunks from a sub-agent used as a tool
      const toolCallId = 'call_test123';
      const toolName = 'agent-subAgent';
      const chunks = [
        { type: 'step-start', payload: { messageId: 'msg-1' } },
        // First tool-output with text-delta
        {
          type: 'tool-output',
          runId: 'run-1',
          from: 'USER',
          payload: {
            output: { type: 'text-delta', payload: { text: 'Hello ' } },
            toolCallId,
            toolName,
          },
        },
        // More text-delta chunks
        {
          type: 'tool-output',
          runId: 'run-1',
          from: 'USER',
          payload: {
            output: { type: 'text-delta', payload: { text: 'world' } },
            toolCallId,
            toolName,
          },
        },
        {
          type: 'tool-output',
          runId: 'run-1',
          from: 'USER',
          payload: {
            output: { type: 'text-delta', payload: { text: '!' } },
            toolCallId,
            toolName,
          },
        },
        // Finish chunk ends the tool output
        {
          type: 'tool-output',
          runId: 'run-1',
          from: 'USER',
          payload: {
            output: { type: 'finish', payload: {} },
            toolCallId,
            toolName,
          },
        },
        { type: 'step-finish', payload: { output: {}, stepResult: { reason: 'stop' }, metadata: {} } },
      ];

      const stream = createMockStream(chunks);
      const wrappedStream = tracker.wrapStream(stream);
      await consumeStream(wrappedStream);

      modelSpan.end();

      // Should have exactly one tool-result span (consolidated from multiple tool-output chunks)
      const toolResultSpans = testExporter.getSpansByName("chunk: 'tool-result'");
      expect(toolResultSpans).toHaveLength(1);

      // Should NOT have any individual tool-output spans (they should be consolidated)
      const toolOutputSpans = testExporter.getSpansByName("chunk: 'tool-output'");
      expect(toolOutputSpans).toHaveLength(0);

      // The span should have accumulated text
      const span = toolResultSpans[0]!;
      expect(span.output).toEqual({
        toolCallId,
        toolName,
        text: 'Hello world!',
      });
    });

    it('should consolidate reasoning-delta chunks from sub-agent', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      const toolCallId = 'call_reasoning123';
      const toolName = 'agent-reasoningAgent';
      const chunks = [
        { type: 'step-start', payload: { messageId: 'msg-1' } },
        {
          type: 'tool-output',
          runId: 'run-1',
          from: 'USER',
          payload: {
            output: { type: 'reasoning-delta', payload: { text: 'Let me think...' } },
            toolCallId,
            toolName,
          },
        },
        {
          type: 'tool-output',
          runId: 'run-1',
          from: 'USER',
          payload: {
            output: { type: 'text-delta', payload: { text: 'The answer is 42' } },
            toolCallId,
            toolName,
          },
        },
        {
          type: 'tool-output',
          runId: 'run-1',
          from: 'USER',
          payload: {
            output: { type: 'finish', payload: {} },
            toolCallId,
            toolName,
          },
        },
        { type: 'step-finish', payload: { output: {}, stepResult: { reason: 'stop' }, metadata: {} } },
      ];

      const stream = createMockStream(chunks);
      const wrappedStream = tracker.wrapStream(stream);
      await consumeStream(wrappedStream);

      modelSpan.end();

      const toolResultSpans = testExporter.getSpansByName("chunk: 'tool-result'");
      expect(toolResultSpans).toHaveLength(1);

      const span = toolResultSpans[0]!;
      expect(span.output).toEqual({
        toolCallId,
        toolName,
        text: 'The answer is 42',
        reasoning: 'Let me think...',
      });
    });

    it('should handle workflow-finish as end of tool output', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      const toolCallId = 'call_workflow123';
      const toolName = 'workflow-myWorkflow';
      const chunks = [
        { type: 'step-start', payload: { messageId: 'msg-1' } },
        {
          type: 'tool-output',
          runId: 'run-1',
          from: 'USER',
          payload: {
            output: { type: 'text-delta', payload: { text: 'Workflow result' } },
            toolCallId,
            toolName,
          },
        },
        // Workflows emit workflow-finish instead of finish
        {
          type: 'tool-output',
          runId: 'run-1',
          from: 'USER',
          payload: {
            output: { type: 'workflow-finish', payload: { workflowStatus: 'success' } },
            toolCallId,
            toolName,
          },
        },
        { type: 'step-finish', payload: { output: {}, stepResult: { reason: 'stop' }, metadata: {} } },
      ];

      const stream = createMockStream(chunks);
      const wrappedStream = tracker.wrapStream(stream);
      await consumeStream(wrappedStream);

      modelSpan.end();

      const toolResultSpans = testExporter.getSpansByName("chunk: 'tool-result'");
      expect(toolResultSpans).toHaveLength(1);

      const span = toolResultSpans[0]!;
      expect(span.output).toEqual({
        toolCallId,
        toolName,
        text: 'Workflow result',
      });
    });
  });

  describe('tool-result deduplication', () => {
    it('should skip tool-result span when tool-output streaming already tracked the same toolCallId', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      const toolCallId = 'call_dedupe123';
      const toolName = 'agent-subAgent';
      const chunks = [
        { type: 'step-start', payload: { messageId: 'msg-1' } },
        // Streaming tool-output chunks
        {
          type: 'tool-output',
          runId: 'run-1',
          from: 'USER',
          payload: {
            output: { type: 'text-delta', payload: { text: 'Streamed content' } },
            toolCallId,
            toolName,
          },
        },
        {
          type: 'tool-output',
          runId: 'run-1',
          from: 'USER',
          payload: {
            output: { type: 'finish', payload: {} },
            toolCallId,
            toolName,
          },
        },
        // After streaming ends, a tool-result chunk arrives (should be skipped)
        {
          type: 'tool-result',
          payload: {
            args: { prompt: 'test' },
            toolCallId,
            toolName,
            result: { text: 'Streamed content' },
          },
        },
        { type: 'step-finish', payload: { output: {}, stepResult: { reason: 'stop' }, metadata: {} } },
      ];

      const stream = createMockStream(chunks);
      const wrappedStream = tracker.wrapStream(stream);
      await consumeStream(wrappedStream);

      modelSpan.end();

      // Should have only ONE tool-result span (from streaming), not two
      const toolResultSpans = testExporter.getSpansByName("chunk: 'tool-result'");
      expect(toolResultSpans).toHaveLength(1);

      // The span should have the streamed content, not the tool-result payload
      const span = toolResultSpans[0]!;
      expect(span.output).toEqual({
        toolCallId,
        toolName,
        text: 'Streamed content',
      });
    });
  });

  describe('tool-result args removal', () => {
    it('should remove args from tool-result output for non-streaming tools', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      const toolCallId = 'call_regular123';
      const toolName = 'regularTool';
      const chunks = [
        { type: 'step-start', payload: { messageId: 'msg-1' } },
        // Non-streaming tool: just a tool-result chunk (no prior tool-output)
        {
          type: 'tool-result',
          payload: {
            args: { input: 'test input', option: true }, // args should be stripped
            toolCallId,
            toolName,
            result: { output: 'tool result' },
          },
        },
        { type: 'step-finish', payload: { output: {}, stepResult: { reason: 'stop' }, metadata: {} } },
      ];

      const stream = createMockStream(chunks);
      const wrappedStream = tracker.wrapStream(stream);
      await consumeStream(wrappedStream);

      modelSpan.end();

      const toolResultSpans = testExporter.getSpansByName("chunk: 'tool-result'");
      expect(toolResultSpans).toHaveLength(1);

      const span = toolResultSpans[0]!;
      // args should not be in the output
      expect(span.output).not.toHaveProperty('args');
      // Other fields should be preserved
      expect(span.output).toEqual({
        toolCallId,
        toolName,
        result: { output: 'tool result' },
      });
    });
  });

  describe('multiple concurrent tool calls', () => {
    it('should track multiple streaming tool calls independently', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      // Simulate interleaved streaming from two sub-agents
      const chunks = [
        { type: 'step-start', payload: { messageId: 'msg-1' } },
        // First tool starts
        {
          type: 'tool-output',
          runId: 'run-1',
          from: 'USER',
          payload: {
            output: { type: 'text-delta', payload: { text: 'Agent1: ' } },
            toolCallId: 'call_agent1',
            toolName: 'agent-first',
          },
        },
        // Second tool starts
        {
          type: 'tool-output',
          runId: 'run-2',
          from: 'USER',
          payload: {
            output: { type: 'text-delta', payload: { text: 'Agent2: ' } },
            toolCallId: 'call_agent2',
            toolName: 'agent-second',
          },
        },
        // Interleaved deltas
        {
          type: 'tool-output',
          runId: 'run-1',
          from: 'USER',
          payload: {
            output: { type: 'text-delta', payload: { text: 'Hello' } },
            toolCallId: 'call_agent1',
            toolName: 'agent-first',
          },
        },
        {
          type: 'tool-output',
          runId: 'run-2',
          from: 'USER',
          payload: {
            output: { type: 'text-delta', payload: { text: 'World' } },
            toolCallId: 'call_agent2',
            toolName: 'agent-second',
          },
        },
        // First tool finishes
        {
          type: 'tool-output',
          runId: 'run-1',
          from: 'USER',
          payload: {
            output: { type: 'finish', payload: {} },
            toolCallId: 'call_agent1',
            toolName: 'agent-first',
          },
        },
        // Second tool finishes
        {
          type: 'tool-output',
          runId: 'run-2',
          from: 'USER',
          payload: {
            output: { type: 'finish', payload: {} },
            toolCallId: 'call_agent2',
            toolName: 'agent-second',
          },
        },
        { type: 'step-finish', payload: { output: {}, stepResult: { reason: 'stop' }, metadata: {} } },
      ];

      const stream = createMockStream(chunks);
      const wrappedStream = tracker.wrapStream(stream);
      await consumeStream(wrappedStream);

      modelSpan.end();

      const toolResultSpans = testExporter.getSpansByName("chunk: 'tool-result'");
      expect(toolResultSpans).toHaveLength(2);

      // Should NOT have any individual tool-output spans (6 chunks consolidated into 2 spans)
      const toolOutputSpans = testExporter.getSpansByName("chunk: 'tool-output'");
      expect(toolOutputSpans).toHaveLength(0);

      // Find spans by toolCallId
      const agent1Span = toolResultSpans.find(s => (s.output as any)?.toolCallId === 'call_agent1');
      const agent2Span = toolResultSpans.find(s => (s.output as any)?.toolCallId === 'call_agent2');

      expect(agent1Span).toBeDefined();
      expect(agent1Span!.output).toEqual({
        toolCallId: 'call_agent1',
        toolName: 'agent-first',
        text: 'Agent1: Hello',
      });

      expect(agent2Span).toBeDefined();
      expect(agent2Span!.output).toEqual({
        toolCallId: 'call_agent2',
        toolName: 'agent-second',
        text: 'Agent2: World',
      });
    });
  });

  describe('step span reuse', () => {
    it('should reuse existing step span when step-start arrives late', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      const chunks = [
        // Text start arrives FIRST (triggering lazy step creation)
        {
          type: 'text-start',
          payload: {},
        },
        // Text delta
        {
          type: 'text-delta',
          payload: { text: 'First chunk' },
        },
        // Step start arrives LATE (should update existing step span)
        {
          type: 'step-start',
          payload: { messageId: 'msg-1', request: { prompt: 'foo' } },
        },
        // Text end (completes text chunk)
        {
          type: 'text-end',
          payload: {},
        },
        // Step finish
        {
          type: 'step-finish',
          payload: { output: {}, stepResult: { reason: 'stop' }, metadata: {} },
        },
      ];

      const stream = createMockStream(chunks);
      const wrappedStream = tracker.wrapStream(stream);
      await consumeStream(wrappedStream);

      modelSpan.end();

      // Get the step span
      const stepSpans = testExporter.getSpansByType(SpanType.MODEL_STEP);
      expect(stepSpans).toHaveLength(1);
      const stepSpan = stepSpans[0]!;

      // Get the chunk span
      const chunkSpans = testExporter.getSpansByType(SpanType.MODEL_CHUNK);
      // We expect at least one 'text' chunk span
      const textChunkSpan = chunkSpans.find(s => s.name === "chunk: 'text'");
      expect(textChunkSpan).toBeDefined();

      // KEY ASSERTION: The chunk's parent should be the SAME as the exported step span
      // If the step span was overwritten, the chunk would point to the *old* (orphaned) span ID,
      // while stepSpan.id would be the *new* span ID.
      expect(textChunkSpan!.parentSpanId).toBe(stepSpan.id);

      // Also verify attributes were updated from step-start
      expect(stepSpan.attributes).toMatchObject({
        messageId: 'msg-1',
      });
      // And input was updated
      expect(stepSpan.input).toEqual({ prompt: 'foo' });
    });
  });
});
