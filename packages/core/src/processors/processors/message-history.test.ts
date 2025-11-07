import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MastraMessageV2 } from '../../agent/index.js';
import type { MemoryRuntimeContext } from '../../memory/types.js';
import { RequestContext } from '../../request-context/index.js';
import { MemoryStorage } from '../../storage/domains/memory/base.js';

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
  private messages: MastraMessageV2[] = [];

  async getMessages(params: any): Promise<{ messages: MastraMessageV2[] }> {
    const { threadId, selectBy } = params;
    const threadMessages = this.messages.filter(m => m.threadId === threadId);

    if (selectBy?.last) {
      return { messages: threadMessages.slice(-selectBy.last) };
    }

    return { messages: threadMessages };
  }

  setMessages(messages: MastraMessageV2[]) {
    this.messages = messages;
  }

  // Implement other required abstract methods with stubs
  async getThreadById(_args: { threadId: string }) {
    return null;
  }
  async getThreadsByResourceId(_args: { resourceId: string }) {
    return [];
  }
  async saveThread(args: any) {
    return args;
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
  async getMessagesById(_args: { ids: string[] }) {
    return [];
  }
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }) {
    return args.messages;
  }
  async updateMessages(args: any) {
    return args.messages || [];
  }
  async deleteMessages(_args: { ids: string[] }) {}
  async getThreadsByResourceIdPaginated(_args: any) {
    return { data: [], nextCursor: null };
  }
  async getMessagesPaginated(_args: any) {
    return { data: [], nextCursor: null };
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
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'Hi there!' }] },
          threadId: 'thread-1',
          createdAt: new Date(),
        },
        {
          id: 'msg-3',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'How are you?' }] },
          threadId: 'thread-1',
          createdAt: new Date(),
        },
      ];

      mockStorage.setMessages(historicalMessages);

      processor = new MessageHistory({
        storage: mockStorage,
        lastMessages: 2,
      });

      const newMessages: MastraMessageV2[] = [
        {
          id: 'msg-4',
          role: 'user',
          content: { content: 'New message', parts: [{ type: 'text', text: 'New message' }] },
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

      const newMessages: MastraMessageV2[] = [
        {
          id: 'msg-2',
          role: 'user',
          content: { content: 'New', parts: [{ type: 'text', text: 'New' }] },
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
      const historicalMessages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { content: 'Message 1', parts: [{ type: 'text', text: 'Message 1' }] },
          threadId: 'thread-1',
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: { content: 'Message 2', parts: [{ type: 'text', text: 'Message 2' }] },
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

      const newMessages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { content: 'New', parts: [{ type: 'text', text: 'New' }] },
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
      const historicalMessages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'system',
          content: { content: 'System prompt', parts: [{ type: 'text', text: 'System prompt' }] },
          threadId: 'thread-1',
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          role: 'user',
          content: { content: 'User message', parts: [{ type: 'text', text: 'User message' }] },
          threadId: 'thread-1',
          createdAt: new Date(),
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

    it('should handle storage errors gracefully', async () => {
      const errorStorage = new MockStorage();
      errorStorage.getMessages = vi.fn().mockRejectedValue(new Error('Storage error'));

      processor = new MessageHistory({
        storage: errorStorage,
      });

      const newMessages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { content: 'New', parts: [{ type: 'text', text: 'New' }] },
          threadId: 'thread-1',
          createdAt: new Date(),
        },
      ];

      const result = await processor.processInput({
        messages: newMessages,
        abort: mockAbort,
        runtimeContext: createRuntimeContextWithMemory('thread-1'),
      });

      // Should return original messages on error
      expect(result).toEqual(newMessages);
    });

    it('should return original messages when no threadId', async () => {
      processor = new MessageHistory({
        storage: mockStorage,
        // No threadId
      });

      const newMessages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { content: 'New', parts: [{ type: 'text', text: 'New' }] },
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
      const historicalMessages = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: {
            format: 2,
            content: 'Let me calculate that',
            parts: [
              { type: 'text', text: 'Let me calculate that' },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'calculator',
                args: { a: 1, b: 2 },
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
      expect(result[0].content.parts?.[1].type).toBe('tool-call');
    });

    it('should handle tool result messages', async () => {
      const historicalMessages = [
        {
          id: 'msg-1',
          role: 'tool',
          content: {
            format: 2,
            content: '3',
            parts: [
              {
                type: 'tool-result',
                toolCallId: 'call-1',
                toolName: 'calculator',
                result: { result: 3 },
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
      expect(result[0].role).toBe('tool');
      expect(result[0].content.parts?.[0].type).toBe('tool-result');
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
        getMessages: vi.fn().mockResolvedValue([]),
        updateThread: vi.fn().mockResolvedValue(undefined),
      } as unknown as MemoryStorage;

      const processor = new MessageHistory({
        storage: mockStorage,
      });

      const messages: MastraDBMessage[] = [
        { role: 'system', content: { format: 2, parts: [{ type: 'text', text: 'You are a helpful assistant' }] } },
        { role: 'user', content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] }, id: 'msg-1' },
        { role: 'assistant', content: { format: 2, parts: [{ type: 'text', text: 'Hi there!' }] }, id: 'msg-2' },
        {
          role: 'assistant',
          content: {
            format: 2,
            parts: [{ type: 'tool-call', toolCallId: 'tool-1', toolName: 'search', args: {} }],
          },
          id: 'msg-3',
        },
        {
          role: 'tool',
          content: {
            format: 2,
            parts: [{ type: 'tool-result', toolCallId: 'tool-1', toolName: 'search', result: 'Tool result' }],
          },
          id: 'msg-4',
        },
      ];

      const result = await processor.processOutputResult({
        messages,
        abort: vi.fn(),
        runtimeContext: createRuntimeContextWithMemory('thread-1'),
      });

      expect(result).toEqual(messages);
      expect(mockStorage.saveMessages).toHaveBeenCalledWith({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.objectContaining({
              format: 2,
              parts: expect.arrayContaining([expect.objectContaining({ type: 'text', text: 'Hello' })]),
            }),
          }),
          expect.objectContaining({
            role: 'assistant',
            content: expect.objectContaining({
              format: 2,
              parts: expect.arrayContaining([expect.objectContaining({ type: 'text', text: 'Hi there!' })]),
            }),
          }),
          expect.objectContaining({
            role: 'assistant',
            content: expect.objectContaining({
              format: 2,
              parts: expect.arrayContaining([expect.objectContaining({ type: 'tool-call' })]),
            }),
          }),
          expect.objectContaining({
            role: 'tool',
            content: expect.objectContaining({
              format: 2,
              parts: expect.arrayContaining([expect.objectContaining({ type: 'tool-result', result: 'Tool result' })]),
            }),
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
        getMessages: vi.fn().mockResolvedValue([]),
        updateThread: vi.fn().mockResolvedValue(undefined),
      } as unknown as MemoryStorage;

      const processor = new MessageHistory({
        storage: mockStorage,
      });

      const messages: MastraMessageV2[] = [
        { role: 'system', content: 'System prompt 1' },
        { role: 'user', content: 'User message' },
        { role: 'system', content: 'System prompt 2' },
        { role: 'assistant', content: 'Assistant response' },
        { role: 'system', content: 'System prompt 3' },
      ];

      await processor.processOutputResult({
        messages,
        abort: vi.fn(),
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
        getMessages: vi.fn().mockResolvedValue({ messages: [{ role: 'user', content: 'existing' }] }),
        updateThread: vi.fn().mockResolvedValue(undefined),
      } as unknown as MemoryStorage;

      const processor = new MessageHistory({
        storage: mockStorage,
      });

      const messages: MastraDBMessage[] = [
        { role: 'user', content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] } },
      ];

      await processor.processOutputResult({
        messages,
        abort: vi.fn(),
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
      } as unknown as MemoryStorage;

      const processor = new MessageHistory({
        storage: mockStorage,
      });

      const messages: MastraMessageV2[] = [{ role: 'user', content: 'Hello' }];

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await processor.processOutputResult({
        messages,
        abort: vi.fn(),
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
        getMessages: vi.fn().mockResolvedValue([]),
        updateThread: vi.fn().mockRejectedValue(new Error('Update failed')),
      } as unknown as MemoryStorage;

      const processor = new MessageHistory({
        storage: mockStorage,
      });

      const messages: MastraMessageV2[] = [{ role: 'user', content: 'Hello' }];

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await processor.processOutputResult({
        messages,
        abort: vi.fn(),
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

      const messages: MastraMessageV2[] = [{ role: 'user', content: 'Hello' }];

      const result = await processor.processOutputResult({
        messages,
        abort: vi.fn(),
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

      const messages: MastraMessageV2[] = [
        { role: 'system', content: 'System message 1' },
        { role: 'system', content: 'System message 2' },
      ];

      const result = await processor.processOutputResult({
        messages,
        abort: vi.fn(),
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
        getMessages: vi.fn().mockResolvedValue([]),
        updateThread: vi.fn().mockResolvedValue(undefined),
      } as unknown as MemoryStorage;

      const processor = new MessageHistory({
        storage: mockStorage,
      });

      const messages: MastraMessageV2[] = [
        { role: 'user', content: 'Hello' }, // No ID
      ];

      await processor.processOutputResult({
        messages,
        abort: vi.fn(),
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
        getMessages: vi.fn().mockResolvedValue([]),
        updateThread: vi.fn().mockResolvedValue(undefined),
      } as unknown as MemoryStorage;

      const processor = new MessageHistory({
        storage: mockStorage,
      });

      const messages: MastraMessageV2[] = [{ role: 'user', content: 'Hello', id: 'existing-id-123' }];

      await processor.processOutputResult({
        messages,
        abort: vi.fn(),
        runtimeContext: createRuntimeContextWithMemory('thread-1'),
      });

      const savedMessages = (mockStorage.saveMessages as any).mock.calls[0][0].messages;
      expect(savedMessages[0].id).toBe('existing-id-123');
    });
  });
});
