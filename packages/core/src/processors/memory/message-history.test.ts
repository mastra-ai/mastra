import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MastraDBMessage } from '../../agent';
import { MessageList } from '../../agent';
import type { MemoryRuntimeContext } from '../../memory';
import { MASTRA_MEMORY_HISTORY_OVERRIDE_KEY, RequestContext } from '../../request-context';
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
    const { threadId, resourceId, perPage = false, page = 1, orderBy } = params;
    const threadMessages = this.messages.filter(
      m => m.threadId === threadId && (resourceId === undefined || m.resourceId === resourceId),
    );

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
  deleteMessages = vi.fn(async (messageIds: string[]) => {
    this.messages = this.messages.filter(message => !message.id || !messageIds.includes(message.id));
  });
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

    it('should recall only messages before the assistant target when regenerating', async () => {
      const storedMessages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Question 1' }] },
          threadId: 'thread-1',
          resourceId: 'resource-1',
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'Answer 1' }] },
          threadId: 'thread-1',
          resourceId: 'resource-1',
          createdAt: new Date('2024-01-01T10:01:00Z'),
        },
        {
          id: 'msg-3',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Question 2' }] },
          threadId: 'thread-1',
          resourceId: 'resource-1',
          createdAt: new Date('2024-01-01T10:02:00Z'),
        },
        {
          id: 'msg-4',
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'Answer 2' }] },
          threadId: 'thread-1',
          resourceId: 'resource-1',
          createdAt: new Date('2024-01-01T10:03:00Z'),
        },
      ];
      mockStorage.setMessages(storedMessages);
      const requestContext = createRuntimeContextWithMemory('thread-1', 'resource-1');
      requestContext.set(MASTRA_MEMORY_HISTORY_OVERRIDE_KEY, {
        type: 'regenerate',
        targetMessageId: 'msg-2',
      });
      const state: Record<string, unknown> = {};
      processor = new MessageHistory({ storage: mockStorage });

      const result = await processor.processInput({
        messages: [],
        messageList: new MessageList(),
        abort: mockAbort,
        requestContext,
        state,
      });

      expect(result).toBeInstanceOf(MessageList);
      expect((result as MessageList).get.all.db().map(message => message.id)).toEqual(['msg-1']);
      expect(state.regenerate).toEqual({
        type: 'regenerate',
        branchMessageIds: ['msg-2', 'msg-3', 'msg-4'],
      });
    });

    it('should reject regenerate targets that are not assistant messages', async () => {
      mockStorage.setMessages([
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Question' }] },
          threadId: 'thread-1',
          resourceId: 'resource-1',
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
      ]);
      const requestContext = createRuntimeContextWithMemory('thread-1', 'resource-1');
      requestContext.set(MASTRA_MEMORY_HISTORY_OVERRIDE_KEY, {
        type: 'regenerate',
        targetMessageId: 'msg-1',
      });
      processor = new MessageHistory({ storage: mockStorage });

      await expect(
        processor.processInput({
          messages: [],
          messageList: new MessageList(),
          abort: mockAbort,
          requestContext,
          state: {},
        }),
      ).rejects.toThrow('Cannot regenerate non-assistant message "msg-1"');
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

    it('should delete incomplete assistant messages before recalling server history', async () => {
      const storedMessages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Question 1' }] },
          threadId: 'thread-1',
          resourceId: 'resource-1',
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'Partial answer' }],
            metadata: { mastra: { responseStatus: 'aborted' } },
          },
          threadId: 'thread-1',
          resourceId: 'resource-1',
          createdAt: new Date('2024-01-01T10:01:00Z'),
        },
        {
          id: 'msg-3',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Question 2' }] },
          threadId: 'thread-1',
          resourceId: 'resource-1',
          createdAt: new Date('2024-01-01T10:02:00Z'),
        },
      ];
      mockStorage.setMessages(storedMessages);
      processor = new MessageHistory({ storage: mockStorage });
      const requestContext = createRuntimeContextWithMemory('thread-1', 'resource-1');
      requestContext.set(MASTRA_MEMORY_HISTORY_OVERRIDE_KEY, { type: 'server-history' });
      const messageList = new MessageList();

      const result = await processor.processInput({
        messages: [],
        messageList,
        abort: mockAbort,
        requestContext,
      });

      expect((result as MessageList).get.all.db().map(message => message.id)).toEqual(['msg-1', 'msg-3']);
      expect(mockStorage.deleteMessages).toHaveBeenCalledWith(['msg-2']);
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

    it('should update thread metadata', async () => {
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

      expect(mockStorage.updateThread).toHaveBeenCalledWith({
        id: 'thread-1',
        title: 'Test Thread',
        metadata: expect.objectContaining({
          createdAt: expect.any(Date),
        }),
      });
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

    it('should delete the regenerated branch only after a replacement response is saved', async () => {
      const mockStorage = {
        saveMessages: vi.fn().mockResolvedValue(undefined),
        deleteMessages: vi.fn().mockResolvedValue(undefined),
        getThreadById: vi.fn().mockResolvedValue({
          id: 'thread-1',
          title: 'Test Thread',
          metadata: {},
        }),
        listMessages: vi.fn().mockResolvedValue({ messages: [], total: 0 }),
        updateThread: vi.fn().mockResolvedValue(undefined),
      } as unknown as MemoryStorage;
      const processor = new MessageHistory({ storage: mockStorage });
      const response: MastraDBMessage = {
        id: 'new-assistant',
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: 'Replacement answer' }] },
        createdAt: new Date(),
      };
      const messageList = new MessageList().add(response, 'response');

      await processor.processOutputResult({
        messageList,
        messages: [response],
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        requestContext: createRuntimeContextWithMemory('thread-1'),
        state: {
          regenerate: {
            type: 'regenerate',
            branchMessageIds: ['old-assistant', 'follow-up-user', 'follow-up-assistant'],
          },
        },
      });

      expect(mockStorage.saveMessages).toHaveBeenCalledTimes(1);
      expect(mockStorage.deleteMessages).toHaveBeenCalledWith([
        'old-assistant',
        'follow-up-user',
        'follow-up-assistant',
      ]);
    });

    it('should not delete a regenerated branch when no replacement response is produced', async () => {
      const mockStorage = {
        saveMessages: vi.fn().mockResolvedValue(undefined),
        deleteMessages: vi.fn().mockResolvedValue(undefined),
        getThreadById: vi.fn().mockResolvedValue({
          id: 'thread-1',
          title: 'Test Thread',
          metadata: {},
        }),
        listMessages: vi.fn().mockResolvedValue({ messages: [], total: 0 }),
        updateThread: vi.fn().mockResolvedValue(undefined),
      } as unknown as MemoryStorage;
      const processor = new MessageHistory({ storage: mockStorage });
      const input: MastraDBMessage = {
        id: 'new-user',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'New question' }] },
        createdAt: new Date(),
      };
      const messageList = new MessageList().add(input, 'input');

      await processor.processOutputResult({
        messageList,
        messages: [input],
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        requestContext: createRuntimeContextWithMemory('thread-1'),
        state: {
          regenerate: {
            type: 'regenerate',
            branchMessageIds: ['old-assistant'],
          },
        },
      });

      expect(mockStorage.saveMessages).toHaveBeenCalledTimes(1);
      expect(mockStorage.deleteMessages).not.toHaveBeenCalled();
    });

    it('should not delete a regenerated branch when the replacement response is incomplete', async () => {
      const mockStorage = {
        saveMessages: vi.fn().mockResolvedValue(undefined),
        deleteMessages: vi.fn().mockResolvedValue(undefined),
        getThreadById: vi.fn().mockResolvedValue({
          id: 'thread-1',
          title: 'Test Thread',
          metadata: {},
        }),
        listMessages: vi.fn().mockResolvedValue({ messages: [], total: 0 }),
        updateThread: vi.fn().mockResolvedValue(undefined),
      } as unknown as MemoryStorage;
      const processor = new MessageHistory({ storage: mockStorage });
      const response: MastraDBMessage = {
        id: 'partial-assistant',
        role: 'assistant',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Partial replacement' }],
          metadata: { mastra: { responseStatus: 'aborted' } },
        },
        createdAt: new Date(),
      };
      const messageList = new MessageList().add(response, 'response');

      await processor.processOutputResult({
        messageList,
        messages: [response],
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        requestContext: createRuntimeContextWithMemory('thread-1'),
        state: {
          regenerate: {
            type: 'regenerate',
            branchMessageIds: ['old-assistant'],
          },
        },
      });

      expect(mockStorage.saveMessages).not.toHaveBeenCalled();
      expect(mockStorage.deleteMessages).not.toHaveBeenCalled();
    });

    it('should not persist incomplete assistant responses in client-history mode', async () => {
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
      const processor = new MessageHistory({ storage: mockStorage });
      const response: MastraDBMessage = {
        id: 'partial-assistant',
        role: 'assistant',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Partial answer' }],
          metadata: { mastra: { responseStatus: 'aborted' } },
        },
        createdAt: new Date(),
      };
      const messageList = new MessageList().add(response, 'response');

      await processor.processOutputResult({
        messageList,
        messages: [response],
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      expect(mockStorage.saveMessages).not.toHaveBeenCalled();
    });

    it('should persist incomplete assistant responses when server-history recovery is enabled', async () => {
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
      const processor = new MessageHistory({ storage: mockStorage });
      const response: MastraDBMessage = {
        id: 'partial-assistant',
        role: 'assistant',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Partial answer' }],
          metadata: { mastra: { responseStatus: 'aborted' } },
        },
        createdAt: new Date(),
      };
      const messageList = new MessageList().add(response, 'response');
      const requestContext = createRuntimeContextWithMemory('thread-1');
      requestContext.set(MASTRA_MEMORY_HISTORY_OVERRIDE_KEY, { type: 'server-history' });

      await processor.processOutputResult({
        messageList,
        messages: [response],
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        requestContext,
      });

      expect(mockStorage.saveMessages).toHaveBeenCalledWith({
        messages: [expect.objectContaining({ id: 'partial-assistant' })],
      });
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
  });
});
