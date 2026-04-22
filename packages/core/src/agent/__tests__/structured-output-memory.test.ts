import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../memory/mock';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '../../request-context';
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
      id: 'test-agent-12800',
      name: 'Test Agent 12800',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
      memory: mockMemory,
    });

    await mockMemory.createThread({ threadId, resourceId });

    // Pre-populate memory with conversation history
    await mockMemory.saveMessages({
      messages: [
        {
          id: randomUUID(),
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Which agent should research dolphins?' }] },
          threadId,
          resourceId,
          createdAt: new Date(),
        },
        {
          id: randomUUID(),
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'Let me route this request.' }] },
          threadId,
          resourceId,
          createdAt: new Date(),
        },
      ],
    });

    await agent.generate([{ role: 'assistant', content: 'Please select the best agent for research dolphins' }], {
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
    });

    // The critical assertion: the prompt sent to the model should NOT end with an assistant message
    expect(capturedPrompts.length).toBeGreaterThan(0);
    const lastPrompt = capturedPrompts[capturedPrompts.length - 1];

    // Find the last non-system message in the prompt
    const nonSystemMessages = lastPrompt.filter((msg: any) => msg.role !== 'system');
    expect(nonSystemMessages.length).toBeGreaterThan(0);

    const lastMessage = nonSystemMessages[nonSystemMessages.length - 1];
    expect(lastMessage.role).toBe('user');
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
    const lastPrompt = capturedPrompts[capturedPrompts.length - 1];
    const nonSystemMessages = lastPrompt.filter((msg: any) => msg.role !== 'system');
    expect(nonSystemMessages.length).toBeGreaterThan(0);
    const lastMessage = nonSystemMessages[nonSystemMessages.length - 1];
    expect(lastMessage.role).toBe('user');
  });
});

