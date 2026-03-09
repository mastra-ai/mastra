import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '../agent';
import { MessageList } from '../agent/message-list';
import { createTool } from '../tools';
import type { Processor } from './index';

/**
 * Creates a mock model that calls `toolName` on the first turn,
 * then replies with "Done!" after seeing the tool result.
 */
function createToolCallingModel(toolName: string) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const hasToolResults = prompt.some(
        (msg: any) =>
          msg.role === 'tool' || (Array.isArray(msg.content) && msg.content.some((c: any) => c.type === 'tool-result')),
      );

      if (!hasToolResults) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName,
              input: JSON.stringify({ text: 'hello' }),
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            },
          ]),
          rawCall: { rawPrompt: [], rawSettings: {} },
          warnings: [],
        };
      } else {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Done!' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
            },
          ]),
          rawCall: { rawPrompt: [], rawSettings: {} },
          warnings: [],
        };
      }
    },
  });
}

describe('Output Processor Data Chunks (#13341)', () => {
  it('should receive data-* chunks from tool execute in processOutputStream', async () => {
    const capturedChunkTypes: string[] = [];
    const capturedDataChunks: any[] = [];

    class DataChunkTrackingProcessor implements Processor {
      readonly id = 'data-chunk-tracking-processor';
      readonly name = 'Data Chunk Tracking Processor';

      async processOutputStream({ part }: any) {
        capturedChunkTypes.push(part.type);
        if (part.type.startsWith('data-')) {
          capturedDataChunks.push(part);
        }
        return part;
      }
    }

    const toolWithCustomData = createTool({
      id: 'toolWithCustomData',
      description: 'A test tool that emits custom data chunks',
      inputSchema: z.object({
        text: z.string(),
      }),
      execute: async (inputData, { writer }) => {
        writer!.custom({ type: 'data-moderation', data: { flagged: false, text: inputData.text } });
        return `Processed: ${inputData.text}`;
      },
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Test agent with tools',
      model: createToolCallingModel('toolWithCustomData') as any,
      tools: { toolWithCustomData },
      outputProcessors: [new DataChunkTrackingProcessor()],
    });

    const stream = await agent.stream('Call the tool with text "hello"', {
      maxSteps: 5,
    });

    const streamChunkTypes: string[] = [];
    for await (const chunk of stream.fullStream) {
      streamChunkTypes.push(chunk.type);
    }

    expect(streamChunkTypes).toContain('data-moderation');
    expect(capturedChunkTypes).toContain('data-moderation');
    expect(capturedDataChunks).toHaveLength(1);
    expect(capturedDataChunks[0].data).toEqual({ flagged: false, text: 'hello' });
  });

  it('should allow output processor to modify data-* chunks', async () => {
    class DataChunkModifyingProcessor implements Processor {
      readonly id = 'data-chunk-modifying-processor';
      readonly name = 'Data Chunk Modifying Processor';

      async processOutputStream({ part }: any) {
        if (part.type === 'data-moderation') {
          return {
            ...part,
            data: { ...part.data, processed: true },
          };
        }
        return part;
      }
    }

    const toolWithCustomData = createTool({
      id: 'toolWithCustomData',
      description: 'A test tool that emits custom data chunks',
      inputSchema: z.object({ text: z.string() }),
      execute: async (inputData, { writer }) => {
        writer!.custom({ type: 'data-moderation', data: { flagged: false } });
        return `Processed: ${inputData.text}`;
      },
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Test agent with tools',
      model: createToolCallingModel('toolWithCustomData') as any,
      tools: { toolWithCustomData },
      outputProcessors: [new DataChunkModifyingProcessor()],
    });

    const stream = await agent.stream('Call the tool with text "hello"', {
      maxSteps: 5,
    });

    const dataChunks: any[] = [];
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'data-moderation') {
        dataChunks.push(chunk);
      }
    }

    expect(dataChunks).toHaveLength(1);
    expect(dataChunks[0].data).toEqual({ flagged: false, processed: true });
  });

  it('should allow output processor to block data-* chunks via abort', async () => {
    class DataChunkBlockingProcessor implements Processor {
      readonly id = 'data-chunk-blocking-processor';
      readonly name = 'Data Chunk Blocking Processor';

      async processOutputStream({ part, abort }: any) {
        if (part.type === 'data-sensitive') {
          abort('Sensitive data blocked');
        }
        return part;
      }
    }

    const toolWithSensitiveData = createTool({
      id: 'toolWithSensitiveData',
      description: 'A test tool that emits sensitive data chunks',
      inputSchema: z.object({ text: z.string() }),
      execute: async (inputData, { writer }) => {
        writer!.custom({ type: 'data-sensitive', data: { secret: 'classified' } });
        return `Processed: ${inputData.text}`;
      },
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Test agent with tools',
      model: createToolCallingModel('toolWithSensitiveData') as any,
      tools: { toolWithSensitiveData },
      outputProcessors: [new DataChunkBlockingProcessor()],
    });

    const stream = await agent.stream('Call the tool with text "hello"', {
      maxSteps: 5,
    });

    const streamChunkTypes: string[] = [];
    const tripwireChunks: any[] = [];
    for await (const chunk of stream.fullStream) {
      streamChunkTypes.push(chunk.type);
      if (chunk.type === 'tripwire') {
        tripwireChunks.push(chunk);
      }
    }

    expect(streamChunkTypes).not.toContain('data-sensitive');
    expect(tripwireChunks).toHaveLength(1);
    expect(tripwireChunks[0].payload.reason).toBe('Sensitive data blocked');
    expect(tripwireChunks[0].payload.processorId).toBe('data-chunk-blocking-processor');
  });

  it('should pass data-* chunks through unchanged when no output processors are configured', async () => {
    const toolWithCustomData = createTool({
      id: 'toolWithCustomData',
      description: 'A test tool that emits custom data chunks',
      inputSchema: z.object({ text: z.string() }),
      execute: async (inputData, { writer }) => {
        writer!.custom({ type: 'data-metrics', data: { latency: 42 } });
        return `Processed: ${inputData.text}`;
      },
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Test agent with tools',
      model: createToolCallingModel('toolWithCustomData') as any,
      tools: { toolWithCustomData },
      // No outputProcessors
    });

    const stream = await agent.stream('Call the tool with text "hello"', {
      maxSteps: 5,
    });

    const dataChunks: any[] = [];
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'data-metrics') {
        dataChunks.push(chunk);
      }
    }

    expect(dataChunks).toHaveLength(1);
    expect(dataChunks[0].data).toEqual({ latency: 42 });
  });

  it('should not persist data-* chunk when processor adds transient: true', async () => {
    const addSpy = vi.spyOn(MessageList.prototype, 'add');

    class TransientMarkingProcessor implements Processor {
      readonly id = 'transient-marking-processor';
      readonly name = 'Transient Marking Processor';

      async processOutputStream({ part }: any) {
        if (part.type === 'data-debug') {
          return { ...part, transient: true };
        }
        return part;
      }
    }

    const toolWithDebugData = createTool({
      id: 'toolWithDebugData',
      description: 'A test tool that emits debug data chunks',
      inputSchema: z.object({ text: z.string() }),
      execute: async (inputData, { writer }) => {
        writer!.custom({ type: 'data-debug', data: { step: 1, detail: 'internal state' } });
        return `Processed: ${inputData.text}`;
      },
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Test agent with tools',
      model: createToolCallingModel('toolWithDebugData') as any,
      tools: { toolWithDebugData },
      outputProcessors: [new TransientMarkingProcessor()],
    });

    const stream = await agent.stream('Call the tool with text "hello"', {
      maxSteps: 5,
    });

    const dataChunks: any[] = [];
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'data-debug') {
        dataChunks.push(chunk);
      }
    }

    // The chunk should still appear in the stream
    expect(dataChunks).toHaveLength(1);
    expect(dataChunks[0].data).toEqual({ step: 1, detail: 'internal state' });
    expect(dataChunks[0].transient).toBe(true);

    // messageList.add should NOT have been called with a data-debug part
    const dataDebugAdds = addSpy.mock.calls.filter(([messages]) => {
      const msgs = Array.isArray(messages) ? messages : [messages];
      return msgs.some((m: any) => m.content?.parts?.some((p: any) => p.type === 'data-debug'));
    });
    expect(dataDebugAdds).toHaveLength(0);

    addSpy.mockRestore();
  });

  it('should process multiple data-* chunks from a single tool execution', async () => {
    const capturedDataChunks: any[] = [];

    class MultiChunkTracker implements Processor {
      readonly id = 'multi-chunk-tracker';
      readonly name = 'Multi Chunk Tracker';

      async processOutputStream({ part }: any) {
        if (part.type.startsWith('data-')) {
          capturedDataChunks.push(part);
        }
        return part;
      }
    }

    const toolWithMultipleChunks = createTool({
      id: 'toolWithMultipleChunks',
      description: 'A test tool that emits multiple data chunks',
      inputSchema: z.object({ text: z.string() }),
      execute: async (inputData, { writer }) => {
        writer!.custom({ type: 'data-progress', data: { step: 1, status: 'started' } });
        writer!.custom({ type: 'data-progress', data: { step: 2, status: 'processing' } });
        writer!.custom({ type: 'data-metrics', data: { latency: 42 } });
        return `Processed: ${inputData.text}`;
      },
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Test agent with tools',
      model: createToolCallingModel('toolWithMultipleChunks') as any,
      tools: { toolWithMultipleChunks },
      outputProcessors: [new MultiChunkTracker()],
    });

    const stream = await agent.stream('Call the tool', { maxSteps: 5 });

    const streamDataChunks: any[] = [];
    for await (const chunk of stream.fullStream) {
      if (chunk.type.startsWith('data-')) {
        streamDataChunks.push(chunk);
      }
    }

    expect(streamDataChunks).toHaveLength(3);
    expect(streamDataChunks[0]).toMatchObject({ type: 'data-progress', data: { step: 1, status: 'started' } });
    expect(streamDataChunks[1]).toMatchObject({ type: 'data-progress', data: { step: 2, status: 'processing' } });
    expect(streamDataChunks[2]).toMatchObject({ type: 'data-metrics', data: { latency: 42 } });

    // Processor should have seen all 3 chunks
    expect(capturedDataChunks).toHaveLength(3);
  });
});
