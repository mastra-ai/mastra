import { randomUUID } from 'crypto';
import { simulateReadableStream, MockLanguageModelV1 } from '@internal/ai-sdk-v4';
import type { UIMessageChunk } from 'ai-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../mastra';
import type { StorageThreadType } from '../../memory';
import { MockMemory } from '../../memory/mock';
import { Agent } from '../agent';
import type { MastraMessageV1 } from '../message-list';

describe('Stream ID Consistency', () => {
  /**
   * Test to verify that stream response IDs match database-saved message IDs
   */

  let memory: MockMemory;
  let mastra: Mastra;

  beforeEach(() => {
    memory = new MockMemory();
    mastra = new Mastra();
  });

  it('should return stream response IDs that can fetch saved messages from database', async () => {
    const model = new MockLanguageModelV1({
      doStream: async () => ({
        stream: simulateReadableStream({
          initialDelayInMs: 0,
          chunkDelayInMs: 1,
          chunks: [
            { type: 'text-delta', textDelta: 'Hello! ' },
            { type: 'text-delta', textDelta: 'I am ' },
            { type: 'text-delta', textDelta: 'a helpful assistant.' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 20 },
            },
          ],
        }),
        rawCall: { rawPrompt: [], rawSettings: {} },
      }),
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are a helpful assistant.',
      model,
      memory,
    });

    agent.__registerMastra(mastra);

    const threadId = randomUUID();
    const resourceId = 'test-resource';

    const streamResult = await agent.streamLegacy('Hello!', {
      threadId,
      resourceId,
    });

    let streamResponseId: string | undefined;
    for await (const _chunk of streamResult.fullStream) {
      console.log('DEBUG chunk', _chunk);
    }
    await streamResult.consumeStream();

    const finishedResult = streamResult;
    const response = await finishedResult.response;

    streamResponseId = response?.messages?.[0]?.id;

    console.log('DEBUG streamResponseId', streamResponseId);
    expect(streamResponseId).toBeDefined();

    const result = await memory.recall({ threadId });

    const messageById = result.messages.find(m => m.id === streamResponseId);

    expect(messageById).toBeDefined();
    expect(messageById!.id).toBe(streamResponseId);
  });

  it('should use custom ID generator for streaming and keep stream response IDs consistent with database', async () => {
    let customIdCounter = 0;
    const customIdGenerator = vi.fn(() => `custom-id-${++customIdCounter}`);

    const model = new MockLanguageModelV1({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { promptTokens: 10, completionTokens: 20 },
        text: 'Hello! I am a helpful assistant.',
      }),
      doStream: async () => ({
        stream: simulateReadableStream({
          initialDelayInMs: 0,
          chunkDelayInMs: 1,
          chunks: [
            { type: 'text-delta', textDelta: 'Hello! ' },
            { type: 'text-delta', textDelta: 'I am ' },
            { type: 'text-delta', textDelta: 'a helpful assistant.' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 20 },
            },
          ],
        }),
        rawCall: { rawPrompt: [], rawSettings: {} },
      }),
    });

    const mastraWithCustomId = new Mastra({
      idGenerator: customIdGenerator,
      logger: false,
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent Custom ID',
      instructions: 'You are a helpful assistant.',
      model,
      memory,
    });

    agent.__registerMastra(mastraWithCustomId);

    const threadId = randomUUID();
    const resourceId = 'test-resource';

    const stream = await agent.streamLegacy('Hello!', { threadId, resourceId });

    await stream.consumeStream();
    const res = await stream.response;
    const messageId = res.messages[0].id;

    const result = await memory.recall({ threadId, perPage: 0, include: [{ id: messageId }] });
    const savedMessages = result.messages;

    expect(savedMessages).toHaveLength(1);
    expect(savedMessages[0].id).toBe(messageId);
    expect(customIdGenerator).toHaveBeenCalled();
  });

  it('should return stream response IDs that can fetch saved messages from database', async () => {
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          {
            type: 'stream-start',
            warnings: [],
          },
          {
            type: 'response-metadata',
            id: 'v2-msg-xyz123',
            modelId: 'mock-model-id',
            timestamp: new Date(0),
          },
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: 'Hello! ' },
          { type: 'text-delta', id: '1', delta: 'I am a ' },
          { type: 'text-delta', id: '1', delta: 'helpful assistant.' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      }),
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent V2',
      instructions: 'You are a helpful assistant.',
      model,
      memory,
    });

    agent.__registerMastra(mastra);

    const threadId = randomUUID();
    const resourceId = 'test-resource';

    const streamResult = await agent.stream('Hello!', {
      threadId,
      resourceId,
    });

    await streamResult.consumeStream();

    let streamResponseId: string | undefined;
    const res = await streamResult.response;
    streamResponseId = res?.uiMessages?.[0]?.id;

    expect(streamResponseId).toBeDefined();

    const result = await memory.recall({ threadId, include: [{ id: streamResponseId! }] });
    const messageById = result.messages.find(m => m.id === streamResponseId);

    expect(messageById).toBeDefined();
    expect(messageById!.id).toBe(streamResponseId);
  });

  it('should use custom ID generator for stream and keep stream response IDs consistent with database', async () => {
    let customIdCounter = 0;
    const customIdGenerator = vi.fn(() => `custom-v2-id-${++customIdCounter}`);

    const model = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [
          {
            type: 'text',
            text: 'Hello! I am a helpful assistant.',
          },
        ],
        warnings: [],
      }),
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          {
            type: 'stream-start',
            warnings: [],
          },
          {
            type: 'response-metadata',
            id: 'custom-v2-msg-xyz123',
            modelId: 'mock-model-id',
            timestamp: new Date(0),
          },
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: 'Hello! ' },
          { type: 'text-delta', id: '1', delta: 'I am a ' },
          { type: 'text-delta', id: '1', delta: 'helpful assistant.' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      }),
    });

    const mastraWithCustomId = new Mastra({
      idGenerator: customIdGenerator,
      logger: false,
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent V2 Custom ID',
      instructions: 'You are a helpful assistant.',
      model,
      memory,
    });

    agent.__registerMastra(mastraWithCustomId);

    const threadId = randomUUID();
    const resourceId = 'test-resource';

    const stream = await agent.stream('Hello!', { threadId, resourceId });

    await stream.consumeStream();
    const res = await stream.response;
    const messageId = res?.uiMessages?.[0]?.id;
    const result = await memory.recall({ threadId, perPage: 0, include: [{ id: messageId! }] });
    const savedMessages = result.messages;
    expect(savedMessages).toHaveLength(1);
    expect(savedMessages[0].id).toBe(messageId!);
    expect(customIdGenerator).toHaveBeenCalled();
  });

  describe('onFinish callback with structured output', () => {
    it('should include object field in onFinish callback when using structured output', async () => {
      const mockModel = new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: '{"name":"John","age":30}' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        }),
      });

      const agent = new Agent({
        id: 'test-structured-output-onfinish',
        name: 'Test Structured Output OnFinish',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
      });

      let onFinishResult: any = null;
      let onFinishCalled = false;

      const outputSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const response = await agent.generate(
        [
          {
            role: 'user',
            content: 'Extract the person data',
          },
        ],
        {
          structuredOutput: {
            schema: outputSchema,
          },
          onFinish: async result => {
            onFinishCalled = true;
            onFinishResult = result;
          },
        },
      );

      // Wait a bit to ensure onFinish is called
      await new Promise(resolve => setTimeout(resolve, 100));

      // The main function should return the structured data correctly
      expect(response.object).toBeDefined();
      expect(response.object).toEqual({ name: 'John', age: 30 });

      // onFinish should have been called
      expect(onFinishCalled).toBe(true);
      expect(onFinishResult).toBeDefined();

      // The fix: onFinish result should now include the object field
      expect(onFinishResult.object).toBeDefined();
      expect(onFinishResult.object).toEqual({ name: 'John', age: 30 });
    }, 10000); // Increase timeout to 10 seconds
  });

  it('should include object field in onFinish callback when using structuredOutput key', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: 'The person is John who is 30 years old' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      }),
    });

    const structuringModel = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: '{"name":"John","age":30}' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      }),
    });

    const agent = new Agent({
      id: 'test-structured-output-processor-onfinish',
      name: 'Test Structured Output Processor OnFinish',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
    });

    let onFinishResult: any = null;
    let onFinishCalled = false;

    const outputSchema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const response = await agent.generate(
      [
        {
          role: 'user',
          content: 'Extract the person data',
        },
      ],
      {
        structuredOutput: {
          schema: outputSchema,
          model: structuringModel,
        },
        onFinish: async result => {
          onFinishCalled = true;
          onFinishResult = result;
        },
      },
    );

    // Wait a bit to ensure onFinish is called
    await new Promise(resolve => setTimeout(resolve, 100));

    // The main function should return the structured data correctly
    expect(response.object).toBeDefined();
    expect(response.object).toEqual({ name: 'John', age: 30 });

    // onFinish should have been called
    expect(onFinishCalled).toBe(true);
    expect(onFinishResult).toBeDefined();

    // The fix: onFinish result should now include the object field
    expect(onFinishResult.object).toBeDefined();
    expect(onFinishResult.object).toEqual({ name: 'John', age: 30 });
  }, 10000); // Increase timeout to 10 seconds

  it.skip('should have messageIds when using toUIMessageStream', async () => {
    const mockMemory = new MockMemory();
    const threadId = randomUUID();
    const resourceId = 'user-1';
    const initialThread: StorageThreadType = {
      id: threadId,
      resourceId,
      metadata: { client: 'initial' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await mockMemory.saveThread({ thread: initialThread });

    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: 'Hello! ' },
          { type: 'text-delta', id: '1', delta: 'How can I ' },
          { type: 'text-delta', id: '1', delta: 'help you today?' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      }),
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent UIMessage',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
      memory: mockMemory,
    });

    const mastra = new Mastra({ agents: { test: agent } });
    agent.__registerMastra(mastra);

    const stream = await agent.stream('Hello!', { threadId, resourceId, format: 'aisdk' });

    // Get the UI message stream
    const uiStream = stream.toUIMessageStream();

    // Collect all chunks from the UI stream to verify message ID is present
    const chunks: UIMessageChunk[] = [];
    const reader = uiStream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const result = await mockMemory.recall({ threadId });
    console.log('messages', result);

    const assistantMessage = result.messages.find((m: MastraMessageV1) => m.role === 'assistant');
    console.log('assistantMessage', assistantMessage);
    const startEvent = chunks.find(chunk => chunk.type === 'start');
    console.log('startEvent', startEvent);

    expect(assistantMessage?.id).toBe(startEvent?.messageId);
  });
});
