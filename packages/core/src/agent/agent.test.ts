import { PassThrough } from 'stream';
import { createOpenAI } from '@ai-sdk/openai';
import type { CoreMessage } from 'ai';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV1 } from 'ai/test';
import { config } from 'dotenv';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { TestIntegration } from '../integration/openapi-toolset.mock';
import { noopLogger } from '../logger';
import { Mastra } from '../mastra';
import { MastraMemory } from '../memory';
import type { StorageThreadType, MemoryConfig, MastraMessageV1 } from '../memory';
import type { Processor } from '../processors/index';
import { RuntimeContext } from '../runtime-context';
import type { StorageGetMessagesArg } from '../storage';
import { createTool } from '../tools';
import { CompositeVoice, MastraVoice } from '../voice';
import { MessageList } from './message-list/index';
import type { MastraMessageV2 } from './types';
import { Agent } from './index';

config();

class MockMemory extends MastraMemory {
  threads: Record<string, StorageThreadType> = {};
  messages: Map<string, MastraMessageV1 | MastraMessageV2> = new Map();

  constructor() {
    super({ name: 'mock' });
    Object.defineProperty(this, 'storage', {
      get: () => ({
        init: async () => {},
        getThreadById: this.getThreadById.bind(this),
        saveThread: async ({ thread }: { thread: StorageThreadType }) => {
          return this.saveThread({ thread });
        },
        getMessages: this.getMessages.bind(this),
        saveMessages: this.saveMessages.bind(this),
      }),
    });
    this._hasOwnStorage = true;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    return this.threads[threadId] || null;
  }

  async saveThread({ thread }: { thread: StorageThreadType; memoryConfig?: MemoryConfig }): Promise<StorageThreadType> {
    const newThread = { ...thread, updatedAt: new Date() };
    if (!newThread.createdAt) {
      newThread.createdAt = new Date();
    }
    this.threads[thread.id] = newThread;
    return this.threads[thread.id];
  }

  // Overloads for getMessages
  async getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
  async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  async getMessages(
    args: StorageGetMessagesArg & { format?: 'v1' | 'v2' },
  ): Promise<MastraMessageV1[] | MastraMessageV2[]>;

  // Implementation for getMessages
  async getMessages({
    threadId,
    resourceId,
    format = 'v1',
  }: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    let results = Array.from(this.messages.values());
    if (threadId) results = results.filter(m => m.threadId === threadId);
    if (resourceId) results = results.filter(m => m.resourceId === resourceId);
    if (format === 'v2') return results as MastraMessageV2[];
    return results as MastraMessageV1[];
  }

  // saveMessages for both v1 and v2
  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  async saveMessages(
    args: { messages: MastraMessageV1[]; format?: undefined | 'v1' } | { messages: MastraMessageV2[]; format: 'v2' },
  ): Promise<MastraMessageV2[] | MastraMessageV1[]> {
    const { messages } = args as any;
    for (const msg of messages) {
      const existing = this.messages.get(msg.id);
      if (existing) {
        this.messages.set(msg.id, {
          ...existing,
          ...msg,
          createdAt: existing.createdAt,
        });
      } else {
        this.messages.set(msg.id, msg);
      }
    }
    return messages;
  }
  async rememberMessages() {
    return { messages: [], messagesV2: [] };
  }
  async getThreadsByResourceId() {
    return [];
  }
  async query() {
    return { messages: [], uiMessages: [] };
  }
  async deleteThread(threadId: string) {
    delete this.threads[threadId];
  }

  async deleteMessages(messageIds: string[]) {
    // Simple implementation for testing - just clear messages for the thread
    const threadMessages = Array.from(this.messages.entries()).filter(([key]) => messageIds.includes(key));
    threadMessages.forEach(([key]) => this.messages.delete(key));
  }

  // Add missing method implementations
  async getWorkingMemory() {
    return null;
  }

  async getWorkingMemoryTemplate() {
    return null;
  }

  getMergedThreadConfig(config?: MemoryConfig) {
    return config || {};
  }

  async updateWorkingMemory({
    threadId: _threadId,
    resourceId: _resourceId,
    workingMemory: _workingMemory,
    memoryConfig: _memoryConfig,
  }: {
    threadId: string;
    resourceId?: string;
    workingMemory: string;
    memoryConfig?: MemoryConfig;
  }) {
    // Mock implementation - just return void
    return;
  }

  async __experimental_updateWorkingMemoryVNext({
    threadId: _threadId,
    resourceId: _resourceId,
    workingMemory: _workingMemory,
    searchString: _searchString,
    memoryConfig: _memoryConfig,
  }: {
    threadId: string;
    resourceId?: string;
    workingMemory: string;
    searchString?: string;
    memoryConfig?: MemoryConfig;
  }) {
    // Mock implementation for abstract method
    return { success: true, reason: 'Mock implementation' };
  }
}

const mockFindUser = vi.fn().mockImplementation(async data => {
  const list = [
    { name: 'Dero Israel', email: 'dero@mail.com' },
    { name: 'Ife Dayo', email: 'dayo@mail.com' },
    { name: 'Tao Feeq', email: 'feeq@mail.com' },
    { name: 'Joe', email: 'joe@mail.com' },
  ];

  const userInfo = list?.find(({ name }) => name === (data as { name: string }).name);
  if (!userInfo) return { message: 'User not found' };
  return userInfo;
});

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

function assertNoDuplicateParts(parts: any[]) {
  // Check for duplicate tool-invocation results by toolCallId
  const seenToolResults = new Set();
  for (const part of parts) {
    if (part.type === 'tool-invocation' && part.toolInvocation.state === 'result') {
      const key = `${part.toolInvocation.toolCallId}|${JSON.stringify(part.toolInvocation.result)}`;
      expect(seenToolResults.has(key)).toBe(false);
      seenToolResults.add(key);
    }
  }

  // Check for duplicate text parts
  const seenTexts = new Set();
  for (const part of parts) {
    if (part.type === 'text') {
      expect(seenTexts.has(part.text)).toBe(false);
      seenTexts.add(part.text);
    }
  }
}

