import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '../agent';
import { createTool } from '../tools';
import type { Processor } from './index';

describe('Output Processor Tool Result Chunks', () => {
  it('should receive tool-result chunks in processOutputStream', async () => {
    const capturedChunkTypes: string[] = [];

    class ToolResultTrackingProcessor implements Processor {
      readonly id = 'tool-result-tracking-processor';
      readonly name = 'Tool Result Tracking Processor';

      async processOutputStream({ part }: any) {
        capturedChunkTypes.push(part.type);
        return part;
      }
    }

    // Create a real tool using createTool
    const echoTool = createTool({
      id: 'echoTool',
      description: 'A test tool that echoes input',
      inputSchema: z.object({
        text: z.string(),
      }),
      execute: async inputData => {
        return `Echo: ${inputData.text}`;
      },
    });

    // Create mock model that calls a tool
    const mockModel = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        // Check if this is the first call (no tool results in messages) or second call (after tool execution)
        const hasToolResults = prompt.some(
          (msg: any) =>
            msg.role === 'tool' ||
            (Array.isArray(msg.content) && msg.content.some((c: any) => c.type === 'tool-result')),
        );

        if (!hasToolResults) {
          // First LLM call - request tool execution
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-456',
                toolName: 'echoTool',
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
          // Second LLM call - after tool execution
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'The tool returned: Echo: hello' },
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
        echoTool,
      },
      outputProcessors: [new ToolResultTrackingProcessor()],
    });

    const stream = await agent.stream('Call the echo tool with text "hello"', {
      maxSteps: 5,
    });

    // Consume the stream and verify tool-result appears in fullStream
    const streamChunkTypes: string[] = [];
    for await (const chunk of stream.fullStream) {
      streamChunkTypes.push(chunk.type);
    }

    // Verify the stream contains tool-result (proving the tool was executed)
    expect(streamChunkTypes).toContain('tool-result');

    // The key assertion: processOutputStream should have received 'tool-result' chunks
    // This is the bug - currently tool-result chunks bypass output processors
    expect(capturedChunkTypes).toContain('tool-result');
  });
});

describe('Output Processor State Persistence Across Tool Execution', () => {
  it('should filter intermediate finish chunks and maintain state during tool execution', async () => {
    const capturedChunks: { type: string; accumulatedTypes: string[] }[] = [];
    class StateTrackingProcessor implements Processor {
      readonly id = 'state-tracking-processor';
      readonly name = 'State Tracking Processor';

      async processOutputStream({ part, streamParts }: any) {
        capturedChunks.push({
          type: part.type,
          accumulatedTypes: streamParts.map((p: any) => p.type),
        });
        return part;
      }
    }

    // Mock tool that returns a result
    const mockTool = {
      description: 'A test tool',
      parameters: {
        type: 'object' as const,
        properties: {
          input: { type: 'string' as const },
        },
        required: ['input'] as const,
      },
      execute: vi.fn(async () => {
        return { result: 'tool executed successfully' };
      }),
    };

    // Create mock model that calls a tool
    const mockModel = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        // Check if this is the first call (no tool results in messages) or second call (after tool execution)
        const hasToolResults = prompt.some(
          (msg: any) =>
            msg.role === 'tool' ||
            (Array.isArray(msg.content) && msg.content.some((c: any) => c.type === 'tool-result')),
        );

        if (!hasToolResults) {
          // First LLM call - request tool execution
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-123',
                toolName: 'testTool',
                input: JSON.stringify({ input: 'test' }),
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
          // Second LLM call - after tool execution
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'The tool executed successfully!' },
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
        testTool: mockTool,
      },
      outputProcessors: [new StateTrackingProcessor()],
    });

    const stream = await agent.stream('Execute the test tool', {
      maxSteps: 5,
    });

    const fullStreamChunks: any[] = [];
    for await (const chunk of stream.fullStream) {
      fullStreamChunks.push(chunk);
    }

    const finishChunks = capturedChunks.filter(c => c.type === 'finish');
    // Output stream processor should just receive the final finish chunk
    expect(finishChunks.length).toBe(1);

    const toolCallIndex = capturedChunks.findIndex(c => c.type === 'tool-call');
    expect(toolCallIndex).toBe(1); // Should be the second chunk (after response-metadata)

    // Verify state accumulation works
    expect(capturedChunks[0]!.type).toBe('response-metadata');
    expect(capturedChunks[0]!.accumulatedTypes).toEqual(['response-metadata']);

    expect(capturedChunks[1]!.type).toBe('tool-call');
    expect(capturedChunks[1]!.accumulatedTypes).toEqual(['response-metadata', 'tool-call']);
  });
});
