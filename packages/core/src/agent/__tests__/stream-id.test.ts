import { randomUUID } from 'node:crypto';
import { simulateReadableStream } from '@internal/ai-sdk-v4';
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { createTool } from '../../tools';
import { Agent } from '../agent';

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
    await streamResult.consumeStream();

    const finishedResult = streamResult;
    const response = await finishedResult.response;

    streamResponseId = response?.messages?.[0]?.id;

    // console.log('DEBUG streamResponseId', streamResponseId);
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
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Hello! ' },
          { type: 'text-delta', id: 'text-1', delta: 'I am a ' },
          { type: 'text-delta', id: 'text-1', delta: 'helpful assistant.' },
          { type: 'text-end', id: 'text-1' },
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
      memory: { thread: threadId, resource: resourceId },
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
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Hello! ' },
          { type: 'text-delta', id: 'text-1', delta: 'I am a ' },
          { type: 'text-delta', id: 'text-1', delta: 'helpful assistant.' },
          { type: 'text-end', id: 'text-1' },
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

    const stream = await agent.stream('Hello!', { memory: { thread: threadId, resource: resourceId } });

    await stream.consumeStream();
    const res = await stream.response;
    const messageId = res?.uiMessages?.[0]?.id;
    const result = await memory.recall({ threadId, perPage: 0, include: [{ id: messageId! }] });
    const savedMessages = result.messages;
    expect(savedMessages).toHaveLength(1);
    expect(savedMessages[0].id).toBe(messageId!);
    expect(customIdGenerator).toHaveBeenCalled();
  });

  it('should return generate response IDs that match database-saved message IDs (V2 model)', async () => {
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
          { type: 'stream-start', warnings: [] },
          {
            type: 'response-metadata',
            id: 'v2-gen-msg-xyz123',
            modelId: 'mock-model-id',
            timestamp: new Date(0),
          },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Hello! ' },
          { type: 'text-delta', id: 'text-1', delta: 'I am a ' },
          { type: 'text-delta', id: 'text-1', delta: 'helpful assistant.' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      }),
    });

    const agent = new Agent({
      id: 'test-agent-generate',
      name: 'Test Agent Generate V2',
      instructions: 'You are a helpful assistant.',
      model,
      memory,
    });

    agent.__registerMastra(mastra);

    const threadId = randomUUID();
    const resourceId = 'test-resource';

    const result = await agent.generate('Hello!', {
      memory: { thread: threadId, resource: resourceId },
    });

    const responseMessageId = result.response?.uiMessages?.[0]?.id;
    expect(responseMessageId).toBeDefined();

    // Verify the response message ID can be found in memory
    const recalled = await memory.recall({ threadId, include: [{ id: responseMessageId! }] });
    const messageById = recalled.messages.find(m => m.id === responseMessageId);
    expect(messageById).toBeDefined();
    expect(messageById!.id).toBe(responseMessageId);

    // Verify no duplicate assistant messages exist (only 1 user + 1 assistant)
    const allMessages = await memory.recall({ threadId });
    const assistantMessages = allMessages.messages.filter(m => m.role === 'assistant');
    expect(assistantMessages).toHaveLength(1);
    expect(assistantMessages[0]!.id).toBe(responseMessageId);
  });

  it('should return consistent message IDs with tool calls (V2 model)', async () => {
    let callCount = 0;

    const toolCallStream = convertArrayToReadableStream([
      { type: 'stream-start' as const, warnings: [] },
      { type: 'response-metadata' as const, id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
      {
        type: 'tool-call-start' as const,
        id: 'call-1',
        toolCallId: 'call-1',
        toolName: 'test-tool',
      },
      {
        type: 'tool-call-args-delta' as const,
        id: 'call-1',
        toolCallId: 'call-1',
        toolName: 'test-tool',
        argsDelta: '{"input":"test"}',
      },
      {
        type: 'tool-call-end' as const,
        id: 'call-1',
        toolCallId: 'call-1',
        toolName: 'test-tool',
        args: { input: 'test' },
      },
      {
        type: 'finish' as const,
        finishReason: 'tool-calls' as const,
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      },
    ]);

    const textStream = convertArrayToReadableStream([
      { type: 'stream-start' as const, warnings: [] },
      { type: 'response-metadata' as const, id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
      { type: 'text-start' as const, id: 'text-1' },
      { type: 'text-delta' as const, id: 'text-1', delta: 'Tool result received.' },
      { type: 'text-end' as const, id: 'text-1' },
      {
        type: 'finish' as const,
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      },
    ]);

    const model = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text', text: 'Tool result received.' }],
        warnings: [],
      }),
      doStream: (async () => {
        callCount++;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: callCount === 1 ? toolCallStream : textStream,
        };
      }) as any,
    });

    const testTool = createTool({
      id: 'test-tool',
      description: 'A test tool',
      inputSchema: z.object({ input: z.string() }),
      execute: async () => ({ result: 'Tool executed' }),
    });

    const agent = new Agent({
      id: 'test-agent-tool-ids',
      name: 'Test Agent Tool IDs',
      instructions: 'You are a helpful assistant.',
      model,
      memory,
      tools: { 'test-tool': testTool },
    });

    agent.__registerMastra(mastra);

    const threadId = randomUUID();
    const resourceId = 'test-resource';

    const streamResult = await agent.stream('Use the test tool', {
      memory: { thread: threadId, resource: resourceId },
    });

    // Consume the entire stream
    await streamResult.consumeStream();

    const response = await streamResult.response;
    const uiMessageIds = response?.uiMessages?.map(m => m.id) || [];

    // Verify all response message IDs can be found in memory
    const allRecalled = await memory.recall({ threadId });

    for (const uiMsgId of uiMessageIds) {
      const matchInMemory = allRecalled.messages.find(m => m.id === uiMsgId);
      expect(matchInMemory, `uiMessage ID ${uiMsgId} should exist in memory`).toBeDefined();
    }

    // Verify fullOutput.messages IDs match response uiMessage IDs
    const fullOutput = await streamResult.getFullOutput();
    const responseMessageIds = fullOutput.messages.filter(m => m.role === 'assistant').map(m => m.id);

    // Every uiMessage ID should appear in fullOutput.messages
    for (const uiMsgId of uiMessageIds) {
      expect(responseMessageIds, `uiMessage ID ${uiMsgId} should appear in fullOutput.messages`).toContain(uiMsgId);
    }
  });

  describe('onFinish callback with structured output', () => {
    it('should include object field in onFinish callback when using structured output', async () => {
      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [
            {
              type: 'text',
              text: '{"name":"John","age":30}',
            },
          ],
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: '{"name":"John","age":30}' },
            { type: 'text-end', id: 'text-1' },
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
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [
          {
            type: 'text',
            text: 'The person is John who is 30 years old',
          },
        ],
        warnings: [],
      }),
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'The person is John who is 30 years old' },
          { type: 'text-end', id: 'text-1' },
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
        content: [
          {
            type: 'text',
            text: '{"name":"John","age":30}',
          },
        ],
        warnings: [],
      }),
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: '{"name":"John","age":30}' },
          { type: 'text-end', id: 'text-1' },
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
});
