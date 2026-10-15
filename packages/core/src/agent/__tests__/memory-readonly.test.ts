import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { MockLanguageModelV2, convertArrayToReadableStream } from './mock-model';

/**
 * Creates a simple mock model for testing.
 */
function createSimpleMockModel() {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [
        {
          type: 'text',
          text: 'Hello! How can I help you?',
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
          id: 'response-1',
          modelId: 'mock-model',
          timestamp: new Date(0),
        },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Hello! How can I help you?' },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
    }),
  });
}

describe('Memory readOnly option', () => {
  /**
   * This test verifies that when `memory.options.readOnly: true` is passed to `.stream()`,
   * no messages are saved to memory.
   */
  it('should NOT save messages when memory.options.readOnly is true in stream()', async () => {
    const threadId = globalThis.crypto.randomUUID();
    const resourceId = 'user-readonly-test';

    const mockMemory = new MockMemory();
    const saveMessagesSpy = vi.spyOn(mockMemory, 'saveMessages');

    const agent = new Agent({
      id: 'readonly-test-agent',
      name: 'ReadOnly Test Agent',
      instructions: 'You are a helpful assistant.',
      model: createSimpleMockModel(),
      memory: mockMemory,
    });

    // Create the thread first
    await mockMemory.createThread({
      threadId,
      resourceId,
    });

    // Call stream with options.readOnly: true
    const response = await agent.stream('Hello!', {
      memory: {
        thread: threadId,
        resource: resourceId,
        options: {
          readOnly: true, // This should prevent any writes to memory
        },
      },
    });

    await response.consumeStream();

    // Verify that saveMessages was NOT called
    expect(saveMessagesSpy).not.toHaveBeenCalled();

    // Verify no messages were saved
    const result = await mockMemory.recall({ threadId, resourceId });
    expect(result.messages.length).toBe(0);
  });

  /**
   * Same test but for generate() method
   */
  it('should NOT save messages when memory.options.readOnly is true in generate()', async () => {
    const threadId = globalThis.crypto.randomUUID();
    const resourceId = 'user-readonly-test-generate';

    const mockMemory = new MockMemory();
    const saveMessagesSpy = vi.spyOn(mockMemory, 'saveMessages');

    const agent = new Agent({
      id: 'readonly-test-agent-generate',
      name: 'ReadOnly Test Agent',
      instructions: 'You are a helpful assistant.',
      model: createSimpleMockModel(),
      memory: mockMemory,
    });

    // Create the thread first
    await mockMemory.createThread({
      threadId,
      resourceId,
    });

    // Call generate with options.readOnly: true
    await agent.generate('Hello!', {
      memory: {
        thread: threadId,
        resource: resourceId,
        options: {
          readOnly: true, // This should prevent any writes to memory
        },
      },
    });

    // Verify that saveMessages was NOT called
    expect(saveMessagesSpy).not.toHaveBeenCalled();

    // Verify no messages were saved
    const result = await mockMemory.recall({ threadId, resourceId });
    expect(result.messages.length).toBe(0);
  });

  /**
   * Verify that without readOnly, messages ARE saved (control test)
   */
  it('should save messages when memory.options.readOnly is NOT set', async () => {
    const threadId = globalThis.crypto.randomUUID();
    const resourceId = 'user-save-test';

    const mockMemory = new MockMemory();

    const agent = new Agent({
      id: 'save-test-agent',
      name: 'Save Test Agent',
      instructions: 'You are a helpful assistant.',
      model: createSimpleMockModel(),
      memory: mockMemory,
    });

    // Call stream WITHOUT readOnly (should save)
    const response = await agent.stream('Hello!', {
      memory: {
        thread: threadId,
        resource: resourceId,
        // No readOnly flag - messages should be saved
      },
    });

    await response.consumeStream();

    // Verify messages were saved (MessageHistory processor saves via storage directly)
    const result = await mockMemory.recall({ threadId, resourceId });
    expect(result.messages.length).toBeGreaterThan(0);

    // Verify we have both user and assistant messages
    const userMessages = result.messages.filter(m => m.role === 'user');
    const assistantMessages = result.messages.filter(m => m.role === 'assistant');
    expect(userMessages.length).toBeGreaterThan(0);
    expect(assistantMessages.length).toBeGreaterThan(0);
  });

  /**
   * Verify that readOnly: true still allows reading from memory
   */
  it('should still read from memory when options.readOnly is true', async () => {
    const threadId = globalThis.crypto.randomUUID();
    const resourceId = 'user-readonly-read-test';

    const mockMemory = new MockMemory();

    const agent = new Agent({
      id: 'readonly-read-test-agent',
      name: 'ReadOnly Read Test Agent',
      instructions: 'You are a helpful assistant.',
      model: createSimpleMockModel(),
      memory: mockMemory,
    });

    // First, save some messages to memory (without readOnly)
    const response1 = await agent.stream('Hello, my name is Alice!', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });
    await response1.consumeStream();

    // Verify first message was saved
    const result1 = await mockMemory.recall({ threadId, resourceId });
    expect(result1.messages.length).toBeGreaterThan(0);

    const messageCountBefore = result1.messages.length;

    // Now make a second request with options.readOnly: true
    // It should be able to READ the previous messages but NOT save new ones
    const saveMessagesSpy = vi.spyOn(mockMemory, 'saveMessages');

    const response2 = await agent.stream('What is my name?', {
      memory: {
        thread: threadId,
        resource: resourceId,
        options: {
          readOnly: true,
          lastMessages: 10, // Should retrieve previous messages
        },
      },
    });
    await response2.consumeStream();

    // Verify that saveMessages was NOT called for the second request
    expect(saveMessagesSpy).not.toHaveBeenCalled();

    // Verify the message count didn't change
    const result2 = await mockMemory.recall({ threadId, resourceId });
    expect(result2.messages.length).toBe(messageCountBefore);
  });

  /**
   * Verify that savePerStep also respects readOnly flag
   */
  it('should NOT save messages with savePerStep when memory.options.readOnly is true', async () => {
    const threadId = globalThis.crypto.randomUUID();
    const resourceId = 'user-readonly-savePerStep';

    const mockMemory = new MockMemory();
    const saveMessagesSpy = vi.spyOn(mockMemory, 'saveMessages');

    const agent = new Agent({
      id: 'readonly-savePerStep-agent',
      name: 'ReadOnly SavePerStep Agent',
      instructions: 'You are a helpful assistant.',
      model: createSimpleMockModel(),
      memory: mockMemory,
    });

    // Create the thread first
    await mockMemory.createThread({
      threadId,
      resourceId,
    });

    // Call stream with options.readOnly: true AND savePerStep: true
    const response = await agent.stream('Hello!', {
      memory: {
        thread: threadId,
        resource: resourceId,
        options: {
          readOnly: true,
        },
      },
      savePerStep: true, // Even with savePerStep, readOnly should be respected
    });

    await response.consumeStream();

    // Verify that saveMessages was NOT called
    expect(saveMessagesSpy).not.toHaveBeenCalled();

    // Verify no messages were saved
    const result = await mockMemory.recall({ threadId, resourceId });
    expect(result.messages.length).toBe(0);
  });
});

