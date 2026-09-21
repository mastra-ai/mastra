import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MastraDBMessage } from '../../agent';
import { MessageList } from '../../agent';
import { createSignal } from '../../agent/signals';
import { recordTerminalErrorMessage } from '../../loop/shared/record-terminal-error-message';
import { MemoryRunState } from '../../memory';
import type { MemoryRuntimeContext } from '../../memory';
import { RequestContext } from '../../request-context';
import { MemoryStorage } from '../../storage';
import type { StorageListThreadsInput, StorageListThreadsOutput } from '../../storage/types';

import { MessageHistory } from './message-history.js';
import { CLIENT_CONTRIBUTABLE_TERMINAL_FIELDS } from './reconcile-client-echoes.js';

// Helper to create RequestContext with memory context
function createRuntimeContextWithMemory(threadId: string, resourceId?: string): RequestContext {
  const requestContext = new RequestContext();
  const memoryContext: MemoryRuntimeContext = {
    thread: { id: threadId },
    resourceId,
  };
  requestContext.set('MastraMemory', memoryContext);
  return requestContext;
}

// Mock storage implementation
class MockStorage extends MemoryStorage {
  private messages: MastraDBMessage[] = [];

  async listMessages(params: any): Promise<any> {
    const { threadId, perPage = false, page = 1, orderBy } = params;
    const threadMessages = this.messages.filter(m => m.threadId === threadId);

    // Sort by createdAt if orderBy is specified
    let sortedMessages = threadMessages;
    if (orderBy?.field === 'createdAt') {
      sortedMessages = [...threadMessages].sort((a, b) => {
        const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
        const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
        return orderBy.direction === 'DESC' ? bTime - aTime : aTime - bTime;
      });
    }

    let resultMessages = sortedMessages;
    if (typeof perPage === 'number' && perPage > 0) {
      resultMessages = sortedMessages.slice(0, perPage);
    }

    return {
      messages: resultMessages,
      total: threadMessages.length,
      page,
      perPage,
      hasMore: false,
    };
  }

