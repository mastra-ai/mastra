import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Agent } from '../agent';
import { createTool } from '../tools';
import type { Processor } from './index';

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

    // Create a tool that emits a data-* chunk via writer.custom()
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

    // Create mock model that calls the tool
    const mockModel = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        const hasToolResults = prompt.some(
          (msg: any) =>
            msg.role === 'tool' ||
            (Array.isArray(msg.content) && msg.content.some((c: any) => c.type === 'tool-result')),
        );

        if (!hasToolResults) {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'toolWithCustomData',
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

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Test agent with tools',
      model: mockModel as any,
      tools: {
        toolWithCustomData,
      },
      outputProcessors: [new DataChunkTrackingProcessor()],
    });

    const stream = await agent.stream('Call the tool with text "hello"', {
      maxSteps: 5,
    });

    const streamChunkTypes: string[] = [];
    for await (const chunk of stream.fullStream) {
      streamChunkTypes.push(chunk.type);
    }

    // The stream should contain the data-moderation chunk
    expect(streamChunkTypes).toContain('data-moderation');

    // The key assertion: processOutputStream should have received the data-* chunk
    expect(capturedChunkTypes).toContain('data-moderation');

    // Verify the data was passed through correctly
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
      inputSchema: z.object({
        text: z.string(),
      }),
      execute: async (inputData, { writer }) => {
        writer!.custom({ type: 'data-moderation', data: { flagged: false } });
        return `Processed: ${inputData.text}`;
      },
    });

    const mockModel = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        const hasToolResults = prompt.some(
          (msg: any) =>
            msg.role === 'tool' ||
            (Array.isArray(msg.content) && msg.content.some((c: any) => c.type === 'tool-result')),
        );

        if (!hasToolResults) {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'toolWithCustomData',
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

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Test agent with tools',
      model: mockModel as any,
      tools: {
        toolWithCustomData,
      },
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

    // The data chunk should have been modified by the processor
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
      inputSchema: z.object({
        text: z.string(),
      }),
      execute: async (inputData, { writer }) => {
        writer!.custom({ type: 'data-sensitive', data: { secret: 'classified' } });
        return `Processed: ${inputData.text}`;
      },
    });

    const mockModel = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        const hasToolResults = prompt.some(
          (msg: any) =>
            msg.role === 'tool' ||
            (Array.isArray(msg.content) && msg.content.some((c: any) => c.type === 'tool-result')),
        );

        if (!hasToolResults) {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'toolWithSensitiveData',
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

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Test agent with tools',
      model: mockModel as any,
      tools: {
        toolWithSensitiveData,
      },
      outputProcessors: [new DataChunkBlockingProcessor()],
    });

    const stream = await agent.stream('Call the tool with text "hello"', {
      maxSteps: 5,
    });

    const streamChunkTypes: string[] = [];
    for await (const chunk of stream.fullStream) {
      streamChunkTypes.push(chunk.type);
    }

    // The data-sensitive chunk should NOT appear in the stream (blocked by processor)
    expect(streamChunkTypes).not.toContain('data-sensitive');
  });
});
