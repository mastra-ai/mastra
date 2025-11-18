import type { MastraDBMessage } from '@mastra/core/agent';
import type { MemoryRuntimeContext } from '@mastra/core/memory';
import { RequestContext } from '@mastra/core/request-context';
import { MemoryStorage } from '@mastra/core/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageHistory } from './message-history.js';

// Helper to create RequestContext with memory context
function createRuntimeContextWithMemory(threadId: string, resourceId?: string): RequestContext {
  const runtimeContext = new RequestContext();
  const memoryContext: MemoryRuntimeContext = {
    thread: { id: threadId },
    resourceId,
  };
  runtimeContext.set('MastraMemory', memoryContext);
  return runtimeContext;
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
  async listThreadsByResourceId(_args: any): Promise<any> {
    return { threads: [], total: 0, page: 1, perPage: false, hasMore: false };
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

      const runtimeContext = createRuntimeContextWithMemory('thread-1');

      const result = await processor.processInput({
        messages: newMessages,
        abort: mockAbort,
        runtimeContext,
      });

      // Should have last 2 historical messages + 1 new message
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('msg-2');
      expect(result[1].id).toBe('msg-3');
      expect(result[2].id).toBe('msg-4');
    });

    it('should merge historical messages with new messages', async () => {
      const historicalMessages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, content: 'Historical', parts: [{ type: 'text', text: 'Historical' }] },
          threadId: 'thread-1',
          createdAt: new Date(),
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
          createdAt: new Date(),
        },
      ];

      const result = await processor.processInput({
        messages: newMessages,
        abort: mockAbort,
        runtimeContext: createRuntimeContextWithMemory('thread-1'),
      });

      expect(result).toHaveLength(2);
      expect(result[0].content.content).toBe('Historical');
      expect(result[1].content.content).toBe('New');
    });

    it('should avoid duplicate message IDs', async () => {
      const historicalMessages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, content: 'Message 1', parts: [{ type: 'text', text: 'Message 1' }] },
          threadId: 'thread-1',
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: { format: 2, content: 'Message 2', parts: [{ type: 'text', text: 'Message 2' }] },
          threadId: 'thread-1',
          createdAt: new Date(),
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
          createdAt: new Date(),
        },
        {
          id: 'msg-3',
          role: 'user',
          content: { format: 2, content: 'Message 3', parts: [{ type: 'text', text: 'Message 3' }] },
          threadId: 'thread-1',
          createdAt: new Date(),
        },
      ];

      const result = await processor.processInput({
        messages: newMessages,
        abort: mockAbort,
        runtimeContext: createRuntimeContextWithMemory('thread-1'),
      });

      // msg-1 from history, msg-2 from new (duplicate filtered), msg-3 from new
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('msg-1');
      expect(result[1].id).toBe('msg-2');
      expect(result[1].content.content).toBe('Message 2 (new)'); // New version kept
      expect(result[2].id).toBe('msg-3');
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

      const result = await processor.processInput({
        messages: newMessages,
        abort: mockAbort,
        runtimeContext: createRuntimeContextWithMemory('thread-1'),
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('msg-1');
    });

    it('should respect includeSystemMessages flag', async () => {
      const baseTime = Date.now();
      const historicalMessages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'system',
          content: { format: 2, content: 'System prompt', parts: [{ type: 'text', text: 'System prompt' }] },
          threadId: 'thread-1',
          createdAt: new Date(baseTime - 2000),
        },
        {
          id: 'msg-2',
          role: 'user',
          content: { format: 2, content: 'User message', parts: [{ type: 'text', text: 'User message' }] },
          threadId: 'thread-1',
          createdAt: new Date(baseTime - 1000),
        },
      ];

      mockStorage.setMessages(historicalMessages);

      // Test with includeSystemMessages = false (default)
      processor = new MessageHistory({
        storage: mockStorage,
      });

      const result1 = await processor.processInput({
        messages: [],
        abort: mockAbort,
        runtimeContext: createRuntimeContextWithMemory('thread-1'),
      });

      expect(result1).toHaveLength(1);
      expect(result1[0].role).toBe('user');

      // Test with includeSystemMessages = true
      processor = new MessageHistory({
        storage: mockStorage,
        includeSystemMessages: true,
      });

      const result2 = await processor.processInput({
        messages: [],
        abort: mockAbort,
        runtimeContext: createRuntimeContextWithMemory('thread-1'),
      });

      expect(result2).toHaveLength(2);
      expect(result2[0].role).toBe('system');
      expect(result2[1].role).toBe('user');
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

      // Should propagate the error instead of silently failing
      await expect(
        processor.processInput({
          messages: newMessages,
          abort: mockAbort,
          runtimeContext: createRuntimeContextWithMemory('thread-1'),
        })
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

      const result = await processor.processInput({
        messages: newMessages,
        abort: mockAbort,
        runtimeContext: createRuntimeContextWithMemory('thread-1'),
      });

      expect(result).toEqual(newMessages);
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

      const result = await processor.processInput({
        messages: [],
        abort: mockAbort,
        runtimeContext: createRuntimeContextWithMemory('thread-1'),
      });

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');
      expect(result[0].content.parts).toHaveLength(2);
      expect(result[0].content.parts?.[1].type).toBe('tool-invocation');
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

      const result = await processor.processInput({
        messages: [],
        abort: mockAbort,
        runtimeContext: createRuntimeContextWithMemory('thread-1'),
      });

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');
      expect(result[0].content.parts?.[0].type).toBe('tool-invocation');
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
          role: 'system', 
          content: { format: 2, parts: [{ type: 'text', text: 'You are a helpful assistant' }] },
          id: 'msg-0',
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
        { 
          role: 'user', 
          content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] }, 
          id: 'msg-1',
          createdAt: new Date('2024-01-01T00:00:01Z'),
        },
        { 
          role: 'assistant', 
          content: { format: 2, parts: [{ type: 'text', text: 'Hi there!' }] }, 
          id: 'msg-2',
          createdAt: new Date('2024-01-01T00:00:02Z'),
        },
        {
          role: 'assistant',
          content: {
            format: 2,
            parts: [{ type: 'tool-invocation', toolInvocation: { state: 'call', toolCallId: 'tool-1', toolName: 'search', args: {} } }],
          },
          id: 'msg-3',
          createdAt: new Date('2024-01-01T00:00:03Z'),
        },
        {
          role: 'assistant',
          content: {
            format: 2,
            parts: [{ type: 'tool-invocation', toolInvocation: { state: 'result', toolCallId: 'tool-1', toolName: 'search', args: {}, result: 'Tool result' } }],
          },
          id: 'msg-4',
          createdAt: new Date('2024-01-01T00:00:04Z'),
        },
      ];

      const result = await processor.processOutputResult({
        messages,
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        runtimeContext: createRuntimeContextWithMemory('thread-1'),
      });

      expect(result).toEqual(messages);
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
              parts: expect.arrayContaining([expect.objectContaining({ type: 'text', text: 'Hi there!' })]),
            }),
            createdAt: expect.any(Date),
          }),
          expect.objectContaining({
            id: 'msg-3',
            role: 'assistant',
            content: expect.objectContaining({
              format: 2,
              parts: expect.arrayContaining([expect.objectContaining({ 
                type: 'tool-invocation',
                toolInvocation: expect.objectContaining({
                  state: 'call',
                }),
              })]),
            }),
            createdAt: expect.any(Date),
          }),
          expect.objectContaining({
            id: 'msg-4',
            role: 'assistant',
            content: expect.objectContaining({
              format: 2,
              parts: expect.arrayContaining([expect.objectContaining({ 
                type: 'tool-invocation',
                toolInvocation: expect.objectContaining({
                  state: 'result',
                }),
              })]),
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
          role: 'system',
          content: { format: 2, parts: [{ type: 'text', text: 'System prompt 1' }] },
          id: 'msg-1',
          createdAt: new Date(),
        },
        {
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'User message' }] },
          id: 'msg-2',
          createdAt: new Date(),
        },
        {
          role: 'system',
          content: { format: 2, parts: [{ type: 'text', text: 'System prompt 2' }] },
          id: 'msg-3',
          createdAt: new Date(),
        },
        {
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'Assistant response' }] },
          id: 'msg-4',
          createdAt: new Date(),
        },
        {
          role: 'system',
          content: { format: 2, parts: [{ type: 'text', text: 'System prompt 3' }] },
          id: 'msg-5',
          createdAt: new Date(),
        },
      ];

      await processor.processOutputResult({
        messages,
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        runtimeContext: createRuntimeContextWithMemory('thread-1'),
      });

      const savedMessages = (mockStorage.saveMessages as any).mock.calls[0][0].messages;
      expect(savedMessages).toHaveLength(2);
      expect(savedMessages.every((m: any) => m.role !== 'system')).toBe(true);
    });

    it('should update thread metadata', async () => {
      const mockStorage = {
        saveMessages: vi.fn().mockResolvedValue(undefined),
        getThreadById: vi.fn().mockResolvedValue({
          id: 'thread-1',
          title: 'Test Thread',
          metadata: { createdAt: new Date('2024-01-01') },
        }),
        listMessages: vi.fn().mockResolvedValue({
          messages: [{ role: 'user', content: { format: 2, parts: [{ type: 'text', text: 'existing' }] } }],
          total: 1,
          page: 0,
          perPage: 40,
          hasMore: false,
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

      await processor.processOutputResult({
        messages,
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        runtimeContext: createRuntimeContextWithMemory('thread-1'),
      });

      expect(mockStorage.updateThread).toHaveBeenCalledWith({
        id: 'thread-1',
        title: 'Test Thread',
        metadata: expect.objectContaining({
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          lastMessageAt: expect.any(Date),
          messageCount: 1,
        }),
      });
    });

    it('should handle save failures gracefully', async () => {
      const mockStorage = {
        saveMessages: vi.fn().mockRejectedValue(new Error('Save failed')),
        getThreadById: vi.fn().mockResolvedValue({
          id: 'thread-1',
          title: 'Test Thread',
          metadata: {},
        }),
        listMessages: vi.fn().mockResolvedValue({ messages: [], total: 0 }),
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

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await processor.processOutputResult({
        messages,
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        runtimeContext: createRuntimeContextWithMemory('thread-1'),
      });

      expect(result).toEqual(messages);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save messages:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle thread update failures gracefully', async () => {
      const mockStorage = {
        saveMessages: vi.fn().mockResolvedValue(undefined),
        getThreadById: vi.fn().mockResolvedValue({
          id: 'thread-1',
          title: 'Test Thread',
          metadata: {},
        }),
        listMessages: vi.fn().mockResolvedValue({ messages: [], total: 0 }),
        updateThread: vi.fn().mockRejectedValue(new Error('Update failed')),
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

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await processor.processOutputResult({
        messages,
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        runtimeContext: createRuntimeContextWithMemory('thread-1'),
      });

      // Should still save messages and return them
      expect(result).toEqual(messages);
      expect(mockStorage.saveMessages).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to update thread metadata:', expect.any(Error));

      consoleSpy.mockRestore();
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

      const result = await processor.processOutputResult({
        messages,
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        // No runtimeContext, so no threadId
      });

      expect(result).toEqual(messages);
      expect(mockStorage.saveMessages).not.toHaveBeenCalled();
    });

    it('should handle messages with only system messages', async () => {
      const mockStorage = {
        saveMessages: vi.fn(),
      } as unknown as MemoryStorage;

      const processor = new MessageHistory({
        storage: mockStorage,
      });

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'system' as const,
          content: { format: 2, parts: [{ type: 'text', text: 'System message 1' }] },
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          role: 'system' as const,
          content: { format: 2, parts: [{ type: 'text', text: 'System message 2' }] },
          createdAt: new Date(),
        },
      ];

      const result = await processor.processOutputResult({
        messages,
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        runtimeContext: createRuntimeContextWithMemory('thread-1'),
      });

      expect(result).toEqual(messages);
      expect(mockStorage.saveMessages).not.toHaveBeenCalled();
    });

    it('should generate message IDs if not provided', async () => {
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
          createdAt: new Date(),
        } as MastraDBMessage, // No ID - will be auto-generated
      ];

      await processor.processOutputResult({
        messages,
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        runtimeContext: createRuntimeContextWithMemory('thread-1'),
      });

      const savedMessages = (mockStorage.saveMessages as any).mock.calls[0][0].messages;
      expect(savedMessages[0].id).toBeDefined();
      expect(savedMessages[0].id).toMatch(/^msg-/);
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

      await processor.processOutputResult({
        messages,
        abort: ((reason?: string) => {
          throw new Error(reason || 'Aborted');
        }) as (reason?: string) => never,
        runtimeContext: createRuntimeContextWithMemory('thread-1'),
      });

      const savedMessages = (mockStorage.saveMessages as any).mock.calls[0][0].messages;
      expect(savedMessages[0].id).toBe('existing-id-123');
    });
  });
});