describe('Structured output memory inheritance', () => {
  it('includes prior memory context when useAgent is true for a separate structuring model', async () => {
    const threadId = randomUUID();
    const resourceId = `structured-output-memory-${randomUUID()}`;
    const mockMemory = new MockMemory();

    const mainModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text', text: 'Acknowledged.' }],
        warnings: [],
      }),
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          {
            type: 'response-metadata',
            id: 'main-response',
            modelId: 'main-model',
            timestamp: new Date(0),
          },
          { type: 'text-start', id: 'main-text' },
          { type: 'text-delta', id: 'main-text', delta: 'Acknowledged.' },
          { type: 'text-end', id: 'main-text' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      }),
    });

    const structuringPrompts: any[] = [];
    const structuringModel = new MockLanguageModelV2({
      doGenerate: async options => {
        structuringPrompts.push(options.prompt);
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                favoriteColor: 'violet',
                hometown: 'Lisbon',
                petName: 'Mochi',
              }),
            },
          ],
          warnings: [],
        };
      },
      doStream: async options => {
        structuringPrompts.push((options as any).prompt);
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            {
              type: 'response-metadata',
              id: 'structuring-response',
              modelId: 'structuring-model',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: 'structuring-text' },
            {
              type: 'text-delta',
              id: 'structuring-text',
              delta: JSON.stringify({
                favoriteColor: 'violet',
                hometown: 'Lisbon',
                petName: 'Mochi',
              }),
            },
            { type: 'text-end', id: 'structuring-text' },
            {
              type: 'object-result',
              object: {
                favoriteColor: 'violet',
                hometown: 'Lisbon',
                petName: 'Mochi',
              },
            } as any,
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ] as any),
        };
      },
    });

    const agent = new Agent({
      id: 'structured-output-cross-turn-memory-test',
      name: 'Memory Agent',
      instructions: 'Answer briefly and use the provided conversation context.',
      model: mainModel,
      memory: mockMemory,
    });

    await mockMemory.createThread({ threadId, resourceId });

    await agent.generate('My favorite color is violet.', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });

    await agent.generate('I grew up in Lisbon.', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });

    await agent.generate('My dog is named Mochi.', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });

    const requestContext = new RequestContext();
    requestContext.set(MASTRA_THREAD_ID_KEY, threadId);
    requestContext.set(MASTRA_RESOURCE_ID_KEY, resourceId);

    const result = await agent.generate(
      'Return my profile as structured data. If a field is missing from this message, fill it from earlier conversation memory.',
      {
        memory: {
          thread: threadId,
          resource: resourceId,
        },
        requestContext,
        structuredOutput: {
          schema: z.object({
            favoriteColor: z.string(),
            hometown: z.string(),
            petName: z.string(),
          }),
          model: structuringModel,
          useAgent: true,
        },
      },
    );

    expect(result.object).toEqual({
      favoriteColor: 'violet',
      hometown: 'Lisbon',
      petName: 'Mochi',
    });

    expect(structuringPrompts.length).toBeGreaterThan(0);
    const prompt = structuringPrompts.at(-1)!;
    const promptText = prompt
      .flatMap((message: any) =>
        Array.isArray(message.content)
          ? message.content.map((part: any) => (typeof part === 'string' ? part : (part.text ?? JSON.stringify(part))))
          : [typeof message.content === 'string' ? message.content : JSON.stringify(message.content)],
      )
      .join('\n');

    expect(promptText).toContain('violet');
    expect(promptText).toContain('Lisbon');
    expect(promptText).toContain('Mochi');
  });

  it('does not leak the structuring agent readOnly memory config into the parent request context', async () => {
    const threadId = randomUUID();
    const resourceId = `structured-output-memory-${randomUUID()}`;
    const mockMemory = new MockMemory();

    const mainModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text', text: 'Main agent summary.' }],
        warnings: [],
      }),
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          {
            type: 'response-metadata',
            id: 'main-response-request-context',
            modelId: 'main-model',
            timestamp: new Date(0),
          },
          { type: 'text-start', id: 'main-text-request-context' },
          { type: 'text-delta', id: 'main-text-request-context', delta: 'Main agent summary.' },
          { type: 'text-end', id: 'main-text-request-context' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      }),
    });

    const structuringModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text', text: JSON.stringify({ summary: 'Structured summary' }) }],
        warnings: [],
      }),
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        request: { body: undefined },
        response: { headers: {}, body: undefined },
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          {
            type: 'response-metadata',
            id: 'structuring-response-request-context',
            modelId: 'structuring-model',
            timestamp: new Date(0),
          },
          { type: 'text-start', id: 'structuring-text-request-context' },
          { type: 'text-delta', id: 'structuring-text-request-context', delta: '{"summary":"Structured summary"}' },
          { type: 'text-end', id: 'structuring-text-request-context' },
          { type: 'object-result', object: { summary: 'Structured summary' } } as any,
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ] as any),
      }),
    });

    const agent = new Agent({
      id: 'structured-output-request-context-isolation-test',
      name: 'Request Context Isolation Agent',
      instructions: 'Answer briefly and use the provided conversation context.',
      model: mainModel,
      memory: mockMemory,
    });

    await mockMemory.createThread({ threadId, resourceId });

    const requestContext = new RequestContext();
    requestContext.set(MASTRA_THREAD_ID_KEY, threadId);
    requestContext.set(MASTRA_RESOURCE_ID_KEY, resourceId);

    const result = await agent.generate('Return a short structured summary.', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
      requestContext,
      structuredOutput: {
        schema: z.object({
          summary: z.string(),
        }),
        model: structuringModel,
        useAgent: true,
      },
    });

    expect(result.object).toEqual({ summary: 'Structured summary' });

    const mastraMemory = requestContext.get('MastraMemory') as { memoryConfig?: { readOnly?: boolean } } | undefined;
    expect(mastraMemory?.memoryConfig?.readOnly).not.toBe(true);
  });

  it('does not include prior memory context when useAgent is omitted for a separate structuring model', async () => {
    const threadId = randomUUID();
    const resourceId = `structured-output-memory-${randomUUID()}`;
    const mockMemory = new MockMemory();

    const mainModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text', text: 'Acknowledged.' }],
        warnings: [],
      }),
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          {
            type: 'response-metadata',
            id: 'main-response-no-agent',
            modelId: 'main-model',
            timestamp: new Date(0),
          },
          { type: 'text-start', id: 'main-text-no-agent' },
          { type: 'text-delta', id: 'main-text-no-agent', delta: 'Acknowledged.' },
          { type: 'text-end', id: 'main-text-no-agent' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      }),
    });

    const structuringPrompts: any[] = [];
    const structuringModel = new MockLanguageModelV2({
      doGenerate: async options => {
        structuringPrompts.push(options.prompt);
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [{ type: 'text', text: JSON.stringify({ summary: 'Structured summary' }) }],
          warnings: [],
        };
      },
      doStream: async options => {
        structuringPrompts.push((options as any).prompt);
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          request: { body: undefined },
          response: { headers: {}, body: undefined },
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            {
              type: 'response-metadata',
              id: 'structuring-response-no-agent',
              modelId: 'structuring-model',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: 'structuring-text-no-agent' },
            { type: 'text-delta', id: 'structuring-text-no-agent', delta: '{"summary":"Structured summary"}' },
            { type: 'text-end', id: 'structuring-text-no-agent' },
            { type: 'object-result', object: { summary: 'Structured summary' } } as any,
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ] as any),
        };
      },
    });

    const agent = new Agent({
      id: 'structured-output-cross-turn-memory-disabled-test',
      name: 'Memory Agent',
      instructions: 'Answer briefly and use the provided conversation context.',
      model: mainModel,
      memory: mockMemory,
    });

    await mockMemory.createThread({ threadId, resourceId });

    await agent.generate('My favorite color is violet.', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });

    await agent.generate('I grew up in Lisbon.', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });

    await agent.generate('My dog is named Mochi.', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });

    const requestContext = new RequestContext();
    requestContext.set(MASTRA_THREAD_ID_KEY, threadId);
    requestContext.set(MASTRA_RESOURCE_ID_KEY, resourceId);

    const result = await agent.generate(
      'Return my profile as structured data. If a field is missing from this message, fill it from earlier conversation memory.',
      {
        memory: {
          thread: threadId,
          resource: resourceId,
        },
        requestContext,
        structuredOutput: {
          schema: z.object({
            summary: z.string(),
          }),
          model: structuringModel,
        },
      },
    );

    expect(result.object).toEqual({ summary: 'Structured summary' });

    expect(structuringPrompts.length).toBeGreaterThan(0);
    const prompt = structuringPrompts.at(-1)!;
    const promptText = prompt
      .flatMap((message: any) =>
        Array.isArray(message.content)
          ? message.content.map((part: any) => (typeof part === 'string' ? part : (part.text ?? JSON.stringify(part))))
          : [typeof message.content === 'string' ? message.content : JSON.stringify(message.content)],
      )
      .join('\n');

    expect(promptText).not.toContain('violet');
    expect(promptText).not.toContain('Lisbon');
    expect(promptText).not.toContain('Mochi');
  });

  it('keeps main-agent text chunks in the outer stream while suppressing structuring-agent text chunks', async () => {
    const threadId = randomUUID();
    const resourceId = `structured-output-streaming-${randomUUID()}`;
    const mockMemory = new MockMemory();

    const mainModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text', text: 'Main agent summary.' }],
        warnings: [],
      }),
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          {
            type: 'response-metadata',
            id: 'main-response-streaming',
            modelId: 'main-model',
            timestamp: new Date(0),
          },
          { type: 'text-start', id: 'main-text-streaming' },
          { type: 'text-delta', id: 'main-text-streaming', delta: 'Main ' },
          { type: 'text-delta', id: 'main-text-streaming', delta: 'agent ' },
          { type: 'text-delta', id: 'main-text-streaming', delta: 'summary.' },
          { type: 'text-end', id: 'main-text-streaming' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      }),
    });

    const structuringModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text', text: JSON.stringify({ summary: 'Structured summary' }) }],
        warnings: [],
      }),
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          {
            type: 'response-metadata',
            id: 'structuring-response-streaming',
            modelId: 'structuring-model',
            timestamp: new Date(0),
          },
          { type: 'text-start', id: 'structuring-text-streaming' },
          {
            type: 'text-delta',
            id: 'structuring-text-streaming',
            delta: '{"summary":"Structured summary"}',
          },
          { type: 'text-end', id: 'structuring-text-streaming' },
          { type: 'object-result', object: { summary: 'Structured summary' } } as any,
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ] as any),
      }),
    });

    const agent = new Agent({
      id: 'structured-output-streaming-visibility-test',
      name: 'Streaming Visibility Agent',
      instructions: 'Answer briefly and structure the result afterward.',
      model: mainModel,
      memory: mockMemory,
    });

    await mockMemory.createThread({ threadId, resourceId });

    const result = await agent.stream('Summarize this briefly', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
      structuredOutput: {
        schema: z.object({
          summary: z.string(),
        }),
        model: structuringModel,
      },
    });

    const textChunks: string[] = [];
    const structuredObjects: Array<{ summary: string }> = [];

    for await (const chunk of result.fullStream) {
      if (chunk.type === 'text-delta') {
        textChunks.push(chunk.payload.text);
      }

      if (chunk.type === 'object-result') {
        structuredObjects.push(chunk.object as { summary: string });
      }
    }

    const fullOutput = await result.getFullOutput();

    expect(textChunks.join('')).toBe('Main agent summary.');
    expect(textChunks.join('')).not.toContain('Structured summary');
    expect(structuredObjects).toEqual([{ summary: 'Structured summary' }]);
    expect(fullOutput.text).toBe('Main agent summary.');
    expect(fullOutput.object).toEqual({ summary: 'Structured summary' });

    await vi.waitFor(async () => {
      const recalled = await mockMemory.recall({ threadId, resourceId });
      const lastAssistantMessage = [...recalled.messages].reverse().find(message => message.role === 'assistant');
      const assistantText =
        lastAssistantMessage?.content.parts
          .filter(part => part.type === 'text')
          .map(part => part.text)
          .join('') ?? '';

      expect(assistantText).toBe('Main agent summary.');
    });
  });
});
