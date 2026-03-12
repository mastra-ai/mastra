import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../memory/mock';
import { Agent } from '../agent';
import { MockLanguageModelV2, convertArrayToReadableStream } from './mock-model';

/**
 * Regression test for issue #12800:
 * "Your API request included an `assistant` message in the final position"
 *
 * The network loop's routing agent prompt is constructed as an assistant-role message
 * (see packages/core/src/loop/network/index.ts line 574-607). When the routing agent
 * calls generate/stream with structuredOutput + memory, the prompt ends up being:
 *   [system] [memory user] [memory assistant] [assistant: routing prompt]
 *
 * Anthropic's API rejects this when using output format (structured output) because
 * the last message is an assistant message, which would pre-fill the response.
 *
 * This test reproduces the issue at the agent level by simulating the network loop's
 * behavior: passing an assistant-role message as input with structuredOutput + memory.
 */
describe('Structured output with memory - assistant message in final position (#12800)', () => {
  it('should not send prompt ending with assistant message when input is assistant-role with structuredOutput and memory', async () => {
    const threadId = randomUUID();
    const resourceId = 'user-12800';

    const mockMemory = new MockMemory();

    // Track what prompts are sent to the model
    const capturedPrompts: any[] = [];

    const mockModel = new MockLanguageModelV2({
      provider: 'anthropic',
      modelId: 'claude-opus-4-6',
      doGenerate: async options => {
        capturedPrompts.push(options.prompt);
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                primitiveId: 'agent1',
                primitiveType: 'agent',
                prompt: 'research dolphins',
                selectionReason: 'best fit',
              }),
            },
          ],
          warnings: [],
        };
      },
      doStream: async options => {
        capturedPrompts.push((options as any).prompt);
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            {
              type: 'stream-start',
              warnings: [],
            },
            {
              type: 'response-metadata',
              id: 'response-1',
              modelId: 'mock-model',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: 'text-1' },
            {
              type: 'text-delta',
              id: 'text-1',
              delta: JSON.stringify({
                primitiveId: 'agent1',
                primitiveType: 'agent',
                prompt: 'research dolphins',
                selectionReason: 'best fit',
              }),
            },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        };
      },
    });

    const agent = new Agent({
      id: 'structured-output-memory-test',
      name: 'Routing Agent',
      instructions: 'You are a routing agent that selects primitives.',
      model: mockModel,
      memory: mockMemory,
    });

    // Create the thread
    await mockMemory.createThread({ threadId, resourceId });

    // Pre-populate memory with a conversation that ends with an assistant message.
    // This simulates what happens after a previous network iteration where the
    // routing agent's response and sub-agent results were saved to memory.
    const now = new Date();
    await mockMemory.saveMessages({
      messages: [
        {
          id: randomUUID(),
          role: 'user' as const,
          content: {
            format: 2 as const,
            parts: [{ type: 'text' as const, text: 'Research dolphins' }],
          },
          threadId,
          createdAt: new Date(now.getTime() - 2000),
          resourceId,
          type: 'text' as const,
        },
        {
          id: randomUUID(),
          role: 'assistant' as const,
          content: {
            format: 2 as const,
            parts: [{ type: 'text' as const, text: 'Dolphins are intelligent marine mammals.' }],
          },
          threadId,
          createdAt: new Date(now.getTime() - 1000),
          resourceId,
          type: 'text' as const,
        },
      ],
    });

    // Simulate the network routing agent call: the routing prompt is an ASSISTANT
    // message (see packages/core/src/loop/network/index.ts line 574-607), and it's
    // called with structuredOutput + memory. This is the exact scenario that triggers
    // the Anthropic error.
    const result = await agent.generate(
      [
        {
          role: 'assistant' as const,
          content: 'Select the most appropriate primitive to handle this task...',
        },
      ],
      {
        memory: {
          thread: threadId,
          resource: resourceId,
        },
        structuredOutput: {
          schema: z.object({
            primitiveId: z.string(),
            primitiveType: z.string(),
            prompt: z.string(),
            selectionReason: z.string(),
          }),
        },
      },
    );

    // Verify we got a response
    expect(result.object).toBeDefined();

    // The critical assertion: the last message in the prompt should NOT be an assistant message.
    // Anthropic rejects requests where the last message is assistant when using output format.
    expect(capturedPrompts.length).toBeGreaterThan(0);
    const prompt = capturedPrompts[0]!;
    const lastMessage = prompt[prompt.length - 1];
    expect(
      lastMessage.role,
      `Expected last message role to NOT be 'assistant', but got 'assistant'. ` +
        `This causes Anthropic API error: "When using output format, pre-filling the ` +
        `assistant response is not supported." ` +
        `Message roles in prompt: ${prompt.map((m: any) => m.role).join(', ')}`,
    ).not.toBe('assistant');
  });

  it('should not send prompt ending with assistant message when using stream with assistant-role input, structuredOutput and memory', async () => {
    const threadId = randomUUID();
    const resourceId = 'user-12800-stream';

    const mockMemory = new MockMemory();

    // Track what prompts are sent to the model
    const capturedPrompts: any[] = [];

    const mockModel = new MockLanguageModelV2({
      provider: 'anthropic',
      modelId: 'claude-opus-4-6',
      doGenerate: async options => {
        capturedPrompts.push(options.prompt);
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                primitiveId: 'agent1',
                primitiveType: 'agent',
                prompt: 'research dolphins',
                selectionReason: 'best fit',
              }),
            },
          ],
          warnings: [],
        };
      },
      doStream: async options => {
        capturedPrompts.push((options as any).prompt);
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            {
              type: 'stream-start',
              warnings: [],
            },
            {
              type: 'response-metadata',
              id: 'response-1',
              modelId: 'mock-model',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: 'text-1' },
            {
              type: 'text-delta',
              id: 'text-1',
              delta: JSON.stringify({
                primitiveId: 'agent1',
                primitiveType: 'agent',
                prompt: 'research dolphins',
                selectionReason: 'best fit',
              }),
            },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        };
      },
    });

    const agent = new Agent({
      id: 'structured-output-memory-stream-test',
      name: 'Routing Agent Stream',
      instructions: 'You are a routing agent that selects primitives.',
      model: mockModel,
      memory: mockMemory,
    });

    // Create the thread
    await mockMemory.createThread({ threadId, resourceId });

    // Pre-populate memory with a conversation ending with an assistant message
    const now = new Date();
    await mockMemory.saveMessages({
      messages: [
        {
          id: randomUUID(),
          role: 'user' as const,
          content: {
            format: 2 as const,
            parts: [{ type: 'text' as const, text: 'Research dolphins' }],
          },
          threadId,
          createdAt: new Date(now.getTime() - 2000),
          resourceId,
          type: 'text' as const,
        },
        {
          id: randomUUID(),
          role: 'assistant' as const,
          content: {
            format: 2 as const,
            parts: [{ type: 'text' as const, text: 'Dolphins are intelligent marine mammals.' }],
          },
          threadId,
          createdAt: new Date(now.getTime() - 1000),
          resourceId,
          type: 'text' as const,
        },
      ],
    });

    // Call stream with assistant-role input + structuredOutput + memory
    const response = await agent.stream(
      [
        {
          role: 'assistant' as const,
          content: 'Select the most appropriate primitive to handle this task...',
        },
      ],
      {
        memory: {
          thread: threadId,
          resource: resourceId,
        },
        structuredOutput: {
          schema: z.object({
            primitiveId: z.string(),
            primitiveType: z.string(),
            prompt: z.string(),
            selectionReason: z.string(),
          }),
        },
      },
    );

    await response.consumeStream();

    // The critical assertion: the last message in the prompt should NOT be an assistant message.
    expect(capturedPrompts.length).toBeGreaterThan(0);
    const prompt = capturedPrompts[0]!;
    const lastMessage = prompt[prompt.length - 1];
    expect(
      lastMessage.role,
      `Expected last message role to NOT be 'assistant', but got 'assistant'. ` +
        `This causes Anthropic API error: "When using output format, pre-filling the ` +
        `assistant response is not supported." ` +
        `Message roles in prompt: ${prompt.map((m: any) => m.role).join(', ')}`,
    ).not.toBe('assistant');
  });
});