describe('agent', () => {
  const integration = new TestIntegration();

  let dummyModel: MockLanguageModelV1;
  beforeEach(() => {
    dummyModel = new MockLanguageModelV1({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        text: `Dummy response`,
      }),
    });
  });

  it('should get a text response from the agent', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: new MockLanguageModelV1({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: `Donald Trump won the 2016 U.S. presidential election, defeating Hillary Clinton.`,
        }),
      }),
    });

    const mastra = new Mastra({
      agents: { electionAgent },
      logger: false,
    });

    const agentOne = mastra.getAgent('electionAgent');

    const response = await agentOne.generate('Who won the 2016 US presidential election?');

    const { text, toolCalls } = response;

    expect(text).toContain('Donald Trump');
    expect(toolCalls.length).toBeLessThan(1);
  });

  it('should get a streamed text response from the agent', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: new MockLanguageModelV1({
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: [
              { type: 'text-delta', textDelta: 'Donald' },
              { type: 'text-delta', textDelta: ' Trump' },
              { type: 'text-delta', textDelta: ` won` },
              { type: 'text-delta', textDelta: ` the` },
              { type: 'text-delta', textDelta: ` ` },
              { type: 'text-delta', textDelta: `201` },
              { type: 'text-delta', textDelta: `6` },
              { type: 'text-delta', textDelta: ` US` },
              { type: 'text-delta', textDelta: ` presidential` },
              { type: 'text-delta', textDelta: ` election` },
              {
                type: 'finish',
                finishReason: 'stop',
                logprobs: undefined,
                usage: { completionTokens: 10, promptTokens: 3 },
              },
            ],
          }),
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      }),
    });

    const mastra = new Mastra({
      agents: { electionAgent },
      logger: false,
    });

    const agentOne = mastra.getAgent('electionAgent');

    const response = await agentOne.stream('Who won the 2016 US presidential election?');

    const { textStream } = response;

    let previousText = '';
    let finalText = '';
    for await (const textPart of textStream) {
      expect(textPart === previousText).toBe(false);
      previousText = textPart;
      finalText = finalText + previousText;
      expect(textPart).toBeDefined();
    }

    expect(finalText).toContain('Donald Trump');
  }, 500000);

  it('should get a structured response from the agent', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: `{"winner":"Barack Obama"}`,
        }),
      }),
    });

    const mastra = new Mastra({
      agents: { electionAgent },
      logger: false,
    });

    const agentOne = mastra.getAgent('electionAgent');

    const response = await agentOne.generate('Who won the 2012 US presidential election?', {
      output: z.object({
        winner: z.string(),
      }),
    });

    const { object } = response;
    expect(object.winner).toContain('Barack Obama');
  });

  it('should support ZodSchema structured output type', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      // model: openai('gpt-4o'),
      model: new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: `{"elements":[{"winner":"Barack Obama","year":"2012"},{"winner":"Donald Trump","year":"2016"}]}`,
        }),
      }),
    });

    const mastra = new Mastra({
      agents: { electionAgent },
      logger: false,
    });

    const agentOne = mastra.getAgent('electionAgent');

    const response = await agentOne.generate('Give me the winners of 2012 and 2016 US presidential elections', {
      output: z.array(
        z.object({
          winner: z.string(),
          year: z.string(),
        }),
      ),
    });

    const { object } = response;

    expect(object.length).toBeGreaterThan(1);
    expect(object).toMatchObject([
      {
        year: '2012',
        winner: 'Barack Obama',
      },
      {
        year: '2016',
        winner: 'Donald Trump',
      },
    ]);
  });

  it('should get a streamed structured response from the agent', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: [
              { type: 'text-delta', textDelta: '{' },
              { type: 'text-delta', textDelta: '"winner":' },
              { type: 'text-delta', textDelta: `"Barack Obama"` },
              { type: 'text-delta', textDelta: `}` },
              {
                type: 'finish',
                finishReason: 'stop',
                logprobs: undefined,
                usage: { completionTokens: 10, promptTokens: 3 },
              },
            ],
          }),
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      }),
    });

    const mastra = new Mastra({
      agents: { electionAgent },
      logger: false,
    });

    const agentOne = mastra.getAgent('electionAgent');

    const response = await agentOne.stream('Who won the 2012 US presidential election?', {
      output: z.object({
        winner: z.string(),
      }),
    });

    const { partialObjectStream } = response;

    let previousPartialObject = {} as { winner: string };
    for await (const partialObject of partialObjectStream) {
      if (partialObject!['winner'] && previousPartialObject['winner']) {
        expect(partialObject!['winner'] === previousPartialObject['winner']).toBe(false);
      }
      previousPartialObject = partialObject! as { winner: string };
      expect(partialObject).toBeDefined();
    }

    expect(previousPartialObject['winner']).toBe('Barack Obama');
  });

  it('should call findUserTool', async () => {
    const findUserTool = createTool({
      id: 'Find user tool',
      description: 'This is a test tool that returns the name and email',
      inputSchema: z.object({
        name: z.string(),
      }),
      execute: ({ context }) => {
        return mockFindUser(context) as Promise<Record<string, any>>;
      },
    });

    const userAgent = new Agent({
      name: 'User agent',
      instructions: 'You are an agent that can get list of users using findUserTool.',
      model: openai('gpt-4o'),
      tools: { findUserTool },
    });

    const mastra = new Mastra({
      agents: { userAgent },
      logger: false,
    });

    const agentOne = mastra.getAgent('userAgent');

    const response = await agentOne.generate('Find the user with name - Dero Israel', {
      maxSteps: 2,
      toolChoice: 'required',
    });

    const toolCall: any = response.toolResults.find((result: any) => result.toolName === 'findUserTool');

    const name = toolCall?.result?.name;

    expect(mockFindUser).toHaveBeenCalled();
    expect(name).toBe('Dero Israel');
  }, 500000);

  it('generate - should pass and call client side tools', async () => {
    const userAgent = new Agent({
      name: 'User agent',
      instructions: 'You are an agent that can get list of users using client side tools.',
      model: openai('gpt-4o'),
    });

    const result = await userAgent.generate('Make it green', {
      clientTools: {
        changeColor: {
          id: 'changeColor',
          description: 'This is a test tool that returns the name and email',
          inputSchema: z.object({
            color: z.string(),
          }),
          execute: async () => {},
        },
      },
    });

    expect(result.toolCalls.length).toBeGreaterThan(0);
  });

  it('generate - should pass and call client side tools with experimental output', async () => {
    const userAgent = new Agent({
      name: 'User agent',
      instructions: 'You are an agent that can get list of users using client side tools.',
      model: openai('gpt-4o'),
    });

    const result = await userAgent.generate('Make it green', {
      clientTools: {
        changeColor: {
          id: 'changeColor',
          description: 'This is a test tool that returns the name and email',
          inputSchema: z.object({
            color: z.string(),
          }),
          execute: async () => {
            console.log('SUHHH');
          },
        },
      },
      experimental_output: z.object({
        color: z.string(),
      }),
    });

    expect(result.toolCalls.length).toBeGreaterThan(0);
  });

  it('stream - should pass and call client side tools', async () => {
    const userAgent = new Agent({
      name: 'User agent',
      instructions: 'You are an agent that can get list of users using client side tools.',
      model: openai('gpt-4o'),
    });

    const result = await userAgent.stream('Make it green', {
      clientTools: {
        changeColor: {
          id: 'changeColor',
          description: 'This is a test tool that returns the name and email',
          inputSchema: z.object({
            color: z.string(),
          }),
          execute: async () => {},
        },
      },
      onFinish: props => {
        expect(props.toolCalls.length).toBeGreaterThan(0);
      },
    });

    for await (const _ of result.fullStream) {
    }

    expect(await result.finishReason).toBe('tool-calls');
  });

  it('streamVNext - should pass and call client side tools', async () => {
    const userAgent = new Agent({
      name: 'User agent',
      instructions: 'You are an agent that can get list of users using client side tools.',
      model: openai('gpt-4o'),
    });

    const result = await userAgent.streamVNext('Make it green', {
      clientTools: {
        changeColor: {
          id: 'changeColor',
          description: 'This is a test tool that returns the name and email',
          inputSchema: z.object({
            color: z.string(),
          }),
          execute: async () => {},
        },
      },
      onFinish: props => {
        expect(props.toolCalls.length).toBeGreaterThan(0);
      },
    });

    expect(await result.finishReason).toBe('tool-calls');
  });

  it('stream - should pass and call client side tools with experimental output', async () => {
    const userAgent = new Agent({
      name: 'User agent',
      instructions: 'You are an agent that can get list of users using client side tools.',
      model: openai('gpt-4o'),
    });

    const result = await userAgent.stream('Make it green', {
      clientTools: {
        changeColor: {
          id: 'changeColor',
          description: 'This is a test tool that returns the name and email',
          inputSchema: z.object({
            color: z.string(),
          }),
          execute: async () => {
            console.log('SUHHH');
          },
        },
      },
      onFinish: props => {
        expect(props.toolCalls.length).toBeGreaterThan(0);
      },
      experimental_output: z.object({
        color: z.string(),
      }),
    });

    for await (const _ of result.fullStream) {
    }
  });

  it('should generate with default max steps', { timeout: 10000 }, async () => {
    const findUserTool = createTool({
      id: 'Find user tool',
      description: 'This is a test tool that returns the name and email',
      inputSchema: z.object({
        name: z.string(),
      }),
      execute: async ({ context }) => {
        return mockFindUser(context) as Promise<Record<string, any>>;
      },
    });

    const userAgent = new Agent({
      name: 'User agent',
      instructions: 'You are an agent that can get list of users using findUserTool.',
      model: openai('gpt-4o'),
      tools: { findUserTool },
    });

    const mastra = new Mastra({
      agents: { userAgent },
      logger: false,
    });

    const agentOne = mastra.getAgent('userAgent');

    const res = await agentOne.generate(
      'Use the "findUserTool" to Find the user with name - Joe and return the name and email',
    );

    const toolCall: any = res.steps[0].toolResults.find((result: any) => result.toolName === 'findUserTool');

    expect(res.steps.length > 1);
    expect(res.text.includes('joe@mail.com'));
    expect(toolCall?.result?.email).toBe('joe@mail.com');
    expect(mockFindUser).toHaveBeenCalled();
  });

  it('should call testTool from TestIntegration', async () => {
    const testAgent = new Agent({
      name: 'Test agent',
      instructions: 'You are an agent that call testTool',
      model: openai('gpt-4o'),
      tools: integration.getStaticTools(),
    });

    const mastra = new Mastra({
      agents: {
        testAgent,
      },
      logger: false,
    });

    const agentOne = mastra.getAgent('testAgent');

    const response = await agentOne.generate('Call testTool', {
      toolChoice: 'required',
    });

    const toolCall: any = response.toolResults.find((result: any) => result.toolName === 'testTool');

    const message = toolCall?.result?.message;

    expect(message).toBe('Executed successfully');
  }, 500000);

  it('should reach default max steps', async () => {
    const agent = new Agent({
      name: 'Test agent',
      instructions: 'Test agent',
      model: openai('gpt-4o'),
      tools: integration.getStaticTools(),
      defaultGenerateOptions: {
        maxSteps: 7,
      },
    });

    const response = await agent.generate('Call testTool 10 times.', {
      toolChoice: 'required',
    });
    expect(response.steps.length).toBe(7);
  }, 500000);

  it('should properly sanitize incomplete tool calls from memory messages', () => {
    const messageList = new MessageList();
    // Original CoreMessages for context, but we'll test the output of list.get.all.core()
    const toolResultOne_Core: CoreMessage = {
      role: 'tool',
      content: [{ type: 'tool-result', toolName: 'test-tool-1', toolCallId: 'tool-1', result: 'res1' }],
    };
    const toolCallTwo_Core: CoreMessage = {
      role: 'assistant',
      content: [{ type: 'tool-call', toolName: 'test-tool-2', toolCallId: 'tool-2', args: {} }],
    };
    const toolResultTwo_Core: CoreMessage = {
      role: 'tool',
      content: [{ type: 'tool-result', toolName: 'test-tool-2', toolCallId: 'tool-2', result: 'res2' }],
    };
    const toolCallThree_Core: CoreMessage = {
      role: 'assistant',
      content: [{ type: 'tool-call', toolName: 'test-tool-3', toolCallId: 'tool-3', args: {} }],
    };

    // Add messages. addOne will merge toolCallTwo and toolResultTwo.
    // toolCallThree is orphaned.
    messageList.add(toolResultOne_Core, 'memory');
    messageList.add(toolCallTwo_Core, 'memory');
    messageList.add(toolResultTwo_Core, 'memory');
    messageList.add(toolCallThree_Core, 'memory');

    const finalCoreMessages = messageList.get.all.core();

    // Expected: toolCallThree (orphaned assistant call) should be gone.
    // toolResultOne assumes the tool call was completed, so should be present
    // toolCallTwo and toolResultTwo should be present and correctly paired by convertToCoreMessages.

    // Check that tool-1 is present, as a result assumes the tool call was completed
    expect(
      finalCoreMessages.find(
        m => m.role === 'tool' && (m.content as any[]).some(p => p.type === 'tool-result' && p.toolCallId === 'tool-1'),
      ),
    ).toBeDefined();

    // Check that tool-2 call and result are present
    const assistantCallForTool2 = finalCoreMessages.find(
      m =>
        m.role === 'assistant' && (m.content as any[]).some(p => p.type === 'tool-call' && p.toolCallId === 'tool-2'),
    );
    expect(assistantCallForTool2).toBeDefined();
    expect(assistantCallForTool2?.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'tool-call', toolCallId: 'tool-2', toolName: 'test-tool-2' }),
      ]),
    );

    const toolResultForTool2 = finalCoreMessages.find(
      m => m.role === 'tool' && (m.content as any[]).some(p => p.type === 'tool-result' && p.toolCallId === 'tool-2'),
    );
    expect(toolResultForTool2).toBeDefined();
    expect(toolResultForTool2?.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'tool-result', toolCallId: 'tool-2', toolName: 'test-tool-2', result: 'res2' }),
      ]),
    );

    // Check that tool-3 (orphaned call) is not present
    expect(
      finalCoreMessages.find(
        m =>
          m.role === 'assistant' && (m.content as any[]).some(p => p.type === 'tool-call' && p.toolCallId === 'tool-3'),
      ),
    ).toBeUndefined();

    expect(finalCoreMessages.length).toBe(4); // Assistant call for tool-1, Tool result for tool-1, Assistant call for tool-2, Tool result for tool-2
  });

  it('should preserve empty assistant messages after tool use', () => {
    const messageList = new MessageList();

    const assistantToolCall_Core: CoreMessage = {
      role: 'assistant',
      content: [{ type: 'tool-call', toolName: 'testTool', toolCallId: 'tool-1', args: {} }],
    };
    const toolMessage_Core: CoreMessage = {
      role: 'tool',
      content: [{ type: 'tool-result', toolName: 'testTool', toolCallId: 'tool-1', result: 'res1' }],
    };
    const emptyAssistant_Core: CoreMessage = {
      role: 'assistant',
      content: '',
    };
    const userMessage_Core: CoreMessage = {
      role: 'user',
      content: 'Hello',
    };

    messageList.add(assistantToolCall_Core, 'memory');
    messageList.add(toolMessage_Core, 'memory');
    messageList.add(emptyAssistant_Core, 'memory');
    messageList.add(userMessage_Core, 'memory');

    const finalCoreMessages = messageList.get.all.core();

    // Expected:
    // 1. Assistant message with tool-1 call.
    // 2. Tool message with tool-1 result.
    // 3. Empty assistant message.
    // 4. User message.
    expect(finalCoreMessages.length).toBe(4);

    const assistantCallMsg = finalCoreMessages.find(
      m =>
        m.role === 'assistant' && (m.content as any[]).some(p => p.type === 'tool-call' && p.toolCallId === 'tool-1'),
    );
    expect(assistantCallMsg).toBeDefined();

    const toolResultMsg = finalCoreMessages.find(
      m => m.role === 'tool' && (m.content as any[]).some(p => p.type === 'tool-result' && p.toolCallId === 'tool-1'),
    );
    expect(toolResultMsg).toBeDefined();

    expect(finalCoreMessages).toEqual(
      expect.arrayContaining([
        {
          role: 'assistant',
          content: [{ type: 'text', text: '' }],
        },
      ]),
    );

    const userMsg = finalCoreMessages.find(m => m.role === 'user');
    expect(userMsg).toBeDefined();
    expect(userMsg?.content).toEqual([{ type: 'text', text: 'Hello' }]); // convertToCoreMessages makes text content an array
  });

  it('should use custom model for title generation when provided in generateTitle config', async () => {
    // Track which model was used for title generation
    let titleModelUsed = false;
    let agentModelUsed = false;

    // Create a mock model for the agent's main model
    const agentModel = new MockLanguageModelV1({
      doGenerate: async () => {
        agentModelUsed = true;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: `Agent model response`,
        };
      },
    });

    // Create a different mock model for title generation
    const titleModel = new MockLanguageModelV1({
      doGenerate: async () => {
        titleModelUsed = true;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 5, completionTokens: 10 },
          text: `Custom Title Model Response`,
        };
      },
    });

    // Create memory with generateTitle config using custom model
    const mockMemory = new MockMemory();

    // Override getMergedThreadConfig to return our test config
    mockMemory.getMergedThreadConfig = () => {
      return {
        threads: {
          generateTitle: {
            model: titleModel,
          },
        },
      };
    };

    const agent = new Agent({
      name: 'title-test-agent',
      instructions: 'test agent for title generation',
      model: agentModel,
      memory: mockMemory,
    });

    // Generate a response that will trigger title generation
    await agent.generate('What is the weather like today?', {
      memory: {
        resource: 'user-1',
        thread: {
          id: 'thread-1',
          title: 'New Thread 2024-01-01T00:00:00.000Z', // Starts with "New Thread" to trigger title generation
        },
      },
    });

    // The agent's main model should have been used for the response
    expect(agentModelUsed).toBe(true);

    // Give some time for the async title generation to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // The custom title model should have been used for title generation
    expect(titleModelUsed).toBe(true);

    // Verify the thread was created
    const thread = await mockMemory.getThreadById({ threadId: 'thread-1' });
    expect(thread).toBeDefined();
    expect(thread?.resourceId).toBe('user-1');
    expect(thread?.title).toBe('Custom Title Model Response');
  });

  it('should support dynamic model selection for title generation', async () => {
    let usedModelName = '';

    // Create two different models
    const premiumModel = new MockLanguageModelV1({
      doGenerate: async () => {
        usedModelName = 'premium';
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 5, completionTokens: 10 },
          text: `Premium Title`,
        };
      },
    });

    const standardModel = new MockLanguageModelV1({
      doGenerate: async () => {
        usedModelName = 'standard';
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 5, completionTokens: 10 },
          text: `Standard Title`,
        };
      },
    });

    const mockMemory = new MockMemory();

    // Override getMergedThreadConfig to return dynamic model selection
    mockMemory.getMergedThreadConfig = () => {
      return {
        threads: {
          generateTitle: {
            model: ({ runtimeContext }: { runtimeContext: RuntimeContext }) => {
              const userTier = runtimeContext.get('userTier');
              return userTier === 'premium' ? premiumModel : standardModel;
            },
          },
        },
      };
    };

    const agent = new Agent({
      name: 'dynamic-title-agent',
      instructions: 'test agent',
      model: dummyModel,
      memory: mockMemory,
    });

    // Generate with premium context
    const runtimeContext = new RuntimeContext();
    runtimeContext.set('userTier', 'premium');

    await agent.generate('Test message', {
      memory: {
        resource: 'user-1',
        thread: {
          id: 'thread-premium',
          title: 'New Thread 2024-01-01T00:00:00.000Z',
        },
      },
      runtimeContext,
    });

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(usedModelName).toBe('premium');

    // Reset and test with standard tier
    usedModelName = '';
    const standardContext = new RuntimeContext();
    standardContext.set('userTier', 'standard');

    await agent.generate('Test message', {
      memory: {
        resource: 'user-2',
        thread: {
          id: 'thread-standard',
          title: 'New Thread 2024-01-01T00:00:00.000Z',
        },
      },
      runtimeContext: standardContext,
    });

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(usedModelName).toBe('standard');
  });

  it('should allow agent model to be updated', async () => {
    let usedModelName = '';

    // Create two different models
    const premiumModel = new MockLanguageModelV1({
      doGenerate: async () => {
        usedModelName = 'premium';
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 5, completionTokens: 10 },
          text: `Premium Title`,
        };
      },
    });

    const standardModel = new MockLanguageModelV1({
      doGenerate: async () => {
        usedModelName = 'standard';
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 5, completionTokens: 10 },
          text: `Standard Title`,
        };
      },
    });

    const agent = new Agent({
      name: 'update-model-agent',
      instructions: 'test agent',
      model: standardModel,
    });

    await agent.generate('Test message');

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(usedModelName).toBe('standard');

    agent.__updateModel({ model: premiumModel });
    usedModelName = '';

    await agent.generate('Test message');

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(usedModelName).toBe('premium');
  });

  it('should handle boolean generateTitle config for backward compatibility', async () => {
    let titleGenerationCallCount = 0;
    let agentCallCount = 0;

    const mockMemory = new MockMemory();

    // Test with generateTitle: true
    mockMemory.getMergedThreadConfig = () => {
      return {
        threads: {
          generateTitle: true,
        },
      };
    };

    const agent = new Agent({
      name: 'boolean-title-agent',
      instructions: 'test agent',
      model: new MockLanguageModelV1({
        doGenerate: async options => {
          // Check if this is for title generation based on the prompt
          const messages = options.prompt;
          const isForTitle = messages.some((msg: any) => msg.content?.includes?.('you will generate a short title'));

          if (isForTitle) {
            titleGenerationCallCount++;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: `Generated Title`,
            };
          } else {
            agentCallCount++;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 20 },
              text: `Agent Response`,
            };
          }
        },
      }),
      memory: mockMemory,
    });

    await agent.generate('Test message', {
      memory: {
        resource: 'user-1',
        thread: {
          id: 'thread-bool',
          title: 'New Thread 2024-01-01T00:00:00.000Z',
        },
      },
    });

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(titleGenerationCallCount).toBe(1);

    // Test with generateTitle: false
    titleGenerationCallCount = 0;
    agentCallCount = 0;
    mockMemory.getMergedThreadConfig = () => {
      return {
        threads: {
          generateTitle: false,
        },
      };
    };

    await agent.generate('Test message', {
      memory: {
        resource: 'user-2',
        thread: {
          id: 'thread-bool-false',
          title: 'New Thread 2024-01-01T00:00:00.000Z',
        },
      },
    });

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(titleGenerationCallCount).toBe(0); // No title generation should happen
    expect(agentCallCount).toBe(1); // But main agent should still be called
  });

  it('should handle errors in title generation gracefully', async () => {
    const mockMemory = new MockMemory();

    // Pre-create the thread with the expected title
    const originalTitle = 'New Thread 2024-01-01T00:00:00.000Z';
    await mockMemory.saveThread({
      thread: {
        id: 'thread-error',
        title: originalTitle,
        resourceId: 'user-1',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      },
    });

    mockMemory.getMergedThreadConfig = () => {
      return {
        threads: {
          generateTitle: {
            model: new MockLanguageModelV1({
              doGenerate: async () => {
                throw new Error('Title generation failed');
              },
            }),
          },
        },
      };
    };

    const agent = new Agent({
      name: 'error-title-agent',
      instructions: 'test agent',
      model: dummyModel,
      memory: mockMemory,
    });
    agent.__setLogger(noopLogger);

    // This should not throw, title generation happens async
    await agent.generate('Test message', {
      memory: {
        resource: 'user-1',
        thread: {
          id: 'thread-error',
          title: originalTitle,
        },
      },
    });

    // Give time for async title generation
    await new Promise(resolve => setTimeout(resolve, 100));

    // Thread should still exist with the original title (preserved when generation fails)
    const thread = await mockMemory.getThreadById({ threadId: 'thread-error' });
    expect(thread).toBeDefined();
    expect(thread?.title).toBe(originalTitle);
  });

  it('should not generate title when config is undefined or null', async () => {
    let titleGenerationCallCount = 0;
    let agentCallCount = 0;
    const mockMemory = new MockMemory();

    // Test with undefined config
    mockMemory.getMergedThreadConfig = () => {
      return {};
    };

    const agent = new Agent({
      name: 'undefined-config-agent',
      instructions: 'test agent',
      model: new MockLanguageModelV1({
        doGenerate: async options => {
          // Check if this is for title generation based on the prompt
          const messages = options.prompt;
          const isForTitle = messages.some((msg: any) => msg.content?.includes?.('you will generate a short title'));

          if (isForTitle) {
            titleGenerationCallCount++;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: `Should not be called`,
            };
          } else {
            agentCallCount++;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 20 },
              text: `Agent Response`,
            };
          }
        },
      }),
      memory: mockMemory,
    });

    await agent.generate('Test message', {
      memory: {
        resource: 'user-1',
        thread: {
          id: 'thread-undefined',
          title: 'New Thread 2024-01-01T00:00:00.000Z',
        },
      },
    });

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(titleGenerationCallCount).toBe(0); // No title generation should happen
    expect(agentCallCount).toBe(1); // But main agent should still be called
  });

  it('should use custom instructions for title generation when provided in generateTitle config', async () => {
    let capturedPrompt = '';
    const customInstructions = 'Generate a creative and engaging title based on the conversation';

    const mockMemory = new MockMemory();

    // Override getMergedThreadConfig to return our test config with custom instructions
    mockMemory.getMergedThreadConfig = () => {
      return {
        threads: {
          generateTitle: {
            model: new MockLanguageModelV1({
              doGenerate: async options => {
                // Capture the prompt to verify custom instructions are used
                const messages = options.prompt;
                const systemMessage = messages.find((msg: any) => msg.role === 'system');
                if (systemMessage) {
                  capturedPrompt =
                    typeof systemMessage.content === 'string'
                      ? systemMessage.content
                      : JSON.stringify(systemMessage.content);
                }
                return {
                  rawCall: { rawPrompt: null, rawSettings: {} },
                  finishReason: 'stop',
                  usage: { promptTokens: 5, completionTokens: 10 },
                  text: `Creative Custom Title`,
                };
              },
            }),
            instructions: customInstructions,
          },
        },
      };
    };

    const agent = new Agent({
      name: 'custom-instructions-agent',
      instructions: 'test agent',
      model: dummyModel,
      memory: mockMemory,
    });

    await agent.generate('What is the weather like today?', {
      memory: {
        resource: 'user-1',
        thread: {
          id: 'thread-custom-instructions',
          title: 'New Thread 2024-01-01T00:00:00.000Z',
        },
      },
    });

    // Give some time for the async title generation to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify the custom instructions were used
    expect(capturedPrompt).toBe(customInstructions);

    // Verify the thread was updated with the custom title
    const thread = await mockMemory.getThreadById({ threadId: 'thread-custom-instructions' });
    expect(thread).toBeDefined();
    expect(thread?.resourceId).toBe('user-1');
    expect(thread?.title).toBe('Creative Custom Title');
  });

  it('should support dynamic instructions selection for title generation', async () => {
    let capturedPrompt = '';
    let usedLanguage = '';

    const mockMemory = new MockMemory();

    // Override getMergedThreadConfig to return dynamic instructions selection
    mockMemory.getMergedThreadConfig = () => {
      return {
        threads: {
          generateTitle: {
            model: new MockLanguageModelV1({
              doGenerate: async options => {
                const messages = options.prompt;
                const systemMessage = messages.find((msg: any) => msg.role === 'system');
                if (systemMessage) {
                  capturedPrompt =
                    typeof systemMessage.content === 'string'
                      ? systemMessage.content
                      : JSON.stringify(systemMessage.content);
                }

                if (capturedPrompt.includes('簡潔なタイトル')) {
                  usedLanguage = 'ja';
                  return {
                    rawCall: { rawPrompt: null, rawSettings: {} },
                    finishReason: 'stop',
                    usage: { promptTokens: 5, completionTokens: 10 },
                    text: `日本語のタイトル`,
                  };
                } else {
                  usedLanguage = 'en';
                  return {
                    rawCall: { rawPrompt: null, rawSettings: {} },
                    finishReason: 'stop',
                    usage: { promptTokens: 5, completionTokens: 10 },
                    text: `English Title`,
                  };
                }
              },
            }),
            instructions: ({ runtimeContext }: { runtimeContext: RuntimeContext }) => {
              const language = runtimeContext.get('language');
              return language === 'ja'
                ? '会話内容に基づいて簡潔なタイトルを生成してください'
                : 'Generate a concise title based on the conversation';
            },
          },
        },
      };
    };

    const agent = new Agent({
      name: 'dynamic-instructions-agent',
      instructions: 'test agent',
      model: dummyModel,
      memory: mockMemory,
    });

    // Test with Japanese context
    const japaneseContext = new RuntimeContext();
    japaneseContext.set('language', 'ja');

    await agent.generate('Test message', {
      memory: {
        resource: 'user-1',
        thread: {
          id: 'thread-ja',
          title: 'New Thread 2024-01-01T00:00:00.000Z',
        },
      },
      runtimeContext: japaneseContext,
    });

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(usedLanguage).toBe('ja');
    expect(capturedPrompt).toContain('簡潔なタイトル');

    // Reset and test with English context
    capturedPrompt = '';
    usedLanguage = '';
    const englishContext = new RuntimeContext();
    englishContext.set('language', 'en');

    await agent.generate('Test message', {
      memory: {
        resource: 'user-2',
        thread: {
          id: 'thread-en',
          title: 'New Thread 2024-01-01T00:00:00.000Z',
        },
      },
      runtimeContext: englishContext,
    });

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(usedLanguage).toBe('en');
    expect(capturedPrompt).toContain('Generate a concise title based on the conversation');
  });

  it('should use default instructions when instructions config is undefined', async () => {
    let capturedPrompt = '';

    const mockMemory = new MockMemory();

    mockMemory.getMergedThreadConfig = () => {
      return {
        threads: {
          generateTitle: {
            model: new MockLanguageModelV1({
              doGenerate: async options => {
                const messages = options.prompt;
                const systemMessage = messages.find((msg: any) => msg.role === 'system');
                if (systemMessage) {
                  capturedPrompt =
                    typeof systemMessage.content === 'string'
                      ? systemMessage.content
                      : JSON.stringify(systemMessage.content);
                }
                return {
                  rawCall: { rawPrompt: null, rawSettings: {} },
                  finishReason: 'stop',
                  usage: { promptTokens: 5, completionTokens: 10 },
                  text: `Default Title`,
                };
              },
            }),
            // instructions field is intentionally omitted
          },
        },
      };
    };

    const agent = new Agent({
      name: 'default-instructions-agent',
      instructions: 'test agent',
      model: dummyModel,
      memory: mockMemory,
    });

    await agent.generate('Test message', {
      memory: {
        resource: 'user-1',
        thread: {
          id: 'thread-default',
          title: 'New Thread 2024-01-01T00:00:00.000Z',
        },
      },
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify that default instructions were used
    expect(capturedPrompt).toContain('you will generate a short title');
    expect(capturedPrompt).toContain('ensure it is not more than 80 characters long');

    const thread = await mockMemory.getThreadById({ threadId: 'thread-default' });
    expect(thread).toBeDefined();
    expect(thread?.title).toBe('Default Title');
  });

  it('should handle errors in dynamic instructions gracefully', async () => {
    const mockMemory = new MockMemory();

    // Pre-create the thread with the expected title
    const originalTitle = 'New Thread 2024-01-01T00:00:00.000Z';
    await mockMemory.saveThread({
      thread: {
        id: 'thread-instructions-error',
        title: originalTitle,
        resourceId: 'user-1',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      },
    });

    mockMemory.getMergedThreadConfig = () => {
      return {
        threads: {
          generateTitle: {
            model: new MockLanguageModelV1({
              doGenerate: async () => {
                return {
                  rawCall: { rawPrompt: null, rawSettings: {} },
                  finishReason: 'stop',
                  usage: { promptTokens: 5, completionTokens: 10 },
                  text: `Title with error handling`,
                };
              },
            }),
            instructions: () => {
              throw new Error('Instructions selection failed');
            },
          },
        },
      };
    };

    const agent = new Agent({
      name: 'error-instructions-agent',
      instructions: 'test agent',
      model: dummyModel,
      memory: mockMemory,
    });
    agent.__setLogger(noopLogger);

    // This should not throw, title generation happens async
    await agent.generate('Test message', {
      memory: {
        resource: 'user-1',
        thread: {
          id: 'thread-instructions-error',
          title: originalTitle,
        },
      },
    });

    // Give time for async title generation
    await new Promise(resolve => setTimeout(resolve, 100));

    // Thread should still exist with the original title (preserved when generation fails)
    const thread = await mockMemory.getThreadById({ threadId: 'thread-instructions-error' });
    expect(thread).toBeDefined();
    expect(thread?.title).toBe(originalTitle);
  });

  it('should handle empty or null instructions appropriately', async () => {
    let capturedPrompt = '';

    const mockMemory = new MockMemory();

    // Test with empty string instructions
    mockMemory.getMergedThreadConfig = () => {
      return {
        threads: {
          generateTitle: {
            model: new MockLanguageModelV1({
              doGenerate: async options => {
                const messages = options.prompt;
                const systemMessage = messages.find((msg: any) => msg.role === 'system');
                if (systemMessage) {
                  capturedPrompt =
                    typeof systemMessage.content === 'string'
                      ? systemMessage.content
                      : JSON.stringify(systemMessage.content);
                }
                return {
                  rawCall: { rawPrompt: null, rawSettings: {} },
                  finishReason: 'stop',
                  usage: { promptTokens: 5, completionTokens: 10 },
                  text: `Title with default instructions`,
                };
              },
            }),
            instructions: '', // Empty string
          },
        },
      };
    };

    const agent = new Agent({
      name: 'empty-instructions-agent',
      instructions: 'test agent',
      model: dummyModel,
      memory: mockMemory,
    });

    agent.__setLogger(noopLogger);

    await agent.generate('Test message', {
      memory: {
        resource: 'user-1',
        thread: {
          id: 'thread-empty-instructions',
          title: 'New Thread 2024-01-01T00:00:00.000Z',
        },
      },
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify that default instructions were used when empty string was provided
    expect(capturedPrompt).toContain('you will generate a short title');

    // Test with null instructions (via dynamic function)
    capturedPrompt = '';
    mockMemory.getMergedThreadConfig = () => {
      return {
        threads: {
          generateTitle: {
            model: new MockLanguageModelV1({
              doGenerate: async options => {
                const messages = options.prompt;
                const systemMessage = messages.find((msg: any) => msg.role === 'system');
                if (systemMessage) {
                  capturedPrompt =
                    typeof systemMessage.content === 'string'
                      ? systemMessage.content
                      : JSON.stringify(systemMessage.content);
                }
                return {
                  rawCall: { rawPrompt: null, rawSettings: {} },
                  finishReason: 'stop',
                  usage: { promptTokens: 5, completionTokens: 10 },
                  text: `Title with null instructions`,
                };
              },
            }),
            instructions: () => '', // Function returning empty string
          },
        },
      };
    };

    await agent.generate('Test message', {
      memory: {
        resource: 'user-2',
        thread: {
          id: 'thread-null-instructions',
          title: 'New Thread 2024-01-01T00:00:00.000Z',
        },
      },
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify that default instructions were used when null was returned
    expect(capturedPrompt).toContain('you will generate a short title');
  });

  describe('voice capabilities', () => {
    class MockVoice extends MastraVoice {
      async speak(): Promise<NodeJS.ReadableStream> {
        const stream = new PassThrough();
        stream.end('mock audio');
        return stream;
      }

      async listen(): Promise<string> {
        return 'mock transcription';
      }

      async getSpeakers() {
        return [{ voiceId: 'mock-voice' }];
      }
    }

    let voiceAgent: Agent;
    beforeEach(() => {
      voiceAgent = new Agent({
        name: 'Voice Agent',
        instructions: 'You are an agent with voice capabilities',
        model: dummyModel,
        voice: new CompositeVoice({
          output: new MockVoice({
            speaker: 'mock-voice',
          }),
          input: new MockVoice({
            speaker: 'mock-voice',
          }),
        }),
      });
    });

    describe('getSpeakers', () => {
      it('should list available voices', async () => {
        const speakers = await voiceAgent.voice?.getSpeakers();
        expect(speakers).toEqual([{ voiceId: 'mock-voice' }]);
      });
    });

    describe('speak', () => {
      it('should generate audio stream from text', async () => {
        const audioStream = await voiceAgent.voice?.speak('Hello World', {
          speaker: 'mock-voice',
        });

        if (!audioStream) {
          expect(audioStream).toBeDefined();
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of audioStream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const audioBuffer = Buffer.concat(chunks);

        expect(audioBuffer.toString()).toBe('mock audio');
      });

      it('should work with different parameters', async () => {
        const audioStream = await voiceAgent.voice?.speak('Test with parameters', {
          speaker: 'mock-voice',
          speed: 0.5,
        });

        if (!audioStream) {
          expect(audioStream).toBeDefined();
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of audioStream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const audioBuffer = Buffer.concat(chunks);

        expect(audioBuffer.toString()).toBe('mock audio');
      });
    });

    describe('listen', () => {
      it('should transcribe audio', async () => {
        const audioStream = new PassThrough();
        audioStream.end('test audio data');

        const text = await voiceAgent.voice?.listen(audioStream);
        expect(text).toBe('mock transcription');
      });

      it('should accept options', async () => {
        const audioStream = new PassThrough();
        audioStream.end('test audio data');

        const text = await voiceAgent.voice?.listen(audioStream, {
          language: 'en',
        });
        expect(text).toBe('mock transcription');
      });
    });

    describe('error handling', () => {
      it('should throw error when no voice provider is configured', async () => {
        const agentWithoutVoice = new Agent({
          name: 'No Voice Agent',
          instructions: 'You are an agent without voice capabilities',
          model: dummyModel,
        });

        await expect(agentWithoutVoice.voice.getSpeakers()).rejects.toThrow('No voice provider configured');
        await expect(agentWithoutVoice.voice.speak('Test')).rejects.toThrow('No voice provider configured');
        await expect(agentWithoutVoice.voice.listen(new PassThrough())).rejects.toThrow('No voice provider configured');
      });
    });
  });

  describe('agent tool handling', () => {
    it('should handle tool name collisions caused by formatting', async () => {
      // Create two tool names that will collide after truncation to 63 chars
      const base = 'a'.repeat(63);
      const toolName1 = base + 'X'; // 64 chars
      const toolName2 = base + 'Y'; // 64 chars, but will be truncated to same as toolName1
      const userAgent = new Agent({
        name: 'User agent',
        instructions: 'Test tool name collision.',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 1, completionTokens: 1 },
            text: 'ok',
          }),
        }),
        tools: {
          [toolName1]: {
            id: toolName1,
            description: 'Tool 1',
            inputSchema: z.object({}),
            execute: async () => {},
          },
          [toolName2]: {
            id: toolName2,
            description: 'Tool 2',
            inputSchema: z.object({}),
            execute: async () => {},
          },
        },
      });
      await expect(userAgent['convertTools']({ runtimeContext: new RuntimeContext() })).rejects.toThrow(/same name/i);
    });

    it('should sanitize tool names with invalid characters', async () => {
      const badName = 'bad!@#tool$name';
      const userAgent = new Agent({
        name: 'User agent',
        instructions: 'Test tool name sanitization.',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 1, completionTokens: 1 },
            text: 'ok',
          }),
        }),
        tools: {
          [badName]: {
            id: badName,
            description: 'Tool with bad chars',
            inputSchema: z.object({}),
            execute: async () => {},
          },
        },
      });
      const tools = await userAgent['convertTools']({ runtimeContext: new RuntimeContext() });
      expect(Object.keys(tools)).toContain('bad___tool_name');
      expect(Object.keys(tools)).not.toContain(badName);
    });

    it('should prefix tool names that do not start with a letter or underscore', async () => {
      const badStart = '1tool';
      const userAgent = new Agent({
        name: 'User agent',
        instructions: 'Test tool name prefix.',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 1, completionTokens: 1 },
            text: 'ok',
          }),
        }),
        tools: {
          [badStart]: {
            id: badStart,
            description: 'Tool with bad start',
            inputSchema: z.object({}),
            execute: async () => {},
          },
        },
      });
      const tools = await userAgent['convertTools']({ runtimeContext: new RuntimeContext() });
      expect(Object.keys(tools)).toContain('_1tool');
      expect(Object.keys(tools)).not.toContain(badStart);
    });

    it('should truncate tool names longer than 63 characters', async () => {
      const longName = 'a'.repeat(70);
      const userAgent = new Agent({
        name: 'User agent',
        instructions: 'Test tool name truncation.',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 1, completionTokens: 1 },
            text: 'ok',
          }),
        }),
        tools: {
          [longName]: {
            id: longName,
            description: 'Tool with long name',
            inputSchema: z.object({}),
            execute: async () => {},
          },
        },
      });
      const tools = await userAgent['convertTools']({ runtimeContext: new RuntimeContext() });
      expect(Object.keys(tools).some(k => k.length === 63)).toBe(true);
      expect(Object.keys(tools)).not.toContain(longName);
    });

    it('should accept and execute both Mastra and Vercel tools in Agent constructor', async () => {
      const mastraExecute = vi.fn().mockResolvedValue({ result: 'mastra' });
      const vercelExecute = vi.fn().mockResolvedValue({ result: 'vercel' });

      const agent = new Agent({
        name: 'test',
        instructions: 'test agent instructions',
        model: openai('gpt-4'),
        tools: {
          mastraTool: createTool({
            id: 'test',
            description: 'test',
            inputSchema: z.object({ name: z.string() }),
            execute: mastraExecute,
          }),
          vercelTool: {
            description: 'test',
            parameters: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
            },
            execute: vercelExecute,
          },
        },
      });

      // Verify tools exist
      expect((agent.getTools() as Agent['tools']).mastraTool).toBeDefined();
      expect((agent.getTools() as Agent['tools']).vercelTool).toBeDefined();

      // Verify both tools can be executed
      // @ts-ignore
      await (agent.getTools() as Agent['tools']).mastraTool.execute!({ name: 'test' });
      // @ts-ignore
      await (agent.getTools() as Agent['tools']).vercelTool.execute!({ name: 'test' });

      expect(mastraExecute).toHaveBeenCalled();
      expect(vercelExecute).toHaveBeenCalled();
    });

    it('should make runtimeContext available to tools when injected in generate', async () => {
      const testRuntimeContext = new RuntimeContext([['test-value', 'runtimeContext-value']]);
      let capturedValue: string | null = null;

      const testTool = createTool({
        id: 'runtimeContext-test-tool',
        description: 'A tool that verifies runtimeContext is available',
        inputSchema: z.object({
          query: z.string(),
        }),
        execute: ({ runtimeContext }) => {
          capturedValue = runtimeContext.get('test-value')!;

          return Promise.resolve({
            success: true,
            runtimeContextAvailable: !!runtimeContext,
            runtimeContextValue: capturedValue,
          });
        },
      });

      const agent = new Agent({
        name: 'runtimeContext-test-agent',
        instructions: 'You are an agent that tests runtimeContext availability.',
        model: openai('gpt-4o'),
        tools: { testTool },
      });

      const mastra = new Mastra({
        agents: { agent },
        logger: false,
      });

      const testAgent = mastra.getAgent('agent');

      const response = await testAgent.generate('Use the runtimeContext-test-tool with query "test"', {
        toolChoice: 'required',
        runtimeContext: testRuntimeContext,
      });

      const toolCall = response.toolResults.find(result => result.toolName === 'testTool');

      expect(toolCall?.result?.runtimeContextAvailable).toBe(true);
      expect(toolCall?.result?.runtimeContextValue).toBe('runtimeContext-value');
      expect(capturedValue).toBe('runtimeContext-value');
    }, 500000);

    it('should make runtimeContext available to tools when injected in stream', async () => {
      const testRuntimeContext = new RuntimeContext([['test-value', 'runtimeContext-value']]);
      let capturedValue: string | null = null;

      const testTool = createTool({
        id: 'runtimeContext-test-tool',
        description: 'A tool that verifies runtimeContext is available',
        inputSchema: z.object({
          query: z.string(),
        }),
        execute: ({ runtimeContext }) => {
          capturedValue = runtimeContext.get('test-value')!;

          return Promise.resolve({
            success: true,
            runtimeContextAvailable: !!runtimeContext,
            runtimeContextValue: capturedValue,
          });
        },
      });

      const agent = new Agent({
        name: 'runtimeContext-test-agent',
        instructions: 'You are an agent that tests runtimeContext availability.',
        model: openai('gpt-4o'),
        tools: { testTool },
      });

      const mastra = new Mastra({
        agents: { agent },
        logger: false,
      });

      const testAgent = mastra.getAgent('agent');

      const stream = await testAgent.stream('Use the runtimeContext-test-tool with query "test"', {
        toolChoice: 'required',
        runtimeContext: testRuntimeContext,
      });

      for await (const _chunk of stream.textStream) {
        // empty line
      }

      const toolCall = (await stream.toolResults).find(result => result.toolName === 'testTool');

      expect(toolCall?.result?.runtimeContextAvailable).toBe(true);
      expect(toolCall?.result?.runtimeContextValue).toBe('runtimeContext-value');
      expect(capturedValue).toBe('runtimeContext-value');
    }, 500000);
  });

  it('should make runtimeContext available to tools when injected in streamVNext', async () => {
    const testRuntimeContext = new RuntimeContext([['test-value', 'runtimeContext-value']]);
    let capturedValue: string | null = null;

    const testTool = createTool({
      id: 'runtimeContext-test-tool',
      description: 'A tool that verifies runtimeContext is available',
      inputSchema: z.object({
        query: z.string(),
      }),
      execute: ({ runtimeContext }) => {
        capturedValue = runtimeContext.get('test-value')!;

        return Promise.resolve({
          success: true,
          runtimeContextAvailable: !!runtimeContext,
          runtimeContextValue: capturedValue,
        });
      },
    });

    const agent = new Agent({
      name: 'runtimeContext-test-agent',
      instructions: 'You are an agent that tests runtimeContext availability.',
      model: openai('gpt-4o'),
      tools: { testTool },
    });

    const mastra = new Mastra({
      agents: { agent },
      logger: false,
    });

    const testAgent = mastra.getAgent('agent');

    const stream = await testAgent.streamVNext('Use the runtimeContext-test-tool with query "test"', {
      toolChoice: 'required',
      runtimeContext: testRuntimeContext,
    });

    await stream.text;

    const toolCall = (await stream.toolResults).find(result => result.toolName === 'testTool');

    expect(toolCall?.result?.runtimeContextAvailable).toBe(true);
    expect(toolCall?.result?.runtimeContextValue).toBe('runtimeContext-value');
    expect(capturedValue).toBe('runtimeContext-value');
  }, 500000);
});

