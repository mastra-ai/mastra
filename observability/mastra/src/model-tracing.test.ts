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

  describe('tool-output pass-through (no spans created)', () => {
    it('should NOT create spans for tool-output chunks (streaming progress)', async () => {
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
        // tool-output chunks are streaming progress - no spans created
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
        {
          type: 'tool-output',
          runId: 'run-1',
          from: 'USER',
          payload: {
            output: { type: 'text-delta', payload: { text: 'world!' } },
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
        // tool-result is a point-in-time event with the final result
        {
          type: 'tool-result',
          payload: {
            toolCallId,
            toolName,
            result: { text: 'Hello world!' },
          },
        },
        { type: 'step-finish', payload: { output: {}, stepResult: { reason: 'stop' }, metadata: {} } },
      ];

      const stream = createMockStream(chunks);
      const wrappedStream = tracker.wrapStream(stream);
      await consumeStream(wrappedStream);

      modelSpan.end();

      // Should have exactly one tool-result span (from the tool-result chunk, not tool-output)
      const toolResultSpans = testExporter.getSpansByName("chunk: 'tool-result'");
      expect(toolResultSpans).toHaveLength(1);

      // Should NOT have any tool-output spans (they are pass-through, no tracing)
      const toolOutputSpans = testExporter.getSpansByName("chunk: 'tool-output'");
      expect(toolOutputSpans).toHaveLength(0);

      // The span should be an event span keyed by metadata only
      const span = toolResultSpans[0]!;
      expect(span.isEvent).toBe(true);
      // toolCallId and toolName are in metadata (tool-result specific fields)
      expect(span.metadata).toMatchObject({ toolCallId, toolName });
      // output is omitted; TOOL_CALL captures the full result payload
      expect(span.output).toBeUndefined();
    });

    it('should pass through tool-output chunks without creating spans', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      const toolCallId = 'call_reasoning123';
      const toolName = 'agent-reasoningAgent';
      const chunks = [
        { type: 'step-start', payload: { messageId: 'msg-1' } },
        // tool-output chunks are pass-through (no spans)
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
        // tool-result creates the event span
        {
          type: 'tool-result',
          payload: {
            toolCallId,
            toolName,
            result: { text: 'The answer is 42', reasoning: 'Let me think...' },
          },
        },
        { type: 'step-finish', payload: { output: {}, stepResult: { reason: 'stop' }, metadata: {} } },
      ];

      const stream = createMockStream(chunks);
      const wrappedStream = tracker.wrapStream(stream);
      await consumeStream(wrappedStream);

      modelSpan.end();

      // No tool-output spans created
      const toolOutputSpans = testExporter.getSpansByName("chunk: 'tool-output'");
      expect(toolOutputSpans).toHaveLength(0);

      // Only tool-result event span
      const toolResultSpans = testExporter.getSpansByName("chunk: 'tool-result'");
      expect(toolResultSpans).toHaveLength(1);
      expect(toolResultSpans[0]!.isEvent).toBe(true);
    });

    it('should create event span for tool-result from workflow tools', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      const toolCallId = 'call_workflow123';
      const toolName = 'workflow-myWorkflow';
      const chunks = [
        { type: 'step-start', payload: { messageId: 'msg-1' } },
        // Workflow streaming output (no spans created)
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
        // tool-result event span with the final result
        {
          type: 'tool-result',
          payload: {
            toolCallId,
            toolName,
            result: { output: 'Workflow result', status: 'success' },
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
      expect(span.isEvent).toBe(true);
      // toolCallId and toolName are in metadata
      expect(span.metadata).toMatchObject({ toolCallId, toolName });
      // output is omitted; TOOL_CALL captures the full result payload
      expect(span.output).toBeUndefined();
    });
  });

  describe('tool-result always creates event span', () => {
    it('should always create tool-result event span regardless of prior tool-output chunks', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      const toolCallId = 'call_dedupe123';
      const toolName = 'agent-subAgent';
      const chunks = [
        { type: 'step-start', payload: { messageId: 'msg-1' } },
        // Streaming tool-output chunks (no spans created)
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
        // tool-result always creates an event span (point-in-time)
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

      // Should have exactly ONE tool-result event span
      const toolResultSpans = testExporter.getSpansByName("chunk: 'tool-result'");
      expect(toolResultSpans).toHaveLength(1);

      // The span should be an event span keyed by metadata only
      const span = toolResultSpans[0]!;
      expect(span.isEvent).toBe(true);
      // toolCallId and toolName are in metadata
      expect(span.metadata).toMatchObject({ toolCallId, toolName });
      // output is omitted; TOOL_CALL captures the full result payload
      expect(span.output).toBeUndefined();
    });
  });

  describe('tool-result payload policy', () => {
    it('should omit tool-result output for locally executed tools', async () => {
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
      // args should not be in metadata and output is omitted entirely
      expect(span.metadata).not.toHaveProperty('args');
      // toolCallId and toolName should be in metadata
      expect(span.metadata).toMatchObject({ toolCallId, toolName });
      // output is omitted; TOOL_CALL captures the full result payload
      expect(span.output).toBeUndefined();
    });

    it('should keep tool-result output for provider-executed tools', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      const toolCallId = 'call_provider123';
      const toolName = 'web_search';
      const result = { output: 'provider result' };
      const chunks = [
        { type: 'step-start', payload: { messageId: 'msg-1' } },
        {
          type: 'tool-result',
          payload: {
            args: { query: 'mastra' },
            toolCallId,
            toolName,
            providerExecuted: true,
            result,
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
      expect(span.metadata).not.toHaveProperty('args');
      expect(span.metadata).toMatchObject({ toolCallId, toolName, providerExecuted: true });
      expect(span.output).toEqual(result);
    });
  });

  describe('multiple concurrent tool calls', () => {
    it('should create separate event spans for multiple tool-result chunks', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      // Simulate interleaved streaming from two sub-agents (no spans for tool-output)
      // followed by their tool-result chunks (event spans created)
      const chunks = [
        { type: 'step-start', payload: { messageId: 'msg-1' } },
        // Interleaved tool-output chunks (pass-through, no spans)
        {
          type: 'tool-output',
          runId: 'run-1',
          from: 'USER',
          payload: {
            output: { type: 'text-delta', payload: { text: 'Agent1: Hello' } },
            toolCallId: 'call_agent1',
            toolName: 'agent-first',
          },
        },
        {
          type: 'tool-output',
          runId: 'run-2',
          from: 'USER',
          payload: {
            output: { type: 'text-delta', payload: { text: 'Agent2: World' } },
            toolCallId: 'call_agent2',
            toolName: 'agent-second',
          },
        },
        // tool-result chunks create event spans
        {
          type: 'tool-result',
          payload: {
            toolCallId: 'call_agent1',
            toolName: 'agent-first',
            result: { text: 'Agent1: Hello' },
          },
        },
        {
          type: 'tool-result',
          payload: {
            toolCallId: 'call_agent2',
            toolName: 'agent-second',
            result: { text: 'Agent2: World' },
          },
        },
        { type: 'step-finish', payload: { output: {}, stepResult: { reason: 'stop' }, metadata: {} } },
      ];

      const stream = createMockStream(chunks);
      const wrappedStream = tracker.wrapStream(stream);
      await consumeStream(wrappedStream);

      modelSpan.end();

      // Should have two tool-result event spans
      const toolResultSpans = testExporter.getSpansByName("chunk: 'tool-result'");
      expect(toolResultSpans).toHaveLength(2);

      // Should NOT have any tool-output spans (they are pass-through)
      const toolOutputSpans = testExporter.getSpansByName("chunk: 'tool-output'");
      expect(toolOutputSpans).toHaveLength(0);

      // Both should be event spans
      expect(toolResultSpans[0]!.isEvent).toBe(true);
      expect(toolResultSpans[1]!.isEvent).toBe(true);

      // Find spans by toolCallId (now in metadata)
      const agent1Span = toolResultSpans.find(s => (s.metadata as any)?.toolCallId === 'call_agent1');
      const agent2Span = toolResultSpans.find(s => (s.metadata as any)?.toolCallId === 'call_agent2');

      expect(agent1Span).toBeDefined();
      // toolCallId and toolName are in metadata
      expect(agent1Span!.metadata).toMatchObject({
        toolCallId: 'call_agent1',
        toolName: 'agent-first',
      });
      // output is omitted; TOOL_CALL captures the full result payload
      expect(agent1Span!.output).toBeUndefined();

      expect(agent2Span).toBeDefined();
      expect(agent2Span!.metadata).toMatchObject({
        toolCallId: 'call_agent2',
        toolName: 'agent-second',
      });
      expect(agent2Span!.output).toBeUndefined();
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

  describe('MODEL_STEP span input extraction', () => {
    it('should extract a shallow message preview from OpenAI-format request body', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' },
      ];

      const chunks = [
        {
          type: 'step-start',
          payload: {
            messageId: 'msg-1',
            request: {
              body: JSON.stringify({
                model: 'gpt-4o',
                messages,
                temperature: 0.7,
                tools: [{ type: 'function', function: { name: 'search' } }],
              }),
            },
          },
        },
        { type: 'text-delta', payload: { text: 'Hi!' } },
        { type: 'step-finish', payload: { output: {}, stepResult: { reason: 'stop' }, metadata: {} } },
      ];

      const stream = createMockStream(chunks);
      const wrappedStream = tracker.wrapStream(stream);
      await consumeStream(wrappedStream);
      modelSpan.end();

      const stepSpans = testExporter.getSpansByType(SpanType.MODEL_STEP);
      expect(stepSpans).toHaveLength(1);
      expect(stepSpans[0]!.input).toEqual(messages);
    });

    it('should extract a shallow message preview from Google/Gemini-format request body', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      const contents = [{ role: 'user', parts: [{ text: 'Hello' }] }];

      const chunks = [
        {
          type: 'step-start',
          payload: {
            messageId: 'msg-1',
            request: {
              body: JSON.stringify({
                model: 'gemini-2.0-flash',
                contents,
                generationConfig: { temperature: 0.7 },
              }),
            },
          },
        },
        { type: 'text-delta', payload: { text: 'Hi!' } },
        { type: 'step-finish', payload: { output: {}, stepResult: { reason: 'stop' }, metadata: {} } },
      ];

      const stream = createMockStream(chunks);
      const wrappedStream = tracker.wrapStream(stream);
      await consumeStream(wrappedStream);
      modelSpan.end();

      const stepSpans = testExporter.getSpansByType(SpanType.MODEL_STEP);
      expect(stepSpans).toHaveLength(1);
      expect(stepSpans[0]!.input).toEqual([{ role: 'user', content: 'Hello' }]);
    });

    it('should handle undefined request body gracefully', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      const chunks = [
        {
          type: 'step-start',
          payload: {
            messageId: 'msg-1',
            request: {},
          },
        },
        { type: 'text-delta', payload: { text: 'Hi!' } },
        { type: 'step-finish', payload: { output: {}, stepResult: { reason: 'stop' }, metadata: {} } },
      ];

      const stream = createMockStream(chunks);
      const wrappedStream = tracker.wrapStream(stream);
      await consumeStream(wrappedStream);
      modelSpan.end();

      const stepSpans = testExporter.getSpansByType(SpanType.MODEL_STEP);
      expect(stepSpans).toHaveLength(1);
      // No body — falls back to the original request object
      expect(stepSpans[0]!.input).toEqual({});
    });

    it('should fall back to original request when body is malformed JSON', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      const malformedRequest = { body: '{"incomplete":' };

      const chunks = [
        {
          type: 'step-start',
          payload: {
            messageId: 'msg-1',
            request: malformedRequest,
          },
        },
        { type: 'text-delta', payload: { text: 'Hi!' } },
        { type: 'step-finish', payload: { output: {}, stepResult: { reason: 'stop' }, metadata: {} } },
      ];

      const stream = createMockStream(chunks);
      const wrappedStream = tracker.wrapStream(stream);
      await consumeStream(wrappedStream);
      modelSpan.end();

      const stepSpans = testExporter.getSpansByType(SpanType.MODEL_STEP);
      expect(stepSpans).toHaveLength(1);
      expect(stepSpans[0]!.input).toEqual(malformedRequest);
    });

    it('should handle already-parsed body object', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      const messages = [{ role: 'user', content: 'Hello' }];

      const chunks = [
        {
          type: 'step-start',
          payload: {
            messageId: 'msg-1',
            request: {
              body: {
                model: 'gpt-4o',
                messages,
              },
            },
          },
        },
        { type: 'text-delta', payload: { text: 'Hi!' } },
        { type: 'step-finish', payload: { output: {}, stepResult: { reason: 'stop' }, metadata: {} } },
      ];

      const stream = createMockStream(chunks);
      const wrappedStream = tracker.wrapStream(stream);
      await consumeStream(wrappedStream);
      modelSpan.end();

      const stepSpans = testExporter.getSpansByType(SpanType.MODEL_STEP);
      expect(stepSpans).toHaveLength(1);
      expect(stepSpans[0]!.input).toEqual(messages);
    });

    it('should collapse nested structured message content to a shallow preview', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      const chunks = [
        {
          type: 'step-start',
          payload: {
            messageId: 'msg-1',
            request: {
              body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                  {
                    role: 'user',
                    content: [
                      { type: 'text', text: 'Describe this image. ' },
                      { type: 'image', image: 'base64-image' },
                    ],
                  },
                  {
                    role: 'assistant',
                    content: [
                      {
                        type: 'tool-call',
                        toolName: 'analyze_image',
                        args: {
                          nested: {
                            deeper: {
                              value: 'png',
                            },
                          },
                        },
                      },
                    ],
                  },
                ],
              }),
            },
          },
        },
        { type: 'text-delta', payload: { text: 'Hi!' } },
        { type: 'step-finish', payload: { output: {}, stepResult: { reason: 'stop' }, metadata: {} } },
      ];

      const stream = createMockStream(chunks);
      const wrappedStream = tracker.wrapStream(stream);
      await consumeStream(wrappedStream);
      modelSpan.end();

      const stepSpans = testExporter.getSpansByType(SpanType.MODEL_STEP);
      expect(stepSpans).toHaveLength(1);
      expect(stepSpans[0]!.input).toEqual([
        { role: 'user', content: 'Describe this image. [image]' },
        { role: 'assistant', content: '[tool: analyze_image]' },
      ]);
    });

    it('should preserve OpenAI tool call names in shallow previews', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      const chunks = [
        {
          type: 'step-start',
          payload: {
            messageId: 'msg-1',
            request: {
              body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                  {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                      {
                        id: 'call_123',
                        type: 'function',
                        function: {
                          name: 'get_weather',
                          arguments: '{"city":"Austin"}',
                        },
                      },
                    ],
                  },
                ],
              }),
            },
          },
        },
        { type: 'text-delta', payload: { text: 'Hi!' } },
        { type: 'step-finish', payload: { output: {}, stepResult: { reason: 'stop' }, metadata: {} } },
      ];

      const stream = createMockStream(chunks);
      const wrappedStream = tracker.wrapStream(stream);
      await consumeStream(wrappedStream);
      modelSpan.end();

      const stepSpans = testExporter.getSpansByType(SpanType.MODEL_STEP);
      expect(stepSpans).toHaveLength(1);
      expect(stepSpans[0]!.input).toEqual([{ role: 'assistant', content: '[tool: get_weather]' }]);
    });

    it('should not append object placeholders when optional function call fields are absent', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      const chunks = [
        {
          type: 'step-start',
          payload: {
            messageId: 'msg-1',
            request: {
              body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                  {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                      {
                        id: 'call_123',
                        type: 'function',
                        function: {
                          name: 'get_weather',
                          arguments: '{"city":"Austin"}',
                        },
                      },
                    ],
                  },
                  {
                    role: 'assistant',
                    content: 'Plain response',
                  },
                ],
              }),
            },
          },
        },
        { type: 'text-delta', payload: { text: 'Hi!' } },
        { type: 'step-finish', payload: { output: {}, stepResult: { reason: 'stop' }, metadata: {} } },
      ];

      const stream = createMockStream(chunks);
      const wrappedStream = tracker.wrapStream(stream);
      await consumeStream(wrappedStream);
      modelSpan.end();

      const stepSpans = testExporter.getSpansByType(SpanType.MODEL_STEP);
      expect(stepSpans).toHaveLength(1);
      expect(stepSpans[0]!.input).toEqual([
        { role: 'assistant', content: '[tool: get_weather]' },
        { role: 'assistant', content: 'Plain response' },
      ]);
    });

    it('should summarize unrecognized request bodies instead of storing the full parsed object', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      const chunks = [
        {
          type: 'step-start',
          payload: {
            messageId: 'msg-1',
            request: {
              body: JSON.stringify({
                model: 'gpt-4o',
                prompt: {
                  nested: {
                    data: {
                      value: 'hello',
                    },
                  },
                },
                temperature: 0.7,
              }),
            },
          },
        },
        { type: 'text-delta', payload: { text: 'Hi!' } },
        { type: 'step-finish', payload: { output: {}, stepResult: { reason: 'stop' }, metadata: {} } },
      ];

      const stream = createMockStream(chunks);
      const wrappedStream = tracker.wrapStream(stream);
      await consumeStream(wrappedStream);
      modelSpan.end();

      const stepSpans = testExporter.getSpansByType(SpanType.MODEL_STEP);
      expect(stepSpans).toHaveLength(1);
      expect(stepSpans[0]!.input).toEqual({
        model: 'gpt-4o',
        keys: ['model', 'prompt', 'temperature'],
      });
    });

    it('should update step input when step-start arrives after startStep()', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      const messages = [{ role: 'user', content: 'Hello' }];

      // Start step early (no payload), then step-start chunk arrives with request data
      tracker.startStep();

      const chunks = [
        {
          type: 'step-start',
          payload: {
            messageId: 'msg-1',
            request: {
              body: JSON.stringify({ model: 'gpt-4o', messages }),
            },
          },
        },
        { type: 'text-delta', payload: { text: 'Hi!' } },
        { type: 'step-finish', payload: { output: {}, stepResult: { reason: 'stop' }, metadata: {} } },
      ];

      const stream = createMockStream(chunks);
      const wrappedStream = tracker.wrapStream(stream);
      await consumeStream(wrappedStream);
      modelSpan.end();

      const stepSpans = testExporter.getSpansByType(SpanType.MODEL_STEP);
      expect(stepSpans).toHaveLength(1);
      expect(stepSpans[0]!.input).toEqual(messages);
    });

    it('should extract messages from AI SDK v5 body.input instead of body.messages', async () => {
      const modelSpan = tracing.startSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-generation',
      });

      const tracker = new ModelSpanTracker(modelSpan);

      // AI SDK v5 uses body.input with {type, text} content parts
      const input = [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: [{ type: 'input_text', text: 'What is the weather?' }] },
      ];

      tracker.startStep();

      const chunks = [
        {
          type: 'step-start',
          payload: {
            messageId: 'msg-1',
            request: {
              body: {
                model: 'gpt-4o-mini',
                input,
                tools: [
                  {
                    type: 'function',
                    name: 'weatherTool',
                    parameters: { type: 'object', properties: { location: { type: 'string' } } },
                  },
                ],
                tool_choice: 'auto',
              },
            },
          },
        },
        { type: 'text-delta', payload: { text: 'Let me check.' } },
        { type: 'step-finish', payload: { output: {}, stepResult: { reason: 'stop' }, metadata: {} } },
      ];

      const stream = createMockStream(chunks);
      const wrappedStream = tracker.wrapStream(stream);
      await consumeStream(wrappedStream);
      modelSpan.end();

      const stepSpans = testExporter.getSpansByType(SpanType.MODEL_STEP);
      expect(stepSpans).toHaveLength(1);
      // Should extract messages from body.input, not show keys summary
      expect(stepSpans[0]!.input).toEqual([
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'What is the weather?' },
      ]);
      // Should NOT contain tool definitions or fallback keys summary
      expect(stepSpans[0]!.input).not.toHaveProperty('tools');
      expect(Array.isArray(stepSpans[0]!.input)).toBe(true);
    });
  });
});