describe('Memory readOnly option on resume', () => {
  function createToolCallingModel() {
    let call = 0;
    let genCall = 0;
    return new MockLanguageModelV2({
      doGenerate: async () => {
        genCall++;
        const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
        return genCall === 1
          ? {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'tool-calls' as const,
              usage,
              content: [{ type: 'tool-call' as const, toolCallId: 'call-1', toolName: 'ask', input: '{}' }],
              warnings: [],
            }
          : {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop' as const,
              usage,
              content: [{ type: 'text' as const, text: 'done' }],
              warnings: [],
            };
      },
      doStream: async () => {
        call++;
        const chunks: any[] =
          call === 1
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'r1', modelId: 'mock-model', timestamp: new Date(0) },
                { type: 'tool-call', toolCallId: 'call-1', toolName: 'ask', input: '{}' },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'r2', modelId: 'mock-model', timestamp: new Date(0) },
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: 'done' },
                { type: 'text-end', id: 't' },
                { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
              ];
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream(chunks),
        };
      },
    });
  }

  async function setup() {
    const threadId = globalThis.crypto.randomUUID();
    const resourceId = 'user-readonly-resume';
    const storage = new InMemoryStore();
    const memory = new MockMemory({ storage });
    const rowsSeenInTool: number[] = [];
    const ask = createTool({
      id: 'ask',
      description: 'asks a person',
      inputSchema: z.object({}),
      suspendSchema: z.object({ question: z.string() }),
      resumeSchema: z.object({ answer: z.string() }),
      execute: async (_input, ctx) => {
        const resumeData = ctx?.agent?.resumeData;
        if (!resumeData) {
          await ctx?.agent?.suspend?.({ question: 'ok?' });
          return;
        }
        expect(ctx?.agent?.flushMessages).toBeUndefined();
        rowsSeenInTool.push((await memory.recall({ threadId, resourceId })).messages.length);
        return { answer: resumeData.answer };
      },
    });
    const agent = new Agent({
      id: 'readonly-resume-agent',
      name: 'ReadOnly Resume Agent',
      instructions: 'test',
      model: createToolCallingModel(),
      memory,
      tools: { ask },
    });
    new Mastra({ agents: { agent }, storage, logger: false });
    await memory.createThread({ threadId, resourceId });
    const memoryOption = { thread: threadId, resource: resourceId, options: { readOnly: true } };
    return { agent, memory, threadId, resourceId, rowsSeenInTool, memoryOption };
  }

  it('resumeGenerate() does not save messages when readOnly is true', async () => {
    const { agent, memory, threadId, resourceId, rowsSeenInTool, memoryOption } = await setup();
    const first = await agent.generate('Hi', { memory: memoryOption });
    expect(first.finishReason).toBe('suspended');
    expect((await memory.recall({ threadId, resourceId })).messages).toHaveLength(0);

    const resumed = await agent.resumeGenerate({ answer: 'yes' }, { runId: first.runId!, memory: memoryOption });
    expect(resumed.text).toBe('done');
    expect(rowsSeenInTool).toEqual([0]);
    expect((await memory.recall({ threadId, resourceId })).messages).toHaveLength(0);
  });

  it('resumeStream() does not save messages when readOnly is true', async () => {
    const { agent, memory, threadId, resourceId, rowsSeenInTool, memoryOption } = await setup();
    const first = await agent.stream('Hi', { memory: memoryOption });
    await first.consumeStream();
    expect((await memory.recall({ threadId, resourceId })).messages).toHaveLength(0);

    const resumed = await agent.resumeStream({ answer: 'yes' }, { runId: first.runId, memory: memoryOption });
    expect(await resumed.text).toBe('done');
    expect(rowsSeenInTool).toEqual([0]);
    expect((await memory.recall({ threadId, resourceId })).messages).toHaveLength(0);
  });
});