describe('agent memory with metadata', () => {
  let dummyModel: MockLanguageModelV1;
  beforeEach(() => {
    dummyModel = new MockLanguageModelV1({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        text: `Dummy response`,
      }),
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [{ type: 'text-delta', textDelta: 'dummy' }],
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });
  });

  it('should create a new thread with metadata using generate', async () => {
    const mockMemory = new MockMemory();
    const agent = new Agent({
      name: 'test-agent',
      instructions: 'test',
      model: dummyModel,
      memory: mockMemory,
    });

    await agent.generate('hello', {
      memory: {
        resource: 'user-1',
        thread: {
          id: 'thread-1',
          metadata: { client: 'test' },
        },
      },
    });

    const thread = await mockMemory.getThreadById({ threadId: 'thread-1' });
    expect(thread).toBeDefined();
    expect(thread?.metadata).toEqual({ client: 'test' });
    expect(thread?.resourceId).toBe('user-1');
  });

  it('should update metadata for an existing thread using generate', async () => {
    const mockMemory = new MockMemory();
    const initialThread: StorageThreadType = {
      id: 'thread-1',
      resourceId: 'user-1',
      metadata: { client: 'initial' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await mockMemory.saveThread({ thread: initialThread });

    const saveThreadSpy = vi.spyOn(mockMemory, 'saveThread');

    const agent = new Agent({
      name: 'test-agent',
      instructions: 'test',
      model: dummyModel,
      memory: mockMemory,
    });

    await agent.generate('hello', {
      memory: {
        resource: 'user-1',
        thread: {
          id: 'thread-1',
          metadata: { client: 'updated' },
        },
      },
    });

    expect(saveThreadSpy).toHaveBeenCalledTimes(1);
    const thread = await mockMemory.getThreadById({ threadId: 'thread-1' });
    expect(thread?.metadata).toEqual({ client: 'updated' });
  });

  it('should not update metadata if it is the same using generate', async () => {
    const mockMemory = new MockMemory();
    const initialThread: StorageThreadType = {
      id: 'thread-1',
      resourceId: 'user-1',
      metadata: { client: 'same' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await mockMemory.saveThread({ thread: initialThread });

    const saveThreadSpy = vi.spyOn(mockMemory, 'saveThread');

    const agent = new Agent({
      name: 'test-agent',
      instructions: 'test',
      model: dummyModel,
      memory: mockMemory,
    });

    await agent.generate('hello', {
      memory: {
        resource: 'user-1',
        thread: {
          id: 'thread-1',
          metadata: { client: 'same' },
        },
      },
    });

    expect(saveThreadSpy).not.toHaveBeenCalled();
  });

  it('should create a new thread with metadata using stream', async () => {
    const mockMemory = new MockMemory();
    const agent = new Agent({
      name: 'test-agent',
      instructions: 'test',
      model: dummyModel,
      memory: mockMemory,
    });

    const res = await agent.stream('hello', {
      memory: {
        resource: 'user-1',
        thread: {
          id: 'thread-1',
          metadata: { client: 'test-stream' },
        },
      },
    });

    for await (const _ of res.fullStream) {
    }

    const thread = await mockMemory.getThreadById({ threadId: 'thread-1' });
    expect(thread).toBeDefined();
    expect(thread?.metadata).toEqual({ client: 'test-stream' });
    expect(thread?.resourceId).toBe('user-1');
  });

  it('should create a new thread with metadata using streamVNext', async () => {
    const mockMemory = new MockMemory();
    const agent = new Agent({
      name: 'test-agent',
      instructions: 'test',
      model: dummyModel,
      memory: mockMemory,
    });

    const res = await agent.streamVNext('hello', {
      memory: {
        resource: 'user-1',
        thread: {
          id: 'thread-1',
          metadata: { client: 'test-stream' },
        },
      },
    });

    await res.text;

    const thread = await mockMemory.getThreadById({ threadId: 'thread-1' });
    expect(thread).toBeDefined();
    expect(thread?.metadata).toEqual({ client: 'test-stream' });
    expect(thread?.resourceId).toBe('user-1');
  });

  it('should still work with deprecated threadId and resourceId', async () => {
    const mockMemory = new MockMemory();
    const agent = new Agent({
      name: 'test-agent',
      instructions: 'test',
      model: dummyModel,
      memory: mockMemory,
    });

    await agent.generate('hello', {
      resourceId: 'user-1',
      threadId: 'thread-1',
    });

    const thread = await mockMemory.getThreadById({ threadId: 'thread-1' });
    expect(thread).toBeDefined();
    expect(thread?.id).toBe('thread-1');
    expect(thread?.resourceId).toBe('user-1');
  });
});

describe('Agent save message parts', () => {
  // Model that emits 10 parts
  const dummyResponseModel = new MockLanguageModelV1({
    doGenerate: async _options => ({
      text: Array.from({ length: 10 }, (_, count) => `Dummy response ${count}`).join(' '),
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
    doStream: async _options => {
      let count = 0;
      const stream = new ReadableStream({
        pull(controller) {
          if (count < 10) {
            controller.enqueue({
              type: 'text-delta',
              textDelta: `Dummy response ${count}`,
              createdAt: new Date(Date.now() + count * 1000).toISOString(),
            });
            count++;
          } else {
            controller.close();
          }
        },
      });
      return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
    },
  });

  // Model never emits any parts
  const emptyResponseModel = new MockLanguageModelV1({
    doGenerate: async _options => ({
      text: undefined,
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [],
      }),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });

  // Model throws immediately before emitting any part
  const errorResponseModel = new MockLanguageModelV1({
    doGenerate: async _options => {
      throw new Error('Immediate interruption');
    },
    doStream: async _options => {
      const stream = new ReadableStream({
        pull() {
          throw new Error('Immediate interruption');
        },
      });
      return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
    },
  });

  describe('generate', () => {
    it('should rescue partial messages (including tool calls) if generate is aborted/interrupted', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;
      let savedMessages: any[] = [];
      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        savedMessages.push(...args[0].messages);
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const errorTool = createTool({
        id: 'errorTool',
        description: 'Always throws an error.',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async () => {
          throw new Error('Tool failed!');
        },
      });

      const echoTool = createTool({
        id: 'echoTool',
        description: 'Echoes the input string.',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ context }) => ({ output: context.input }),
      });

      const agent = new Agent({
        name: 'partial-rescue-agent-generate',
        instructions:
          'Call each tool in a separate step. Do not use parallel tool calls. Always wait for the result of one tool before calling the next.',
        model: openai('gpt-4o'),
        memory: mockMemory,
        tools: { errorTool, echoTool },
      });
      agent.__setLogger(noopLogger);

      let stepCount = 0;
      let caught = false;
      try {
        await agent.generate('Please echo this and then use the error tool. Be verbose and take multiple steps.', {
          threadId: 'thread-partial-rescue-generate',
          resourceId: 'resource-partial-rescue-generate',
          experimental_continueSteps: true,
          savePerStep: true,
          onStepFinish: (result: any) => {
            if (result.toolCalls && result.toolCalls.length > 1) {
              throw new Error('Model attempted parallel tool calls; test requires sequential tool calls');
            }
            stepCount++;
            if (stepCount === 2) {
              throw new Error('Simulated error in onStepFinish');
            }
          },
        });
      } catch (err: any) {
        caught = true;
        expect(err.message).toMatch(/Simulated error in onStepFinish/i);
      }
      expect(caught).toBe(true);

      // After interruption, check what was saved
      const messages = await mockMemory.getMessages({
        threadId: 'thread-partial-rescue-generate',
        resourceId: 'resource-partial-rescue-generate',
        format: 'v2',
      });
      // User message should be saved
      expect(messages.find(m => m.role === 'user')).toBeTruthy();
      // At least one assistant message (could be partial) should be saved
      expect(messages.find(m => m.role === 'assistant')).toBeTruthy();
      // At least one tool call (echoTool or errorTool) should be saved if the model got that far
      const assistantWithToolInvocation = messages.find(
        m =>
          m.role === 'assistant' &&
          m.content &&
          Array.isArray(m.content.parts) &&
          m.content.parts.some(
            part =>
              part.type === 'tool-invocation' &&
              part.toolInvocation &&
              (part.toolInvocation.toolName === 'echoTool' || part.toolInvocation.toolName === 'errorTool'),
          ),
      );
      expect(assistantWithToolInvocation).toBeTruthy();
      // There should be at least one save call (user and partial assistant/tool)
      expect(saveCallCount).toBeGreaterThanOrEqual(1);
    }, 500000);

    it('should incrementally save messages across steps and tool calls', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;
      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const echoTool = createTool({
        id: 'echoTool',
        description: 'Echoes the input string.',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ context }) => ({ output: context.input }),
      });

      const agent = new Agent({
        name: 'test-agent-generate',
        instructions: 'If the user prompt contains "Echo:", always call the echoTool. Be verbose in your response.',
        model: openai('gpt-4o'),
        memory: mockMemory,
        tools: { echoTool },
      });

      await agent.generate('Echo: Please echo this long message and explain why.', {
        threadId: 'thread-echo-generate',
        resourceId: 'resource-echo-generate',
        savePerStep: true,
      });

      expect(saveCallCount).toBeGreaterThan(1);
      const messages = await mockMemory.getMessages({
        threadId: 'thread-echo-generate',
        resourceId: 'resource-echo-generate',
      });
      expect(messages.length).toBeGreaterThan(0);

      const assistantMsg = messages.find(m => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();
      assertNoDuplicateParts(assistantMsg!.content.parts);

      const toolResultIds = new Set(
        assistantMsg!.content.parts
          .filter(p => p.type === 'tool-invocation' && p.toolInvocation.state === 'result')
          .map(p => p.toolInvocation.toolCallId),
      );
      expect(assistantMsg!.content.toolInvocations.length).toBe(toolResultIds.size);
    }, 500000);

    it('should incrementally save messages with multiple tools and multi-step generation', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;
      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const echoTool = createTool({
        id: 'echoTool',
        description: 'Echoes the input string.',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ context }) => ({ output: context.input }),
      });

      const uppercaseTool = createTool({
        id: 'uppercaseTool',
        description: 'Converts input to uppercase.',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ context }) => ({ output: context.input.toUpperCase() }),
      });

      const agent = new Agent({
        name: 'test-agent-multi-generate',
        instructions: [
          'If the user prompt contains "Echo:", call the echoTool.',
          'If the user prompt contains "Uppercase:", call the uppercaseTool.',
          'If both are present, call both tools and explain the results.',
          'Be verbose in your response.',
        ].join(' '),
        model: openai('gpt-4o'),
        memory: mockMemory,
        tools: { echoTool, uppercaseTool },
      });

      await agent.generate(
        'Echo: Please echo this message. Uppercase: please also uppercase this message. Explain both results.',
        {
          threadId: 'thread-multi-generate',
          resourceId: 'resource-multi-generate',
          savePerStep: true,
        },
      );

      expect(saveCallCount).toBeGreaterThan(1);
      const messages = await mockMemory.getMessages({
        threadId: 'thread-multi-generate',
        resourceId: 'resource-multi-generate',
      });
      expect(messages.length).toBeGreaterThan(0);
      const assistantMsg = messages.find(m => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();
      assertNoDuplicateParts(assistantMsg!.content.parts);

      const toolResultIds = new Set(
        assistantMsg!.content.parts
          .filter(p => p.type === 'tool-invocation' && p.toolInvocation.state === 'result')
          .map(p => p.toolInvocation.toolCallId),
      );
      expect(assistantMsg!.content.toolInvocations.length).toBe(toolResultIds.size);
    }, 500000);

    it('should persist the full message after a successful run', async () => {
      const mockMemory = new MockMemory();
      const agent = new Agent({
        name: 'test-agent-generate',
        instructions: 'test',
        model: dummyResponseModel,
        memory: mockMemory,
      });
      await agent.generate('repeat tool calls', {
        threadId: 'thread-1-generate',
        resourceId: 'resource-1-generate',
      });

      const messages = await mockMemory.getMessages({
        threadId: 'thread-1-generate',
        resourceId: 'resource-1-generate',
        format: 'v2',
      });
      // Check that the last message matches the expected final output
      expect(
        messages[messages.length - 1]?.content?.parts?.some(
          p => p.type === 'text' && p.text?.includes('Dummy response'),
        ),
      ).toBe(true);
    });

    it('should only call saveMessages for the user message when no assistant parts are generated', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;

      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const agent = new Agent({
        name: 'no-progress-agent-generate',
        instructions: 'test',
        model: emptyResponseModel,
        memory: mockMemory,
      });

      await agent.generate('no progress', {
        threadId: 'thread-2-generate',
        resourceId: 'resource-2-generate',
      });

      expect(saveCallCount).toBe(1);

      const messages = await mockMemory.getMessages({
        threadId: 'thread-2-generate',
        resourceId: 'resource-2-generate',
        format: 'v2',
      });
      expect(messages.length).toBe(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content.content).toBe('no progress');
    });

    it('should not save any message if interrupted before any part is emitted', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;

      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const agent = new Agent({
        name: 'immediate-interrupt-agent-generate',
        instructions: 'test',
        model: errorResponseModel,
        memory: mockMemory,
      });

      try {
        await agent.generate('interrupt before step', {
          threadId: 'thread-3-generate',
          resourceId: 'resource-3-generate',
        });
      } catch (err: any) {
        expect(err.message).toBe('Immediate interruption');
      }

      expect(saveCallCount).toBe(0);
      const messages = await mockMemory.getMessages({
        threadId: 'thread-3-generate',
        resourceId: 'resource-3-generate',
      });
      expect(messages.length).toBe(0);
    });

    it('should not save thread if error occurs after starting response but before completion', async () => {
      const mockMemory = new MockMemory();
      const saveThreadSpy = vi.spyOn(mockMemory, 'saveThread');

      const errorModel = new MockLanguageModelV1({
        doGenerate: async () => {
          throw new Error('Simulated error during response');
        },
      });

      const agent = new Agent({
        name: 'error-agent',
        instructions: 'test',
        model: errorModel,
        memory: mockMemory,
      });

      let errorCaught = false;
      try {
        await agent.generate('trigger error', {
          memory: {
            resource: 'user-err',
            thread: {
              id: 'thread-err',
            },
          },
        });
      } catch (err: any) {
        errorCaught = true;
        expect(err.message).toMatch(/Simulated error/);
      }
      expect(errorCaught).toBe(true);

      expect(saveThreadSpy).not.toHaveBeenCalled();
      const thread = await mockMemory.getThreadById({ threadId: 'thread-err' });
      expect(thread).toBeNull();
    });
  });
  describe('stream', () => {
    it('should rescue partial messages (including tool calls) if stream is aborted/interrupted', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;
      let savedMessages: any[] = [];
      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        savedMessages.push(...args[0].messages);
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const errorTool = createTool({
        id: 'errorTool',
        description: 'Always throws an error.',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async () => {
          throw new Error('Tool failed!');
        },
      });

      const echoTool = createTool({
        id: 'echoTool',
        description: 'Echoes the input string.',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ context }) => ({ output: context.input }),
      });

      const agent = new Agent({
        name: 'partial-rescue-agent',
        instructions:
          'Call each tool in a separate step. Do not use parallel tool calls. Always wait for the result of one tool before calling the next.',
        model: openai('gpt-4o'),
        memory: mockMemory,
        tools: { errorTool, echoTool },
      });
      agent.__setLogger(noopLogger);

      let stepCount = 0;

      const stream = await agent.stream(
        'Please echo this and then use the error tool. Be verbose and take multiple steps.',
        {
          threadId: 'thread-partial-rescue',
          resourceId: 'resource-partial-rescue',
          experimental_continueSteps: true,
          savePerStep: true,
          onStepFinish: (result: any) => {
            if (result.toolCalls && result.toolCalls.length > 1) {
              throw new Error('Model attempted parallel tool calls; test requires sequential tool calls');
            }
            stepCount++;
            if (stepCount === 2) {
              throw new Error('Simulated error in onStepFinish');
            }
          },
        },
      );

      let caught = false;
      try {
        for await (const _part of stream.fullStream) {
        }
      } catch (err) {
        caught = true;
        expect(err.message).toMatch(/Simulated error in onStepFinish/i);
      }
      expect(caught).toBe(true);

      // After interruption, check what was saved
      const messages = await mockMemory.getMessages({
        threadId: 'thread-partial-rescue',
        resourceId: 'resource-partial-rescue',
        format: 'v2',
      });
      // User message should be saved
      expect(messages.find(m => m.role === 'user')).toBeTruthy();
      // At least one assistant message (could be partial) should be saved
      expect(messages.find(m => m.role === 'assistant')).toBeTruthy();
      // At least one tool call (echoTool or errorTool) should be saved if the model got that far
      const assistantWithToolInvocation = messages.find(
        m =>
          m.role === 'assistant' &&
          m.content &&
          Array.isArray(m.content.parts) &&
          m.content.parts.some(
            part =>
              part.type === 'tool-invocation' &&
              part.toolInvocation &&
              (part.toolInvocation.toolName === 'echoTool' || part.toolInvocation.toolName === 'errorTool'),
          ),
      );
      expect(assistantWithToolInvocation).toBeTruthy();
      // There should be at least one save call (user and partial assistant/tool)
      expect(saveCallCount).toBeGreaterThanOrEqual(1);
    }, 500000);

    it('should incrementally save messages across steps and tool calls', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;
      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const echoTool = createTool({
        id: 'echoTool',
        description: 'Echoes the input string.',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ context }) => ({ output: context.input }),
      });

      const agent = new Agent({
        name: 'test-agent',
        instructions: 'If the user prompt contains "Echo:", always call the echoTool. Be verbose in your response.',
        model: openai('gpt-4o'),
        memory: mockMemory,
        tools: { echoTool },
      });

      const stream = await agent.stream('Echo: Please echo this long message and explain why.', {
        threadId: 'thread-echo',
        resourceId: 'resource-echo',
        savePerStep: true,
      });

      for await (const _part of stream.fullStream) {
      }

      expect(saveCallCount).toBeGreaterThan(1);
      const messages = await mockMemory.getMessages({ threadId: 'thread-echo', resourceId: 'resource-echo' });
      expect(messages.length).toBeGreaterThan(0);
      const assistantMsg = messages.find(m => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();
      assertNoDuplicateParts(assistantMsg!.content.parts);

      const toolResultIds = new Set(
        assistantMsg!.content.parts
          .filter(p => p.type === 'tool-invocation' && p.toolInvocation.state === 'result')
          .map(p => p.toolInvocation.toolCallId),
      );
      expect(assistantMsg!.content.toolInvocations.length).toBe(toolResultIds.size);
    }, 500000);

    it('should incrementally save messages with multiple tools and multi-step streaming', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;
      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const echoTool = createTool({
        id: 'echoTool',
        description: 'Echoes the input string.',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ context }) => ({ output: context.input }),
      });

      const uppercaseTool = createTool({
        id: 'uppercaseTool',
        description: 'Converts input to uppercase.',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ context }) => ({ output: context.input.toUpperCase() }),
      });

      const agent = new Agent({
        name: 'test-agent-multi',
        instructions: [
          'If the user prompt contains "Echo:", call the echoTool.',
          'If the user prompt contains "Uppercase:", call the uppercaseTool.',
          'If both are present, call both tools and explain the results.',
          'Be verbose in your response.',
        ].join(' '),
        model: openai('gpt-4o'),
        memory: mockMemory,
        tools: { echoTool, uppercaseTool },
      });

      const stream = await agent.stream(
        'Echo: Please echo this message. Uppercase: please also uppercase this message. Explain both results.',
        {
          threadId: 'thread-multi',
          resourceId: 'resource-multi',
          savePerStep: true,
        },
      );

      for await (const _part of stream.fullStream) {
      }

      expect(saveCallCount).toBeGreaterThan(1);
      const messages = await mockMemory.getMessages({ threadId: 'thread-multi', resourceId: 'resource-multi' });
      expect(messages.length).toBeGreaterThan(0);
      const assistantMsg = messages.find(m => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();
      assertNoDuplicateParts(assistantMsg!.content.parts);

      const toolResultIds = new Set(
        assistantMsg!.content.parts
          .filter(p => p.type === 'tool-invocation' && p.toolInvocation.state === 'result')
          .map(p => p.toolInvocation.toolCallId),
      );
      expect(assistantMsg!.content.toolInvocations.length).toBe(toolResultIds.size);
    }, 500000);

    it('should persist the full message after a successful run', async () => {
      const mockMemory = new MockMemory();
      const agent = new Agent({
        name: 'test-agent',
        instructions: 'test',
        model: dummyResponseModel,
        memory: mockMemory,
      });
      const stream = await agent.stream('repeat tool calls', {
        threadId: 'thread-1',
        resourceId: 'resource-1',
      });

      for await (const _part of stream.fullStream) {
      }

      const messages = await mockMemory.getMessages({ threadId: 'thread-1', resourceId: 'resource-1', format: 'v2' });
      // Check that the last message matches the expected final output
      expect(
        messages[messages.length - 1]?.content?.parts?.some(
          p => p.type === 'text' && p.text?.includes('Dummy response'),
        ),
      ).toBe(true);
    });

    it('should only call saveMessages for the user message when no assistant parts are generated', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;

      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const agent = new Agent({
        name: 'no-progress-agent',
        instructions: 'test',
        model: emptyResponseModel,
        memory: mockMemory,
      });

      const stream = await agent.stream('no progress', {
        threadId: 'thread-2',
        resourceId: 'resource-2',
      });

      for await (const _part of stream.fullStream) {
        // Should not yield any parts
      }

      expect(saveCallCount).toBe(1);

      const messages = await mockMemory.getMessages({ threadId: 'thread-2', resourceId: 'resource-2', format: 'v2' });
      expect(messages.length).toBe(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content.content).toBe('no progress');
    });

    it('should not save any message if interrupted before any part is emitted', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;

      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const agent = new Agent({
        name: 'immediate-interrupt-agent',
        instructions: 'test',
        model: errorResponseModel,
        memory: mockMemory,
      });

      const stream = await agent.stream('interrupt before step', {
        threadId: 'thread-3',
        resourceId: 'resource-3',
      });

      try {
        for await (const _part of stream.fullStream) {
          // Should never yield
        }
      } catch (err) {
        expect(err.message).toBe('Immediate interruption');
      }

      expect(saveCallCount).toBe(0);
      const messages = await mockMemory.getMessages({ threadId: 'thread-3', resourceId: 'resource-3' });
      expect(messages.length).toBe(0);
    });

    it('should not save thread if error occurs after starting response but before completion', async () => {
      const mockMemory = new MockMemory();
      const saveThreadSpy = vi.spyOn(mockMemory, 'saveThread');

      const errorModel = new MockLanguageModelV1({
        doStream: async () => {
          const stream = new ReadableStream({
            pull() {
              throw new Error('Simulated stream error');
            },
          });
          return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
        },
      });

      const agent = new Agent({
        name: 'error-agent-stream',
        instructions: 'test',
        model: errorModel,
        memory: mockMemory,
      });

      let errorCaught = false;
      try {
        const stream = await agent.stream('trigger error', {
          memory: {
            resource: 'user-err',
            thread: {
              id: 'thread-err-stream',
            },
          },
        });
        for await (const _ of stream.textStream) {
          // Should throw
        }
      } catch (err: any) {
        errorCaught = true;
        expect(err.message).toMatch(/Simulated stream error/);
      }
      expect(errorCaught).toBe(true);

      expect(saveThreadSpy).not.toHaveBeenCalled();
      const thread = await mockMemory.getThreadById({ threadId: 'thread-err-stream' });
      expect(thread).toBeNull();
    });
  });

  describe('streamVnext', () => {
    it('should rescue partial messages (including tool calls) if stream is aborted/interrupted', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;
      let savedMessages: any[] = [];
      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        savedMessages.push(...args[0].messages);
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const errorTool = createTool({
        id: 'errorTool',
        description: 'Always throws an error.',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async () => {
          throw new Error('Tool failed!');
        },
      });

      const echoTool = createTool({
        id: 'echoTool',
        description: 'Echoes the input string.',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ context }) => ({ output: context.input }),
      });

      const agent = new Agent({
        name: 'partial-rescue-agent',
        instructions:
          'Call each tool in a separate step. Do not use parallel tool calls. Always wait for the result of one tool before calling the next.',
        model: openai('gpt-4o'),
        memory: mockMemory,
        tools: { errorTool, echoTool },
      });
      agent.__setLogger(noopLogger);

      let stepCount = 0;

      const stream = await agent.streamVNext(
        'Please echo this and then use the error tool. Be verbose and take multiple steps.',
        {
          memory: {
            thread: 'thread-partial-rescue',
            resource: 'resource-partial-rescue',
          },
          savePerStep: true,
          onStepFinish: (result: any) => {
            if (result.toolCalls && result.toolCalls.length > 1) {
              throw new Error('Model attempted parallel tool calls; test requires sequential tool calls');
            }
            stepCount++;
            if (stepCount === 2) {
              throw new Error('Simulated error in onStepFinish');
            }
          },
        },
      );

      let caught = false;
      try {
        await stream.text;
      } catch (err) {
        caught = true;
        expect(err.message).toMatch(/Simulated error in onStepFinish/i);
      }
      expect(caught).toBe(true);

      // After interruption, check what was saved
      const messages = await mockMemory.getMessages({
        threadId: 'thread-partial-rescue',
        resourceId: 'resource-partial-rescue',
        format: 'v2',
      });
      // User message should be saved
      expect(messages.find(m => m.role === 'user')).toBeTruthy();
      // At least one assistant message (could be partial) should be saved
      expect(messages.find(m => m.role === 'assistant')).toBeTruthy();
      // At least one tool call (echoTool or errorTool) should be saved if the model got that far
      const assistantWithToolInvocation = messages.find(
        m =>
          m.role === 'assistant' &&
          m.content &&
          Array.isArray(m.content.parts) &&
          m.content.parts.some(
            part =>
              part.type === 'tool-invocation' &&
              part.toolInvocation &&
              (part.toolInvocation.toolName === 'echoTool' || part.toolInvocation.toolName === 'errorTool'),
          ),
      );
      expect(assistantWithToolInvocation).toBeTruthy();
      // There should be at least one save call (user and partial assistant/tool)
      expect(saveCallCount).toBeGreaterThanOrEqual(1);
    }, 10000);

    it('should incrementally save messages across steps and tool calls', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;
      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const echoTool = createTool({
        id: 'echoTool',
        description: 'Echoes the input string.',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ context }) => ({ output: context.input }),
      });

      const agent = new Agent({
        name: 'test-agent',
        instructions: 'If the user prompt contains "Echo:", always call the echoTool. Be verbose in your response.',
        model: openai('gpt-4o'),
        memory: mockMemory,
        tools: { echoTool },
      });

      const stream = await agent.streamVNext('Echo: Please echo this long message and explain why.', {
        memory: {
          thread: 'thread-echo',
          resource: 'resource-echo',
        },
        savePerStep: true,
      });

      await stream.text;

      expect(saveCallCount).toBeGreaterThan(1);
      const messages = await mockMemory.getMessages({ threadId: 'thread-echo', resourceId: 'resource-echo' });
      expect(messages.length).toBeGreaterThan(0);
    }, 15000);

    it('should incrementally save messages with multiple tools and multi-step streaming', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;
      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const echoTool = createTool({
        id: 'echoTool',
        description: 'Echoes the input string.',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ context }) => ({ output: context.input }),
      });

      const uppercaseTool = createTool({
        id: 'uppercaseTool',
        description: 'Converts input to uppercase.',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ context }) => ({ output: context.input.toUpperCase() }),
      });

      const agent = new Agent({
        name: 'test-agent-multi',
        instructions: [
          'If the user prompt contains "Echo:", call the echoTool.',
          'If the user prompt contains "Uppercase:", call the uppercaseTool.',
          'If both are present, call both tools and explain the results.',
          'Be verbose in your response.',
        ].join(' '),
        model: openai('gpt-4o'),
        memory: mockMemory,
        tools: { echoTool, uppercaseTool },
      });

      const stream = await agent.streamVNext(
        'Echo: Please echo this message. Uppercase: please also uppercase this message. Explain both results.',
        {
          memory: {
            thread: 'thread-multi',
            resource: 'resource-multi',
          },
          savePerStep: true,
        },
      );

      await stream.text;

      expect(saveCallCount).toBeGreaterThan(1);
      const messages = await mockMemory.getMessages({ threadId: 'thread-multi', resourceId: 'resource-multi' });
      expect(messages.length).toBeGreaterThan(0);
    }, 10000);

    it('should persist the full message after a successful run', async () => {
      const mockMemory = new MockMemory();
      const agent = new Agent({
        name: 'test-agent',
        instructions: 'test',
        model: dummyResponseModel,
        memory: mockMemory,
      });
      const stream = await agent.streamVNext('repeat tool calls', {
        memory: {
          thread: 'thread-1',
          resource: 'resource-1',
        },
      });

      await stream.text;

      const messages = await mockMemory.getMessages({ threadId: 'thread-1', resourceId: 'resource-1', format: 'v2' });
      // Check that the last message matches the expected final output
      expect(
        messages[messages.length - 1]?.content?.parts?.some(
          p => p.type === 'text' && p.text?.includes('Dummy response'),
        ),
      ).toBe(true);
    });

    it('should only call saveMessages for the user message when no assistant parts are generated', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;

      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const agent = new Agent({
        name: 'no-progress-agent',
        instructions: 'test',
        model: emptyResponseModel,
        memory: mockMemory,
      });

      const stream = await agent.streamVNext('no progress', {
        memory: {
          thread: 'thread-2',
          resource: 'resource-2',
        },
      });

      await stream.text;

      expect(saveCallCount).toBe(1);

      const messages = await mockMemory.getMessages({ threadId: 'thread-2', resourceId: 'resource-2', format: 'v2' });
      expect(messages.length).toBe(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content.content).toBe('no progress');
    });

    it('should not save any message if interrupted before any part is emitted', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;

      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const agent = new Agent({
        name: 'immediate-interrupt-agent',
        instructions: 'test',
        model: errorResponseModel,
        memory: mockMemory,
      });

      const stream = await agent.streamVNext('interrupt before step', {
        memory: {
          thread: 'thread-3',
          resource: 'resource-3',
        },
      });

      try {
        await stream.text;
      } catch (err) {
        expect(err.message).toBe('Immediate interruption');
      }

      expect(saveCallCount).toBe(0);
      const messages = await mockMemory.getMessages({ threadId: 'thread-3', resourceId: 'resource-3' });
      expect(messages.length).toBe(0);
    });
  });

  describe('streamVnext', () => {
    it('should rescue partial messages (including tool calls) if stream is aborted/interrupted', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;
      let savedMessages: any[] = [];
      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        savedMessages.push(...args[0].messages);
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const errorTool = createTool({
        id: 'errorTool',
        description: 'Always throws an error.',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async () => {
          throw new Error('Tool failed!');
        },
      });

      const echoTool = createTool({
        id: 'echoTool',
        description: 'Echoes the input string.',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ context }) => ({ output: context.input }),
      });

      const agent = new Agent({
        name: 'partial-rescue-agent',
        instructions:
          'Call each tool in a separate step. Do not use parallel tool calls. Always wait for the result of one tool before calling the next.',
        model: openai('gpt-4o'),
        memory: mockMemory,
        tools: { errorTool, echoTool },
      });
      agent.__setLogger(noopLogger);

      let stepCount = 0;

      const stream = await agent.streamVNext(
        'Please echo this and then use the error tool. Be verbose and take multiple steps.',
        {
          memory: {
            thread: 'thread-partial-rescue',
            resource: 'resource-partial-rescue',
          },
          savePerStep: true,
          onStepFinish: (result: any) => {
            if (result.toolCalls && result.toolCalls.length > 1) {
              throw new Error('Model attempted parallel tool calls; test requires sequential tool calls');
            }
            stepCount++;
            if (stepCount === 2) {
              throw new Error('Simulated error in onStepFinish');
            }
          },
        },
      );

      let caught = false;
      try {
        await stream.text;
      } catch (err) {
        caught = true;
        expect(err.message).toMatch(/Simulated error in onStepFinish/i);
      }
      expect(caught).toBe(true);

      // After interruption, check what was saved
      const messages = await mockMemory.getMessages({
        threadId: 'thread-partial-rescue',
        resourceId: 'resource-partial-rescue',
        format: 'v2',
      });
      // User message should be saved
      expect(messages.find(m => m.role === 'user')).toBeTruthy();
      // At least one assistant message (could be partial) should be saved
      expect(messages.find(m => m.role === 'assistant')).toBeTruthy();
      // At least one tool call (echoTool or errorTool) should be saved if the model got that far
      const assistantWithToolInvocation = messages.find(
        m =>
          m.role === 'assistant' &&
          m.content &&
          Array.isArray(m.content.parts) &&
          m.content.parts.some(
            part =>
              part.type === 'tool-invocation' &&
              part.toolInvocation &&
              (part.toolInvocation.toolName === 'echoTool' || part.toolInvocation.toolName === 'errorTool'),
          ),
      );
      expect(assistantWithToolInvocation).toBeTruthy();
      // There should be at least one save call (user and partial assistant/tool)
      expect(saveCallCount).toBeGreaterThanOrEqual(1);
    }, 10000);

    it('should incrementally save messages across steps and tool calls', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;
      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const echoTool = createTool({
        id: 'echoTool',
        description: 'Echoes the input string.',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ context }) => ({ output: context.input }),
      });

      const agent = new Agent({
        name: 'test-agent',
        instructions: 'If the user prompt contains "Echo:", always call the echoTool. Be verbose in your response.',
        model: openai('gpt-4o'),
        memory: mockMemory,
        tools: { echoTool },
      });

      const stream = await agent.streamVNext('Echo: Please echo this long message and explain why.', {
        memory: {
          thread: 'thread-echo',
          resource: 'resource-echo',
        },
        savePerStep: true,
      });

      await stream.text;

      expect(saveCallCount).toBeGreaterThan(1);
      const messages = await mockMemory.getMessages({ threadId: 'thread-echo', resourceId: 'resource-echo' });
      expect(messages.length).toBeGreaterThan(0);
    }, 15000);

    it('should incrementally save messages with multiple tools and multi-step streaming', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;
      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const echoTool = createTool({
        id: 'echoTool',
        description: 'Echoes the input string.',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ context }) => ({ output: context.input }),
      });

      const uppercaseTool = createTool({
        id: 'uppercaseTool',
        description: 'Converts input to uppercase.',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ context }) => ({ output: context.input.toUpperCase() }),
      });

      const agent = new Agent({
        name: 'test-agent-multi',
        instructions: [
          'If the user prompt contains "Echo:", call the echoTool.',
          'If the user prompt contains "Uppercase:", call the uppercaseTool.',
          'If both are present, call both tools and explain the results.',
          'Be verbose in your response.',
        ].join(' '),
        model: openai('gpt-4o'),
        memory: mockMemory,
        tools: { echoTool, uppercaseTool },
      });

      const stream = await agent.streamVNext(
        'Echo: Please echo this message. Uppercase: please also uppercase this message. Explain both results.',
        {
          memory: {
            thread: 'thread-multi',
            resource: 'resource-multi',
          },
          savePerStep: true,
        },
      );

      await stream.text;

      expect(saveCallCount).toBeGreaterThan(1);
      const messages = await mockMemory.getMessages({ threadId: 'thread-multi', resourceId: 'resource-multi' });
      expect(messages.length).toBeGreaterThan(0);
    }, 10000);

    it('should persist the full message after a successful run', async () => {
      const mockMemory = new MockMemory();
      const agent = new Agent({
        name: 'test-agent',
        instructions: 'test',
        model: dummyResponseModel,
        memory: mockMemory,
      });
      const stream = await agent.streamVNext('repeat tool calls', {
        memory: {
          thread: 'thread-1',
          resource: 'resource-1',
        },
      });

      await stream.text;

      const messages = await mockMemory.getMessages({ threadId: 'thread-1', resourceId: 'resource-1', format: 'v2' });
      // Check that the last message matches the expected final output
      expect(
        messages[messages.length - 1]?.content?.parts?.some(
          p => p.type === 'text' && p.text?.includes('Dummy response'),
        ),
      ).toBe(true);
    });

    it('should only call saveMessages for the user message when no assistant parts are generated', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;

      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const agent = new Agent({
        name: 'no-progress-agent',
        instructions: 'test',
        model: emptyResponseModel,
        memory: mockMemory,
      });

      const stream = await agent.streamVNext('no progress', {
        memory: {
          thread: 'thread-2',
          resource: 'resource-2',
        },
      });

      await stream.text;

      expect(saveCallCount).toBe(1);

      const messages = await mockMemory.getMessages({ threadId: 'thread-2', resourceId: 'resource-2', format: 'v2' });
      expect(messages.length).toBe(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content.content).toBe('no progress');
    });

    it('should not save any message if interrupted before any part is emitted', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;

      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const agent = new Agent({
        name: 'immediate-interrupt-agent',
        instructions: 'test',
        model: errorResponseModel,
        memory: mockMemory,
      });

      const stream = await agent.streamVNext('interrupt before step', {
        memory: {
          thread: 'thread-3',
          resource: 'resource-3',
        },
      });

      try {
        await stream.text;
      } catch (err) {
        expect(err.message).toBe('Immediate interruption');
      }

      expect(saveCallCount).toBe(0);
      const messages = await mockMemory.getMessages({ threadId: 'thread-3', resourceId: 'resource-3' });
      expect(messages.length).toBe(0);
    });
  });
});

