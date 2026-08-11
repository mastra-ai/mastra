import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MastraDBMessage } from '../../agent';
import { MessageList } from '../../agent';
import { createSignal } from '../../agent/signals';
import { MemoryRunState } from '../../memory';
import type { MemoryRuntimeContext } from '../../memory';
import { RequestContext } from '../../request-context';
import { MemoryStorage } from '../../storage';
import type { StorageListThreadsInput, StorageListThreadsOutput } from '../../storage/types';

import { MessageHistory } from './message-history.js';

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

    it('should filter out ONLY system messages', async () => {
      const mockStorage = {
        saveMessages: vi.fn().mockResolvedValue(undefined),
        getThreadById: vi.fn().mockResolvedValue({
          id: 'thread-1',
          title: 'Test Thread',
          metadata: {},
        }),
        listMessages: vi.fn().mockResolvedValue({ messages: [], total: 0 }),
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

    it('should record a stored-record lookup failure and persist the original input and output', async () => {
      processor = new MessageHistory({ storage: mockStorage });
      const lookupError = new Error('lookup unavailable');
      vi.spyOn(mockStorage, 'listMessagesById').mockRejectedValueOnce(lookupError);
      const saveSpy = vi.spyOn(mockStorage, 'saveMessages');
      const lookupSpan = { end: vi.fn(), error: vi.fn() };
      const saveSpan = { end: vi.fn(), error: vi.fn() };
      const currentSpan = {
        createChildSpan: vi.fn().mockReturnValueOnce(lookupSpan).mockReturnValueOnce(saveSpan),
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

      await processor.processOutputResult({
        messageList,
        messages: [],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
        tracingContext: { currentSpan } as any,
      });

      expect(currentSpan.createChildSpan).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          name: 'memory: recall',
          input: { messageIds: ['msg-input'] },
          attributes: { operationType: 'recall', messageCount: 1 },
        }),
      );
      expect(lookupSpan.error).toHaveBeenCalledWith({ error: lookupError, endSpan: true });
      expect(saveSpy).toHaveBeenCalledWith({ messages: [input, output] });
      expect(saveSpan.end).toHaveBeenCalledWith({ output: { success: true } });

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

    it('should treat an echoed ID from another thread as a fresh message', async () => {
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

      const echo = assistantMessage({
        content: {
          format: 2,
          content: 'Other thread answer',
          parts: [{ type: 'text', text: 'Other thread answer' }],
        },
        threadId: 'thread-1',
      });

      const messageList = new MessageList().add([echo], 'input');

      await processor.processOutputResult({
        messageList,
        messages: [],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      // msg-1 resolves to thread-2's record, which is not canonical for this
      // thread: the echo is persisted as-is (fresh message), neither suppressed
      // as an "unchanged echo" nor merged under the foreign thread's IDs.
      expect(saveSpy).toHaveBeenCalledWith({
        messages: [expect.objectContaining({ id: 'msg-1', threadId: 'thread-1' })],
      });

      saveSpy.mockRestore();
    });

    it('should treat an echoed ID from another resource in the same thread as a fresh message', async () => {
      const foreign = assistantMessage({ resourceId: 'resource-2' });
      mockStorage.setMessages([foreign]);

      processor = new MessageHistory({ storage: mockStorage });
      const saveSpy = vi.spyOn(mockStorage, 'saveMessages');
      const echo = assistantMessage({ resourceId: 'resource-1' });

      await processor.processOutputResult({
        messageList: new MessageList().add([echo], 'input'),
        messages: [],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1', 'resource-1'),
      });

      expect(saveSpy).toHaveBeenCalledWith({
        messages: [expect.objectContaining({ id: 'msg-1', threadId: 'thread-1', resourceId: 'resource-1' })],
      });

      saveSpy.mockRestore();
    });
  });
});
