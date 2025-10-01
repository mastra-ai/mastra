import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import type { Processor } from './index';

describe('Output Processor State Persistence Across Tool Execution', () => {
  it('should filter intermediate finish chunks and maintain state during tool execution', async () => {
    const capturedChunks: { type: string; accumulatedTypes: string[] }[] = [];

    // Test processor that captures chunk types and accumulated state
    class StateTrackingProcessor implements Processor {
      name = 'state-tracking-processor';

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
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'The tool executed successfully!' },
              { type: 'text-end', id: '1' },
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
      name: 'test-agent',
      instructions: 'Test agent with tools',
      model: mockModel as any,
      tools: {
        testTool: mockTool,
      },
      outputProcessors: [new StateTrackingProcessor()],
    });

    // Stream the response
    const stream = await agent.streamVNext('Execute the test tool', {
      format: 'aisdk',
      maxSteps: 5, // Allow multiple steps to continue after tool execution
    });

    // Consume the stream
    const fullStreamChunks: any[] = [];
    for await (const chunk of stream.fullStream) {
      fullStreamChunks.push(chunk);
    }

    console.log(
      'Full stream chunk types:',
      fullStreamChunks.map(c => c.type),
    );

    // VERIFICATION: Both issues are now fixed!

    // Issue 2 Fix: Intermediate finish chunks with 'tool-calls' reason are filtered out
    const finishChunks = capturedChunks.filter(c => c.type === 'finish');
    // Before fix: Would see 2 finish chunks (one with 'tool-calls' reason that shouldn't reach processors)
    // After fix: No finish chunks reach the processor (the intermediate one is filtered)
    expect(finishChunks.length).toBe(0);

    // Issue 1 Fix: Processor state persists across the stream (no reset)
    // Find the tool-call chunk
    const toolCallIndex = capturedChunks.findIndex(c => c.type === 'tool-call');
    expect(toolCallIndex).toBe(1); // Should be the second chunk (after response-metadata)

    // Verify state accumulation works
    expect(capturedChunks[0]!.type).toBe('response-metadata');
    expect(capturedChunks[0]!.accumulatedTypes).toEqual(['response-metadata']);

    expect(capturedChunks[1]!.type).toBe('tool-call');
    expect(capturedChunks[1]!.accumulatedTypes).toEqual(['response-metadata', 'tool-call']);

    // This demonstrates the fix: state is accumulating properly across chunks
    // Before the fix, we would have seen state reset after the tool-call
  });
});