describe('dynamic memory configuration', () => {
  let dummyModel: MockLanguageModelV1;
  beforeEach(() => {
    dummyModel = new MockLanguageModelV1({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        text: `Dummy response`,
      }),
    });
  });

  it('should support static memory configuration', async () => {
    const mockMemory = new MockMemory();
    const agent = new Agent({
      name: 'static-memory-agent',
      instructions: 'test agent',
      model: dummyModel,
      memory: mockMemory,
    });

    const memory = await agent.getMemory();
    expect(memory).toBe(mockMemory);
  });

  it('should support dynamic memory configuration with runtimeContext', async () => {
    const premiumMemory = new MockMemory();
    const standardMemory = new MockMemory();

    const agent = new Agent({
      name: 'dynamic-memory-agent',
      instructions: 'test agent',
      model: dummyModel,
      memory: ({ runtimeContext }) => {
        const userTier = runtimeContext.get('userTier');
        return userTier === 'premium' ? premiumMemory : standardMemory;
      },
    });

    // Test with premium context
    const premiumContext = new RuntimeContext();
    premiumContext.set('userTier', 'premium');
    const premiumResult = await agent.getMemory({ runtimeContext: premiumContext });
    expect(premiumResult).toBe(premiumMemory);

    // Test with standard context
    const standardContext = new RuntimeContext();
    standardContext.set('userTier', 'standard');
    const standardResult = await agent.getMemory({ runtimeContext: standardContext });
    expect(standardResult).toBe(standardMemory);
  });

  it('should support async dynamic memory configuration', async () => {
    const mockMemory = new MockMemory();

    const agent = new Agent({
      name: 'async-memory-agent',
      instructions: 'test agent',
      model: dummyModel,
      memory: async ({ runtimeContext }) => {
        const userId = runtimeContext.get('userId') as string;
        // Simulate async memory creation/retrieval
        await new Promise(resolve => setTimeout(resolve, 10));
        (mockMemory as any).threads[`user-${userId}`] = {
          id: `user-${userId}`,
          resourceId: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return mockMemory;
      },
    });

    const runtimeContext = new RuntimeContext();
    runtimeContext.set('userId', 'user123');

    const memory = await agent.getMemory({ runtimeContext });
    expect(memory).toBe(mockMemory);
    expect((memory as any)?.threads['user-user123']).toBeDefined();
  });

  it('should throw error when dynamic memory function returns empty value', async () => {
    const agent = new Agent({
      name: 'invalid-memory-agent',
      instructions: 'test agent',
      model: dummyModel,
      memory: () => null as any,
    });

    await expect(agent.getMemory()).rejects.toThrow('Function-based memory returned empty value');
  });

  it('should work with memory in generate method with dynamic configuration', async () => {
    const mockMemory = new MockMemory();

    const agent = new Agent({
      name: 'generate-memory-agent',
      instructions: 'test agent',
      model: dummyModel,
      memory: ({ runtimeContext }) => {
        const environment = runtimeContext.get('environment');
        if (environment === 'test') {
          return mockMemory;
        }
        // Return a default mock memory instead of undefined
        return new MockMemory();
      },
    });

    const runtimeContext = new RuntimeContext();
    runtimeContext.set('environment', 'test');

    const response = await agent.generate('test message', {
      memory: {
        resource: 'user-1',
        thread: {
          id: 'thread-1',
        },
      },
      runtimeContext,
    });

    expect(response.text).toBe('Dummy response');

    // Verify that thread was created in memory
    const thread = await mockMemory.getThreadById({ threadId: 'thread-1' });
    expect(thread).toBeDefined();
    expect(thread?.resourceId).toBe('user-1');
  });

  it('should work with memory in stream method with dynamic configuration', async () => {
    const mockMemory = new MockMemory();

    const agent = new Agent({
      name: 'stream-memory-agent',
      instructions: 'test agent',
      model: new MockLanguageModelV1({
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: [
              { type: 'text-delta', textDelta: 'Dynamic' },
              { type: 'text-delta', textDelta: ' memory' },
              { type: 'text-delta', textDelta: ' response' },
              {
                type: 'finish',
                finishReason: 'stop',
                logprobs: undefined,
                usage: { completionTokens: 10, promptTokens: 3 },
              },
            ],
          }),
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      }),
      memory: ({ runtimeContext }) => {
        const enableMemory = runtimeContext.get('enableMemory');
        return enableMemory ? mockMemory : new MockMemory();
      },
    });

    const runtimeContext = new RuntimeContext();
    runtimeContext.set('enableMemory', true);

    const stream = await agent.stream('test message', {
      memory: {
        resource: 'user-1',
        thread: {
          id: 'thread-stream',
        },
      },
      runtimeContext,
    });

    let finalText = '';
    for await (const textPart of stream.textStream) {
      finalText += textPart;
    }

    expect(finalText).toBe('Dynamic memory response');

    // Verify that thread was created in memory
    const thread = await mockMemory.getThreadById({ threadId: 'thread-stream' });
    expect(thread).toBeDefined();
    expect(thread?.resourceId).toBe('user-1');
  });
});

