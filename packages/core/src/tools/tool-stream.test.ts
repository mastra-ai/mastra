import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { Agent } from '../agent';
import type { ChunkType } from '../stream/types';
import { createTool } from '.';

describe('ToolStream - writer.custom', () => {
  let mockModel: MockLanguageModelV2;

  beforeEach(() => {
    mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          {
            type: 'tool-call',
            toolCallId: 'call-custom-1',
            toolName: 'customTool',
            input: '{"message": "test"}',
            providerExecuted: false,
          },
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: 'Tool executed successfully.' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });
  });

  it('should allow tools to write custom data chunks using writer.custom', async () => {
    const customTool = createTool({
      id: 'custom-tool',
      description: 'A tool that uses writer.custom to send custom data chunks',
      inputSchema: z.object({
        message: z.string(),
      }),
      execute: async ({ writer, context }: any) => {
        // Use writer.custom to send a custom data chunk
        await writer?.custom({
          type: 'data-custom-progress',
          data: {
            status: 'processing',
            message: context.message,
            progress: 50,
          },
        });

        // Send another custom chunk
        await writer.custom({
          type: 'data-custom-result',
          data: {
            status: 'complete',
            result: `Processed: ${context.message}`,
          },
        });

        return { success: true, message: context.message };
      },
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are a test agent that uses custom tools.',
      model: mockModel,
      tools: {
        customTool,
      },
    });

    const stream = await agent.stream('Call the custom-tool with message "test"');

    const chunks: ChunkType[] = [];
    for await (const chunk of stream.fullStream) {
      chunks.push(chunk);
    }

    // Find the custom data chunks - they should bubble up directly as data-* chunks
    const customProgressChunk = chunks.find(chunk => chunk.type === 'data-custom-progress');
    const customResultChunk = chunks.find(chunk => chunk.type === 'data-custom-result');

    expect(customProgressChunk).toBeDefined();
    expect(customResultChunk).toBeDefined();

    // Verify the data payload
    if (customProgressChunk && 'data' in customProgressChunk) {
      const data = (customProgressChunk as any).data;
      expect(data.status).toBe('processing');
      expect(data.progress).toBe(50);
      expect(data.message).toBe('test');
    }
  });

  it('should allow sub-agent tools to use writer.custom', async () => {
    // Create a sub-agent with a tool that uses writer.custom
    const subAgentTool = createTool({
      id: 'sub-agent-tool',
      description: 'A tool on a sub-agent that uses writer.custom',
      inputSchema: z.object({
        task: z.string(),
      }),
      execute: async ({ writer, context }: any) => {
        // Send custom progress updates
        await writer?.custom({
          type: 'data-sub-agent-progress',
          data: {
            step: 'initializing',
            task: context.task,
          },
        });

        await writer.custom({
          type: 'data-sub-agent-progress',
          data: {
            step: 'processing',
            task: context.task,
            progress: 75,
          },
        });

        return { completed: true, task: context.task };
      },
    });

    const subAgentModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
          {
            type: 'tool-call',
            toolCallId: 'call-sub-1',
            toolName: 'sub-agent-tool',
            input: '{"task": "analyze data"}',
            providerExecuted: false,
          },
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: 'Task completed.' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });

    const subAgent = new Agent({
      id: 'sub-agent',
      name: 'Sub Agent',
      instructions: 'You are a sub-agent that can execute tasks.',
      model: subAgentModel,
      tools: {
        subAgentTool,
      },
    });

    // Create parent agent that has the sub-agent registered
    const parentAgentModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-2', modelId: 'mock-model-id', timestamp: new Date(0) },
          {
            type: 'tool-call',
            toolCallId: 'call-agent-1',
            toolName: 'agent-subAgent',
            input: '{"prompt": "Use the sub-agent-tool to analyze data"}',
            providerExecuted: false,
          },
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: 'Sub-agent executed successfully.' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });

    const parentAgent = new Agent({
      id: 'parent-agent',
      name: 'Parent Agent',
      instructions: 'You are a parent agent that can delegate to sub-agents.',
      model: parentAgentModel,
      agents: {
        subAgent,
      },
    });

    const stream = await parentAgent.stream('Use the sub-agent to analyze data');

    const chunks: ChunkType[] = [];
    for await (const chunk of stream.fullStream) {
      chunks.push(chunk);
    }

    // Find custom chunks from the sub-agent's tool
    // Data chunks should bubble up directly as data-* chunks (not wrapped)
    const customChunks = chunks.filter(chunk => chunk.type === 'data-sub-agent-progress');
    // We should have custom chunks from the sub-agent's tool execution
    expect(customChunks.length).toBeGreaterThan(0);
  });

  it('should handle writer.custom with regular tool-output chunks', async () => {
    const mixedTool = createTool({
      id: 'mixed-tool',
      description: 'A tool that uses both writer.write and writer.custom',
      inputSchema: z.object({
        value: z.string(),
      }),
      execute: async ({ writer, context }: any) => {
        // Use regular write
        await writer?.write({
          type: 'status-update',
          message: 'Starting processing',
        });

        // Use custom for data chunks
        await writer?.custom({
          type: 'data-processing-metrics',
          data: {
            value: context.value,
            timestamp: Date.now(),
          },
        });

        // Another regular write
        await writer.write({
          type: 'status-update',
          message: 'Processing complete',
        });

        return { processed: context.value };
      },
    });

    const mixedToolModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          {
            type: 'tool-call',
            toolCallId: 'call-mixed-1',
            toolName: 'mixedTool',
            input: '{"value": "test"}',
            providerExecuted: false,
          },
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: 'Tool executed successfully.' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });

    const agent = new Agent({
      id: 'mixed-agent',
      name: 'Mixed Agent',
      instructions: 'You are an agent that uses mixed streaming tools.',
      model: mixedToolModel,
      tools: {
        mixedTool,
      },
    });

    const stream = await agent.stream('Call the mixed-tool with value "test"');

    const chunks: ChunkType[] = [];
    for await (const chunk of stream.fullStream) {
      chunks.push(chunk);
    }

    // Find tool-output chunks (from writer.write) and direct custom chunks (from writer.custom)
    const toolOutputChunks = chunks.filter(chunk => chunk.type === 'tool-output');
    const customDataChunks = chunks.filter(chunk => chunk.type === 'data-processing-metrics');

    expect(toolOutputChunks.length).toBeGreaterThan(0);

    // Verify we have regular writes (wrapped in tool-output)
    const hasRegularWrite = toolOutputChunks.some(chunk => {
      if ('payload' in chunk) {
        const payload = chunk.payload as any;
        return payload?.output?.type === 'status-update';
      }
      return false;
    });

    // Verify we have custom data chunks (bubbled up directly, not wrapped)
    expect(customDataChunks.length).toBeGreaterThan(0);
    expect(hasRegularWrite).toBe(true);

    // Verify the custom data chunk has the correct structure
    if (customDataChunks.length > 0 && 'data' in customDataChunks[0]) {
      const data = (customDataChunks[0] as any).data;
      expect(data.value).toBe('test');
      expect(data.timestamp).toBeDefined();
    }
  });
});
