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
import type { MessageHistoryOptions } from './message-history.js';

interface CustomMessageHistoryOptions extends MessageHistoryOptions {
  testLabel: string;
}

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

  describe('constructor options', () => {
    it('keeps MessageHistoryOptions extensible as an interface', () => {
      const options: CustomMessageHistoryOptions = {
        storage: mockStorage,
        testLabel: 'custom-message-history',
      };

      expect(new MessageHistory(options).id).toBe('message-history');
    });

    it('rejects persistence combined with toolCallFilter', () => {
      expect(
        () =>
          new MessageHistory({
            storage: mockStorage,
            persistence: { mode: 'final-turn' },
            toolCallFilter: {},
          }),
      ).toThrowError(
        new TypeError('MessageHistory options.persistence cannot be combined with options.toolCallFilter'),
      );
    });
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

    it.each(['error', 'aborted'])('should not persist a %s run that produced output', async finishReason => {
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
          finishReason,
          steps: [],
        },
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      expect(mockStorage.saveMessages).not.toHaveBeenCalled();
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

    it('applies the transcript projection to direct persistence without mutating the source message', async () => {
      const mockStorage = {
        saveMessages: vi.fn().mockResolvedValue(undefined),
        getThreadById: vi.fn().mockResolvedValue({
          id: 'thread-1',
          title: 'Test Thread',
          metadata: {},
        }),
      } as unknown as MemoryStorage;
      const processor = new MessageHistory({ storage: mockStorage });
      const suspendedTool = {
        toolCallId: 'call-private',
        toolName: 'requestApproval',
        args: { documentId: 'RAW_TOOL_ARGS' },
        approvedArgs: { documentId: 'PRIVATE_APPROVED_ARGS' },
        approvalInputIdentityDigest: 'PRIVATE_APPROVAL_DIGEST',
        suspendPayload: { reason: 'RAW_SUSPENSION_PAYLOAD' },
        metadata: {
          mastra: {
            toolPayloadTransform: {
              transcript: {
                'input-available': { transformed: { documentId: 'PUBLIC_TOOL_ARGS' } },
                suspend: { transformed: { reason: 'PUBLIC_SUSPENSION_PAYLOAD' } },
              },
            },
          },
        },
      };
      const message: MastraDBMessage = {
        id: 'msg-private-suspension',
        role: 'assistant',
        createdAt: new Date('2024-01-01T00:00:01Z'),
        content: {
          format: 2,
          parts: [{ type: 'data-tool-call-suspended', data: suspendedTool } as any],
          metadata: {
            suspendedTools: {
              'call-private': structuredClone(suspendedTool),
            },
          },
        },
      };
      const sourceBefore = structuredClone(message);

      await processor.persistMessages({ messages: [message], threadId: 'thread-1' });

      expect(message).toEqual(sourceBefore);
      const savedMessages = (mockStorage.saveMessages as any).mock.calls[0][0].messages as MastraDBMessage[];
      const savedSuspendedPart = savedMessages[0]!.content.parts[0] as any;
      const savedSuspendedMetadata = (savedMessages[0]!.content.metadata!.suspendedTools as any)['call-private'];
      expect(savedSuspendedPart.data).toMatchObject({
        args: { documentId: 'PUBLIC_TOOL_ARGS' },
        suspendPayload: { reason: 'PUBLIC_SUSPENSION_PAYLOAD' },
      });
      expect(savedSuspendedMetadata).toMatchObject({
        args: { documentId: 'PUBLIC_TOOL_ARGS' },
        suspendPayload: { reason: 'PUBLIC_SUSPENSION_PAYLOAD' },
      });
      expect(savedSuspendedPart.data).not.toHaveProperty('approvedArgs');
      expect(savedSuspendedPart.data).not.toHaveProperty('approvalInputIdentityDigest');
      expect(savedSuspendedMetadata).not.toHaveProperty('approvedArgs');
      expect(savedSuspendedMetadata).not.toHaveProperty('approvalInputIdentityDigest');
      const serialized = JSON.stringify(savedMessages);
      expect(serialized).not.toContain('RAW_TOOL_ARGS');
      expect(serialized).not.toContain('PRIVATE_APPROVED_ARGS');
      expect(serialized).not.toContain('PRIVATE_APPROVAL_DIGEST');
      expect(serialized).not.toContain('RAW_SUSPENSION_PAYLOAD');
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

  describe('toolCallFilter persistence policy', () => {
    const createPersistenceStorage = () =>
      ({
        saveMessages: vi.fn().mockResolvedValue(undefined),
        getThreadById: vi.fn().mockResolvedValue({
          id: 'thread-1',
          title: 'Test Thread',
          metadata: {},
        }),
        updateThread: vi.fn().mockResolvedValue(undefined),
      }) as unknown as MemoryStorage;

    const createToolResultMessage = (): MastraDBMessage => ({
      role: 'assistant',
      content: {
        format: 2,
        content: 'Final answer',
        providerMetadata: {
          mastra: { rawToolResult: 'CONTENT_PROVIDER_SECRET' },
        },
        parts: [
          { type: 'text', text: 'Final answer' },
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'call-search',
              toolName: 'search',
              args: { query: 'RAW_ARGS_SENTINEL' },
              result: { hits: ['RAW_RESULT_SENTINEL'] },
              rawInput: { query: 'RAW_INPUT_SENTINEL' },
              errorText: 'ERROR_TEXT_SENTINEL',
              approval: { id: 'APPROVAL_ID_SENTINEL', reason: 'APPROVAL_REASON_SENTINEL' },
            },
            title: 'PART_TITLE_SENTINEL',
            providerExecuted: true,
            providerMetadata: {
              mastra: {
                modelOutput: {
                  type: 'content',
                  value: [
                    { type: 'text', text: 'Compact result' },
                    { type: 'media', data: 'BASE64_SENTINEL', mediaType: 'image/png' },
                  ],
                },
                rawProviderPayload: 'PROVIDER_METADATA_SENTINEL',
              },
            },
          },
        ],
        toolInvocations: [
          {
            state: 'result',
            toolCallId: 'call-search',
            toolName: 'search',
            args: { query: 'TOP_LEVEL_ARGS_SENTINEL' },
            result: 'TOP_LEVEL_RESULT_SENTINEL',
          },
        ],
      },
      id: 'msg-tool-result',
      createdAt: new Date('2024-01-01T00:00:01Z'),
    });

    const createPrefilteredToolMessage = (toolName: string, state: 'call' | 'partial-call'): MastraDBMessage =>
      ({
        role: 'assistant',
        content: {
          format: 2,
          content: 'Keep this answer',
          providerMetadata: {
            mastra: { rawToolPayload: 'PREFILTERED_PROVIDER_SECRET' },
          },
          parts: [
            { type: 'text', text: 'Keep this answer' },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state,
                toolCallId: `call-${toolName}`,
                toolName,
                args: { secret: 'PREFILTERED_ARGS_SECRET' },
              },
            },
          ],
        },
        id: `msg-${toolName}`,
        createdAt: new Date('2024-01-01T00:00:01Z'),
      }) as MastraDBMessage;

    it('filters direct persistMessages writes without mutating the source message', async () => {
      const storage = createPersistenceStorage();
      const processor = new MessageHistory({
        storage,
        toolCallFilter: {
          preserveModelOutput: true,
          maxModelOutputBytes: 128,
        },
      });
      const message = createToolResultMessage();
      const sourceBefore = JSON.stringify(message);

      await processor.persistMessages({ messages: [message], threadId: 'thread-1' });

      expect(JSON.stringify(message)).toBe(sourceBefore);
      const savedMessages = (storage.saveMessages as any).mock.calls[0][0].messages as MastraDBMessage[];
      const serialized = JSON.stringify(savedMessages);
      expect(savedMessages).toHaveLength(1);
      expect(serialized).toContain('Final answer');
      expect(serialized).toContain('search result:\\nCompact result');
      expect(serialized).not.toContain('RAW_ARGS_SENTINEL');
      expect(serialized).not.toContain('RAW_RESULT_SENTINEL');
      expect(serialized).not.toContain('RAW_INPUT_SENTINEL');
      expect(serialized).not.toContain('ERROR_TEXT_SENTINEL');
      expect(serialized).not.toContain('APPROVAL_ID_SENTINEL');
      expect(serialized).not.toContain('APPROVAL_REASON_SENTINEL');
      expect(serialized).not.toContain('PART_TITLE_SENTINEL');
      expect(serialized).not.toContain('PROVIDER_METADATA_SENTINEL');
      expect(serialized).not.toContain('CONTENT_PROVIDER_SECRET');
      expect(serialized).not.toContain('TOP_LEVEL_ARGS_SENTINEL');
      expect(serialized).not.toContain('TOP_LEVEL_RESULT_SENTINEL');
      expect(serialized).not.toContain('BASE64_SENTINEL');
      expect(savedMessages[0]!.content.toolInvocations).toBeUndefined();
    });

    it('removes filtered approval and suspension state without leaking its payloads', async () => {
      const storage = createPersistenceStorage();
      const processor = new MessageHistory({
        storage,
        toolCallFilter: { exclude: ['secret_tool'] },
      });
      const approvalState = {
        toolCallId: 'call-secret-approval',
        toolName: 'secret_tool',
        args: { secret: 'APPROVAL_ARGS_SENTINEL' },
        approvedArgs: { secret: 'APPROVED_ARGS_SENTINEL' },
        approvalInputIdentityDigest: 'APPROVAL_DIGEST_SENTINEL',
        type: 'approval',
      };
      const suspensionState = {
        toolCallId: 'call-secret-suspension',
        toolName: 'secret_tool',
        args: { secret: 'SUSPENSION_ARGS_SENTINEL' },
        suspendPayload: { secret: 'SUSPEND_PAYLOAD_SENTINEL' },
        type: 'suspension',
      };
      const message: MastraDBMessage = {
        id: 'msg-filtered-tool-state',
        role: 'assistant',
        createdAt: new Date('2024-01-01T00:00:01Z'),
        content: {
          format: 2,
          parts: [
            { type: 'text', text: 'Waiting for a safe answer.' },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'call',
                toolCallId: 'call-secret-approval',
                toolName: 'secret_tool',
                args: { secret: 'INVOCATION_ARGS_SENTINEL' },
              },
            },
            { type: 'data-tool-call-approval', data: approvalState } as any,
            { type: 'data-tool-call-suspended', data: suspensionState } as any,
          ],
          metadata: {
            pendingToolApprovals: { 'call-secret-approval': structuredClone(approvalState) },
            suspendedTools: { 'call-secret-suspension': structuredClone(suspensionState) },
            retainedMetadata: 'keep-me',
          },
        },
      };
      const sourceBefore = structuredClone(message);

      await processor.persistMessages({ messages: [message], threadId: 'thread-1' });

      expect(message).toEqual(sourceBefore);
      const savedMessages = (storage.saveMessages as any).mock.calls[0][0].messages as MastraDBMessage[];
      const savedMessage = savedMessages[0]!;
      expect(savedMessage.content.parts).toEqual([{ type: 'text', text: 'Waiting for a safe answer.' }]);
      expect(savedMessage.content.metadata).toEqual({ retainedMetadata: 'keep-me' });
      const serialized = JSON.stringify(savedMessages);
      expect(serialized).not.toContain('APPROVAL_ARGS_SENTINEL');
      expect(serialized).not.toContain('APPROVED_ARGS_SENTINEL');
      expect(serialized).not.toContain('APPROVAL_DIGEST_SENTINEL');
      expect(serialized).not.toContain('SUSPENSION_ARGS_SENTINEL');
      expect(serialized).not.toContain('SUSPEND_PAYLOAD_SENTINEL');
      expect(serialized).not.toContain('INVOCATION_ARGS_SENTINEL');
    });

    it('retains native OM cursor anchors without changing standalone filtering', async () => {
      const message: MastraDBMessage = {
        id: 'msg-tool-only-anchor',
        role: 'assistant',
        threadId: 'thread-1',
        resourceId: 'resource-1',
        createdAt: new Date('2024-01-01T00:00:01Z'),
        content: {
          format: 2,
          providerMetadata: { mastra: { rawProviderPayload: 'ANCHOR_PROVIDER_SECRET' } },
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call-anchor',
                toolName: 'secret_tool',
                args: { secret: 'ANCHOR_ARGS_SECRET' },
                result: { secret: 'ANCHOR_RESULT_SECRET' },
              },
              providerMetadata: { mastra: { rawToolPayload: 'ANCHOR_PART_SECRET' } },
            },
          ],
        },
      };

      const standaloneStorage = createPersistenceStorage();
      await new MessageHistory({
        storage: standaloneStorage,
        toolCallFilter: { exclude: ['secret_tool'] },
      }).persistMessages({ messages: [message], threadId: 'thread-1' });
      expect(standaloneStorage.saveMessages).not.toHaveBeenCalled();

      const nativeOmStorage = createPersistenceStorage();
      await new MessageHistory({
        storage: nativeOmStorage,
        toolCallFilter: { exclude: ['secret_tool'] },
        retainFilteredMessageAnchors: true,
      }).persistMessages({
        messages: [
          message,
          {
            id: 'msg-empty-preliminary-filter',
            role: 'assistant',
            threadId: 'thread-1',
            resourceId: 'resource-1',
            createdAt: new Date('2024-01-01T00:00:02Z'),
            content: { format: 2, parts: [] },
          },
          {
            id: 'msg-working-memory-preliminary-filter',
            role: 'assistant',
            threadId: 'thread-1',
            resourceId: 'resource-1',
            createdAt: new Date('2024-01-01T00:00:03Z'),
            content: {
              format: 2,
              parts: [
                {
                  type: 'tool-invocation',
                  toolInvocation: {
                    state: 'call',
                    toolCallId: 'call-update-working-memory',
                    toolName: 'updateWorkingMemory',
                    args: { memory: 'hidden' },
                  },
                },
              ],
            },
          },
        ],
        threadId: 'thread-1',
        resourceId: 'resource-1',
      });

      const nativeOmMessages = (nativeOmStorage.saveMessages as any).mock.calls[0][0].messages as MastraDBMessage[];
      expect(nativeOmMessages).toEqual([
        {
          id: 'msg-tool-only-anchor',
          role: 'assistant',
          threadId: 'thread-1',
          resourceId: 'resource-1',
          createdAt: message.createdAt,
          content: { format: 2, parts: [] },
        },
      ]);
      expect(nativeOmMessages.some(savedMessage => savedMessage.id === 'msg-empty-preliminary-filter')).toBe(false);
      expect(nativeOmMessages.some(savedMessage => savedMessage.id === 'msg-working-memory-preliminary-filter')).toBe(
        false,
      );

      const sealedMessage = {
        ...message,
        id: 'msg-sealed-tool-only-anchor',
        content: {
          ...message.content,
          metadata: { mastra: { sealed: true } },
        },
      };
      const sealedStorage = createPersistenceStorage();
      await new MessageHistory({
        storage: sealedStorage,
        toolCallFilter: { exclude: ['secret_tool'] },
        retainFilteredMessageAnchors: true,
      }).persistMessages({ messages: [sealedMessage], threadId: 'thread-1', resourceId: 'resource-1' });

      const sealedAnchor = (sealedStorage.saveMessages as any).mock.calls[0][0].messages[0] as MastraDBMessage;
      expect(sealedAnchor.content).toEqual({
        format: 2,
        metadata: { mastra: { sealed: true } },
        parts: [],
      });

      const readdedSealedAnchor = new MessageList({ threadId: 'thread-1' });
      readdedSealedAnchor.add(sealedAnchor, 'memory');
      readdedSealedAnchor.add(
        {
          ...sealedAnchor,
          content: {
            ...sealedAnchor.content,
            parts: [{ type: 'text', text: 'new content after sealed anchor' }],
          },
        },
        'response',
      );
      expect(readdedSealedAnchor.get.all.db()).toHaveLength(2);
      expect(readdedSealedAnchor.get.all.db()[1]?.id).not.toBe(sealedAnchor.id);
    });

    it('keeps a sealed re-add boundary when the filtered tool part was last', async () => {
      const storage = createPersistenceStorage();
      const processor = new MessageHistory({ storage, toolCallFilter: {} });
      const message = createToolResultMessage();
      const sealedAt = 17_042;
      message.content.metadata = { mastra: { sealed: true } };
      const toolPart = message.content.parts.find(part => part.type === 'tool-invocation');
      if (!toolPart || toolPart.type !== 'tool-invocation') throw new Error('expected tool invocation');
      toolPart.metadata = { mastra: { sealedAt } };

      await processor.persistMessages({ messages: [message], threadId: 'thread-1' });

      const saved = (storage.saveMessages as any).mock.calls[0][0].messages[0] as MastraDBMessage;
      const lastPart = saved.content.parts.at(-1);
      expect(lastPart?.type).toBe('text');
      expect((lastPart as any)?.metadata?.mastra?.sealedAt).toBe(sealedAt);

      const messageList = new MessageList({ threadId: 'thread-1' });
      messageList.add(saved, 'memory');
      messageList.add(
        {
          ...saved,
          content: {
            ...saved.content,
            parts: [{ type: 'text', text: 'new content after reload' }],
          },
        },
        'response',
      );

      const readded = messageList.get.all.db().filter(messageItem => messageItem.role === 'assistant');
      expect(readded).toHaveLength(2);
      expect(readded[1]?.id).not.toBe(saved.id);
      expect(readded[1]?.content.parts).toMatchObject([{ type: 'text', text: 'new content after reload' }]);
    });

    it('keeps preserved model output on the sealed side when a filtered state part carries the boundary', async () => {
      const storage = createPersistenceStorage();
      const processor = new MessageHistory({
        storage,
        toolCallFilter: { exclude: ['secret_tool'], preserveModelOutput: true },
      });
      const message: MastraDBMessage = {
        id: 'msg-sealed-filtered-state',
        role: 'assistant',
        createdAt: new Date('2024-01-01T00:00:01Z'),
        content: {
          format: 2,
          metadata: { mastra: { sealed: true } },
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call-sealed-filtered-state',
                toolName: 'secret_tool',
                args: { secret: 'SEALED_STATE_ARGS_SENTINEL' },
                result: { secret: 'SEALED_STATE_RESULT_SENTINEL' },
              },
              providerMetadata: {
                mastra: { modelOutput: { type: 'text', value: 'compact preserved output' } },
              },
            },
            {
              type: 'data-tool-call-suspended',
              data: { toolCallId: 'call-sealed-filtered-state', toolName: 'secret_tool' },
              metadata: { mastra: { sealedAt: 17_045 } },
            } as any,
            { type: 'text', text: 'post-boundary text' },
          ],
        },
      };

      await processor.persistMessages({ messages: [message], threadId: 'thread-1' });

      const saved = (storage.saveMessages as any).mock.calls[0][0].messages[0] as MastraDBMessage;
      expect(saved.content.parts[0]).toMatchObject({
        type: 'text',
        text: 'secret_tool result:\ncompact preserved output',
        metadata: { mastra: { sealedAt: 17_045 } },
      });
      expect(JSON.stringify(saved)).not.toContain('SEALED_STATE_ARGS_SENTINEL');
      expect(JSON.stringify(saved)).not.toContain('SEALED_STATE_RESULT_SENTINEL');

      const messageList = new MessageList({ threadId: 'thread-1' });
      messageList.add(saved, 'memory');
      messageList.add(
        {
          ...saved,
          content: {
            ...saved.content,
            parts: [...saved.content.parts, { type: 'text', text: 'new content after reload' }],
          },
        },
        'response',
      );

      const readded = messageList.get.all.db().filter(messageItem => messageItem.role === 'assistant');
      expect(readded).toHaveLength(2);
      expect(readded[1]?.id).not.toBe(saved.id);
      expect(readded[1]?.content.parts).toMatchObject([
        { type: 'text', text: 'post-boundary text' },
        { type: 'text', text: 'new content after reload' },
      ]);
    });

    it('keeps appended parts after the original sealed boundary', async () => {
      const storage = createPersistenceStorage();
      const processor = new MessageHistory({ storage, toolCallFilter: {} });
      const message = createToolResultMessage();
      const sealedAt = 17_043;
      message.content.metadata = { mastra: { sealed: true } };
      const toolPart = message.content.parts.find(part => part.type === 'tool-invocation');
      if (!toolPart || toolPart.type !== 'tool-invocation') throw new Error('expected tool invocation');
      toolPart.metadata = { mastra: { sealedAt } };
      message.content.parts.push({ type: 'data-om-observation-end', data: { cycleId: 'cycle-after-seal' } });

      await processor.persistMessages({ messages: [message], threadId: 'thread-1' });

      const saved = (storage.saveMessages as any).mock.calls[0][0].messages[0] as MastraDBMessage;
      const savedText = saved.content.parts.find(part => part.type === 'text');
      const savedMarker = saved.content.parts.find(part => part.type === 'data-om-observation-end');
      expect((savedText as any)?.metadata?.mastra?.sealedAt).toBe(sealedAt);
      expect((savedMarker as any)?.metadata?.mastra?.sealedAt).toBeUndefined();

      const messageList = new MessageList({ threadId: 'thread-1' });
      messageList.add(saved, 'memory');
      messageList.add(
        {
          ...saved,
          content: {
            ...saved.content,
            parts: [...saved.content.parts, { type: 'text', text: 'new content after appended marker' }],
          },
        },
        'response',
      );

      const readded = messageList.get.all.db().filter(messageItem => messageItem.role === 'assistant');
      expect(readded).toHaveLength(2);
      expect(readded[1]?.id).not.toBe(saved.id);
      expect(readded[1]?.content.parts).toMatchObject([
        { type: 'data-om-observation-end', data: { cycleId: 'cycle-after-seal' } },
        { type: 'text', text: 'new content after appended marker' },
      ]);
    });

    it('keeps a payload-free seal before retained post-boundary parts', async () => {
      const storage = createPersistenceStorage();
      const processor = new MessageHistory({ storage, toolCallFilter: { exclude: ['secret_tool'] } });
      const sealedAt = 17_044;
      const message: MastraDBMessage = {
        id: 'msg-sealed-tool-only',
        role: 'assistant',
        threadId: 'thread-1',
        createdAt: new Date('2024-01-01T00:00:01Z'),
        content: {
          format: 2,
          metadata: { mastra: { sealed: true } },
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call-sealed-anchor',
                toolName: 'secret_tool',
                args: { secret: 'SEALED_ARGS_SECRET' },
                result: { secret: 'SEALED_RESULT_SECRET' },
              },
              metadata: { mastra: { sealedAt } },
            },
            { type: 'data-om-observation-end', data: { cycleId: 'cycle-after-sealed-tool' } },
            { type: 'text', text: 'retained post-boundary text' },
          ],
        },
      };

      await processor.persistMessages({ messages: [message], threadId: 'thread-1' });

      const saved = (storage.saveMessages as any).mock.calls[0][0].messages[0] as MastraDBMessage;
      expect(saved.content.parts).toEqual([
        { type: 'text', text: '', metadata: { mastra: { sealedAt } } },
        { type: 'data-om-observation-end', data: { cycleId: 'cycle-after-sealed-tool' } },
        { type: 'text', text: 'retained post-boundary text' },
      ]);
      expect(JSON.stringify(saved)).not.toContain('SEALED_ARGS_SECRET');
      expect(JSON.stringify(saved)).not.toContain('SEALED_RESULT_SECRET');

      const messageList = new MessageList({ threadId: 'thread-1' });
      messageList.add(saved, 'memory');
      messageList.add(
        {
          ...saved,
          content: {
            ...saved.content,
            parts: [...saved.content.parts, { type: 'text', text: 'new content after sealed boundary' }],
          },
        },
        'response',
      );

      const readded = messageList.get.all.db().filter(messageItem => messageItem.role === 'assistant');
      expect(readded).toHaveLength(2);
      expect(readded[1]?.id).not.toBe(saved.id);
      expect(readded[1]?.content.parts).toMatchObject([
        { type: 'data-om-observation-end', data: { cycleId: 'cycle-after-sealed-tool' } },
        { type: 'text', text: 'retained post-boundary text' },
        { type: 'text', text: 'new content after sealed boundary' },
      ]);
    });

    it('applies the same policy through processOutputResult', async () => {
      const storage = createPersistenceStorage();
      const processor = new MessageHistory({
        storage,
        toolCallFilter: { preserveModelOutput: true },
      });
      const message = createToolResultMessage();
      const messageList = new MessageList().add(message, 'response');

      await processor.processOutputResult({
        messageList,
        messages: [message],
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      const savedMessages = (storage.saveMessages as any).mock.calls[0][0].messages as MastraDBMessage[];
      const serialized = JSON.stringify(savedMessages);
      expect(serialized).toContain('search result:\\nCompact result');
      expect(serialized).not.toContain('RAW_RESULT_SENTINEL');
      expect(messageList.get.response.db()).toEqual([message]);
    });

    it.each([
      ['streaming tool call', 'search', 'partial-call'],
      ['working-memory tool call', 'updateWorkingMemory', 'call'],
    ] as const)('strips provider metadata when the policy covers a prefiltered %s', async (_label, toolName, state) => {
      const storage = createPersistenceStorage();
      const processor = new MessageHistory({ storage, toolCallFilter: {} });
      const message = createPrefilteredToolMessage(toolName, state);

      await processor.persistMessages({ messages: [message], threadId: 'thread-1' });

      const savedMessages = (storage.saveMessages as any).mock.calls[0][0].messages as MastraDBMessage[];
      const serialized = JSON.stringify(savedMessages);
      expect(serialized).toContain('Keep this answer');
      expect(serialized).not.toContain('PREFILTERED_PROVIDER_SECRET');
      expect(serialized).not.toContain('PREFILTERED_ARGS_SECRET');
    });

    it('preserves existing metadata behavior when exclude is an empty no-op policy', async () => {
      const storage = createPersistenceStorage();
      const processor = new MessageHistory({ storage, toolCallFilter: { exclude: [] } });
      const message = createPrefilteredToolMessage('search', 'partial-call');

      await processor.persistMessages({ messages: [message], threadId: 'thread-1' });

      const savedMessages = (storage.saveMessages as any).mock.calls[0][0].messages as MastraDBMessage[];
      const serialized = JSON.stringify(savedMessages);
      expect(serialized).toContain('PREFILTERED_PROVIDER_SECRET');
      expect(serialized).not.toContain('PREFILTERED_ARGS_SECRET');
    });

    it('applies a finite model-output bound when persistence filtering omits one', async () => {
      const storage = createPersistenceStorage();
      const processor = new MessageHistory({
        storage,
        toolCallFilter: { preserveModelOutput: true },
      });
      const message = createToolResultMessage();
      const toolPart = message.content.parts.find(part => part.type === 'tool-invocation');
      if (!toolPart || toolPart.type !== 'tool-invocation') throw new Error('expected tool invocation');
      toolPart.providerMetadata = { mastra: { modelOutput: 'x'.repeat(1024 * 1024) } };

      const encodeSpy = vi.spyOn(TextEncoder.prototype, 'encode');
      let encodedInputLengths: number[];
      try {
        await processor.persistMessages({ messages: [message], threadId: 'thread-1' });
        encodedInputLengths = encodeSpy.mock.calls.map(([input]) => input.length);
      } finally {
        encodeSpy.mockRestore();
      }

      const savedMessages = (storage.saveMessages as any).mock.calls[0][0].messages as MastraDBMessage[];
      const serialized = JSON.stringify(savedMessages);
      expect(Math.max(...encodedInputLengths!)).toBeLessThanOrEqual(16 * 1024 + 1);
      expect(serialized).toContain('[truncated]');
      expect(new TextEncoder().encode(serialized).byteLength).toBeLessThan(17 * 1024);
    });

    it.each(['array', 'legacy wrapper'] as const)('omits circular %s model output', async shape => {
      const storage = createPersistenceStorage();
      const processor = new MessageHistory({
        storage,
        toolCallFilter: { preserveModelOutput: true },
      });
      const message = createToolResultMessage();
      const toolPart = message.content.parts.find(part => part.type === 'tool-invocation');
      if (!toolPart || toolPart.type !== 'tool-invocation') throw new Error('expected tool invocation');
      const circular: unknown[] | { value?: unknown } = shape === 'array' ? [] : {};
      if (Array.isArray(circular)) circular.push(circular);
      else circular.value = circular;
      toolPart.providerMetadata = { mastra: { modelOutput: circular } };

      await processor.persistMessages({ messages: [message], threadId: 'thread-1' });

      const savedMessages = (storage.saveMessages as any).mock.calls[0][0].messages as MastraDBMessage[];
      expect(JSON.stringify(savedMessages)).not.toContain('search result');
    });

    it('filters legacy messages that store tool payloads only in content.toolInvocations', async () => {
      const storage = createPersistenceStorage();
      const processor = new MessageHistory({ storage, toolCallFilter: {} });
      const message = createToolResultMessage();
      message.content.parts = [{ type: 'text', text: 'Final answer' }];

      await processor.persistMessages({ messages: [message], threadId: 'thread-1' });

      const savedMessages = (storage.saveMessages as any).mock.calls[0][0].messages as MastraDBMessage[];
      const serialized = JSON.stringify(savedMessages);
      expect(serialized).toContain('Final answer');
      expect(serialized).not.toContain('TOP_LEVEL_ARGS_SENTINEL');
      expect(serialized).not.toContain('TOP_LEVEL_RESULT_SENTINEL');
      expect(savedMessages[0]!.content.toolInvocations).toBeUndefined();
    });

    it.each([
      ['string content', 'Legacy text'],
      ['missing parts', { format: 2, content: 'Legacy object text' }],
    ])('does not crash on %s when persistence filtering is enabled', async (_label, content) => {
      const storage = createPersistenceStorage();
      const processor = new MessageHistory({ storage, toolCallFilter: {} });
      const message = {
        id: 'legacy-malformed-message',
        role: 'assistant',
        content,
        createdAt: new Date('2024-01-01T00:00:01Z'),
      } as unknown as MastraDBMessage;
      const sourceBefore = JSON.stringify(message);

      await processor.persistMessages({ messages: [message], threadId: 'thread-1' });

      expect(JSON.stringify(message)).toBe(sourceBefore);
      const savedMessages = (storage.saveMessages as any).mock.calls[0][0].messages as MastraDBMessage[];
      expect(savedMessages).toHaveLength(1);
      expect(JSON.stringify(savedMessages[0]!.content)).toContain('Legacy');
    });

    it('keeps existing persistence behavior when the policy is omitted', async () => {
      const storage = createPersistenceStorage();
      const processor = new MessageHistory({ storage });
      const message = createToolResultMessage();

      await processor.persistMessages({ messages: [message], threadId: 'thread-1' });

      const savedMessages = (storage.saveMessages as any).mock.calls[0][0].messages as MastraDBMessage[];
      const serialized = JSON.stringify(savedMessages);
      expect(serialized).toContain('RAW_ARGS_SENTINEL');
      expect(serialized).toContain('RAW_RESULT_SENTINEL');
      expect(serialized).toContain('TOP_LEVEL_ARGS_SENTINEL');
      expect(serialized).toContain('TOP_LEVEL_RESULT_SENTINEL');
    });
  });

  describe('final-turn persistence policy', () => {
    const createPersistenceStorage = () =>
      ({
        saveMessages: vi.fn().mockResolvedValue(undefined),
        getThreadById: vi.fn().mockResolvedValue({
          id: 'thread-1',
          title: 'Test Thread',
          metadata: {},
        }),
        updateThread: vi.fn().mockResolvedValue(undefined),
      }) as unknown as MemoryStorage;

    const createFinalTurnMessages = (): MastraDBMessage[] => [
      {
        id: 'user-stable',
        role: 'user',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: {
          format: 2,
          content: 'Find the latest evidence',
          metadata: { secret: 'USER_MESSAGE_METADATA_SECRET' },
          providerMetadata: { mastra: { secret: 'USER_PROVIDER_SECRET' } },
          parts: [
            { type: 'text', text: 'Find the latest evidence', providerMetadata: { mastra: { secret: 'PART_SECRET' } } },
          ],
        },
      },
      {
        id: 'assistant-transient',
        role: 'assistant',
        createdAt: new Date('2024-01-01T00:00:01Z'),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'TRANSIENT_ASSISTANT_ROW' }],
        },
      },
      {
        id: 'assistant-final',
        role: 'assistant',
        createdAt: new Date('2024-01-01T00:00:02Z'),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        type: 'text',
        content: {
          format: 2,
          content: 'PROVISIONAL_TOP_LEVEL_CONTENT',
          reasoning: 'TOP_LEVEL_REASONING',
          providerMetadata: { mastra: { secret: 'ASSISTANT_PROVIDER_SECRET' } },
          parts: [
            { type: 'text', text: 'PROVISIONAL_TEXT' },
            { type: 'reasoning', text: 'INTERMEDIATE_REASONING' },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'private-call',
                toolName: 'latex_read_file',
                args: { path: 'PRIVATE_PATH' },
                result: { content: 'PRIVATE_RAW_RESULT' },
              },
              providerMetadata: { mastra: { modelOutput: 'PRIVATE_COMPACT_FILE_CONTENT' } },
            },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'public-call',
                toolName: 'grounding_search',
                args: { query: 'RAW_PUBLIC_QUERY' },
                result: { hits: ['RAW_PUBLIC_RESULT'] },
              },
              providerMetadata: {
                mastra: {
                  modelOutput: {
                    type: 'content',
                    value: [
                      { type: 'text', text: 'Approved public summary' },
                      { type: 'media', data: 'BASE64_MEDIA', mediaType: 'image/png' },
                    ],
                  },
                  raw: 'RAW_PROVIDER_METADATA',
                },
              },
            },
            { type: 'step-start', model: 'provider/model' },
            { type: 'reasoning', text: 'FINAL_STEP_REASONING' },
            {
              type: 'text',
              text: 'Final evidence answer.',
              providerMetadata: { mastra: { secret: 'FINAL_TEXT_PROVIDER_SECRET' } },
            },
          ],
          toolInvocations: [
            {
              state: 'result',
              toolCallId: 'legacy-call',
              toolName: 'legacy_tool',
              args: { secret: 'TOP_LEVEL_TOOL_ARGS' },
              result: 'TOP_LEVEL_TOOL_RESULT',
            },
          ],
        },
      },
    ];

    it('persists stable user, allowlisted compact outcomes, and only the final assistant answer', async () => {
      const storage = createPersistenceStorage();
      const processor = new MessageHistory({
        storage,
        persistence: {
          mode: 'final-turn',
          preserveModelOutputFor: ['grounding_search'],
          maxModelOutputBytes: 128,
        },
      });
      const messages = createFinalTurnMessages();
      const sourceBefore = JSON.stringify(messages);

      await processor.persistMessages({ messages, threadId: 'thread-1', resourceId: 'resource-1' });

      expect(JSON.stringify(messages)).toBe(sourceBefore);
      const savedMessages = (storage.saveMessages as any).mock.calls[0][0].messages as MastraDBMessage[];
      expect(savedMessages.map(message => message.id)).toEqual(['user-stable', 'assistant-final']);
      expect(savedMessages[0]!.content).toEqual({
        format: 2,
        content: 'Find the latest evidence',
        parts: [{ type: 'text', text: 'Find the latest evidence' }],
      });
      expect(savedMessages[1]!.content).toEqual({
        format: 2,
        parts: [
          { type: 'text', text: 'grounding_search result:\nApproved public summary' },
          { type: 'text', text: 'Final evidence answer.' },
        ],
      });

      const serialized = JSON.stringify(savedMessages);
      for (const omitted of [
        'TRANSIENT_ASSISTANT_ROW',
        'PROVISIONAL_TOP_LEVEL_CONTENT',
        'PROVISIONAL_TEXT',
        'INTERMEDIATE_REASONING',
        'FINAL_STEP_REASONING',
        'PRIVATE_PATH',
        'PRIVATE_RAW_RESULT',
        'PRIVATE_COMPACT_FILE_CONTENT',
        'RAW_PUBLIC_QUERY',
        'RAW_PUBLIC_RESULT',
        'BASE64_MEDIA',
        'RAW_PROVIDER_METADATA',
        'TOP_LEVEL_TOOL_ARGS',
        'TOP_LEVEL_TOOL_RESULT',
        'USER_MESSAGE_METADATA_SECRET',
        'USER_PROVIDER_SECRET',
        'PART_SECRET',
        'ASSISTANT_PROVIDER_SECRET',
        'FINAL_TEXT_PROVIDER_SECRET',
      ]) {
        expect(serialized).not.toContain(omitted);
      }
    });

    it('applies final-turn projection to input and a merged multi-step response without mutating MessageList', async () => {
      const storage = createPersistenceStorage();
      const processor = new MessageHistory({
        storage,
        persistence: {
          mode: 'final-turn',
          preserveModelOutputFor: ['grounding_search'],
        },
      });
      const messages = createFinalTurnMessages();
      const historicalMessage: MastraDBMessage = {
        id: 'historical-assistant',
        role: 'assistant',
        createdAt: new Date('2023-12-31T23:59:59Z'),
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'historical-public-call',
                toolName: 'grounding_search',
                args: {},
                result: {},
              },
              providerMetadata: { mastra: { modelOutput: 'HISTORICAL_OUTCOME_MUST_NOT_LEAK' } },
            },
          ],
        },
      };
      const messageList = new MessageList()
        .add(historicalMessage, 'memory')
        .add(messages[0]!, 'input')
        .add(messages[2]!, 'response');
      const messageListBefore = JSON.stringify(messageList.get.all.db());

      await processor.processOutputResult({
        messages,
        messageList,
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1', 'resource-1'),
      });

      expect(JSON.stringify(messageList.get.all.db())).toBe(messageListBefore);
      const savedMessages = (storage.saveMessages as any).mock.calls[0][0].messages as MastraDBMessage[];
      expect(savedMessages.map(message => message.id)).toEqual(['user-stable', 'assistant-final']);
      expect(savedMessages[1]!.content.parts).toEqual([
        { type: 'text', text: 'grounding_search result:\nApproved public summary' },
        { type: 'text', text: 'Final evidence answer.' },
      ]);
      expect(JSON.stringify(savedMessages)).not.toContain('HISTORICAL_OUTCOME_MUST_NOT_LEAK');
    });

    it('persists a bounded terminal-only assistant answer for reload', async () => {
      const storage = createPersistenceStorage();
      const processor = new MessageHistory({ storage, persistence: { mode: 'final-turn' } });
      const messages: MastraDBMessage[] = [
        {
          id: 'terminal-user',
          role: 'user',
          createdAt: new Date('2024-01-01T00:00:00Z'),
          threadId: 'thread-1',
          resourceId: 'resource-1',
          content: { format: 2, parts: [{ type: 'text', text: 'Delegate this answer.' }] },
        },
        {
          id: 'terminal-assistant',
          role: 'assistant',
          createdAt: new Date('2024-01-01T00:00:01Z'),
          threadId: 'thread-1',
          resourceId: 'resource-1',
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: 'spawn-call',
                  toolName: 'spawn_subagent',
                  args: { task: 'PRIVATE_CHILD_TASK' },
                  result: { raw: 'PRIVATE_CHILD_RESULT' },
                },
              },
              {
                type: 'data-terminal-tool-result',
                id: 'run-1:terminal-tool-result:1',
                data: {
                  status: 'success',
                  items: [
                    {
                      toolName: 'spawn_subagent',
                      toolCallId: 'spawn-call',
                      status: 'success',
                      value: { kind: 'subagent-direct-answer', text: 'Specialist-authored final answer.' },
                    },
                  ],
                },
                providerMetadata: { mastra: { secret: 'TERMINAL_PART_METADATA_SECRET' } },
              } as any,
            ],
          },
        },
      ];

      await processor.persistMessages({ messages, threadId: 'thread-1', resourceId: 'resource-1' });

      const savedMessages = (storage.saveMessages as any).mock.calls[0][0].messages as MastraDBMessage[];
      expect(savedMessages.map(message => message.id)).toEqual(['terminal-user', 'terminal-assistant']);
      expect(savedMessages[1]!.content.parts).toEqual([
        {
          type: 'data-terminal-tool-result',
          id: 'run-1:terminal-tool-result:1',
          data: {
            status: 'success',
            items: [
              {
                toolName: 'spawn_subagent',
                toolCallId: 'spawn-call',
                status: 'success',
                value: { kind: 'subagent-direct-answer', text: 'Specialist-authored final answer.' },
              },
            ],
          },
        },
      ]);
      expect(JSON.stringify(savedMessages)).not.toContain('PRIVATE_CHILD_TASK');
      expect(JSON.stringify(savedMessages)).not.toContain('PRIVATE_CHILD_RESULT');
      expect(JSON.stringify(savedMessages)).not.toContain('TERMINAL_PART_METADATA_SECRET');
    });

    it('retains terminal data at the exact 64 KiB data boundary even though the persisted part wrapper is larger', async () => {
      const storage = createPersistenceStorage();
      const processor = new MessageHistory({ storage, persistence: { mode: 'final-turn' } });
      const terminalData = {
        status: 'success' as const,
        items: [
          {
            toolName: 'spawn_subagent',
            toolCallId: 'spawn-boundary',
            status: 'success' as const,
            value: { text: '' },
          },
        ],
      };
      const encodedSize = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
      terminalData.items[0]!.value.text = 'x'.repeat(64 * 1024 - encodedSize(terminalData));
      expect(encodedSize(terminalData)).toBe(64 * 1024);
      const messages: MastraDBMessage[] = [
        {
          id: 'terminal-boundary-user',
          role: 'user',
          createdAt: new Date('2024-01-01T00:00:00Z'),
          content: { format: 2, parts: [{ type: 'text', text: 'Return the large bounded answer.' }] },
        },
        {
          id: 'terminal-boundary-assistant',
          role: 'assistant',
          createdAt: new Date('2024-01-01T00:00:01Z'),
          content: {
            format: 2,
            parts: [
              {
                type: 'data-terminal-tool-result',
                id: 'run-boundary:terminal-tool-result:1',
                data: terminalData,
              } as any,
            ],
          },
        },
      ];

      await processor.persistMessages({ messages, threadId: 'thread-1' });

      const savedMessages = (storage.saveMessages as any).mock.calls[0][0].messages as MastraDBMessage[];
      expect(savedMessages[1]!.content.parts).toEqual([
        {
          type: 'data-terminal-tool-result',
          id: 'run-boundary:terminal-tool-result:1',
          data: terminalData,
        },
      ]);
      expect(encodedSize(savedMessages[1]!.content.parts[0])).toBeGreaterThan(64 * 1024);
    });

    it('does not persist an approved compact outcome from before the last user turn', async () => {
      const storage = createPersistenceStorage();
      const processor = new MessageHistory({
        storage,
        persistence: {
          mode: 'final-turn',
          preserveModelOutputFor: ['grounding_search'],
        },
      });
      const messages = createFinalTurnMessages();
      const historicalAssistant: MastraDBMessage = {
        id: 'historical-assistant',
        role: 'assistant',
        createdAt: new Date('2023-12-31T23:59:59Z'),
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'historical-public-call',
                toolName: 'grounding_search',
                args: {},
                result: {},
              },
              providerMetadata: { mastra: { modelOutput: 'HISTORICAL_OUTCOME_MUST_NOT_LEAK' } },
            },
          ],
        },
      };

      await processor.persistMessages({
        messages: [historicalAssistant, ...messages],
        threadId: 'thread-1',
      });

      const savedMessages = (storage.saveMessages as any).mock.calls[0][0].messages as MastraDBMessage[];
      expect(JSON.stringify(savedMessages)).not.toContain('HISTORICAL_OUTCOME_MUST_NOT_LEAK');
      expect(savedMessages[1]!.content.parts).toEqual([
        { type: 'text', text: 'grounding_search result:\nApproved public summary' },
        { type: 'text', text: 'Final evidence answer.' },
      ]);
    });

    it('does not persist an empty user row when every user part is transient', async () => {
      const storage = createPersistenceStorage();
      const processor = new MessageHistory({
        storage,
        persistence: { mode: 'final-turn' },
      });
      const messages: MastraDBMessage[] = [
        {
          id: 'transient-user',
          role: 'user',
          createdAt: new Date('2024-01-01T00:00:00Z'),
          content: {
            format: 2,
            metadata: { secret: 'TRANSIENT_USER_METADATA' },
            providerMetadata: { mastra: { secret: 'TRANSIENT_USER_PROVIDER_METADATA' } },
            parts: [
              { type: 'step-start' },
              { type: 'reasoning', text: 'TRANSIENT_USER_REASONING' },
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: 'transient-user-call',
                  toolName: 'grounding_search',
                  args: {},
                  result: {},
                },
              },
            ],
          },
        },
        {
          id: 'assistant-answer',
          role: 'assistant',
          createdAt: new Date('2024-01-01T00:00:01Z'),
          content: { format: 2, parts: [{ type: 'text', text: 'Final answer only.' }] },
        },
      ];

      await processor.persistMessages({ messages, threadId: 'thread-1' });

      const savedMessages = (storage.saveMessages as any).mock.calls[0][0].messages as MastraDBMessage[];
      expect(savedMessages.map(message => message.id)).toEqual(['assistant-answer']);
      expect(JSON.stringify(savedMessages)).toBe(
        '[{"id":"assistant-answer","role":"assistant","createdAt":"2024-01-01T00:00:01.000Z","content":{"format":2,"parts":[{"type":"text","text":"Final answer only."}]}}]',
      );
    });

    it.each([undefined, []] as const)('retains no compact output for a %s allowlist', async allowlist => {
      const storage = createPersistenceStorage();
      const processor = new MessageHistory({
        storage,
        persistence: {
          mode: 'final-turn',
          ...(allowlist === undefined ? {} : { preserveModelOutputFor: [...allowlist] }),
        },
      });

      await processor.persistMessages({ messages: createFinalTurnMessages(), threadId: 'thread-1' });

      const savedMessages = (storage.saveMessages as any).mock.calls[0][0].messages as MastraDBMessage[];
      const serialized = JSON.stringify(savedMessages);
      expect(serialized).toContain('Final evidence answer.');
      expect(serialized).not.toContain('Approved public summary');
      expect(serialized).not.toContain('PRIVATE_COMPACT_FILE_CONTENT');
    });

    it('applies the UTF-8 bound to an allowlisted multibyte compact outcome', async () => {
      const storage = createPersistenceStorage();
      const processor = new MessageHistory({
        storage,
        persistence: {
          mode: 'final-turn',
          preserveModelOutputFor: ['grounding_search'],
          maxModelOutputBytes: 32,
        },
      });
      const messages = createFinalTurnMessages();
      const assistant = messages[2]!;
      const publicTool = assistant.content.parts.find(
        part => part.type === 'tool-invocation' && part.toolInvocation.toolName === 'grounding_search',
      );
      if (!publicTool || publicTool.type !== 'tool-invocation') throw new Error('expected public tool');
      publicTool.providerMetadata = { mastra: { modelOutput: '🙂'.repeat(100) } };

      await processor.persistMessages({ messages, threadId: 'thread-1' });

      const savedMessages = (storage.saveMessages as any).mock.calls[0][0].messages as MastraDBMessage[];
      const outcome = savedMessages[1]!.content.parts[0];
      if (outcome?.type !== 'text') throw new Error('expected compact outcome');
      const boundedValue = outcome.text.split(' result:\n')[1]!;
      expect(new TextEncoder().encode(boundedValue).byteLength).toBeLessThanOrEqual(32);
      expect(boundedValue).toContain('[truncated]');
      expect(boundedValue).not.toContain('\uFFFD');
    });

    it('fails closed for accessor, circular, media, and non-result allowlisted model output', async () => {
      const storage = createPersistenceStorage();
      const processor = new MessageHistory({
        storage,
        persistence: {
          mode: 'final-turn',
          preserveModelOutputFor: ['accessor', 'circular', 'media', 'unfinished'],
        },
      });
      const accessorMetadata: Record<string, unknown> = {};
      Object.defineProperty(accessorMetadata, 'modelOutput', {
        enumerable: true,
        get() {
          throw new Error('must not invoke accessor');
        },
      });
      const circular: unknown[] = [];
      circular.push(circular);
      const messages = createFinalTurnMessages();
      messages[2]!.content.parts.splice(
        2,
        2,
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'result', toolCallId: 'accessor', toolName: 'accessor', args: {}, result: {} },
          providerMetadata: { mastra: accessorMetadata },
        },
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'result', toolCallId: 'circular', toolName: 'circular', args: {}, result: {} },
          providerMetadata: { mastra: { modelOutput: circular } },
        },
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'result', toolCallId: 'media', toolName: 'media', args: {}, result: {} },
          providerMetadata: { mastra: { modelOutput: { type: 'media', data: 'BASE64', mediaType: 'image/png' } } },
        },
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'call', toolCallId: 'unfinished', toolName: 'unfinished', args: {} },
          providerMetadata: { mastra: { modelOutput: 'UNFINISHED_OUTPUT' } },
        },
      );

      await processor.persistMessages({ messages, threadId: 'thread-1' });

      const savedMessages = (storage.saveMessages as any).mock.calls[0][0].messages as MastraDBMessage[];
      expect(savedMessages[1]!.content.parts).toEqual([{ type: 'text', text: 'Final evidence answer.' }]);
      expect(JSON.stringify(savedMessages)).not.toContain('BASE64');
      expect(JSON.stringify(savedMessages)).not.toContain('UNFINISHED_OUTPUT');
    });
  });
});