describe('Input Processors', () => {
  let mockModel: MockLanguageModelV1;

  // Helper function to create a MastraMessageV2
  const createMessage = (text: string, role: 'user' | 'assistant' = 'user'): MastraMessageV2 => ({
    id: crypto.randomUUID(),
    role,
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
    },
    createdAt: new Date(),
  });

  beforeEach(() => {
    mockModel = new MockLanguageModelV1({
      doGenerate: async ({ prompt }) => {
        // Extract text content from the prompt messages
        const messages = Array.isArray(prompt) ? prompt : [];
        const textContent = messages
          .map(msg => {
            if (typeof msg.content === 'string') {
              return msg.content;
            } else if (Array.isArray(msg.content)) {
              return msg.content
                .filter(part => part.type === 'text')
                .map(part => part.text)
                .join(' ');
            }
            return '';
          })
          .filter(Boolean)
          .join(' ');

        return {
          text: `processed: ${textContent}`,
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          rawCall: { rawPrompt: prompt, rawSettings: {} },
        };
      },
      doStream: async ({ prompt }) => {
        // Extract text content from the prompt messages
        const messages = Array.isArray(prompt) ? prompt : [];
        const textContent = messages
          .map(msg => {
            if (typeof msg.content === 'string') {
              return msg.content;
            } else if (Array.isArray(msg.content)) {
              return msg.content
                .filter(part => part.type === 'text')
                .map(part => part.text)
                .join(' ');
            }
            return '';
          })
          .filter(Boolean)
          .join(' ');

        return {
          stream: simulateReadableStream({
            chunks: [
              { type: 'text-delta', textDelta: 'processed: ' },
              { type: 'text-delta', textDelta: textContent },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { promptTokens: 10, completionTokens: 20 },
              },
            ],
          }),
          rawCall: { rawPrompt: prompt, rawSettings: {} },
        };
      },
    });
  });

  describe('basic functionality', () => {
    it('should run input processors before generation', async () => {
      const processor = {
        name: 'test-processor',
        processInput: async ({ messages }) => {
          messages.push(createMessage('Processor was here!'));
          return messages;
        },
      };

      const agentWithProcessor = new Agent({
        name: 'test-agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [processor],
      });

      const result = await agentWithProcessor.generate('Hello world');

      // The processor should have added a message
      expect(result.text).toContain('processed:');
      expect(result.text).toContain('Processor was here!');
    });

    it('should run multiple processors in order', async () => {
      const processor1 = {
        name: 'processor-1',
        processInput: async ({ messages }) => {
          messages.push(createMessage('First processor'));
          return messages;
        },
      };

      const processor2 = {
        name: 'processor-2',
        processInput: async ({ messages }) => {
          messages.push(createMessage('Second processor'));
          return messages;
        },
      };

      const agentWithProcessors = new Agent({
        name: 'test-agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [processor1, processor2],
      });

      const result = await agentWithProcessors.generate('Hello');

      expect(result.text).toContain('First processor');
      expect(result.text).toContain('Second processor');
    });

    it('should support async processors running in sequence', async () => {
      const processor1 = {
        name: 'async-processor-1',
        processInput: async ({ messages }) => {
          messages.push(createMessage('First processor'));
          return messages;
        },
      };

      const processor2 = {
        name: 'async-processor-2',
        processInput: async ({ messages }) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          messages.push(createMessage('Second processor'));
          return messages;
        },
      };

      const agentWithAsyncProcessors = new Agent({
        name: 'test-agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [processor1, processor2],
      });

      const result = await agentWithAsyncProcessors.generate('Test async');

      // Processors run sequentially, so "First processor" should appear before "Second processor"
      expect(result.text).toContain('First processor');
      expect(result.text).toContain('Second processor');
    });
  });

  describe('tripwire functionality', () => {
    it('should handle processor abort with default message', async () => {
      const abortProcessor = {
        name: 'abort-processor',
        processInput: async ({ abort, messages }) => {
          abort();
          return messages;
        },
      };

      const agentWithAbortProcessor = new Agent({
        name: 'test-agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [abortProcessor],
      });

      const result = await agentWithAbortProcessor.generate('This should be aborted');

      expect(result.tripwire).toBe(true);
      expect(result.tripwireReason).toBe('Tripwire triggered by abort-processor');
      expect(result.text).toBe('');
      expect(result.finishReason).toBe('other');
    });

    it('should handle processor abort with custom message', async () => {
      const customAbortProcessor = {
        name: 'custom-abort',
        processInput: async ({ abort, messages }) => {
          abort('Custom abort reason');
          return messages;
        },
      };

      const agentWithCustomAbort = new Agent({
        name: 'test-agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [customAbortProcessor],
      });

      const result = await agentWithCustomAbort.generate('Custom abort test');

      expect(result.tripwire).toBe(true);
      expect(result.tripwireReason).toBe('Custom abort reason');
      expect(result.text).toBe('');
    });

    it('should not execute subsequent processors after abort', async () => {
      let secondProcessorExecuted = false;

      const abortProcessor = {
        name: 'abort-first',
        processInput: async ({ abort, messages }) => {
          abort('Stop here');
          return messages;
        },
      };

      const shouldNotRunProcessor = {
        name: 'should-not-run',
        processInput: async ({ messages }) => {
          secondProcessorExecuted = true;
          messages.push(createMessage('This should not be added'));
          return messages;
        },
      };

      const agentWithAbortSequence = new Agent({
        name: 'test-agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [abortProcessor, shouldNotRunProcessor],
      });

      const result = await agentWithAbortSequence.generate('Abort sequence test');

      expect(result.tripwire).toBe(true);
      expect(secondProcessorExecuted).toBe(false);
    });
  });

  describe('streaming with input processors', () => {
    it('should handle input processors with streaming', async () => {
      const streamProcessor = {
        name: 'stream-processor',
        processInput: async ({ messages }) => {
          messages.push(createMessage('Stream processor active'));
          return messages;
        },
      };

      const agentWithStreamProcessor = new Agent({
        name: 'test-agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [streamProcessor],
      });

      const stream = await agentWithStreamProcessor.stream('Stream test');

      let fullText = '';
      for await (const textPart of stream.textStream) {
        fullText += textPart;
      }

      expect(fullText).toContain('Stream processor active');
    });

    it('should handle abort in streaming with tripwire response', async () => {
      const streamAbortProcessor = {
        name: 'stream-abort',
        processInput: async ({ abort, messages }) => {
          abort('Stream aborted');
          return messages;
        },
      };

      const agentWithStreamAbort = new Agent({
        name: 'test-agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [streamAbortProcessor],
      });

      const stream = await agentWithStreamAbort.stream('Stream abort test');

      expect(stream.tripwire).toBe(true);
      expect(stream.tripwireReason).toBe('Stream aborted');

      // Stream should be empty
      let textReceived = '';
      for await (const textPart of stream.textStream) {
        textReceived += textPart;
      }
      expect(textReceived).toBe('');
    });

    it('should include deployer methods when tripwire is triggered in streaming', async () => {
      const deployerAbortProcessor = {
        name: 'deployer-abort',
        processInput: async ({ abort, messages }) => {
          abort('Deployer test abort');
          return messages;
        },
      };

      const agentWithDeployerAbort = new Agent({
        name: 'test-agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [deployerAbortProcessor],
      });

      const stream = await agentWithDeployerAbort.stream('Deployer abort test');

      expect(stream.tripwire).toBe(true);
      expect(stream.tripwireReason).toBe('Deployer test abort');

      // Verify deployer methods exist and return Response objects
      expect(typeof stream.toDataStreamResponse).toBe('function');
      expect(typeof stream.toTextStreamResponse).toBe('function');

      const dataStreamResponse = stream.toDataStreamResponse();
      const textStreamResponse = stream.toTextStreamResponse();

      expect(dataStreamResponse).toBeInstanceOf(Response);
      expect(textStreamResponse).toBeInstanceOf(Response);
      expect(dataStreamResponse.status).toBe(200);
      expect(textStreamResponse.status).toBe(200);

      // Verify other required methods are present
      expect(typeof stream.pipeDataStreamToResponse).toBe('function');
      expect(typeof stream.pipeTextStreamToResponse).toBe('function');
      expect(stream.experimental_partialOutputStream).toBeDefined();
      expect(typeof stream.experimental_partialOutputStream[Symbol.asyncIterator]).toBe('function');
    });
  });

  describe('dynamic input processors', () => {
    it('should support function-based input processors', async () => {
      const runtimeContext = new RuntimeContext<{ processorMessage: string }>();
      runtimeContext.set('processorMessage', 'Dynamic message');

      const agentWithDynamicProcessors = new Agent({
        name: 'test-agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: ({ runtimeContext }) => {
          const message: string = runtimeContext.get('processorMessage') || 'Default message';
          return [
            {
              name: 'dynamic-processor',
              processInput: async ({ messages }) => {
                messages.push(createMessage(message));
                return messages;
              },
            },
          ];
        },
      });

      const result = await agentWithDynamicProcessors.generate('Test dynamic', {
        runtimeContext,
      });

      expect(result.text).toContain('Dynamic message');
    });

    it('should handle empty processors array', async () => {
      const agentWithEmptyProcessors = new Agent({
        name: 'test-agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [],
      });

      const result = await agentWithEmptyProcessors.generate('No processors test');

      expect(result.text).toContain('processed:');
      expect(result.text).toContain('No processors test');
    });
  });

  describe('message manipulation', () => {
    it('should allow processors to modify message content', async () => {
      const messageModifierProcessor = {
        name: 'message-modifier',
        processInput: async ({ messages }) => {
          // Access existing messages and modify them
          const lastMessage = messages[messages.length - 1];

          if (lastMessage && lastMessage.content.parts.length > 0) {
            // Add a prefix to user messages
            messages.push(createMessage('MODIFIED: Original message was received'));
          }
          return messages;
        },
      };

      const agentWithModifier = new Agent({
        name: 'test-agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [messageModifierProcessor],
      });

      const result = await agentWithModifier.generate('Original user message');

      expect(result.text).toContain('MODIFIED: Original message was received');
      expect(result.text).toContain('Original user message');
    });

    it('should allow processors to filter or validate messages', async () => {
      const validationProcessor = {
        name: 'validator',
        processInput: async ({ messages, abort }) => {
          // Extract text content from all messages
          const textContent = messages
            .map(msg =>
              msg.content.parts
                .filter(part => part.type === 'text')
                .map(part => part.text)
                .join(' '),
            )
            .join(' ');

          const hasInappropriateContent = textContent.includes('inappropriate');

          if (hasInappropriateContent) {
            abort('Content validation failed');
          } else {
            messages.push(createMessage('Content validated'));
          }
          return messages;
        },
      };

      const agentWithValidator = new Agent({
        name: 'test-agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        inputProcessors: [validationProcessor],
      });

      // Test valid content
      const validResult = await agentWithValidator.generate('This is appropriate content');
      expect(validResult.text).toContain('Content validated');

      // Test invalid content
      const invalidResult = await agentWithValidator.generate('This contains inappropriate content');
      expect(invalidResult.tripwire).toBe(true);
      expect(invalidResult.tripwireReason).toBe('Content validation failed');
    });
  });
});