  async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    return { messages: this.messages.filter(m => m.id && messageIds.includes(m.id)) };
  }

  setMessages(messages: MastraDBMessage[]) {
    this.messages = messages;
  }

  // Implement other required abstract methods with stubs
  async getThreadById(_args: { threadId: string }) {
    return null;
  }
  async saveThread(args: any) {
    return args.thread || args;
  }
  async updateThread(args: { id: string; title: string; metadata: Record<string, unknown> }) {
    return {
      id: args.id,
      resourceId: 'resource-1',
      title: args.title,
      metadata: args.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  async deleteThread(_args: { threadId: string }) {}
  async saveMessages(args: { messages: MastraDBMessage[] }) {
    return { messages: args.messages };
  }
  async updateMessages(args: any) {
    return args.messages || [];
  }
  async listThreads(args: StorageListThreadsInput): Promise<StorageListThreadsOutput> {
    return {
      threads: [],
      total: 0,
      page: args.page ?? 0,
      perPage: args.perPage ?? 100,
      hasMore: false,
    };
  }
}

describe('MessageHistory', () => {
  let mockStorage: MockStorage;
  let processor: MessageHistory;
  const mockAbort = vi.fn(() => {
    throw new Error('Aborted');
  }) as any;

  beforeEach(() => {
    mockStorage = new MockStorage();
    vi.clearAllMocks();
  });

  describe('processInput', () => {
    it('should fetch last N messages from storage', async () => {
      const historicalMessages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
          threadId: 'thread-1',
          createdAt: new Date(Date.now() - 3000), // 3 seconds ago
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'Hi there!' }] },
          threadId: 'thread-1',
          createdAt: new Date(Date.now() - 2000), // 2 seconds ago
        },
        {
          id: 'msg-3',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'How are you?' }] },
          threadId: 'thread-1',
          createdAt: new Date(Date.now() - 1000), // 1 second ago
        },
      ];

      mockStorage.setMessages(historicalMessages);

      processor = new MessageHistory({
        storage: mockStorage,
        lastMessages: 2,
      });

      const newMessages: MastraDBMessage[] = [
        {
          id: 'msg-4',
          role: 'user',
          content: { format: 2, content: 'New message', parts: [{ type: 'text', text: 'New message' }] },
          threadId: 'thread-1',
          createdAt: new Date(),
        },
      ];

      const requestContext = createRuntimeContextWithMemory('thread-1');
      const messageList = new MessageList();
      messageList.add(newMessages, 'input');

      const result = await processor.processInput({
        messages: newMessages,
        messageList,
        abort: mockAbort,
        requestContext,
      });

      // Should have last 2 historical messages + 1 new message
      const resultMessages = result instanceof MessageList ? result.get.all.db() : result;
      expect(resultMessages).toHaveLength(3);
      expect(resultMessages[0].id).toBe('msg-2');
      expect(resultMessages[1].id).toBe('msg-3');
      expect(resultMessages[2].id).toBe('msg-4');
    });

    it('reuses the same history read within a memory run', async () => {
      mockStorage.setMessages([
        {
          id: 'stored-message',
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'Stored response' }] },
          threadId: 'thread-1',
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
      ]);
      const listMessages = vi.spyOn(mockStorage, 'listMessages');
      const runState = new MemoryRunState({
        memory: {},
        threadId: 'thread-1',
        resourceId: 'resource-1',
      });
      const requestContext = new RequestContext();
      requestContext.set('MastraMemory', {
        thread: { id: 'thread-1' },
        resourceId: 'resource-1',
        runState: () => runState,
      });
      processor = new MessageHistory({ storage: mockStorage, lastMessages: 10 });

      for (const id of ['input-1', 'input-2']) {
        const message: MastraDBMessage = {
          id,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: id }] },
          threadId: 'thread-1',
          createdAt: new Date(),
        };
        const messageList = new MessageList();
        messageList.add(message, 'input');
        await processor.processInput({
          messages: [message],
          messageList,
          abort: mockAbort,
          requestContext,
        });
      }

      expect(listMessages).toHaveBeenCalledTimes(1);
    });

    it('should merge historical messages with new messages', async () => {
      const historicalMessages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, content: 'Historical', parts: [{ type: 'text', text: 'Historical' }] },
          threadId: 'thread-1',
          createdAt: new Date(Date.now() - 10000), // 10 seconds ago
        },
      ];

      mockStorage.setMessages(historicalMessages);

      processor = new MessageHistory({
        storage: mockStorage,
      });

      const newMessages: MastraDBMessage[] = [
        {
          id: 'msg-2',
          role: 'user',
          content: { format: 2, content: 'New', parts: [{ type: 'text', text: 'New' }] },
          threadId: 'thread-1',
          createdAt: new Date(), // now
        },
      ];

      const messageList = new MessageList();
      messageList.add(newMessages, 'input');

      const result = await processor.processInput({
        messages: newMessages,
        messageList,
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      const resultMessages = result instanceof MessageList ? result.get.all.db() : result;
      expect(resultMessages).toHaveLength(2);
      expect(resultMessages[0].content.content).toBe('Historical');
      expect(resultMessages[1].content.content).toBe('New');
    });

    it('should avoid duplicate message IDs', async () => {
      const baseTime = Date.now();
      const historicalMessages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, content: 'Message 1', parts: [{ type: 'text', text: 'Message 1' }] },
          threadId: 'thread-1',
          createdAt: new Date(baseTime - 3000), // 3 seconds ago
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: { format: 2, content: 'Message 2', parts: [{ type: 'text', text: 'Message 2' }] },
          threadId: 'thread-1',
          createdAt: new Date(baseTime - 2000), // 2 seconds ago
        },
      ];

      mockStorage.setMessages(historicalMessages);

      processor = new MessageHistory({
        storage: mockStorage,
      });

      const newMessages: MastraDBMessage[] = [
        {
          id: 'msg-2', // Duplicate ID
          role: 'assistant',
          content: { format: 2, content: 'Message 2 (new)', parts: [{ type: 'text', text: 'Message 2 (new)' }] },
          threadId: 'thread-1',
          createdAt: new Date(baseTime - 1000), // 1 second ago
        },
        {
          id: 'msg-3',
          role: 'user',
          content: { format: 2, content: 'Message 3', parts: [{ type: 'text', text: 'Message 3' }] },
          threadId: 'thread-1',
          createdAt: new Date(baseTime), // now
        },
      ];

      const messageList = new MessageList();
      messageList.add(newMessages, 'input');

      const result = await processor.processInput({
        messages: newMessages,
        messageList,
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      const resultMessages = result instanceof MessageList ? result.get.all.db() : result;
      // msg-1 from history, msg-2 from new (duplicate filtered), msg-3 from new
      expect(resultMessages).toHaveLength(3);
      expect(resultMessages[0].id).toBe('msg-1');
      expect(resultMessages[1].id).toBe('msg-2');
      expect(resultMessages[1].content.content).toBe('Message 2 (new)'); // New version kept
      expect(resultMessages[2].id).toBe('msg-3');
    });

    it('should handle empty storage', async () => {
      processor = new MessageHistory({
        storage: mockStorage,
      });

      const newMessages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, content: 'New', parts: [{ type: 'text', text: 'New' }] },
          threadId: 'thread-1',
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList();
      messageList.add(newMessages, 'input');

      const result = await processor.processInput({
        messages: newMessages,
        messageList,
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      const resultMessages = result instanceof MessageList ? result.get.all.db() : result;
      expect(resultMessages).toHaveLength(1);
      expect(resultMessages[0].id).toBe('msg-1');
    });

    it('should propagate storage errors', async () => {
      const errorStorage = new MockStorage();
      errorStorage.listMessages = vi.fn().mockRejectedValue(new Error('Storage error'));

      processor = new MessageHistory({
        storage: errorStorage,
      });

      const newMessages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'New' }] },
          threadId: 'thread-1',
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList();
      messageList.add(newMessages, 'input');

      // Should propagate the error instead of silently failing
      await expect(
        processor.processInput({
          messages: newMessages,
          messageList,
          abort: mockAbort,
          requestContext: createRuntimeContextWithMemory('thread-1'),
        }),
      ).rejects.toThrow('Storage error');
    });

    it('should return original messages when no threadId', async () => {
      processor = new MessageHistory({
        storage: mockStorage,
        // No threadId
      });

      const newMessages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, content: 'New', parts: [{ type: 'text', text: 'New' }] },
          threadId: 'thread-1',
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList();
      messageList.add(newMessages, 'input');

      // Don't pass requestContext to simulate no threadId
      const result = await processor.processInput({
        messages: newMessages,
        messageList,
        abort: mockAbort,
      });

      const resultMessages = result instanceof MessageList ? result.get.all.db() : result;
      expect(resultMessages).toEqual(newMessages);
    });

    it('should handle assistant messages with tool calls', async () => {
      const historicalMessages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant' as const,
          content: {
            format: 2,
            parts: [
              { type: 'text', text: 'Let me calculate that' },
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'call',
                  toolCallId: 'call-1',
                  toolName: 'calculator',
                  args: { a: 1, b: 2 },
                },
              },
            ],
          },
          threadId: 'thread-1',
          createdAt: new Date(),
        },
      ];

      mockStorage.setMessages(historicalMessages);

      processor = new MessageHistory({
        storage: mockStorage,
      });

      const messageList1 = new MessageList();

      const result = await processor.processInput({
        messages: [],
        messageList: messageList1,
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      const resultMessages = result instanceof MessageList ? result.get.all.db() : result;
      expect(resultMessages).toHaveLength(1);
      expect(resultMessages[0].role).toBe('assistant');
      expect(resultMessages[0].content.parts).toHaveLength(2);
      expect(resultMessages[0].content.parts?.[1].type).toBe('tool-invocation');
    });

    it('should handle tool result messages', async () => {
      const historicalMessages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant' as const,
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: 'call-1',
                  toolName: 'calculator',
                  args: {},
                  result: { result: 3 },
                },
              },
            ],
          },
          threadId: 'thread-1',
          createdAt: new Date(),
        },
      ];

      mockStorage.setMessages(historicalMessages);

      processor = new MessageHistory({
        storage: mockStorage,
      });

      const messageList2 = new MessageList();

      const result = await processor.processInput({
        messages: [],
        messageList: messageList2,
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      const resultMessages = result instanceof MessageList ? result.get.all.db() : result;
      expect(resultMessages).toHaveLength(1);
      expect(resultMessages[0].role).toBe('assistant');
      expect(resultMessages[0].content.parts?.[0].type).toBe('tool-invocation');
    });
  });

  describe('processOutputResult', () => {
    it('should save user, assistant, and tool messages', async () => {
      const mockStorage = {
        saveMessages: vi.fn().mockResolvedValue(undefined),
        getThreadById: vi.fn().mockResolvedValue({
          id: 'thread-1',
          title: 'Test Thread',
          metadata: {},
        }),
        listMessages: vi.fn().mockResolvedValue({ messages: [], total: 0 }),
        listMessagesById: vi.fn().mockResolvedValue({ messages: [] }),
        updateThread: vi.fn().mockResolvedValue(undefined),
      } as unknown as MemoryStorage;

      const processor = new MessageHistory({
        storage: mockStorage,
      });

      const messages: MastraDBMessage[] = [
        {
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
          id: 'msg-1',
          createdAt: new Date('2024-01-01T00:00:01Z'),
        },
        {
          role: 'assistant',
          content: {
            format: 2,
            parts: [
              { type: 'text', text: 'Hi there!' },
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: 'tool-1',
                  toolName: 'search',
                  args: {},
                  result: 'Tool result',
                },
              },
            ],
          },
          id: 'msg-2',
          createdAt: new Date('2024-01-01T00:00:02Z'),
        },
      ];

      const messageList = new MessageList().add(messages, `response`).addSystem({
        role: 'system',
        content: 'You are a helpful assistant',
        id: 'msg-0',
        createdAt: new Date('2024-01-01T00:00:00Z'),
      });
      const result = await processor.processOutputResult({
        messageList,
        messages,
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      expect(result.get.response.db()).toEqual(messages);
      expect(mockStorage.saveMessages).toHaveBeenCalledWith({
        messages: expect.arrayContaining([
          expect.objectContaining({
            id: 'msg-1',
            role: 'user',
            content: expect.objectContaining({
              format: 2,
              parts: expect.arrayContaining([expect.objectContaining({ type: 'text', text: 'Hello' })]),
            }),
            createdAt: expect.any(Date),
          }),
          expect.objectContaining({
            id: 'msg-2',
            role: 'assistant',
            content: expect.objectContaining({
              format: 2,
              parts: expect.arrayContaining([
                expect.objectContaining({ type: 'text', text: 'Hi there!' }),
                expect.objectContaining({
                  type: 'tool-invocation',
                  toolInvocation: expect.objectContaining({
                    state: 'result',
                  }),
                }),
              ]),
            }),
            createdAt: expect.any(Date),
          }),
        ]),
      });
      // System message should NOT be saved
      expect(mockStorage.saveMessages).toHaveBeenCalledWith({
        messages: expect.not.arrayContaining([expect.objectContaining({ role: 'system' })]),
      });
    });

    it('should not persist an input-only failed run', async () => {
      const mockStorage = {
        saveMessages: vi.fn().mockResolvedValue(undefined),
        getThreadById: vi.fn().mockResolvedValue({
          id: 'thread-1',
          title: 'Test Thread',
          metadata: {},
        }),
        listMessages: vi.fn().mockResolvedValue({ messages: [], total: 0 }),
        listMessagesById: vi.fn().mockResolvedValue({ messages: [] }),
        updateThread: vi.fn().mockResolvedValue(undefined),
      } as unknown as MemoryStorage;

      const processor = new MessageHistory({
        storage: mockStorage,
      });

      const messages: MastraDBMessage[] = [
        {
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'User message' }] },
          id: 'msg-2',
          createdAt: new Date(),
        },
      ];

      // Provider errored before producing any output: only input exists.
      const messageList = new MessageList().add(messages, `input`);
      const result = await processor.processOutputResult({
        messageList,
        messages,
        result: {
          text: '',
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          finishReason: 'error',
          steps: [],
        },
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      expect(result).toBe(messageList);
      expect(mockStorage.saveMessages).not.toHaveBeenCalled();
    });

    it('should persist a failed run that produced output', async () => {
      const mockStorage = {
        saveMessages: vi.fn().mockResolvedValue(undefined),
        getThreadById: vi.fn().mockResolvedValue({
          id: 'thread-1',
          title: 'Test Thread',
          metadata: {},
        }),
        listMessages: vi.fn().mockResolvedValue({ messages: [], total: 0 }),
        listMessagesById: vi.fn().mockResolvedValue({ messages: [] }),
        updateThread: vi.fn().mockResolvedValue(undefined),
      } as unknown as MemoryStorage;

      const processor = new MessageHistory({
        storage: mockStorage,
      });

      const userMessage: MastraDBMessage = {
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'User message' }] },
        id: 'msg-2',
        createdAt: new Date(),
      };
      const assistantMessage: MastraDBMessage = {
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: 'Partial response' }] },
        id: 'msg-3',
        createdAt: new Date(),
      };

      const messageList = new MessageList().add([userMessage], `input`).add([assistantMessage], `response`);
      await processor.processOutputResult({
        messageList,
        messages: [userMessage, assistantMessage],
        result: {
          text: 'Partial response',
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          finishReason: 'error',
          steps: [],
        },
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      expect(mockStorage.saveMessages).toHaveBeenCalled();
    });

    it('should persist a user plus error-only assistant through the ordinary path', async () => {
      const mockStorage = {
        saveMessages: vi.fn().mockResolvedValue(undefined),
        getThreadById: vi.fn().mockResolvedValue({
          id: 'thread-1',
          title: 'Test Thread',
          metadata: {},
        }),
        listMessages: vi.fn().mockResolvedValue({ messages: [], total: 0 }),
        listMessagesById: vi.fn().mockResolvedValue({ messages: [] }),
        updateThread: vi.fn().mockResolvedValue(undefined),
      } as unknown as MemoryStorage;

      const processor = new MessageHistory({
        storage: mockStorage,
      });

      const userMessage: MastraDBMessage = {
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'User message' }] },
        id: 'msg-2',
        createdAt: new Date(),
      };
      const messageList = new MessageList().add([userMessage], `input`);

      // A terminal failure recorded as an `error` part produces a real assistant
      // response message, so the input-only orphan guard above no longer applies
      // and no special empty-message rule is needed.
      recordTerminalErrorMessage({
        messageList,
        attemptId: 'msg-3',
        activeId: 'msg-3',
        error: new Error('provider exploded'),
      });

      await processor.processOutputResult({
        messageList,
        messages: messageList.get.all.db(),
        result: {
          text: '',
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          finishReason: 'error',
          steps: [],
        },
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      expect(mockStorage.saveMessages).toHaveBeenCalledTimes(1);
      const saved = (mockStorage.saveMessages as any).mock.calls[0][0].messages as MastraDBMessage[];
      expect(saved.map(message => message.role)).toEqual(['user', 'assistant']);
      expect(saved[1]?.id).toBe('msg-3');
      expect(saved[1]?.content.parts).toEqual([
        {
          type: 'error',
          error: { name: 'Error', message: 'provider exploded' },
          createdAt: expect.any(Number),
        },
      ]);
    });

    it('should preserve partial parts alongside the persisted error part', async () => {
      const mockStorage = {
        saveMessages: vi.fn().mockResolvedValue(undefined),
        getThreadById: vi.fn().mockResolvedValue({
          id: 'thread-1',
          title: 'Test Thread',
          metadata: {},
        }),
        listMessages: vi.fn().mockResolvedValue({ messages: [], total: 0 }),
        listMessagesById: vi.fn().mockResolvedValue({ messages: [] }),
        updateThread: vi.fn().mockResolvedValue(undefined),
      } as unknown as MemoryStorage;

      const processor = new MessageHistory({
        storage: mockStorage,
      });

      const userMessage: MastraDBMessage = {
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'User message' }] },
        id: 'msg-2',
        createdAt: new Date(),
      };
      const partialAssistant: MastraDBMessage = {
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: 'Partial response' }] },
        id: 'msg-3',
        createdAt: new Date(),
      };
      const messageList = new MessageList().add([userMessage], `input`).add([partialAssistant], `response`);

      // The response id rotated after the partial output was stored, so the
      // error part has to land on the attempt's record instead of a new one.
      recordTerminalErrorMessage({
        messageList,
        attemptId: 'msg-3',
        activeId: 'msg-rotated',
        error: new Error('stream broke'),
      });

      await processor.processOutputResult({
        messageList,
        messages: messageList.get.all.db(),
        result: {
          text: 'Partial response',
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          finishReason: 'error',
          steps: [],
        },
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      expect(mockStorage.saveMessages).toHaveBeenCalledTimes(1);
      const saved = (mockStorage.saveMessages as any).mock.calls[0][0].messages as MastraDBMessage[];

      expect(saved.map(message => message.role)).toEqual(['user', 'assistant']);
      const assistant = saved.find(message => message.role === 'assistant');
      expect(assistant?.id).toBe('msg-3');
      expect(assistant?.content.parts.map(part => part.type)).toEqual(['text', 'error']);
      expect(assistant?.content.parts.find(part => part.type === 'text')).toMatchObject({ text: 'Partial response' });
      expect(assistant?.content.parts.find(part => part.type === 'error')).toMatchObject({
        error: { name: 'Error', message: 'stream broke' },
      });
    });

    it('should filter out ONLY system messages', async () => {
      const mockStorage = {
        saveMessages: vi.fn().mockResolvedValue(undefined),
        getThreadById: vi.fn().mockResolvedValue({
          id: 'thread-1',
          title: 'Test Thread',
          metadata: {},
        }),
        listMessages: vi.fn().mockResolvedValue({ messages: [], total: 0 }),
        listMessagesById: vi.fn().mockResolvedValue({ messages: [] }),
        updateThread: vi.fn().mockResolvedValue(undefined),
      } as unknown as MemoryStorage;

      const processor = new MessageHistory({
        storage: mockStorage,
      });

      const messages: MastraDBMessage[] = [
        {
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'User message' }] },
          id: 'msg-2',
          createdAt: new Date(),
        },
        {
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'Assistant response' }] },
          id: 'msg-4',
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList().add(messages, `input`).addSystem('System prompt 3');
      await processor.processOutputResult({
        messageList,
        messages,
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      const savedMessages = (mockStorage.saveMessages as any).mock.calls[0][0].messages;
      expect(savedMessages).toHaveLength(2);
      expect(savedMessages.every((m: any) => m.role !== 'system')).toBe(true);
    });

    it('should not persist system messages even when passed directly to persistMessages', async () => {
      const mockStorage = {
        saveMessages: vi.fn().mockResolvedValue(undefined),
        getThreadById: vi.fn().mockResolvedValue({
          id: 'thread-1',
          title: 'Test Thread',
          metadata: {},
        }),
        updateThread: vi.fn().mockResolvedValue(undefined),
      } as unknown as MemoryStorage;

      const processor = new MessageHistory({
        storage: mockStorage,
      });

      const messages: MastraDBMessage[] = [
        {
          role: 'system',
          content: { format: 2, parts: [{ type: 'text', text: 'Runtime-only system instruction' }] },
          id: 'msg-system',
          createdAt: new Date(),
        },
        {
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'User message' }] },
          id: 'msg-user',
          createdAt: new Date(),
        },
      ];

      await processor.persistMessages({ messages, threadId: 'thread-1' });

      expect(mockStorage.saveMessages).toHaveBeenCalledWith({
        messages: [expect.objectContaining({ id: 'msg-user', role: 'user' })],
      });
    });

    it('should drop transient signals but keep normal signals when persisting', async () => {
      const mockStorage = {
        saveMessages: vi.fn().mockResolvedValue(undefined),
        getThreadById: vi.fn().mockResolvedValue({
          id: 'thread-1',
          title: 'Test Thread',
          metadata: {},
        }),
        updateThread: vi.fn().mockResolvedValue(undefined),
      } as unknown as MemoryStorage;

      const processor = new MessageHistory({
        storage: mockStorage,
      });

      const transientSignal = createSignal({
        id: 'sig-transient',
        type: 'reactive',
        contents: 'Steering reminder — not retained',
        transient: true,
      }).toDBMessage({ threadId: 'thread-1' });
      const persistedSignal = createSignal({
        id: 'sig-persisted',
        type: 'reactive',
        contents: 'Regular signal — stored',
      }).toDBMessage({ threadId: 'thread-1' });

      const messages: MastraDBMessage[] = [
        transientSignal,
        persistedSignal,
        {
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'User message' }] },
          id: 'msg-user',
          createdAt: new Date(),
        },
      ];

      await processor.persistMessages({ messages, threadId: 'thread-1' });

      const savedMessages = (mockStorage.saveMessages as any).mock.calls[0][0].messages as MastraDBMessage[];
      const savedIds = savedMessages.map(m => m.id);
      expect(savedIds).toContain('sig-persisted');
      expect(savedIds).toContain('msg-user');
      expect(savedIds).not.toContain('sig-transient');
    });

    it('should preserve dynamic system reminders in persisted non-system messages to avoid cache invalidation and re-injection', async () => {
      const mockStorage = {
        saveMessages: vi.fn().mockResolvedValue(undefined),
        getThreadById: vi.fn().mockResolvedValue({
          id: 'thread-1',
          title: 'Test Thread',
          metadata: {},
        }),
        listMessages: vi.fn().mockResolvedValue({ messages: [], total: 0 }),
        listMessagesById: vi.fn().mockResolvedValue({ messages: [] }),
        updateThread: vi.fn().mockResolvedValue(undefined),
      } as unknown as MemoryStorage;

      const processor = new MessageHistory({
        storage: mockStorage,
      });

      const reminderMarkup =
        '<system-reminder type="dynamic-agents-md" path="/repo/packages/core/AGENTS.md">Core guidance</system-reminder>';

      const messages: MastraDBMessage[] = [
        {
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: reminderMarkup }] },
          id: 'msg-reminder',
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList().add(messages, `input`);
      await processor.processOutputResult({
        messageList,
        messages,
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      const savedMessages = (mockStorage.saveMessages as any).mock.calls[0][0].messages as MastraDBMessage[];
      expect(savedMessages).toHaveLength(1);
      expect(savedMessages[0]).toEqual(
        expect.objectContaining({
          role: 'user',
          content: expect.objectContaining({
            parts: [expect.objectContaining({ type: 'text', text: reminderMarkup })],
          }),
        }),
      );
    });

    it('should not rewrite an existing thread row when persisting messages', async () => {
      const mockStorage = {
        saveMessages: vi.fn().mockResolvedValue(undefined),
        getThreadById: vi.fn().mockResolvedValue({
          id: 'thread-1',
          title: 'Test Thread',
          metadata: { createdAt: new Date('2024-01-01') },
        }),
        updateThread: vi.fn().mockResolvedValue(undefined),
        listMessagesById: vi.fn().mockResolvedValue({ messages: [] }),
      } as unknown as MemoryStorage;

      const processor = new MessageHistory({
        storage: mockStorage,
      });

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user' as const,
          content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList().add(messages, `input`);

      await processor.processOutputResult({
        messages,
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        requestContext: createRuntimeContextWithMemory('thread-1'),
        messageList,
      });

      // Writing back the row we just read would clobber a title generated
      // concurrently with this save.
      expect(mockStorage.updateThread).not.toHaveBeenCalled();
    });

    it('should return original messages when no threadId', async () => {
      const mockStorage = {
        saveMessages: vi.fn(),
      } as unknown as MemoryStorage;

      const processor = new MessageHistory({
        storage: mockStorage,
        // No threadId
      });

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user' as const,
          content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList().add(messages, `input`);
      const result = await processor.processOutputResult({
        messageList,
        messages,
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        // No requestContext, so no threadId
      });

      expect(result.get.input.db()).toEqual(messages);
      expect(mockStorage.saveMessages).not.toHaveBeenCalled();
    });

    it('should handle messages with only system messages', async () => {
      const mockStorage = {
        saveMessages: vi.fn(),
      } as unknown as MemoryStorage;

      const processor = new MessageHistory({
        storage: mockStorage,
      });

      const messageList = new MessageList().addSystem(['System message 1', 'System message 2']);
      await processor.processOutputResult({
        messageList,
        messages: [],
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      expect(mockStorage.saveMessages).not.toHaveBeenCalled();
    });

    it('should preserve existing message IDs', async () => {
      const mockStorage = {
        saveMessages: vi.fn().mockResolvedValue(undefined),
        getThreadById: vi.fn().mockResolvedValue({
          id: 'thread-1',
          title: 'Test Thread',
          metadata: {},
        }),
        listMessages: vi.fn().mockResolvedValue({ messages: [], total: 0 }),
        listMessagesById: vi.fn().mockResolvedValue({ messages: [] }),
        updateThread: vi.fn().mockResolvedValue(undefined),
      } as unknown as MemoryStorage;

      const processor = new MessageHistory({
        storage: mockStorage,
      });

      const messages: MastraDBMessage[] = [
        {
          role: 'user' as const,
          content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
          id: 'existing-id-123',
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList().add(messages, `input`);
      await processor.processOutputResult({
        messageList,
        messages,
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      const savedMessages = (mockStorage.saveMessages as any).mock.calls[0][0].messages;
      expect(savedMessages[0].id).toBe('existing-id-123');
    });

    it('should preserve leading/trailing whitespace in text parts that have no working memory tags', async () => {
      const mockStorage = {
        saveMessages: vi.fn().mockResolvedValue(undefined),
        getThreadById: vi.fn().mockResolvedValue({
          id: 'thread-1',
          title: 'Test Thread',
          metadata: {},
        }),
        listMessages: vi.fn().mockResolvedValue({ messages: [], total: 0 }),
        listMessagesById: vi.fn().mockResolvedValue({ messages: [] }),
        updateThread: vi.fn().mockResolvedValue(undefined),
      } as unknown as MemoryStorage;

      const processor = new MessageHistory({
        storage: mockStorage,
      });

      // Token-boundary splits produce parts with meaningful leading whitespace
      // (e.g. ' access'). Trimming these corrupts the concatenated output.
      const messages: MastraDBMessage[] = [
        {
          role: 'assistant',
          content: {
            format: 2,
            parts: [
              { type: 'text', text: 'You can' },
              { type: 'text', text: ' access' },
              { type: 'text', text: ' the data.' },
            ],
          },
          id: 'msg-1',
          createdAt: new Date('2024-01-01T00:00:01Z'),
        },
      ];

      const messageList = new MessageList().add(messages, `response`);
      await processor.processOutputResult({
        messageList,
        messages,
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      const savedMessages = (mockStorage.saveMessages as any).mock.calls[0][0].messages;
      const savedParts = savedMessages[0].content.parts.filter((p: any) => p.type === 'text');
      expect(savedParts.map((p: any) => p.text)).toEqual(['You can', ' access', ' the data.']);
      expect(savedParts.map((p: any) => p.text).join('')).toBe('You can access the data.');
    });

    it('should strip working memory tags and trim only the parts that contained tags', async () => {
      const mockStorage = {
        saveMessages: vi.fn().mockResolvedValue(undefined),
        getThreadById: vi.fn().mockResolvedValue({
          id: 'thread-1',
          title: 'Test Thread',
          metadata: {},
        }),
        listMessages: vi.fn().mockResolvedValue({ messages: [], total: 0 }),
        listMessagesById: vi.fn().mockResolvedValue({ messages: [] }),
        updateThread: vi.fn().mockResolvedValue(undefined),
      } as unknown as MemoryStorage;

      const processor = new MessageHistory({
        storage: mockStorage,
      });

      const messages: MastraDBMessage[] = [
        {
          role: 'assistant',
          content: {
            format: 2,
            parts: [
              { type: 'text', text: 'Saved.\n<working_memory>secret</working_memory>' },
              { type: 'text', text: ' untouched ' },
            ],
          },
          id: 'msg-1',
          createdAt: new Date('2024-01-01T00:00:01Z'),
        },
      ];

      const messageList = new MessageList().add(messages, `response`);
      await processor.processOutputResult({
        messageList,
        messages,
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      const savedMessages = (mockStorage.saveMessages as any).mock.calls[0][0].messages;
      const savedParts = savedMessages[0].content.parts.filter((p: any) => p.type === 'text');
      // The part with a tag is stripped and trimmed; the untouched part keeps its whitespace.
      expect(savedParts.map((p: any) => p.text)).toEqual(['Saved.', ' untouched ']);
    });
  });

  describe('client echo reconciliation', () => {
    const baseTime = Date.now();

    function assistantMessage(overrides: Partial<MastraDBMessage> = {}): MastraDBMessage {
      return {
        id: 'msg-1',
        role: 'assistant',
        content: {
          format: 2,
          content: 'Transformed answer',
          parts: [{ type: 'text', text: 'Transformed answer' }],
        },
        threadId: 'thread-1',
        createdAt: new Date(baseTime - 1000),
        ...overrides,
      };
    }

    it('should not re-persist an unchanged echo of a stored message', async () => {
      const stored = assistantMessage();
      mockStorage.setMessages([stored]);

      processor = new MessageHistory({ storage: mockStorage });
      const saveSpy = vi.spyOn(mockStorage, 'saveMessages');

      const echo = assistantMessage();
      const newUserMessage = assistantMessage({
        id: 'msg-2',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Next turn' }] },
        createdAt: new Date(baseTime),
      });

      const messageList = new MessageList().add([echo, newUserMessage], 'input');

      await processor.processOutputResult({
        messageList,
        messages: [],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      // Only the genuinely new message is persisted — the echo of msg-1 is skipped
      // so the upsert cannot overwrite the stored canonical record.
      expect(saveSpy).toHaveBeenCalledWith({
        messages: [expect.objectContaining({ id: 'msg-2' })],
      });

      saveSpy.mockRestore();
    });

    it('should preserve stored server-authored content when a lossy echo is submitted', async () => {
      const stored = assistantMessage({
        content: {
          format: 2,
          content: 'Transformed answer',
          parts: [
            { type: 'text', text: 'Transformed answer' },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call-1',
                toolName: 'search',
                args: { q: 'x' },
                result: 'found',
              },
            },
          ],
        },
      });
      mockStorage.setMessages([stored]);

      processor = new MessageHistory({ storage: mockStorage });
      const saveSpy = vi.spyOn(mockStorage, 'saveMessages');

      // Client echoes the raw (un-transformed) text and drops the tool history.
      const lossyEcho = assistantMessage({
        content: { format: 2, content: 'Raw answer', parts: [{ type: 'text', text: 'Raw answer' }] },
      });
      const newUserMessage = assistantMessage({
        id: 'msg-2',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Next turn' }] },
        createdAt: new Date(baseTime),
      });

      const messageList = new MessageList().add([lossyEcho, newUserMessage], 'input');

      await processor.processOutputResult({
        messageList,
        messages: [],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      // The stored (transformed) text and the completed tool history survive the echo.
      expect(saveSpy).toHaveBeenCalledWith({
        messages: expect.arrayContaining([
          expect.objectContaining({
            id: 'msg-1',
            content: expect.objectContaining({
              content: 'Transformed answer',
              parts: expect.arrayContaining([
                expect.objectContaining({ type: 'text', text: 'Transformed answer' }),
                expect.objectContaining({
                  type: 'tool-invocation',
                  toolInvocation: expect.objectContaining({ toolCallId: 'call-1', state: 'result', result: 'found' }),
                }),
              ]),
            }),
          }),
          expect.objectContaining({ id: 'msg-2' }),
        ]),
      });

      // The client's raw copy is not persisted anywhere: the stored server text
      // is the only text part, and the tool history survives intact.
      const savedMessages = (saveSpy.mock.calls[0]![0] as any).messages as MastraDBMessage[];
      const savedMsg1 = savedMessages.find(m => m.id === 'msg-1')!;
      expect(savedMsg1.content.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text)).toEqual([
        'Transformed answer',
      ]);
      expect(savedMsg1.content.parts.filter((p: any) => p.type === 'tool-invocation')).toHaveLength(1);

      saveSpy.mockRestore();
    });

    it('should preserve a deliberately emptied stored content string against an echo', async () => {
      // The server emptied the content string (e.g. a redaction pass); an empty
      // string is a stored value, not an absent one. The part list keeps the
      // stored shape so the record itself still exists.
      const stored = assistantMessage({
        content: { format: 2, content: '', parts: [{ type: 'text', text: '' }] },
      });
      mockStorage.setMessages([stored]);

      processor = new MessageHistory({ storage: mockStorage });
      const saveSpy = vi.spyOn(mockStorage, 'saveMessages');

      // The client echoes an older copy that still carries the pre-redaction text.
      const staleEcho = assistantMessage({
        content: { format: 2, content: 'Transformed answer', parts: [{ type: 'text', text: 'Transformed answer' }] },
      });
      const newUserMessage = assistantMessage({
        id: 'msg-2',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Next turn' }] },
        createdAt: new Date(baseTime),
      });

      const messageList = new MessageList().add([staleEcho, newUserMessage], 'input');

      await processor.processOutputResult({
        messageList,
        messages: [],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      // The emptied stored string survives: a falsy-but-present stored value must
      // not be refilled from the client echo.
      expect(saveSpy).toHaveBeenCalledWith({
        messages: expect.arrayContaining([
          expect.objectContaining({
            id: 'msg-1',
            content: expect.objectContaining({ content: '', parts: [{ type: 'text', text: '' }] }),
          }),
          expect.objectContaining({ id: 'msg-2' }),
        ]),
      });

      saveSpy.mockRestore();
    });

    it('should merge a client-side tool result into the stored call message', async () => {
      const stored = assistantMessage({
        content: {
          format: 2,
          content: 'Let me look that up',
          parts: [
            { type: 'text', text: 'Let me look that up' },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'call',
                toolCallId: 'call-1',
                toolName: 'search',
                args: { query: 'mastra' },
              },
            },
          ],
        },
      });
      mockStorage.setMessages([stored]);

      processor = new MessageHistory({ storage: mockStorage });
      const saveSpy = vi.spyOn(mockStorage, 'saveMessages');

      // Client executed the tool and returns the same assistant message ID with the
      // invocation advanced to `result`, carrying client-side args that differ
      // from the stored call's args (the client copy must not replace them).
      const echoWithResult = assistantMessage({
        content: {
          format: 2,
          content: 'Let me look that up',
          parts: [
            { type: 'text', text: 'Let me look that up' },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call-1',
                toolName: 'search',
                args: { query: 'client-modified' },
                result: 'result-from-client',
              },
            },
          ],
        },
      });

      const messageList = new MessageList().add([echoWithResult], 'input');

      await processor.processOutputResult({
        messageList,
        messages: [],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      const savedMessages = (saveSpy.mock.calls[0]![0] as any).messages as MastraDBMessage[];
      const savedMsg1 = savedMessages.find(m => m.id === 'msg-1');
      const toolPart = savedMsg1!.content.parts.find((p: any) => p.type === 'tool-invocation')!;

      // The client-authored result is stored, but the server-authored args, name,
      // and text are not discarded.
      expect(toolPart.toolInvocation).toMatchObject({
        state: 'result',
        toolCallId: 'call-1',
        toolName: 'search',
        result: 'result-from-client',
        args: { query: 'mastra' },
      });

      saveSpy.mockRestore();
    });

    it('should fail closed when the stored-record lookup throws instead of persisting an unreconciled upsert', async () => {
      processor = new MessageHistory({ storage: mockStorage });
      const lookupError = new Error('lookup unavailable');
      vi.spyOn(mockStorage, 'listMessagesById').mockRejectedValueOnce(lookupError);
      const saveSpy = vi.spyOn(mockStorage, 'saveMessages');
      const currentSpan = {
        update: vi.fn(),
      };

      const input = assistantMessage({
        id: 'msg-input',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Next turn' }] },
      });
      const output = assistantMessage({
        id: 'msg-output',
        content: { format: 2, parts: [{ type: 'text', text: 'Next answer' }] },
      });
      const messageList = new MessageList().add([input], 'input').add([output], 'response');

      // A transient read failure must not fall back to an unreconciled upsert that
      // could clobber the canonical stored records: the whole save fails closed.
      await expect(
        processor.processOutputResult({
          messageList,
          messages: [],
          abort: mockAbort,
          requestContext: createRuntimeContextWithMemory('thread-1'),
          tracingContext: { currentSpan } as any,
        }),
      ).rejects.toThrow('lookup unavailable');

      expect(currentSpan.update).toHaveBeenCalledWith({ attributes: { reconciliationMessageCount: 1 } });
      // No unreconciled write happened.
      expect(saveSpy).not.toHaveBeenCalled();

      saveSpy.mockRestore();
    });

    it('should fail closed when the storage cannot look up stored records by ID', async () => {
      // A storage adapter that does not support the ID-scoped lookup cannot be
      // reconciled against, so persisting its client input would be an
      // unreconciled upsert. The processor must refuse rather than reopen the
      // clobber vector.
      const storageWithoutLookup = new MockStorage();
      (storageWithoutLookup as any).listMessagesById = undefined;
      processor = new MessageHistory({ storage: storageWithoutLookup });
      const saveSpy = vi.spyOn(storageWithoutLookup, 'saveMessages');

      const input = assistantMessage({
        id: 'msg-input',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Next turn' }] },
      });

      await expect(
        processor.processOutputResult({
          messageList: new MessageList().add([input], 'input'),
          messages: [],
          abort: mockAbort,
          requestContext: createRuntimeContextWithMemory('thread-1'),
        }),
      ).rejects.toThrow('listMessagesById is required');

      expect(saveSpy).not.toHaveBeenCalled();

      saveSpy.mockRestore();
    });

    it('should preserve a v4 client-authored error result without accepting other client fields', async () => {
      const stored = assistantMessage({
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'call',
                toolCallId: 'call-1',
                toolName: 'search',
                args: { query: 'mastra' },
              },
            },
          ],
        },
      });
      mockStorage.setMessages([stored]);

      processor = new MessageHistory({ storage: mockStorage });
      const saveSpy = vi.spyOn(mockStorage, 'saveMessages');
      const echoWithError = assistantMessage({
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call-1',
                toolName: 'client-tool-name',
                args: { query: 'client-modified', injected: true },
                result: 'Search failed',
                isError: true,
                errorText: 'Search failed',
                rawInput: { injected: true },
              },
            },
          ],
        },
      });

      await processor.processOutputResult({
        messageList: new MessageList().add([echoWithError], 'input'),
        messages: [],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      const savedMessages = (saveSpy.mock.calls[0]![0] as any).messages as MastraDBMessage[];
      const toolPart = savedMessages[0]!.content.parts.find(part => part.type === 'tool-invocation');
      expect(toolPart?.type).toBe('tool-invocation');
      if (toolPart?.type !== 'tool-invocation') throw new Error('Expected a tool-invocation part');
      expect(toolPart.toolInvocation).toEqual({
        state: 'result',
        toolCallId: 'call-1',
        toolName: 'search',
        args: { query: 'mastra' },
        result: 'Search failed',
        isError: true,
        errorText: 'Search failed',
      });

      saveSpy.mockRestore();
    });

    it('should preserve v4 error fields in the legacy toolInvocations result path', async () => {
      const stored = assistantMessage({
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Searching' }],
          toolInvocations: [
            {
              state: 'call',
              toolCallId: 'call-1',
              toolName: 'search',
              args: { query: 'mastra' },
            },
          ],
        },
      });
      mockStorage.setMessages([stored]);

      processor = new MessageHistory({ storage: mockStorage });
      const saveSpy = vi.spyOn(mockStorage, 'saveMessages');
      const echoWithError = assistantMessage({
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Searching' }],
          toolInvocations: [
            {
              state: 'result',
              toolCallId: 'call-1',
              toolName: 'client-tool-name',
              args: { query: 'client-modified', injected: true },
              result: 'Search failed',
              isError: true,
              errorText: 'Search failed',
            },
          ],
        },
      });

      await processor.processOutputResult({
        messageList: new MessageList().add([echoWithError], 'input'),
        messages: [],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      const savedMessages = (saveSpy.mock.calls[0]![0] as any).messages as MastraDBMessage[];
      expect(savedMessages[0]!.content.toolInvocations).toEqual([
        {
          state: 'result',
          toolCallId: 'call-1',
          toolName: 'search',
          args: { query: 'mastra' },
          result: 'Search failed',
          isError: true,
          errorText: 'Search failed',
        },
      ]);

      saveSpy.mockRestore();
    });

    it('should preserve a v6 client-authored output error without accepting other client fields', async () => {
      const stored = assistantMessage({
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'call',
                toolCallId: 'call-1',
                toolName: 'search',
                args: { query: 'mastra' },
              },
            },
          ],
        },
      });
      mockStorage.setMessages([stored]);

      processor = new MessageHistory({ storage: mockStorage });
      const saveSpy = vi.spyOn(mockStorage, 'saveMessages');
      const echoWithError = assistantMessage({
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'output-error',
                toolCallId: 'call-1',
                toolName: 'client-tool-name',
                args: { query: 'client-modified', injected: true },
                errorText: 'Search failed',
                result: 'client-result',
                isError: false,
                rawInput: { injected: true },
              },
            },
          ],
        },
      });

      await processor.processOutputResult({
        messageList: new MessageList().add([echoWithError], 'input'),
        messages: [],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      const savedMessages = (saveSpy.mock.calls[0]![0] as any).messages as MastraDBMessage[];
      const toolPart = savedMessages[0]!.content.parts.find(part => part.type === 'tool-invocation');
      expect(toolPart?.type).toBe('tool-invocation');
      if (toolPart?.type !== 'tool-invocation') throw new Error('Expected a tool-invocation part');
      expect(toolPart.toolInvocation).toEqual({
        state: 'output-error',
        toolCallId: 'call-1',
        toolName: 'search',
        args: { query: 'mastra' },
        errorText: 'Search failed',
      });

      saveSpy.mockRestore();
    });

    it('should never adopt client-supplied toolName or client-injected args keys', async () => {
      const stored = assistantMessage({
        content: {
          format: 2,
          content: 'Let me look that up',
          parts: [
            { type: 'text', text: 'Let me look that up' },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'call',
                toolCallId: 'call-1',
                toolName: 'search',
                args: { query: 'mastra' },
              },
            },
          ],
        },
      });
      mockStorage.setMessages([stored]);

      processor = new MessageHistory({ storage: mockStorage });
      const saveSpy = vi.spyOn(mockStorage, 'saveMessages');

      // The client echo returns the invocation with a different toolName and
      // extra args keys the server call never had.
      const echoWithResult = assistantMessage({
        content: {
          format: 2,
          content: 'Let me look that up',
          parts: [
            { type: 'text', text: 'Let me look that up' },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call-1',
                toolName: 'other-tool',
                args: { query: 'client-modified', injected: 'key' },
                result: 'result-from-client',
              },
            },
          ],
        },
      });

      const messageList = new MessageList().add([echoWithResult], 'input');

      await processor.processOutputResult({
        messageList,
        messages: [],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      const savedMessages = (saveSpy.mock.calls[0]![0] as any).messages as MastraDBMessage[];
      const savedMsg1 = savedMessages.find(m => m.id === 'msg-1');
      const toolPart = savedMsg1!.content.parts.find((p: any) => p.type === 'tool-invocation')!;

      // Only fields from a supported terminal transition are taken from the
      // client. The server-authored toolName and args (exactly, without injected
      // keys) survive.
      expect(toolPart.toolInvocation).toEqual({
        state: 'result',
        toolCallId: 'call-1',
        toolName: 'search',
        args: { query: 'mastra' },
        result: 'result-from-client',
      });

      saveSpy.mockRestore();
    });

    it('should not adopt client tool history when the stored message has no legacy toolInvocations', async () => {
      const stored = assistantMessage({
        content: { format: 2, content: 'Answer', parts: [{ type: 'text', text: 'Answer' }] },
      });
      mockStorage.setMessages([stored]);

      processor = new MessageHistory({ storage: mockStorage });
      const saveSpy = vi.spyOn(mockStorage, 'saveMessages');

      // The client copy carries a legacy toolInvocations array the server never stored.
      const echo = assistantMessage({
        content: {
          format: 2,
          content: 'Answer',
          parts: [{ type: 'text', text: 'Answer' }],
          toolInvocations: [
            {
              state: 'result',
              toolCallId: 'call-1',
              toolName: 'search',
              args: { query: 'x' },
              result: 'found',
            },
          ],
        } as any,
      });

      const messageList = new MessageList().add([echo], 'input');

      await processor.processOutputResult({
        messageList,
        messages: [],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      const savedMessages = (saveSpy.mock.calls[0]![0] as any).messages as MastraDBMessage[];
      const savedMsg1 = savedMessages.find(m => m.id === 'msg-1');
      expect(savedMsg1!.content.toolInvocations).toBeUndefined();

      saveSpy.mockRestore();
    });

    it('should drop echo-only metadata keys', async () => {
      const stored = assistantMessage({
        content: {
          format: 2,
          content: 'Answer',
          parts: [{ type: 'text', text: 'Answer' }],
          metadata: { sealed: true },
        },
      });
      mockStorage.setMessages([stored]);

      processor = new MessageHistory({ storage: mockStorage });
      const saveSpy = vi.spyOn(mockStorage, 'saveMessages');

      // The echo pre-seeds a metadata key the server never set.
      const echo = assistantMessage({
        content: {
          format: 2,
          content: 'Answer',
          parts: [{ type: 'text', text: 'Answer' }],
          metadata: { sealed: true, clientSeeded: 'x' },
        },
      });

      const messageList = new MessageList().add([echo], 'input');

      await processor.processOutputResult({
        messageList,
        messages: [],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      const savedMessages = (saveSpy.mock.calls[0]![0] as any).messages as MastraDBMessage[];
      const savedMsg1 = savedMessages.find(m => m.id === 'msg-1');
      expect(savedMsg1!.content.metadata).toEqual({ sealed: true });

      saveSpy.mockRestore();
    });

    it('should not accept incoming-only parts regardless of position', async () => {
      const stored = assistantMessage({
        content: {
          format: 2,
          content: 'Let me look that up',
          parts: [
            { type: 'text', text: 'Let me look that up' },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call-1',
                toolName: 'search',
                args: { query: 'mastra' },
                result: 'found',
              },
            },
          ],
        },
      });
      mockStorage.setMessages([stored]);

      processor = new MessageHistory({ storage: mockStorage });
      const saveSpy = vi.spyOn(mockStorage, 'saveMessages');

      // The echo carries two text parts the stored message never had: one at a
      // position where the stored array has a part, one at a tail index. Under a
      // positional rule the tail one would survive while the other is dropped —
      // the rule must be position-independent: incoming-only parts are never
      // accepted.
      const echo = assistantMessage({
        content: {
          format: 2,
          content: 'Let me look that up',
          parts: [
            { type: 'text', text: 'Let me look that up' },
            { type: 'text', text: 'New client part 1' },
            { type: 'text', text: 'New client part 2' },
          ],
        },
      });

      const messageList = new MessageList().add([echo], 'input');

      await processor.processOutputResult({
        messageList,
        messages: [],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      const savedMessages = (saveSpy.mock.calls[0]![0] as any).messages as MastraDBMessage[];
      const savedMsg1 = savedMessages.find(m => m.id === 'msg-1');
      const savedTexts = savedMsg1!.content.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text);
      expect(savedTexts).toEqual(['Let me look that up']);

      saveSpy.mockRestore();
    });

    it('should keep an edited user message and skip an unchanged user echo', async () => {
      const stored = {
        id: 'msg-1',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Original question' }] },
        threadId: 'thread-1',
        createdAt: new Date(baseTime - 1000),
      } as MastraDBMessage;
      mockStorage.setMessages([stored]);

      processor = new MessageHistory({ storage: mockStorage });
      const saveSpy = vi.spyOn(mockStorage, 'saveMessages');

      const edited = {
        ...stored,
        content: { format: 2, parts: [{ type: 'text', text: 'Edited question' }] },
      } as MastraDBMessage;
      const messageList = new MessageList().add([edited], 'input');

      await processor.processOutputResult({
        messageList,
        messages: [],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      // The client is the author of user messages: the edit is persisted as-is
      // instead of being discarded by the server-wins merge.
      const savedMessages = (saveSpy.mock.calls[0]![0] as any).messages as MastraDBMessage[];
      expect(savedMessages.map(m => m.id)).toEqual(['msg-1']);
      expect(savedMessages[0]!.content.parts.map((p: any) => ({ type: p.type, text: p.text }))).toEqual([
        { type: 'text', text: 'Edited question' },
      ]);

      // An unchanged re-send of the same user message is still recognized as a
      // stale echo and not re-persisted.
      const unchanged = { ...stored } as MastraDBMessage;
      const messageList2 = new MessageList().add([unchanged], 'input');
      await processor.processOutputResult({
        messageList: messageList2,
        messages: [],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });
      expect(saveSpy.mock.calls.length).toBe(1);

      saveSpy.mockRestore();
    });

    it('should reject an edited echo of a sealed user message', async () => {
      // Observational memory stamps `content.metadata.mastra.sealed` onto a user
      // message once it has crossed an observation boundary. (It does not append
      // `data-om-*` marker parts to user messages, so the stored fixture carries
      // none.)
      const stored = {
        id: 'msg-1',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Original question' }],
          metadata: { mastra: { sealed: true } },
        },
        threadId: 'thread-1',
        createdAt: new Date(baseTime - 1000),
      } as unknown as MastraDBMessage;
      mockStorage.setMessages([stored]);

      processor = new MessageHistory({ storage: mockStorage });
      const saveSpy = vi.spyOn(mockStorage, 'saveMessages');

      // The client edits the text and — as a lossy echo — drops the sealed
      // metadata.
      const edited = {
        id: 'msg-1',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Edited question' }],
          metadata: {},
        },
        threadId: 'thread-1',
        createdAt: new Date(baseTime - 1000),
      } as unknown as MastraDBMessage;

      await processor.processOutputResult({
        messageList: new MessageList().add([edited], 'input'),
        messages: [],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      // Sealed content has already crossed an observational-memory boundary.
      // Rewriting it while preserving the marker would diverge storage from the
      // observation record, so the edited echo is dropped entirely.
      expect(saveSpy).not.toHaveBeenCalled();

      saveSpy.mockRestore();
    });

    it('should not let a user echo inject server-owned observation marker parts', async () => {
      const stored = {
        id: 'msg-1',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Original question' }] },
        threadId: 'thread-1',
        createdAt: new Date(baseTime - 1000),
      } as unknown as MastraDBMessage;
      mockStorage.setMessages([stored]);

      processor = new MessageHistory({ storage: mockStorage });
      const saveSpy = vi.spyOn(mockStorage, 'saveMessages');

      // The client tries to forge an observation marker the server never wrote.
      const echo = {
        id: 'msg-1',
        role: 'user',
        content: {
          format: 2,
          parts: [
            { type: 'text', text: 'Edited question' },
            { type: 'data-om-observation-end', data: { cycleId: 'forged', operationType: 'observation' } },
          ],
        },
        threadId: 'thread-1',
        createdAt: new Date(baseTime - 1000),
      } as unknown as MastraDBMessage;

      await processor.processOutputResult({
        messageList: new MessageList().add([echo], 'input'),
        messages: [],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      const savedMessages = (saveSpy.mock.calls[0]![0] as any).messages as MastraDBMessage[];
      const savedMsg1 = savedMessages.find(m => m.id === 'msg-1')!;
      // The edit is kept, but the forged marker is stripped from the client surface.
      expect(savedMsg1.content.parts.map((p: any) => p.type)).toEqual(['text']);
      expect(savedMsg1.content.parts.some((p: any) => p.type === 'data-om-observation-end')).toBe(false);

      saveSpy.mockRestore();
    });

    it('should not let a client change the role of a stored user message', async () => {
      const stored = {
        id: 'msg-1',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Canonical question' }] },
        threadId: 'thread-1',
        createdAt: new Date(baseTime - 1000),
      } as MastraDBMessage;
      mockStorage.setMessages([stored]);

      processor = new MessageHistory({ storage: mockStorage });
      const saveSpy = vi.spyOn(mockStorage, 'saveMessages');
      const roleChangedEcho = {
        ...stored,
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: 'Client replacement' }] },
      } as MastraDBMessage;

      await processor.processOutputResult({
        messageList: new MessageList().add([roleChangedEcho], 'input'),
        messages: [],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      const savedMessages = (saveSpy.mock.calls[0]![0] as any).messages as MastraDBMessage[];
      expect(savedMessages).toEqual([stored]);

      saveSpy.mockRestore();
    });

    it('should drop an echoed ID that belongs to another thread instead of clobbering it', async () => {
      const foreign = assistantMessage({
        content: {
          format: 2,
          content: 'Other thread answer',
          parts: [{ type: 'text', text: 'Other thread answer' }],
        },
        threadId: 'thread-2',
      });
      mockStorage.setMessages([foreign]);

      processor = new MessageHistory({ storage: mockStorage });
      const saveSpy = vi.spyOn(mockStorage, 'saveMessages');

      // msg-1 canonically belongs to thread-2. The client echoes it into thread-1
      // alongside a genuinely new message.
      const foreignEcho = assistantMessage({
        content: {
          format: 2,
          content: 'Other thread answer',
          parts: [{ type: 'text', text: 'Other thread answer' }],
        },
        threadId: 'thread-1',
      });
      const genuinelyNew = assistantMessage({
        id: 'msg-2',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Next turn' }] },
        threadId: 'thread-1',
        createdAt: new Date(baseTime),
      });

      const messageList = new MessageList().add([foreignEcho, genuinelyNew], 'input');

      await processor.processOutputResult({
        messageList,
        messages: [],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      // Persistence upserts on ID, so writing the foreign-thread ID under thread-1
      // would clobber thread-2's canonical record. The echo is dropped; only the
      // genuinely new message is persisted.
      const savedMessages = (saveSpy.mock.calls[0]![0] as any).messages as MastraDBMessage[];
      expect(savedMessages.map(m => m.id)).toEqual(['msg-2']);

      saveSpy.mockRestore();
    });

    it('should warn when a foreign-thread ID is dropped so the loss is not silent', async () => {
      const foreign = assistantMessage({ threadId: 'thread-2' });
      mockStorage.setMessages([foreign]);

      const warn = vi.fn();
      processor = new MessageHistory({
        storage: mockStorage,
        getLogger: () => ({ warn }) as any,
      });
      const saveSpy = vi.spyOn(mockStorage, 'saveMessages');

      const foreignEcho = assistantMessage({ threadId: 'thread-1' });
      const genuinelyNew = assistantMessage({
        id: 'msg-2',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Next turn' }] },
        threadId: 'thread-1',
        createdAt: new Date(baseTime),
      });

      await processor.processOutputResult({
        messageList: new MessageList().add([foreignEcho, genuinelyNew], 'input'),
        messages: [],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      expect(warn).toHaveBeenCalledTimes(1);
      const [message, context] = warn.mock.calls[0]!;
      expect(message).toContain('foreign-thread');
      expect(context).toMatchObject({
        threadId: 'thread-1',
        droppedMessageIds: ['msg-1'],
      });
      expect(String((context as any).reason)).toContain('foreign-thread ID collision');

      saveSpy.mockRestore();
    });

    it('should stamp the dropped-message count on the memory span and stay quiet when nothing is dropped', async () => {
      const foreign = assistantMessage({ threadId: 'thread-2' });
      mockStorage.setMessages([foreign]);

      const warn = vi.fn();
      const currentSpan = { update: vi.fn() };
      processor = new MessageHistory({
        storage: mockStorage,
        getLogger: () => ({ warn }) as any,
      });

      await processor.processOutputResult({
        messageList: new MessageList().add([assistantMessage({ threadId: 'thread-1' })], 'input'),
        messages: [],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
        tracingContext: { currentSpan } as any,
      });

      expect(currentSpan.update).toHaveBeenCalledWith({ attributes: { reconciliationDroppedMessageCount: 1 } });

      // Nothing foreign in the second batch: the attribute is still stamped, as
      // zero, and no warn is emitted.
      currentSpan.update.mockClear();
      warn.mockClear();
      await processor.processOutputResult({
        messageList: new MessageList().add(
          [
            assistantMessage({
              id: 'msg-3',
              role: 'user',
              content: { format: 2, parts: [{ type: 'text', text: 'Fresh' }] },
              threadId: 'thread-1',
              createdAt: new Date(baseTime),
            }),
          ],
          'input',
        ),
        messages: [],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
        tracingContext: { currentSpan } as any,
      });

      expect(currentSpan.update).toHaveBeenCalledWith({ attributes: { reconciliationDroppedMessageCount: 0 } });
      expect(warn).not.toHaveBeenCalled();
    });

    it('should still drop the foreign-thread echo when no logger is reachable', async () => {
      const foreign = assistantMessage({ threadId: 'thread-2' });
      mockStorage.setMessages([foreign]);

      // No getLogger option: observability is additive, the drop policy is not
      // conditional on a logger being available.
      processor = new MessageHistory({ storage: mockStorage });
      const saveSpy = vi.spyOn(mockStorage, 'saveMessages');

      const genuinelyNew = assistantMessage({
        id: 'msg-2',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Next turn' }] },
        threadId: 'thread-1',
        createdAt: new Date(baseTime),
      });

      await processor.processOutputResult({
        messageList: new MessageList().add([assistantMessage({ threadId: 'thread-1' }), genuinelyNew], 'input'),
        messages: [],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      const savedMessages = (saveSpy.mock.calls[0]![0] as any).messages as MastraDBMessage[];
      expect(savedMessages.map(m => m.id)).toEqual(['msg-2']);
      // The foreign canonical record is untouched.
      expect((await mockStorage.listMessagesById({ messageIds: ['msg-1'] })).messages[0]!.threadId).toBe('thread-2');

      saveSpy.mockRestore();
    });

    it('should drop an echoed ID from another resource in the same thread instead of clobbering it', async () => {
      const foreign = assistantMessage({ resourceId: 'resource-2' });
      mockStorage.setMessages([foreign]);

      processor = new MessageHistory({ storage: mockStorage });
      const saveSpy = vi.spyOn(mockStorage, 'saveMessages');
      const foreignEcho = assistantMessage({ resourceId: 'resource-1' });
      const genuinelyNew = assistantMessage({
        id: 'msg-2',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Next turn' }] },
        resourceId: 'resource-1',
        createdAt: new Date(baseTime),
      });

      await processor.processOutputResult({
        messageList: new MessageList().add([foreignEcho, genuinelyNew], 'input'),
        messages: [],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1', 'resource-1'),
      });

      const savedMessages = (saveSpy.mock.calls[0]![0] as any).messages as MastraDBMessage[];
      expect(savedMessages.map(m => m.id)).toEqual(['msg-2']);

      saveSpy.mockRestore();
    });

    it('should not adopt tool-invocation fields outside the terminal whitelist', async () => {
      const stored = assistantMessage({
        content: {
          format: 2,
          content: 'Let me look that up',
          parts: [
            { type: 'text', text: 'Let me look that up' },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'call',
                toolCallId: 'call-1',
                toolName: 'search',
                args: { query: 'mastra' },
              },
            },
          ],
        },
      });
      mockStorage.setMessages([stored]);

      processor = new MessageHistory({ storage: mockStorage });
      const saveSpy = vi.spyOn(mockStorage, 'saveMessages');

      // The client echo advances the call to a result but also smuggles a
      // server-authored-only field (`rawInput`) and an `approval` object the
      // server never stored. Neither is part of the client-contributable
      // whitelist, so neither may reach the persisted record.
      const echoWithResult = assistantMessage({
        content: {
          format: 2,
          content: 'Let me look that up',
          parts: [
            { type: 'text', text: 'Let me look that up' },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call-1',
                toolName: 'search',
                args: { query: 'mastra' },
                result: 'result-from-client',
                rawInput: { query: 'client-injected-raw-input' },
                approval: { id: 'client-approval', approved: true },
              },
            },
          ],
        },
      });

      const messageList = new MessageList().add([echoWithResult], 'input');

      await processor.processOutputResult({
        messageList,
        messages: [],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      const savedMessages = (saveSpy.mock.calls[0]![0] as any).messages as MastraDBMessage[];
      const savedMsg1 = savedMessages.find(m => m.id === 'msg-1');
      const toolPart = savedMsg1!.content.parts.find((pp: any) => pp.type === 'tool-invocation')!;

      // Only the whitelisted terminal field (`result`) is taken from the client;
      // `rawInput` and `approval` are dropped.
      expect(toolPart.toolInvocation).toEqual({
        state: 'result',
        toolCallId: 'call-1',
        toolName: 'search',
        args: { query: 'mastra' },
        result: 'result-from-client',
      });

      saveSpy.mockRestore();
    });

    it('codifies the client-contributable terminal-field whitelist as an explicit constant', () => {
      // This guard fails loudly if the client-contributable surface is ever
      // widened silently: any new key here is a new field a client echo could
      // overwrite on a server-authored tool call.
      expect(CLIENT_CONTRIBUTABLE_TERMINAL_FIELDS).toEqual({
        result: ['result', 'isError', 'errorText'],
        'output-error': ['errorText'],
      });
    });
  });
});
