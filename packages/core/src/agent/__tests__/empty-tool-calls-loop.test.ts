import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createTool } from '../../tools';
import { Agent } from '../agent';

/**
 * Regression tests for issue #12581:
 * Anthropic models can return `stop_reason: "tool_use"` (mapped to `finishReason: "tool-calls"`)
 * with an empty `content` array — no actual tool call chunks. This caused an infinite loop
 * because the shouldContinue logic treated `finishReason: "tool-calls"` as a continuation
 * signal, but there were no tool calls to execute, so the model would be called again
 * with the same messages and produce the same empty response indefinitely.
 *
 * The fix: treat `finishReason: "tool-calls"` with no pending tool calls as equivalent
 * to `finishReason: "stop"`.
 */
describe('empty tool-calls infinite loop (#12581)', () => {
  const lookupTool = createTool({
    id: 'lookup',
    description: 'Look up information',
    inputSchema: z.object({ query: z.string() }),
    execute: async ({ query }) => ({ found: true, data: `Result for: ${query}` }),
  });

  it('should stop when finishReason is tool-calls but no tool calls are present (generate)', async () => {
    let callCount = 0;

    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => {
        callCount++;
        // Simulate Anthropic returning stop_reason: "tool_use" with empty content
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          content: [], // Empty — no tool calls despite finishReason
          warnings: [],
        };
      },
    });

    const agent = new Agent({
      id: 'test-empty-tool-calls',
      name: 'Test Agent',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
      tools: { lookup: lookupTool },
    });

    await agent.generate('Hello', { maxSteps: 5 });

    // Without the fix, this would loop 5 times (maxSteps).
    // With the fix, the model should only be called once.
    expect(callCount).toBe(1);
  });

  it('should stop when finishReason is tool-calls but no tool calls are present (stream)', async () => {
    let callCount = 0;

    const mockModel = new MockLanguageModelV2({
      doStream: async () => {
        callCount++;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: `id-${callCount}`, modelId: 'mock-model-id', timestamp: new Date(0) },
            // No tool-call chunks — just a finish with finishReason: 'tool-calls'
            {
              type: 'finish',
              finishReason: 'tool-calls' as const,
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });

    const agent = new Agent({
      id: 'test-empty-tool-calls-stream',
      name: 'Test Agent',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
      tools: { lookup: lookupTool },
    });

    const result = await agent.stream('Hello', { maxSteps: 5 });

    // Consume the stream to completion
    await result.text;

    // Without the fix, this would loop 5 times (maxSteps).
    // With the fix, the model should only be called once.
    expect(callCount).toBe(1);
  });

  it('should still continue when finishReason is tool-calls AND actual tool calls are present', async () => {
    let callCount = 0;

    const mockModel = new MockLanguageModelV2({
      doStream: async () => {
        callCount++;

        if (callCount === 1) {
          // Step 1: Model calls a tool (normal behavior)
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'response-metadata',
                id: `id-${callCount}`,
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'lookup',
                input: JSON.stringify({ query: 'test' }),
              },
              {
                type: 'finish',
                finishReason: 'tool-calls' as const,
                usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        } else {
          // Step 2: Model responds with text (done)
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'response-metadata',
                id: `id-${callCount}`,
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'Done' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop' as const,
                usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        }
      },
    });

    const agent = new Agent({
      id: 'test-real-tool-calls',
      name: 'Test Agent',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
      tools: { lookup: lookupTool },
    });

    const result = await agent.stream('Look up test', { maxSteps: 5 });

    // Consume the stream to completion
    await result.text;

    // The loop should continue past step 1 (tool call) and stop at step 2 (text response)
    expect(callCount).toBe(2);
  });
});