describe('Dynamic instructions with mastra instance', () => {
  let dummyModel: MockLanguageModelV1;
  let mastra: Mastra;

  beforeEach(() => {
    dummyModel = new MockLanguageModelV1({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        text: `Logger test response`,
      }),
    });

    mastra = new Mastra({
      logger: noopLogger,
    });
  });

  it('should expose mastra instance in dynamic instructions', async () => {
    let capturedMastra: Mastra | undefined;
    let capturedRuntimeContext: RuntimeContext | undefined;

    const agent = new Agent({
      name: 'test-agent',
      instructions: ({ runtimeContext, mastra }) => {
        capturedRuntimeContext = runtimeContext;
        capturedMastra = mastra;

        const logger = mastra?.getLogger();
        logger?.debug('Running with context', { info: runtimeContext.get('info') });

        return 'You are a helpful assistant.';
      },
      model: dummyModel,
      mastra,
    });

    const runtimeContext = new RuntimeContext();
    runtimeContext.set('info', 'test-info');

    const response = await agent.generate('hello', { runtimeContext });

    expect(response.text).toBe('Logger test response');
    expect(capturedMastra).toBe(mastra);
    expect(capturedRuntimeContext).toBe(runtimeContext);
    expect(capturedRuntimeContext?.get('info')).toBe('test-info');
  });

  it('should work with static instructions (backward compatibility)', async () => {
    const agent = new Agent({
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model: dummyModel,
      mastra,
    });

    const response = await agent.generate('hello');
    expect(response.text).toBe('Logger test response');
  });

  it('should handle dynamic instructions when mastra is undefined', async () => {
    let capturedMastra: Mastra | undefined;

    const agent = new Agent({
      name: 'test-agent',
      instructions: ({ mastra }) => {
        capturedMastra = mastra;
        return 'You are a helpful assistant.';
      },
      model: dummyModel,
      // No mastra provided
    });

    const response = await agent.generate('hello');

    expect(response.text).toBe('Logger test response');
    expect(capturedMastra).toBeUndefined();
  });
});

describe('UIMessageWithMetadata support', () => {
  let dummyModel: MockLanguageModelV1;
  let mockMemory: MockMemory;

  beforeEach(() => {
    dummyModel = new MockLanguageModelV1({
      doGenerate: async () => ({
        finishReason: 'stop',
        usage: { completionTokens: 10, promptTokens: 3 },
        text: 'Response acknowledging metadata',
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: 'text-delta', textDelta: 'Response' },
            { type: 'text-delta', textDelta: ' acknowledging' },
            { type: 'text-delta', textDelta: ' metadata' },
            {
              type: 'finish',
              finishReason: 'stop',
              logprobs: undefined,
              usage: { completionTokens: 10, promptTokens: 3 },
            },
          ],
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });
    mockMemory = new MockMemory();
  });

  it('should preserve metadata in generate method', async () => {
    const agent = new Agent({
      name: 'metadata-test-agent',
      instructions: 'You are a helpful assistant',
      model: dummyModel,
      memory: mockMemory,
    });

    const messagesWithMetadata = [
      {
        role: 'user' as const,
        content: 'Hello with metadata',
        parts: [{ type: 'text' as const, text: 'Hello with metadata' }],
        metadata: {
          source: 'web-ui',
          customerId: '12345',
          context: { orderId: 'ORDER-789', status: 'pending' },
        },
      },
    ];

    await agent.generate(messagesWithMetadata, {
      memory: {
        resource: 'customer-12345',
        thread: {
          id: 'support-thread',
        },
      },
    });

    // Verify messages were saved with metadata
    const savedMessages = await mockMemory.getMessages({
      threadConfig: { id: 'support-thread', resourceId: 'customer-12345' },
      limit: 10,
    });

    expect(savedMessages.length).toBeGreaterThan(0);

    // Find the user message
    const userMessage = savedMessages.find(m => m.role === 'user');
    expect(userMessage).toBeDefined();

    // Check that metadata was preserved in v2 format
    if (
      userMessage &&
      'content' in userMessage &&
      typeof userMessage.content === 'object' &&
      'metadata' in userMessage.content
    ) {
      expect(userMessage.content.metadata).toEqual({
        source: 'web-ui',
        customerId: '12345',
        context: { orderId: 'ORDER-789', status: 'pending' },
      });
    }
  });

  it('should preserve metadata in stream method', async () => {
    const agent = new Agent({
      name: 'metadata-stream-agent',
      instructions: 'You are a helpful assistant',
      model: dummyModel,
      memory: mockMemory,
    });

    const messagesWithMetadata = [
      {
        role: 'user' as const,
        content: 'Stream with metadata',
        parts: [{ type: 'text' as const, text: 'Stream with metadata' }],
        metadata: {
          source: 'mobile-app',
          sessionId: 'session-123',
          deviceInfo: { platform: 'iOS', version: '17.0' },
        },
      },
    ];

    const stream = await agent.stream(messagesWithMetadata, {
      memory: {
        resource: 'user-mobile',
        thread: {
          id: 'mobile-thread',
        },
      },
    });

    // Consume the stream
    let finalText = '';
    for await (const textPart of stream.textStream) {
      finalText += textPart;
    }

    expect(finalText).toBe('Response acknowledging metadata');

    // Verify messages were saved with metadata
    const savedMessages = await mockMemory.getMessages({
      threadConfig: { id: 'mobile-thread', resourceId: 'user-mobile' },
      limit: 10,
    });

    expect(savedMessages.length).toBeGreaterThan(0);

    // Find the user message
    const userMessage = savedMessages.find(m => m.role === 'user');
    expect(userMessage).toBeDefined();

    // Check that metadata was preserved
    if (
      userMessage &&
      'content' in userMessage &&
      typeof userMessage.content === 'object' &&
      'metadata' in userMessage.content
    ) {
      expect(userMessage.content.metadata).toEqual({
        source: 'mobile-app',
        sessionId: 'session-123',
        deviceInfo: { platform: 'iOS', version: '17.0' },
      });
    }
  });

  it('should handle mixed messages with and without metadata', async () => {
    const agent = new Agent({
      name: 'mixed-metadata-agent',
      instructions: 'You are a helpful assistant',
      model: dummyModel,
      memory: mockMemory,
    });

    const mixedMessages = [
      {
        role: 'user' as const,
        content: 'First message with metadata',
        parts: [{ type: 'text' as const, text: 'First message with metadata' }],
        metadata: {
          messageType: 'initial',
          priority: 'high',
        },
      },
      {
        role: 'assistant' as const,
        content: 'Response without metadata',
        parts: [{ type: 'text' as const, text: 'Response without metadata' }],
      },
      {
        role: 'user' as const,
        content: 'Second user message',
        parts: [{ type: 'text' as const, text: 'Second user message' }],
        // No metadata on this message
      },
    ];

    await agent.generate(mixedMessages, {
      memory: {
        resource: 'mixed-user',
        thread: {
          id: 'mixed-thread',
        },
      },
    });

    // Verify messages were saved correctly
    const savedMessages = await mockMemory.getMessages({
      threadConfig: { id: 'mixed-thread', resourceId: 'mixed-user' },
      limit: 10,
    });

    expect(savedMessages.length).toBeGreaterThan(0);

    // Find messages and check metadata
    const messagesAsV2 = savedMessages as MastraMessageV2[];
    const firstUserMessage = messagesAsV2.find(
      m =>
        m.role === 'user' && m.content.parts?.[0]?.type === 'text' && m.content.parts[0].text.includes('First message'),
    );
    const secondUserMessage = messagesAsV2.find(
      m =>
        m.role === 'user' && m.content.parts?.[0]?.type === 'text' && m.content.parts[0].text.includes('Second user'),
    );

    // First message should have metadata
    expect(firstUserMessage?.content.metadata).toEqual({
      messageType: 'initial',
      priority: 'high',
    });

    // Second message should not have metadata
    expect(secondUserMessage?.content.metadata).toBeUndefined();
  });
});

