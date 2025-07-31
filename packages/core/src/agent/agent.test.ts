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
        process: async ({ messages }) => {
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
        process: async ({ messages }) => {
          messages.push(createMessage('First processor'));
          return messages;
        },
      };

      const processor2 = {
        name: 'processor-2',
        process: async ({ messages }) => {
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
        process: async ({ messages }) => {
          messages.push(createMessage('First processor'));
          return messages;
        },
      };

      const processor2 = {
        name: 'async-processor-2',
        process: async ({ messages }) => {
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
        process: async ({ abort, messages }) => {
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
        process: async ({ abort, messages }) => {
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
        process: async ({ abort, messages }) => {
          abort('Stop here');
          return messages;
        },
      };

      const shouldNotRunProcessor = {
        name: 'should-not-run',
        process: async ({ messages }) => {
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
        process: async ({ messages }) => {
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
        process: async ({ abort, messages }) => {
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
        process: async ({ abort, messages }) => {
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
              process: async ({ messages }) => {
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
        process: async ({ messages }) => {
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
        process: async ({ messages, abort }) => {
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
