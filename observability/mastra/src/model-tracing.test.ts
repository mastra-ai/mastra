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

  describe('infrastructure chunk filtering', () => {
    it('should NOT create spans for infrastructure chunks (response-metadata, error, abort, etc.)', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      // All these infrastructure chunks should NOT create spans
      const chunks = [
        { type: 'step-start', payload: { messageId: 'msg-1' } },
        { type: 'response-metadata', payload: { signature: 'test-sig' } },
        { type: 'source', payload: { id: 'src-1', sourceType: 'url', title: 'Test Source' } },
        { type: 'file', payload: { data: 'base64data', mimeType: 'image/png' } },
        { type: 'error', payload: { error: new Error('test error') } },
        { type: 'abort', payload: {} },
        { type: 'tripwire', payload: { reason: 'blocked' } },
        { type: 'watch', payload: {} },
        { type: 'tool-error', payload: { toolCallId: 'tc-1', toolName: 'test', error: 'failed' } },
        { type: 'tool-call-suspended', payload: { toolCallId: 'tc-3', toolName: 'test', args: {} } },
        { type: 'reasoning-signature', payload: { id: 'r-1', signature: 'sig' } },
        { type: 'redacted-reasoning', payload: { id: 'r-2', data: {} } },
        { type: 'step-output', payload: { output: {} } },
        { type: 'step-finish', payload: { output: {}, stepResult: { reason: 'stop' }, metadata: {} } },
      ];

      const stream = createMockStream(chunks);
      const wrappedStream = tracker.wrapStream(stream);
      await consumeStream(wrappedStream);

      modelSpan.end();

      // Get all MODEL_CHUNK spans
      const chunkSpans = testExporter.getSpansByType(SpanType.MODEL_CHUNK);

      // Should have NO chunk spans - all infrastructure chunks should be skipped
      expect(chunkSpans).toHaveLength(0);
    });

    it('should NOT create spans for unknown/unrecognized chunk types', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      // Unknown chunk types that might be custom or future additions
      const chunks = [
        { type: 'step-start', payload: { messageId: 'msg-1' } },
        { type: 'custom-chunk', payload: { data: 'custom data' } },
        { type: 'future-feature', payload: { info: 'new feature' } },
        { type: 'experimental-xyz', payload: {} },
        { type: 'step-finish', payload: { output: {}, stepResult: { reason: 'stop' }, metadata: {} } },
      ];

      const stream = createMockStream(chunks);
      const wrappedStream = tracker.wrapStream(stream);
      await consumeStream(wrappedStream);

      modelSpan.end();

      // Get all MODEL_CHUNK spans
      const chunkSpans = testExporter.getSpansByType(SpanType.MODEL_CHUNK);

      // Should have NO chunk spans - unknown types should be skipped by default
      expect(chunkSpans).toHaveLength(0);
    });

    it('should still create spans for semantic content chunks (text, reasoning, tool-call)', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      // Semantic content chunks that SHOULD create spans
      const chunks = [
        { type: 'step-start', payload: { messageId: 'msg-1' } },
        // Text content
        { type: 'text-start', payload: { id: 't-1' } },
        { type: 'text-delta', payload: { id: 't-1', text: 'Hello world' } },
        { type: 'text-end', payload: { id: 't-1' } },
        // Reasoning content
        { type: 'reasoning-start', payload: { id: 'r-1' } },
        { type: 'reasoning-delta', payload: { id: 'r-1', text: 'Thinking...' } },
        { type: 'reasoning-end', payload: { id: 'r-1' } },
        // Tool call
        { type: 'tool-call-input-streaming-start', payload: { toolCallId: 'tc-1', toolName: 'myTool' } },
        { type: 'tool-call-delta', payload: { toolCallId: 'tc-1', argsTextDelta: '{"arg": "value"}' } },
        { type: 'tool-call-input-streaming-end', payload: { toolCallId: 'tc-1' } },
        { type: 'step-finish', payload: { output: {}, stepResult: { reason: 'stop' }, metadata: {} } },
      ];

      const stream = createMockStream(chunks);
      const wrappedStream = tracker.wrapStream(stream);
      await consumeStream(wrappedStream);

      modelSpan.end();

      // Get all MODEL_CHUNK spans
      const chunkSpans = testExporter.getSpansByType(SpanType.MODEL_CHUNK);

      // Should have 3 chunk spans: text, reasoning, tool-call
      expect(chunkSpans).toHaveLength(3);

      const textSpan = chunkSpans.find(s => s.name === "chunk: 'text'");
      const reasoningSpan = chunkSpans.find(s => s.name === "chunk: 'reasoning'");
      const toolCallSpan = chunkSpans.find(s => s.name === "chunk: 'tool-call'");

      expect(textSpan).toBeDefined();
      expect(textSpan!.output).toEqual({ text: 'Hello world' });

      expect(reasoningSpan).toBeDefined();
      expect(reasoningSpan!.output).toEqual({ text: 'Thinking...' });

      expect(toolCallSpan).toBeDefined();
      expect(toolCallSpan!.output).toHaveProperty('toolName', 'myTool');
    });
  });

  describe('tool-call-approval tracing', () => {
    it('should create a span for tool-call-approval chunks', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      const toolCallId = 'tc-approval-123';
      const toolName = 'criticalAction';
      const args = { param1: 'value1', param2: 42 };
      const resumeSchema = '{"type":"object","properties":{"approved":{"type":"boolean"}}}';

      const chunks = [
        { type: 'step-start', payload: { messageId: 'msg-1' } },
        {
          type: 'tool-call-approval',
          runId: 'run-1',
          from: 'AGENT',
          payload: {
            toolCallId,
            toolName,
            args,
            resumeSchema,
          },
        },
        { type: 'step-finish', payload: { output: {}, stepResult: { reason: 'stop' }, metadata: {} } },
      ];

      const stream = createMockStream(chunks);
      const wrappedStream = tracker.wrapStream(stream);
      await consumeStream(wrappedStream);

      modelSpan.end();

      // Should have exactly one tool-call-approval chunk span
      const approvalSpans = testExporter.getSpansByName("chunk: 'tool-call-approval'");
      expect(approvalSpans).toHaveLength(1);

      // Verify span attributes
      const span = approvalSpans[0]!;
      expect(span.type).toBe(SpanType.MODEL_CHUNK);
      // MODEL_CHUNK attributes should only contain chunkType and sequenceNumber
      expect(span.attributes).toMatchObject({
        chunkType: 'tool-call-approval',
      });

      // Verify span output contains the full approval payload
      expect(span.output).toEqual({
        toolCallId,
        toolName,
        args,
        resumeSchema,
      });
    });

    it('should handle tool-call-approval without prior step-start', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      const chunks = [
        // tool-call-approval before step-start - should auto-create step
        {
          type: 'tool-call-approval',
          runId: 'run-1',
          from: 'AGENT',
          payload: {
            toolCallId: 'tc-auto-step',
            toolName: 'autoApprove',
            args: {},
            resumeSchema: '{}',
          },
        },
        { type: 'step-start', payload: { messageId: 'msg-1' } },
        { type: 'step-finish', payload: { output: {}, stepResult: { reason: 'stop' }, metadata: {} } },
      ];

      const stream = createMockStream(chunks);
      const wrappedStream = tracker.wrapStream(stream);
      await consumeStream(wrappedStream);

      modelSpan.end();

      // Should have the approval span and step span
      const approvalSpans = testExporter.getSpansByName("chunk: 'tool-call-approval'");
      expect(approvalSpans).toHaveLength(1);

      const stepSpans = testExporter.getSpansByType(SpanType.MODEL_STEP);
      expect(stepSpans).toHaveLength(1);
    });
  });
});