describe('output processors', () => {
  describe('streamVNext output processors', () => {
    it('should process text chunks through output processors in real-time', async () => {
      class TestOutputProcessor implements Processor {
        readonly name = 'test-output-processor';

        async processOutputStream(args: {
          chunk: any;
          streamParts: any[];
          state: Record<string, any>;
          abort: (reason?: string) => never;
        }) {
          const { chunk } = args;
          // Only process text-delta chunks
          if (chunk.type === 'text-delta') {
            return { type: 'text-delta', textDelta: chunk.textDelta.replace(/test/gi, 'TEST') };
          }
          return chunk;
        }
      }

      const agent = new Agent({
        name: 'output-processor-test-agent',
        instructions: 'You are a helpful assistant. Respond with exactly: "This is a test response"',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            text: 'This is a test response',
            finishReason: 'stop',
            usage: { completionTokens: 5, promptTokens: 10 },
          }),
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                { type: 'text-delta', textDelta: 'This is a test' },
                { type: 'text-delta', textDelta: ' response okay. test' },
              ],
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        }),
        outputProcessors: [new TestOutputProcessor()],
      });

      const stream = agent.streamVNext('Hello');

      let collectedText = '';
      for await (const chunk of stream) {
        if (chunk.type === 'text-delta') {
          collectedText += chunk.payload.text;
        }
      }

      // The output processor should have replaced "test" with "TEST"
      expect(collectedText).toBe('This is a TEST response okay. TEST');
    });

    it('should filter blocked content chunks', async () => {
      class BlockingOutputProcessor implements Processor {
        readonly name = 'filtering-output-processor';

        async processOutputStream({ chunk }) {
          // Filter out chunks containing "blocked"
          if (chunk.type === 'text-delta' && chunk.textDelta?.includes('blocked')) {
            return null; // Return null to filter the chunk
          }
          return chunk;
        }
      }

      const agent = new Agent({
        name: 'blocking-processor-test-agent',
        instructions: 'You are a helpful assistant.',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            text: 'This content should be blocked',
            finishReason: 'stop',
            usage: { completionTokens: 5, promptTokens: 10 },
          }),
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                { type: 'text-delta', textDelta: 'This content should be blocked. ' },
                { type: 'text-delta', textDelta: 'But this should be allowed.' },
              ],
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        }),
        outputProcessors: [new BlockingOutputProcessor()],
      });

      const stream = agent.streamVNext('Hello');

      let collectedText = '';
      for await (const chunk of stream) {
        if (chunk.type === 'text-delta') {
          collectedText += chunk.payload.text;
        }
      }

      // The blocked content should be filtered out completely (not appear in stream)
      expect(collectedText).toBe('But this should be allowed.');
    });

    it('should emit tripwire when output processor calls abort', async () => {
      class AbortingOutputProcessor implements Processor {
        readonly name = 'aborting-output-processor';

        async processOutputStream({ chunk, abort }) {
          if (chunk.type === 'text-delta' && chunk.textDelta?.includes('abort')) {
            abort('Content triggered abort');
          }

          return chunk;
        }
      }

      const agent = new Agent({
        name: 'aborting-processor-test-agent',
        instructions: 'You are a helpful assistant.',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            text: 'This should trigger abort condition',
            finishReason: 'stop',
            usage: { completionTokens: 5, promptTokens: 10 },
          }),
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                { type: 'text-delta', textDelta: 'This should trigger ' },
                { type: 'text-delta', textDelta: 'abort condition' },
                { type: 'text-delta', textDelta: ", but this won't be sent." },
              ],
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        }),
        outputProcessors: [new AbortingOutputProcessor()],
      });

      const stream = agent.streamVNext('Hello');
      const chunks: any[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      // Should have received a tripwire chunk
      const tripwireChunk = chunks.find(chunk => chunk.type === 'tripwire');
      expect(tripwireChunk).toBeDefined();
      expect(tripwireChunk.payload.tripwireReason).toBe('Content triggered abort');

      // Should not have received the text after the abort trigger
      let collectedText = '';
      chunks.forEach(chunk => {
        if (chunk.type === 'text-delta') {
          collectedText += chunk.payload.text;
        }
      });
      expect(collectedText).toBe('This should trigger ');
    });

    it('should process chunks through multiple output processors in sequence', async () => {
      class ReplaceProcessor implements Processor {
        readonly name = 'replace-processor';

        async processOutputStream({ chunk }) {
          if (chunk.type === 'text-delta') {
            return { type: 'text-delta', textDelta: chunk.textDelta.replace(/hello/gi, 'HELLO') };
          }
          return chunk;
        }
      }

      class AddPrefixProcessor implements Processor {
        readonly name = 'prefix-processor';

        async processOutputStream({ chunk }) {
          // Add prefix to any chunk that contains "HELLO"
          if (chunk.type === 'text-delta' && chunk.textDelta?.includes('HELLO')) {
            return { type: 'text-delta', textDelta: `[PROCESSED] ${chunk.textDelta}` };
          }
          return chunk;
        }
      }

      const agent = new Agent({
        name: 'multi-processor-test-agent',
        instructions: 'Respond with: "hello world"',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            text: 'hello world',
            finishReason: 'stop',
            usage: { completionTokens: 2, promptTokens: 5 },
          }),
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [{ type: 'text-delta', textDelta: 'hello world' }],
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        }),
        outputProcessors: [new ReplaceProcessor(), new AddPrefixProcessor()],
      });

      const stream = agent.streamVNext('Test');

      let collectedText = '';
      for await (const chunk of stream) {
        if (chunk.type === 'text-delta') {
          collectedText += chunk.payload.text;
        }
      }

      // Should be processed by both processors: replace "hello" -> "HELLO", then add prefix
      // The stream might be split into multiple chunks, so we need to handle that
      expect(collectedText).toBe('[PROCESSED] HELLO world');
    });

    it('should should abort if the output processor calls abort', async () => {
      class BlockingOutputProcessor implements Processor {
        readonly name = 'filtering-output-processor';

        async processOutputStream({ chunk, abort }) {
          if (chunk.type === 'text-delta' && chunk.textDelta?.includes('blocked')) {
            abort('blocked content');
          }
          return chunk;
        }
      }

      const agent = new Agent({
        name: 'blocking-processor-test-agent',
        instructions: 'You are a helpful assistant.',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            text: 'This content should be blocked',
            finishReason: 'stop',
            usage: { completionTokens: 5, promptTokens: 10 },
          }),
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                { type: 'text-delta', textDelta: 'This content should be blocked. ' },
                { type: 'text-delta', textDelta: 'But this should be allowed.' },
              ],
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        }),
        outputProcessors: [new BlockingOutputProcessor()],
      });

      const stream = agent.streamVNext('Hello');

      let collectedText = '';
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'text-delta') {
            collectedText += chunk.payload.text;
          } else if (chunk.type === 'tripwire') {
            expect(chunk.payload.tripwireReason).toBe('blocked content');
          }
        }
      } catch (error) {
        expect(error).toBe('blocked content');
      }

      expect(collectedText).toBe('');
    });
  });

  describe('generate output processors', () => {
    it('should process final text through output processors', async () => {
      let processedText = '';

      class TestOutputProcessor implements Processor {
        readonly name = 'test-output-processor';

        async processOutputResult({ messages }) {
          // Process the final generated text
          const processedMessages = messages.map(msg => ({
            ...msg,
            content: {
              ...msg.content,
              parts: msg.content.parts.map(part =>
                part.type === 'text' ? { ...part, text: part.text.replace(/test/gi, 'TEST') } : part,
              ),
            },
          }));

          // Store the processed text to verify it was called
          processedText =
            processedMessages[0]?.content.parts[0]?.type === 'text'
              ? (processedMessages[0].content.parts[0] as any).text
              : '';

          return processedMessages;
        }
      }

      const agent = new Agent({
        name: 'generate-output-processor-test-agent',
        instructions: 'You are a helpful assistant.',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            text: 'This is a test response with test words',
            finishReason: 'stop',
            usage: { completionTokens: 8, promptTokens: 10 },
          }),
        }),
        outputProcessors: [new TestOutputProcessor()],
      });

      const result = await agent.generate('Hello');

      // The output processors should modify the returned result
      expect(result.text).toBe('This is a TEST response with TEST words');

      // And the processor should have been called and processed the text
      expect(processedText).toBe('This is a TEST response with TEST words');
    });

    it('should process messages through multiple output processors in sequence', async () => {
      let finalProcessedText = '';

      class ReplaceProcessor implements Processor {
        readonly name = 'replace-processor';

        async processOutputResult({ messages }) {
          return messages.map(msg => ({
            ...msg,
            content: {
              ...msg.content,
              parts: msg.content.parts.map(part =>
                part.type === 'text' ? { ...part, text: part.text.replace(/hello/gi, 'HELLO') } : part,
              ),
            },
          }));
        }
      }

      class AddPrefixProcessor implements Processor {
        readonly name = 'prefix-processor';

        async processOutputResult({ messages }) {
          const processedMessages = messages.map(msg => ({
            ...msg,
            content: {
              ...msg.content,
              parts: msg.content.parts.map(part =>
                part.type === 'text' ? { ...part, text: `[PROCESSED] ${part.text}` } : part,
              ),
            },
          }));

          // Store the final processed text to verify both processors ran
          finalProcessedText =
            processedMessages[0]?.content.parts[0]?.type === 'text'
              ? (processedMessages[0].content.parts[0] as any).text
              : '';

          return processedMessages;
        }
      }

      const agent = new Agent({
        name: 'multi-processor-generate-test-agent',
        instructions: 'Respond with: "hello world"',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            text: 'hello world',
            finishReason: 'stop',
            usage: { completionTokens: 2, promptTokens: 5 },
          }),
        }),
        outputProcessors: [new ReplaceProcessor(), new AddPrefixProcessor()],
      });

      const result = await agent.generate('Test');

      // The output processors should modify the returned result
      expect(result.text).toBe('[PROCESSED] HELLO world');

      // And both processors should have been called in sequence
      expect(finalProcessedText).toBe('[PROCESSED] HELLO world');
    });

    it('should handle abort in output processors', async () => {
      class AbortingOutputProcessor implements Processor {
        readonly name = 'aborting-output-processor';

        async processOutputResult({ messages, abort }) {
          // Check if the response contains inappropriate content
          const hasInappropriateContent = messages.some(msg =>
            msg.content.parts.some(part => part.type === 'text' && part.text.includes('inappropriate')),
          );

          if (hasInappropriateContent) {
            abort('Content flagged as inappropriate');
          }

          return messages;
        }
      }

      const agent = new Agent({
        name: 'aborting-generate-test-agent',
        instructions: 'You are a helpful assistant.',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            text: 'This content is inappropriate and should be blocked',
            finishReason: 'stop',
            usage: { completionTokens: 10, promptTokens: 10 },
          }),
        }),
        outputProcessors: [new AbortingOutputProcessor()],
      });

      // Should return tripwire result when processor aborts
      const result = await agent.generate('Generate inappropriate content');

      expect(result.tripwire).toBe(true);
      expect(result.tripwireReason).toBe('Content flagged as inappropriate');
      expect(result.text).toBe('');
      expect(result.finishReason).toBe('other');
    });

    it('should skip processors that do not implement processOutputResult', async () => {
      let processedText = '';

      class CompleteProcessor implements Processor {
        readonly name = 'complete-processor';

        async processOutputResult({ messages }) {
          const processedMessages = messages.map(msg => ({
            ...msg,
            content: {
              ...msg.content,
              parts: msg.content.parts.map(part =>
                part.type === 'text' ? { ...part, text: `${part.text} [COMPLETE]` } : part,
              ),
            },
          }));

          // Store the processed text to verify this processor ran
          processedText =
            processedMessages[0]?.content.parts[0]?.type === 'text'
              ? (processedMessages[0].content.parts[0] as any).text
              : '';

          return processedMessages;
        }
      }

      // Only include the complete processor - the incomplete one would cause TypeScript errors
      const agent = new Agent({
        name: 'skipping-generate-test-agent',
        instructions: 'You are a helpful assistant.',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            text: 'Original response',
            finishReason: 'stop',
            usage: { completionTokens: 2, promptTokens: 5 },
          }),
        }),
        outputProcessors: [new CompleteProcessor()],
      });

      const result = await agent.generate('Test');

      // The output processors should modify the returned result
      expect(result.text).toBe('Original response [COMPLETE]');

      // And the complete processor should have processed the text
      expect(processedText).toBe('Original response [COMPLETE]');
    });
  });

  describe('generate output processors with structured output', () => {
    it('should process structured output through output processors', async () => {
      let processedObject: any = null;

      class StructuredOutputProcessor implements Processor {
        readonly name = 'structured-output-processor';

        async processOutputResult({ messages }) {
          // Process the final generated text and extract the structured data
          const processedMessages = messages.map(msg => ({
            ...msg,
            content: {
              ...msg.content,
              parts: msg.content.parts.map(part => {
                if (part.type === 'text') {
                  // Parse the JSON and modify it
                  try {
                    const parsedData = JSON.parse(part.text);
                    const modifiedData = {
                      ...parsedData,
                      winner: parsedData.winner?.toUpperCase() || '',
                      processed: true,
                    };
                    processedObject = modifiedData;
                    return { ...part, text: JSON.stringify(modifiedData) };
                  } catch {
                    return part;
                  }
                }
                return part;
              }),
            },
          }));

          return processedMessages;
        }
      }

      const agent = new Agent({
        name: 'structured-output-processor-test-agent',
        instructions: 'You know about US elections.',
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            text: '{"winner": "Barack Obama", "year": "2012"}',
            finishReason: 'stop',
            usage: { completionTokens: 10, promptTokens: 10 },
          }),
        }),
        outputProcessors: [new StructuredOutputProcessor()],
      });

      const result = await agent.generate('Who won the 2012 US presidential election?', {
        output: z.object({
          winner: z.string(),
          year: z.string(),
        }),
      });

      // The output processors should modify the returned result
      expect(result.object.winner).toBe('BARACK OBAMA');
      expect(result.object.year).toBe('2012');
      expect((result.object as any).processed).toBe(true);

      // And the processor should have been called and processed the structured data
      expect(processedObject).toEqual({
        winner: 'BARACK OBAMA',
        year: '2012',
        processed: true,
      });
    });

    it('should handle multiple processors with structured output', async () => {
      let firstProcessorCalled = false;
      let secondProcessorCalled = false;
      let finalResult: any = null;

      class FirstProcessor implements Processor {
        readonly name = 'first-processor';

        async processOutputResult({ messages }) {
          firstProcessorCalled = true;
          return messages.map(msg => ({
            ...msg,
            content: {
              ...msg.content,
              parts: msg.content.parts.map(part => {
                if (part.type === 'text') {
                  try {
                    const data = JSON.parse(part.text);
                    const modified = { ...data, first_processed: true };
                    return { ...part, text: JSON.stringify(modified) };
                  } catch {
                    return part;
                  }
                }
                return part;
              }),
            },
          }));
        }
      }

      class SecondProcessor implements Processor {
        readonly name = 'second-processor';

        async processOutputResult({ messages }) {
          secondProcessorCalled = true;
          return messages.map(msg => ({
            ...msg,
            content: {
              ...msg.content,
              parts: msg.content.parts.map(part => {
                if (part.type === 'text') {
                  try {
                    const data = JSON.parse(part.text);
                    const modified = { ...data, second_processed: true };
                    finalResult = modified;
                    return { ...part, text: JSON.stringify(modified) };
                  } catch {
                    return part;
                  }
                }
                return part;
              }),
            },
          }));
        }
      }

      const agent = new Agent({
        name: 'multi-processor-structured-test-agent',
        instructions: 'You are a helpful assistant.',
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            text: '{"message": "hello world"}',
            finishReason: 'stop',
            usage: { completionTokens: 5, promptTokens: 5 },
          }),
        }),
        outputProcessors: [new FirstProcessor(), new SecondProcessor()],
      });

      const result = await agent.generate('Say hello', {
        output: z.object({
          message: z.string(),
        }),
      });

      // The output processors should modify the returned result
      expect(result.object.message).toBe('hello world');
      expect((result.object as any).first_processed).toBe(true);
      expect((result.object as any).second_processed).toBe(true);

      // Both processors should have been called
      expect(firstProcessorCalled).toBe(true);
      expect(secondProcessorCalled).toBe(true);

      // Final result should have both processor modifications
      expect(finalResult).toEqual({
        message: 'hello world',
        first_processed: true,
        second_processed: true,
      });
    });
  });

  describe('streamVNext output processors with structured output', () => {
    it('should process streamed structured output through output processors', async () => {
      let processedChunks: string[] = [];
      let finalProcessedObject: any = null;

      class StreamStructuredProcessor implements Processor {
        readonly name = 'stream-structured-processor';

        async processOutputStream({ chunk }) {
          // Handle both text-delta and object-delta chunks
          if (chunk.type === 'text-delta' && chunk.textDelta) {
            // Collect and transform streaming chunks
            const modifiedChunk = {
              ...chunk,
              textDelta: chunk.textDelta.replace(/obama/gi, 'OBAMA'),
            };
            processedChunks.push(chunk.textDelta);
            return modifiedChunk;
          } else if (chunk.type === 'object-delta' && (chunk as any).objectDelta) {
            // Handle object streaming chunks
            const stringified = JSON.stringify((chunk as any).objectDelta);
            processedChunks.push(stringified);
            return chunk;
          }
          return chunk;
        }

        async processOutputResult({ messages }) {
          // Also process the final result
          const processedMessages = messages.map(msg => ({
            ...msg,
            content: {
              ...msg.content,
              parts: msg.content.parts.map(part => {
                if (part.type === 'text') {
                  try {
                    const data = JSON.parse(part.text);
                    const modified = { ...data, stream_processed: true };
                    finalProcessedObject = modified;
                    return { ...part, text: JSON.stringify(modified) };
                  } catch {
                    return part;
                  }
                }
                return part;
              }),
            },
          }));

          return processedMessages;
        }
      }

      const agent = new Agent({
        name: 'stream-structured-processor-test-agent',
        instructions: 'You know about US elections.',
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                { type: 'text-delta', textDelta: '{"winner":' },
                { type: 'text-delta', textDelta: '"Barack' },
                { type: 'text-delta', textDelta: ' Obama",' },
                { type: 'text-delta', textDelta: '"year":"2012"}' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  logprobs: undefined,
                  usage: { completionTokens: 10, promptTokens: 5 },
                },
              ],
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        }),
        outputProcessors: [new StreamStructuredProcessor()],
      });

      const response = agent.streamVNext('Who won the 2012 US presidential election?', {
        output: z.object({
          winner: z.string(),
          year: z.string(),
        }),
      });

      // Consume the stream
      let streamedContent = '';
      for await (const chunk of response) {
        if (chunk.type === 'text-delta') {
          streamedContent += chunk.payload.text;
        }
      }

      // Wait for the stream to finish
      await response.finishReason;

      // Check that streaming chunks were processed
      expect(processedChunks.length).toBeGreaterThan(0);
      expect(processedChunks.join('')).toContain('Barack');

      // Check that streaming content was modified
      expect(streamedContent).toContain('OBAMA');

      // Check that final object processing occurred
      expect(finalProcessedObject).toEqual({
        winner: 'Barack Obama',
        year: '2012',
        stream_processed: true,
      });
    });

    it('should process experimental_output during streaming', async () => {
      let streamProcessorCalled = false;
      let finalProcessorCalled = false;

      class ExperimentalStreamProcessor implements Processor {
        readonly name = 'experimental-stream-processor';

        async processOutputStream({ chunk }) {
          // Handle both text-delta and object-delta chunks
          streamProcessorCalled = true; // Set this regardless of chunk type

          if (chunk.type === 'text-delta') {
            return {
              ...chunk,
              textDelta: chunk.textDelta?.replace(/green/gi, 'GREEN'),
            };
          } else if (chunk.type === 'object-delta') {
            return chunk;
          }
          return chunk;
        }

        async processOutputResult({ messages }) {
          finalProcessorCalled = true;
          return messages.map(msg => ({
            ...msg,
            content: {
              ...msg.content,
              parts: msg.content.parts.map(part => {
                if (part.type === 'text') {
                  try {
                    const data = JSON.parse(part.text);
                    return { ...part, text: JSON.stringify({ ...data, experimental_stream: true }) };
                  } catch {
                    return part;
                  }
                }
                return part;
              }),
            },
          }));
        }
      }

      const agent = new Agent({
        name: 'experimental-stream-test-agent',
        instructions: 'You are a helpful assistant.',
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                { type: 'text-delta', textDelta: '{"color":' },
                { type: 'text-delta', textDelta: '"green",' },
                { type: 'text-delta', textDelta: '"intensity":"bright"}' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  logprobs: undefined,
                  usage: { completionTokens: 8, promptTokens: 5 },
                },
              ],
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        }),
        outputProcessors: [new ExperimentalStreamProcessor()],
      });

      const response = agent.streamVNext('Make it green', {
        output: z.object({
          color: z.string(),
          intensity: z.string(),
        }),
      });

      // Consume the stream
      for await (const _chunk of response) {
        // Just consume the stream
      }

      // Wait for completion
      await response.finishReason;
      const finalObject = await response.object;

      // Verify both stream and final processors were called
      expect(streamProcessorCalled).toBe(true);
      expect(finalProcessorCalled).toBe(true);

      // Note: Currently streaming transformations and final result processing are separate
      // This test verifies both are called, but final result is based on original LLM output
      expect(finalObject).toEqual({
        color: 'green', // Original LLM output
        intensity: 'bright',
        experimental_stream: true, // Added by final result processor
      });
    });

    describe('streaming tripwires with structured output', () => {
      it('should return empty object when tripwire triggered during streaming with output', async () => {
        class StreamAbortProcessor implements Processor {
          readonly name = 'stream-abort-output-processor';

          async processOutputStream({ chunk, abort }) {
            // Abort on the second text-delta chunk
            if (chunk.type === 'text-delta' && chunk.textDelta?.includes('Barack')) {
              abort('Stream aborted during structured output generation');
            }
            return chunk;
          }
        }

        const agent = new Agent({
          name: 'stream-abort-structured-test-agent',
          instructions: 'You know about US elections.',
          model: new MockLanguageModelV1({
            defaultObjectGenerationMode: 'json',
            doStream: async () => ({
              stream: simulateReadableStream({
                chunks: [
                  { type: 'text-delta', textDelta: '{"winner":' },
                  { type: 'text-delta', textDelta: '"Barack' }, // This will trigger abort
                  { type: 'text-delta', textDelta: ' Obama",' },
                  { type: 'text-delta', textDelta: '"year":"2012"}' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    logprobs: undefined,
                    usage: { completionTokens: 10, promptTokens: 5 },
                  },
                ],
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
            }),
          }),
          outputProcessors: [new StreamAbortProcessor()],
        });

        const response = agent.streamVNext('Who won the 2012 US presidential election?', {
          output: z.object({
            winner: z.string(),
            year: z.string(),
          }),
        });

        // Consume stream until tripwire
        const chunks: any[] = [];
        for await (const chunk of response) {
          chunks.push(chunk);
        }

        // Should contain tripwire chunk
        const tripwireChunk = chunks.find(c => c.type === 'tripwire');
        expect(tripwireChunk).toBeDefined();
        expect(tripwireChunk.payload.tripwireReason).toBe('Stream aborted during structured output generation');

        // Wait for completion
        await response.finishReason;

        // Final object should be null/empty since stream was aborted
        const finalObject = await response.object;
        expect(finalObject).toBeNull();
      });

      it('should return empty object when tripwire triggered during streaming with experimental_output', async () => {
        class StreamAbortProcessor implements Processor {
          readonly name = 'stream-abort-experimental-processor';

          async processOutputStream({ chunk, abort }) {
            // Abort on the second text-delta chunk
            if (chunk.type === 'text-delta' && chunk.textDelta?.includes('green')) {
              abort('Stream aborted during experimental output generation');
            }
            return chunk;
          }
        }

        const agent = new Agent({
          name: 'stream-abort-experimental-test-agent',
          instructions: 'You are a helpful assistant.',
          model: new MockLanguageModelV1({
            defaultObjectGenerationMode: 'json',
            doStream: async () => ({
              stream: simulateReadableStream({
                chunks: [
                  { type: 'text-delta', textDelta: '{"color":' },
                  { type: 'text-delta', textDelta: '"green",' }, // This will trigger abort
                  { type: 'text-delta', textDelta: '"intensity":"bright"}' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    logprobs: undefined,
                    usage: { completionTokens: 8, promptTokens: 5 },
                  },
                ],
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
            }),
          }),
          outputProcessors: [new StreamAbortProcessor()],
        });

        const response = agent.streamVNext('Make it green', {
          experimental_output: z.object({
            color: z.string(),
            intensity: z.string(),
          }),
        });

        // Consume stream until tripwire
        const chunks: any[] = [];
        for await (const chunk of response) {
          chunks.push(chunk);
        }

        // Should contain tripwire chunk
        const tripwireChunk = chunks.find(c => c.type === 'tripwire');
        expect(tripwireChunk).toBeDefined();
        expect(tripwireChunk.payload.tripwireReason).toBe('Stream aborted during experimental output generation');

        // Wait for completion
        await response.finishReason;

        // Final object should be null/empty since stream was aborted
        const finalObject = await response.object;
        expect(finalObject).toBeNull();
      });
    });
  });

  describe('tripwire functionality', () => {
    describe('generate method', () => {
      it('should handle processor abort with default message', async () => {
        const abortProcessor = {
          name: 'abort-output-processor',
          async processOutputResult({ abort, messages }) {
            abort();
            return messages;
          },
        } satisfies Processor;

        const agent = new Agent({
          name: 'output-tripwire-test-agent',
          instructions: 'You are a helpful assistant.',
          model: new MockLanguageModelV1({
            doGenerate: async () => ({
              rawCall: { rawPrompt: null, rawSettings: {} },
              text: 'This should be aborted',
              finishReason: 'stop',
              usage: { completionTokens: 4, promptTokens: 10 },
            }),
          }),
          outputProcessors: [abortProcessor],
        });

        const result = await agent.generate('Hello');

        expect(result.tripwire).toBe(true);
        expect(result.tripwireReason).toBe('Tripwire triggered by abort-output-processor');
        expect(result.text).toBe('');
        expect(result.finishReason).toBe('other');
      });

      it('should handle processor abort with custom message', async () => {
        const customAbortProcessor = {
          name: 'custom-abort-output',
          async processOutputResult({ abort, messages }) {
            abort('Custom output abort reason');
            return messages;
          },
        } satisfies Processor;

        const agent = new Agent({
          name: 'custom-output-tripwire-test-agent',
          instructions: 'You are a helpful assistant.',
          model: new MockLanguageModelV1({
            doGenerate: async () => ({
              rawCall: { rawPrompt: null, rawSettings: {} },
              text: 'This should be aborted with custom message',
              finishReason: 'stop',
              usage: { completionTokens: 8, promptTokens: 10 },
            }),
          }),
          outputProcessors: [customAbortProcessor],
        });

        const result = await agent.generate('Custom abort test');

        expect(result.tripwire).toBe(true);
        expect(result.tripwireReason).toBe('Custom output abort reason');
        expect(result.text).toBe('');
      });

      it('should not execute subsequent processors after abort', async () => {
        let secondProcessorExecuted = false;

        const abortProcessor = {
          name: 'abort-first-output',
          async processOutputResult({ abort, messages }) {
            abort('Stop here');
            return messages;
          },
        } satisfies Processor;

        const shouldNotRunProcessor = {
          name: 'should-not-run-output',
          async processOutputResult({ messages }) {
            secondProcessorExecuted = true;
            return messages.map(msg => ({
              ...msg,
              content: {
                ...msg.content,
                parts: msg.content.parts.map(part =>
                  part.type === 'text' ? { ...part, text: `${part.text} [SHOULD NOT APPEAR]` } : part,
                ),
              },
            }));
          },
        } satisfies Processor;

        const agent = new Agent({
          name: 'output-abort-sequence-test-agent',
          instructions: 'You are a helpful assistant.',
          model: new MockLanguageModelV1({
            doGenerate: async () => ({
              rawCall: { rawPrompt: null, rawSettings: {} },
              text: 'Abort sequence test',
              finishReason: 'stop',
              usage: { completionTokens: 3, promptTokens: 10 },
            }),
          }),
          outputProcessors: [abortProcessor, shouldNotRunProcessor],
        });

        const result = await agent.generate('Abort sequence test');

        expect(result.tripwire).toBe(true);
        expect(result.tripwireReason).toBe('Stop here');
        expect(secondProcessorExecuted).toBe(false);
      });
    });

    describe('streamVNext method', () => {
      it('should handle processor abort with default message', async () => {
        const abortProcessor = {
          name: 'abort-stream-output-processor',
          async processOutputStream({ chunk, abort }) {
            // Abort immediately on any text chunk
            if (chunk.type === 'text-delta') {
              abort();
            }
            return chunk;
          },
        } satisfies Processor;

        const agent = new Agent({
          name: 'stream-output-tripwire-test-agent',
          instructions: 'You are a helpful assistant.',
          model: new MockLanguageModelV1({
            doGenerate: async () => ({
              rawCall: { rawPrompt: null, rawSettings: {} },
              text: 'This should be aborted in stream',
              finishReason: 'stop',
              usage: { completionTokens: 6, promptTokens: 10 },
            }),
            doStream: async () => ({
              stream: simulateReadableStream({
                chunks: [
                  { type: 'text-delta', textDelta: 'This should be ' },
                  { type: 'text-delta', textDelta: 'aborted in stream' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    logprobs: undefined,
                    usage: { completionTokens: 6, promptTokens: 10 },
                  },
                ],
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
            }),
          }),
          outputProcessors: [abortProcessor],
        });

        const stream = agent.streamVNext('Hello');
        const chunks: any[] = [];

        for await (const chunk of stream) {
          chunks.push(chunk);
        }

        // Should receive start, step-start, and tripwire chunk
        const tripwireChunk = chunks.find(c => c.type === 'tripwire');
        expect(tripwireChunk).toBeDefined();
        expect(tripwireChunk.payload.tripwireReason).toBe('Chunk blocked by abort-stream-output-processor');
      });

      it('should handle processor abort with custom message', async () => {
        const customAbortProcessor = {
          name: 'custom-abort-stream-output',
          async processOutputStream({ chunk, abort }) {
            if (chunk.type === 'text-delta') {
              abort('Custom stream output abort reason');
            }
            return chunk;
          },
        } satisfies Processor;

        const agent = new Agent({
          name: 'custom-stream-output-tripwire-test-agent',
          instructions: 'You are a helpful assistant.',
          model: new MockLanguageModelV1({
            doGenerate: async () => ({
              rawCall: { rawPrompt: null, rawSettings: {} },
              text: 'This should be aborted with custom message in stream',
              finishReason: 'stop',
              usage: { completionTokens: 10, promptTokens: 10 },
            }),
            doStream: async () => ({
              stream: simulateReadableStream({
                chunks: [
                  { type: 'text-delta', textDelta: 'This should be aborted ' },
                  { type: 'text-delta', textDelta: 'with custom message in stream' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    logprobs: undefined,
                    usage: { completionTokens: 10, promptTokens: 10 },
                  },
                ],
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
            }),
          }),
          outputProcessors: [customAbortProcessor],
        });

        const stream = agent.streamVNext('Custom abort test');
        const chunks: any[] = [];

        for await (const chunk of stream) {
          chunks.push(chunk);
        }

        const tripwireChunk = chunks.find(c => c.type === 'tripwire');
        expect(tripwireChunk).toBeDefined();
        expect(tripwireChunk.payload.tripwireReason).toBe('Custom stream output abort reason');
      });

      it('should not execute subsequent processors after abort', async () => {
        let secondProcessorCalledAfterAbort = false;
        let abortTriggered = false;

        const abortProcessor = {
          name: 'abort-first-stream-output',
          async processOutputStream({ chunk, abort }) {
            if (chunk.type === 'text-delta') {
              abortTriggered = true;
              abort('Stop here in stream');
            }
            return chunk;
          },
        } satisfies Processor;

        const shouldNotRunProcessor = {
          name: 'should-not-run-stream-output',
          async processOutputStream({ chunk }) {
            // If abort was already triggered, this processor shouldn't be called again
            if (abortTriggered) {
              secondProcessorCalledAfterAbort = true;
            }
            if (chunk.type === 'text-delta') {
              return { type: 'text-delta', textDelta: `${chunk.textDelta} [SHOULD NOT APPEAR]` };
            }
            return chunk;
          },
        } satisfies Processor;

        const agent = new Agent({
          name: 'stream-output-abort-sequence-test-agent',
          instructions: 'You are a helpful assistant.',
          model: new MockLanguageModelV1({
            doGenerate: async () => ({
              rawCall: { rawPrompt: null, rawSettings: {} },
              text: 'Stream abort sequence test',
              finishReason: 'stop',
              usage: { completionTokens: 4, promptTokens: 10 },
            }),
            doStream: async () => ({
              stream: simulateReadableStream({
                chunks: [
                  { type: 'text-delta', textDelta: 'Stream abort ' },
                  { type: 'text-delta', textDelta: 'sequence test' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    logprobs: undefined,
                    usage: { completionTokens: 4, promptTokens: 10 },
                  },
                ],
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
            }),
          }),
          outputProcessors: [abortProcessor, shouldNotRunProcessor],
        });

        const stream = agent.streamVNext('Stream abort sequence test');
        const chunks: any[] = [];

        for await (const chunk of stream) {
          chunks.push(chunk);
        }

        const tripwireChunk = chunks.find(c => c.type === 'tripwire');
        expect(tripwireChunk).toBeDefined();
        expect(tripwireChunk.payload.tripwireReason).toBe('Stop here in stream');
        expect(secondProcessorCalledAfterAbort).toBe(false);
      });

      it('should not send any chunks after tripwire is triggered', async () => {
        const abortProcessor = {
          name: 'abort-on-first-text-chunk',
          async processOutputStream({ chunk, abort }) {
            if (chunk.type === 'text-delta') {
              abort('Stream terminated after first text chunk');
            }
            return chunk;
          },
        } satisfies Processor;

        const agent = new Agent({
          name: 'no-chunks-after-tripwire-test-agent',
          instructions: 'You are a helpful assistant.',
          model: new MockLanguageModelV1({
            doGenerate: async () => ({
              rawCall: { rawPrompt: null, rawSettings: {} },
              text: 'This stream should be cut off early',
              finishReason: 'stop',
              usage: { completionTokens: 7, promptTokens: 10 },
            }),
            doStream: async () => ({
              stream: simulateReadableStream({
                chunks: [
                  { type: 'text-delta', textDelta: 'First chunk ' },
                  { type: 'text-delta', textDelta: 'Second chunk that should not appear' },
                  { type: 'text-delta', textDelta: 'Third chunk that should not appear' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    logprobs: undefined,
                    usage: { completionTokens: 7, promptTokens: 10 },
                  },
                ],
              }),
              rawCall: { rawPrompt: null, rawSettings: {} },
            }),
          }),
          outputProcessors: [abortProcessor],
        });

        const stream = agent.streamVNext('Test stream termination');
        const chunks: any[] = [];

        for await (const chunk of stream) {
          chunks.push(chunk);
        }

        // Should have start, step-start, and tripwire chunks only
        // No subsequent text-delta chunks should appear after the first one triggers abort
        const textChunks = chunks.filter(c => c.type === 'text-delta');
        const tripwireChunk = chunks.find(c => c.type === 'tripwire');
        const finishChunk = chunks.find(c => c.type === 'finish');

        // Should have no text chunks (the first one triggers abort before being emitted)
        expect(textChunks).toHaveLength(0);

        // Should have exactly one tripwire chunk
        expect(tripwireChunk).toBeDefined();
        expect(tripwireChunk.payload.tripwireReason).toBe('Stream terminated after first text chunk');

        // Should have no finish chunk (stream was terminated early)
        expect(finishChunk).toBeUndefined();

        // Verify that chunks after tripwire are not included
        const chunkTypes = chunks.map(c => c.type);
        const tripwireIndex = chunkTypes.indexOf('tripwire');
        const chunksAfterTripwire = chunkTypes.slice(tripwireIndex + 1);
        expect(chunksAfterTripwire).toHaveLength(0);
      });
    });
  });
});

describe('StructuredOutputProcessor Integration Tests', () => {
  describe('with real LLM', () => {
    it('should convert unstructured text to structured JSON for color analysis', async () => {
      const colorSchema = z.object({
        color: z.string().describe('The primary color'),
        intensity: z.enum(['light', 'medium', 'bright', 'vibrant']).describe('How intense the color is'),
        hexCode: z
          .string()
          .regex(/^#[0-9A-F]{6}$/i)
          .describe('Hex color code'),
        mood: z.string().describe('The mood or feeling the color evokes'),
      });

      const agent = new Agent({
        name: 'Color Expert',
        instructions:
          'You are an expert on colors. Analyze colors and describe their properties, psychological effects, and technical details.',
        model: openai('gpt-4o-mini'),
      });

      const result = await agent.generate(
        'Tell me about a vibrant sunset orange color. What are its properties and how does it make people feel?',
        {
          structuredOutput: {
            schema: colorSchema,
            model: openai('gpt-4o-mini'), // Use smaller model for faster tests
            errorStrategy: 'strict',
          },
        },
      );

      // Verify we have both natural text AND structured data
      expect(result.text).toBeTruthy();
      expect(result.text).toMatch(/orange|color|vibrant|sunset/i); // Should contain natural language about colors
      expect(result.object).toBeDefined();

      // Validate the structured data
      expect(result.object).toMatchObject({
        color: expect.any(String),
        intensity: expect.stringMatching(/^(light|medium|bright|vibrant)$/),
        hexCode: expect.stringMatching(/^#[0-9A-F]{6}$/i),
        mood: expect.any(String),
      });

      // Validate the content makes sense for orange
      expect(result.object!.color.toLowerCase()).toContain('orange');
      expect(['bright', 'vibrant']).toContain(result.object!.intensity);
      expect(result.object!.mood).toBeTruthy();

      console.log('Natural text:', result.text);
      console.log('Structured color data:', result.object);
    }, 40000);

    it('should handle complex nested schemas for article analysis', async () => {
      const articleSchema = z.object({
        title: z.string().describe('A concise title for the content'),
        summary: z.string().describe('A brief summary of the main points'),
        keyPoints: z
          .array(
            z.object({
              point: z.string().describe('A key insight or main point'),
              importance: z.number().min(1).max(5).describe('Importance level from 1-5'),
            }),
          )
          .describe('List of key points from the content'),
        metadata: z.object({
          topics: z.array(z.string()).describe('Main topics covered'),
          difficulty: z.enum(['beginner', 'intermediate', 'advanced']).describe('Content difficulty level'),
          estimatedReadTime: z.number().describe('Estimated reading time in minutes'),
        }),
      });

      const agent = new Agent({
        name: 'Content Analyzer',
        instructions: 'You are an expert content analyst. Read and analyze text content to extract key insights.',
        model: openai('gpt-4o-mini'),
      });

      const articleText = `
        Machine learning has revolutionized how we approach data analysis. 
        At its core, machine learning involves training algorithms to recognize patterns in data. 
        There are three main types: supervised learning (with labeled data), unsupervised learning (finding hidden patterns), 
        and reinforcement learning (learning through trial and error). 
        Popular applications include recommendation systems, image recognition, and natural language processing. 
        For beginners, starting with simple algorithms like linear regression or decision trees is recommended.
      `;

      const result = await agent.generate(`Analyze this article and extract key information:\n\n${articleText}`, {
        structuredOutput: {
          schema: articleSchema,
          model: openai('gpt-4o-mini'),
          errorStrategy: 'strict',
        },
      });

      // Verify we have both natural text AND structured data
      expect(result.text).toBeTruthy();
      expect(result.text).toMatch(/machine learning|analysis|algorithms|data/i); // Should contain natural language
      expect(result.object).toBeDefined();

      // Validate the structured data
      expect(result.object).toMatchObject({
        title: expect.any(String),
        summary: expect.any(String),
        keyPoints: expect.arrayContaining([
          expect.objectContaining({
            point: expect.any(String),
            importance: expect.any(Number),
          }),
        ]),
        metadata: expect.objectContaining({
          topics: expect.any(Array),
          difficulty: expect.stringMatching(/^(beginner|intermediate|advanced)$/),
          estimatedReadTime: expect.any(Number),
        }),
      });

      // Validate content relevance
      expect(result.object!.title.toLowerCase()).toMatch(/machine learning|ml|data/);
      expect(result.object!.summary.toLowerCase()).toContain('machine learning');
      expect(result.object!.keyPoints.length).toBeGreaterThan(0);
      expect(
        result.object!.metadata.topics.some(
          (topic: string) => topic.toLowerCase().includes('machine learning') || topic.toLowerCase().includes('data'),
        ),
      ).toBe(true);

      console.log('Natural text:', result.text);
      console.log('Structured article analysis:', result.object);
    }, 40000);

    it('should handle fallback strategy gracefully', async () => {
      const strictSchema = z.object({
        impossible: z.literal('exact_match_required'),
        number: z.number().min(1000).max(1001), // Very restrictive
      });

      const fallbackValue = {
        impossible: 'exact_match_required' as const,
        number: 1000,
      };

      const agent = new Agent({
        name: 'Test Agent',
        instructions: 'You are a helpful assistant.',
        model: openai('gpt-4o-mini'),
      });

      const result = await agent.generate('Tell me about the weather today in a casual way.', {
        structuredOutput: {
          schema: strictSchema,
          model: openai('gpt-4o-mini'),
          errorStrategy: 'fallback',
          fallbackValue,
        },
      });

      // Should preserve natural text but return fallback object
      expect(result.text).toBeTruthy();
      expect(result.text).toMatch(/weather|today|casual/i); // Should contain natural language about weather
      expect(result.object).toEqual(fallbackValue);

      console.log('Natural text:', result.text);
      console.log('Fallback object:', result.object);
    }, 40000);

    it('should work with different models for main agent vs structuring agent', async () => {
      const ideaSchema = z.object({
        idea: z.string().describe('The creative idea'),
        category: z.enum(['technology', 'business', 'art', 'science', 'other']).describe('Category of the idea'),
        feasibility: z.number().min(1).max(10).describe('How feasible is this idea (1-10)'),
        resources: z.array(z.string()).describe('Resources needed to implement'),
      });

      const agent = new Agent({
        name: 'Creative Thinker',
        instructions: 'You are a creative thinker who generates innovative ideas and explores possibilities.',
        model: openai('gpt-4o-mini'), // Use faster model for idea generation
      });

      const result = await agent.generate(
        'Come up with an innovative solution for reducing food waste in restaurants.',
        {
          structuredOutput: {
            schema: ideaSchema,
            model: openai('gpt-4o'), // Use more powerful model for structuring
            errorStrategy: 'strict',
          },
        },
      );

      // Verify we have both natural text AND structured data
      expect(result.text).toBeTruthy();
      expect(result.text).toMatch(/food waste|restaurant|reduce|solution|innovative/i); // Should contain natural language
      expect(result.object).toBeDefined();

      // Validate structured data
      expect(result.object).toMatchObject({
        idea: expect.any(String),
        category: expect.stringMatching(/^(technology|business|art|science|other)$/),
        feasibility: expect.any(Number),
        resources: expect.any(Array),
      });

      // Validate content
      expect(result.object!.idea.toLowerCase()).toMatch(/food waste|restaurant|reduce/);
      expect(result.object!.feasibility).toBeGreaterThanOrEqual(1);
      expect(result.object!.feasibility).toBeLessThanOrEqual(10);
      expect(result.object!.resources.length).toBeGreaterThan(0);

      console.log('Natural text:', result.text);
      console.log('Structured idea data:', result.object);
    }, 40000);
  });

  it('should work with streamVNext', async () => {
    const ideaSchema = z.object({
      idea: z.string().describe('The creative idea'),
      category: z.enum(['technology', 'business', 'art', 'science', 'other']).describe('Category of the idea'),
      feasibility: z.number().min(1).max(10).describe('How feasible is this idea (1-10)'),
      resources: z.array(z.string()).describe('Resources needed to implement'),
    });

    const agent = new Agent({
      name: 'Creative Thinker',
      instructions: 'You are a creative thinker who generates innovative ideas and explores possibilities.',
      model: openai('gpt-4o-mini'), // Use faster model for idea generation
    });

    const result = await agent.streamVNext(
      'Come up with an innovative solution for reducing food waste in restaurants.',
      {
        structuredOutput: {
          schema: ideaSchema,
          model: openai('gpt-4o-mini'), // Use more powerful model for structuring
          errorStrategy: 'strict',
        },
      },
    );

    const resultText = await result.text;
    const resultObj = await result.object;

    // Verify we have both natural text AND structured data
    expect(resultText).toBeTruthy();
    expect(resultText).toMatch(/food waste|restaurant|reduce|solution|innovative/i); // Should contain natural language
    expect(resultObj).toBeDefined();

    // Validate structured data
    expect(resultObj).toMatchObject({
      idea: expect.any(String),
      category: expect.stringMatching(/^(technology|business|art|science|other)$/),
      feasibility: expect.any(Number),
      resources: expect.any(Array),
    });

    // Validate content
    expect(resultObj.idea.toLowerCase()).toMatch(/food waste|restaurant|reduce/);
    expect(resultObj.feasibility).toBeGreaterThanOrEqual(1);
    expect(resultObj.feasibility).toBeLessThanOrEqual(10);
    expect(resultObj.resources.length).toBeGreaterThan(0);

    console.log('Natural text:', resultText);
    console.log('Structured idea data:', resultObj);
  }, 40000);
});
