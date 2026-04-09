import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import type { MemoryConfig } from '@mastra/core/memory';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraVector } from '@mastra/core/vector';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { updateWorkingMemoryTool } from './tools/working-memory';
import { Memory } from './index';

// Expose protected methods for testing
class TestableMemoryWithWorkingMemory extends Memory {
  public async testExperimentalUpdateWorkingMemoryVNext(args: {
    threadId: string;
    resourceId?: string;
    workingMemory: string;
    searchString?: string;
    memoryConfig?: MemoryConfig;
  }): Promise<{ success: boolean; reason: string }> {
    return this.__experimental_updateWorkingMemoryVNext(args);
  }
}

// Expose protected method for testing
class TestableMemory extends Memory {
  public testUpdateMessageToHideWorkingMemoryV2(message: MastraDBMessage): MastraDBMessage | null {
    return this.updateMessageToHideWorkingMemoryV2(message);
  }
}

function getTextParts(message: MastraDBMessage): string[] {
  const parts = Array.isArray(message.content.parts) ? message.content.parts : [];
  return parts.filter(part => part.type === 'text').map(part => part.text);
}

describe('Memory', () => {
  describe('updateMessageToHideWorkingMemoryV2', () => {
    const memory = new TestableMemory();

    it('should handle proper V2 message content', () => {
      const message: MastraDBMessage = {
        id: 'test-1',
        role: 'user',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Hello world' }],
        },
      };

      const result = memory.testUpdateMessageToHideWorkingMemoryV2(message);

      expect(result).not.toBeNull();
      expect(result?.content.parts).toHaveLength(1);
      expect(result?.content.parts[0]).toEqual({ type: 'text', text: 'Hello world' });
    });

    it('should strip working memory tags from text parts', () => {
      const message: MastraDBMessage = {
        id: 'test-2',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Hello <working_memory>secret</working_memory> world' }],
        },
      };

      const result = memory.testUpdateMessageToHideWorkingMemoryV2(message);

      expect(result).not.toBeNull();
      expect(result?.content.parts[0]).toEqual({ type: 'text', text: 'Hello  world' });
    });

    it('should not crash when content is undefined', () => {
      const message = {
        id: 'test-3',
        role: 'user',
        createdAt: new Date(),
        content: undefined,
      } as unknown as MastraDBMessage;

      const result = memory.testUpdateMessageToHideWorkingMemoryV2(message);

      expect(result).not.toBeNull();
      expect(result?.content).toBeUndefined();
    });

    it('should not crash when content is a string (legacy format)', () => {
      const message = {
        id: 'test-4',
        role: 'user',
        createdAt: new Date(),
        content: 'Hello world',
      } as unknown as MastraDBMessage;

      const result = memory.testUpdateMessageToHideWorkingMemoryV2(message);

      expect(result).not.toBeNull();
      // Content should be preserved as-is, not corrupted to {}
      expect(result?.content).toBe('Hello world');
    });

    it('should not crash when content is an array (legacy format)', () => {
      const message = {
        id: 'test-5',
        role: 'user',
        createdAt: new Date(),
        content: [{ type: 'text', text: 'Hello' }],
      } as unknown as MastraDBMessage;

      const result = memory.testUpdateMessageToHideWorkingMemoryV2(message);

      expect(result).not.toBeNull();
      // Content should be preserved as array, not corrupted to { 0: ... }
      expect(Array.isArray(result?.content)).toBe(true);
    });

    it('should not crash when parts contain null or undefined elements', () => {
      const message: MastraDBMessage = {
        id: 'test-6',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Hello' }, null as any, undefined as any, { type: 'text', text: 'World' }],
        },
      };

      const result = memory.testUpdateMessageToHideWorkingMemoryV2(message);

      expect(result).not.toBeNull();
    });

    it('should not drop messages with empty parts array but valid content.content (issue #13824)', () => {
      const message: MastraDBMessage = {
        id: 'test-empty-parts',
        threadId: 'thread-1',
        resourceId: 'resource-1',
        role: 'user',
        createdAt: new Date(),
        content: {
          format: 2,
          content: 'Hello from a real message',
          experimental_attachments: [],
          parts: [],
        },
      };

      const result = memory.testUpdateMessageToHideWorkingMemoryV2(message);

      // The message has legitimate text in content.content — it must NOT be dropped
      expect(result).not.toBeNull();
      expect(result?.content.content).toBe('Hello from a real message');
    });

    it('should not drop assistant messages with empty parts array but valid content.content (issue #13824)', () => {
      const message: MastraDBMessage = {
        id: 'test-empty-parts-assistant',
        threadId: 'thread-1',
        resourceId: 'resource-1',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          content: 'I am the assistant reply',
          experimental_attachments: [],
          parts: [],
        },
      };

      const result = memory.testUpdateMessageToHideWorkingMemoryV2(message);

      expect(result).not.toBeNull();
      expect(result?.content.content).toBe('I am the assistant reply');
    });

    it('should filter out updateWorkingMemory tool invocations', () => {
      const message: MastraDBMessage = {
        id: 'test-7',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            { type: 'text', text: 'Let me update memory' },
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call-1',
                toolName: 'updateWorkingMemory',
                args: { data: 'test' },
                state: 'result',
                result: 'ok',
              },
            },
          ],
        },
      };

      const result = memory.testUpdateMessageToHideWorkingMemoryV2(message);

      expect(result).not.toBeNull();
      expect(result?.content.parts).toHaveLength(1);
      expect(result?.content.parts[0]).toEqual({ type: 'text', text: 'Let me update memory' });
    });
  });

  describe('saveMessages with empty parts array (issue #13824)', () => {
    let memory: Memory;

    beforeEach(() => {
      memory = new Memory({
        storage: new InMemoryStore(),
      });
    });

    it('should save messages that have content.content but empty parts array', async () => {
      const threadId = 'thread-save-test';
      const resourceId = 'resource-save-test';

      await memory.createThread({
        threadId,
        resourceId,
      });

      const messages: MastraDBMessage[] = [
        {
          id: 'save-msg-1',
          threadId,
          resourceId,
          role: 'user',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          content: {
            format: 2,
            content: 'Hello from user',
            experimental_attachments: [],
            parts: [],
          },
        },
        {
          id: 'save-msg-2',
          threadId,
          resourceId,
          role: 'assistant',
          createdAt: new Date('2024-01-01T10:01:00Z'),
          content: {
            format: 2,
            content: 'Hello from assistant',
            experimental_attachments: [],
            parts: [],
          },
        },
      ];

      const result = await memory.saveMessages({ messages });

      // Messages must not be silently dropped
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.messages).toHaveLength(2);

      const recalled = await memory.recall({
        threadId,
        resourceId,
        perPage: false,
      });

      expect(recalled.messages).toHaveLength(2);
      expect(recalled.messages.map(message => message.id)).toEqual(['save-msg-1', 'save-msg-2']);
      expect(recalled.messages.map(message => message.content)).toEqual([messages[0].content, messages[1].content]);
    });
  });

  describe('cloneThread', () => {
    let memory: Memory;
    const resourceId = 'test-resource';

    beforeEach(() => {
      memory = new Memory({
        storage: new InMemoryStore(),
      });
    });

    it('should clone a thread with all its messages', async () => {
      // Create a source thread
      const sourceThread = await memory.saveThread({
        thread: {
          id: 'source-thread-1',
          resourceId,
          title: 'Original Thread',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Save some messages to the source thread
      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          threadId: sourceThread.id,
          resourceId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'msg-2',
          threadId: sourceThread.id,
          resourceId,
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'Hi there!' }] },
          createdAt: new Date('2024-01-01T10:01:00Z'),
        },
        {
          id: 'msg-3',
          threadId: sourceThread.id,
          resourceId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'How are you?' }] },
          createdAt: new Date('2024-01-01T10:02:00Z'),
        },
      ];

      await memory.saveMessages({ messages });

      // Clone the thread
      const { thread: clonedThread, clonedMessages } = await memory.cloneThread({
        sourceThreadId: sourceThread.id,
      });

      // Verify the cloned thread
      expect(clonedThread.id).not.toBe(sourceThread.id);
      expect(clonedThread.resourceId).toBe(resourceId);
      expect(clonedThread.title).toBe('Clone of Original Thread');
      expect(clonedThread.metadata?.clone).toBeDefined();
      expect((clonedThread.metadata?.clone as any).sourceThreadId).toBe(sourceThread.id);

      // Verify the cloned messages
      expect(clonedMessages).toHaveLength(3);
      expect(clonedMessages.every(m => m.threadId === clonedThread.id)).toBe(true);
      expect(clonedMessages.every(m => m.id !== 'msg-1' && m.id !== 'msg-2' && m.id !== 'msg-3')).toBe(true);
    });

    it('should clone a thread with custom title', async () => {
      const sourceThread = await memory.saveThread({
        thread: {
          id: 'source-thread-2',
          resourceId,
          title: 'Original Thread',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const { thread: clonedThread } = await memory.cloneThread({
        sourceThreadId: sourceThread.id,
        title: 'My Custom Title',
      });

      expect(clonedThread.title).toBe('My Custom Title');
    });

    it('should clone a thread with message limit', async () => {
      const sourceThread = await memory.saveThread({
        thread: {
          id: 'source-thread-3',
          resourceId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Save 5 messages
      const messages: MastraDBMessage[] = [];
      for (let i = 1; i <= 5; i++) {
        messages.push({
          id: `msg-limit-${i}`,
          threadId: sourceThread.id,
          resourceId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: `Message ${i}` }] },
          createdAt: new Date(`2024-01-01T10:0${i}:00Z`),
        });
      }
      await memory.saveMessages({ messages });

      // Clone with limit of 2 (should get the last 2 messages)
      const { clonedMessages } = await memory.cloneThread({
        sourceThreadId: sourceThread.id,
        options: { messageLimit: 2 },
      });

      expect(clonedMessages).toHaveLength(2);
      // Should be the last 2 messages (Message 4 and Message 5)
      expect(clonedMessages[0]?.content.parts[0].text).toBe('Message 4');
      expect(clonedMessages[1]?.content.parts[0].text).toBe('Message 5');
    });

    it('should clone a thread with date filter', async () => {
      const sourceThread = await memory.saveThread({
        thread: {
          id: 'source-thread-4',
          resourceId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Save messages with different dates
      const messages: MastraDBMessage[] = [
        {
          id: 'msg-date-1',
          threadId: sourceThread.id,
          resourceId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'January message' }] },
          createdAt: new Date('2024-01-15T10:00:00Z'),
        },
        {
          id: 'msg-date-2',
          threadId: sourceThread.id,
          resourceId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'February message' }] },
          createdAt: new Date('2024-02-15T10:00:00Z'),
        },
        {
          id: 'msg-date-3',
          threadId: sourceThread.id,
          resourceId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'March message' }] },
          createdAt: new Date('2024-03-15T10:00:00Z'),
        },
      ];
      await memory.saveMessages({ messages });

      // Clone with date filter (only February)
      const { clonedMessages } = await memory.cloneThread({
        sourceThreadId: sourceThread.id,
        options: {
          messageFilter: {
            startDate: new Date('2024-02-01'),
            endDate: new Date('2024-02-28'),
          },
        },
      });

      expect(clonedMessages).toHaveLength(1);
      expect(clonedMessages[0]?.content.parts[0].text).toBe('February message');
    });

    it('should clone a thread with specific message IDs', async () => {
      const sourceThread = await memory.saveThread({
        thread: {
          id: 'source-thread-5',
          resourceId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-id-1',
          threadId: sourceThread.id,
          resourceId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'First' }] },
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'msg-id-2',
          threadId: sourceThread.id,
          resourceId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Second' }] },
          createdAt: new Date('2024-01-01T10:01:00Z'),
        },
        {
          id: 'msg-id-3',
          threadId: sourceThread.id,
          resourceId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Third' }] },
          createdAt: new Date('2024-01-01T10:02:00Z'),
        },
      ];
      await memory.saveMessages({ messages });

      // Clone only specific messages
      const { clonedMessages } = await memory.cloneThread({
        sourceThreadId: sourceThread.id,
        options: {
          messageFilter: {
            messageIds: ['msg-id-1', 'msg-id-3'],
          },
        },
      });

      expect(clonedMessages).toHaveLength(2);
      expect(clonedMessages[0]?.content.parts[0].text).toBe('First');
      expect(clonedMessages[1]?.content.parts[0].text).toBe('Third');
    });

    it('should throw error when source thread does not exist', async () => {
      await expect(
        memory.cloneThread({
          sourceThreadId: 'non-existent-thread',
        }),
      ).rejects.toThrow('Source thread with id non-existent-thread not found');
    });

    it('should clone thread with custom thread ID', async () => {
      const sourceThread = await memory.saveThread({
        thread: {
          id: 'source-thread-custom-id',
          resourceId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const customThreadId = 'my-custom-clone-id';
      const { thread: clonedThread } = await memory.cloneThread({
        sourceThreadId: sourceThread.id,
        newThreadId: customThreadId,
      });

      expect(clonedThread.id).toBe(customThreadId);
    });

    it('should throw error when custom thread ID already exists', async () => {
      const sourceThread = await memory.saveThread({
        thread: {
          id: 'source-thread-dup',
          resourceId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Create another thread with the ID we want to use
      await memory.saveThread({
        thread: {
          id: 'existing-thread-id',
          resourceId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await expect(
        memory.cloneThread({
          sourceThreadId: sourceThread.id,
          newThreadId: 'existing-thread-id',
        }),
      ).rejects.toThrow('Thread with id existing-thread-id already exists');
    });

    it('should clone thread to a different resource', async () => {
      const sourceThread = await memory.saveThread({
        thread: {
          id: 'source-thread-6',
          resourceId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const newResourceId = 'different-resource';
      const { thread: clonedThread } = await memory.cloneThread({
        sourceThreadId: sourceThread.id,
        resourceId: newResourceId,
      });

      expect(clonedThread.resourceId).toBe(newResourceId);
    });

    it('should preserve custom metadata in cloned thread', async () => {
      const sourceThread = await memory.saveThread({
        thread: {
          id: 'source-thread-7',
          resourceId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const { thread: clonedThread } = await memory.cloneThread({
        sourceThreadId: sourceThread.id,
        metadata: {
          customField: 'custom value',
          anotherField: 123,
        },
      });

      expect(clonedThread.metadata?.customField).toBe('custom value');
      expect(clonedThread.metadata?.anotherField).toBe(123);
      expect(clonedThread.metadata?.clone).toBeDefined();
    });

    it('should clone thread-scoped working memory to the cloned thread', async () => {
      const wmMemory = new Memory({
        storage: new InMemoryStore(),
        options: {
          workingMemory: {
            enabled: true,
            scope: 'thread',
          },
        },
      });

      // Create source thread
      const sourceThread = await wmMemory.saveThread({
        thread: {
          id: 'source-thread-wm',
          resourceId,
          title: 'Thread with Working Memory',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Save a message to the source thread
      await wmMemory.saveMessages({
        messages: [
          {
            id: 'msg-wm-1',
            threadId: sourceThread.id,
            resourceId,
            role: 'user',
            content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
            createdAt: new Date('2024-01-01T10:00:00Z'),
          },
        ],
      });

      // Set working memory on the source thread
      await wmMemory.updateWorkingMemory({
        threadId: sourceThread.id,
        resourceId,
        workingMemory: 'User name is Alice. Lives in New York.',
      });

      // Verify source thread has working memory
      const sourceWm = await wmMemory.getWorkingMemory({
        threadId: sourceThread.id,
        resourceId,
      });
      expect(sourceWm).toBe('User name is Alice. Lives in New York.');

      // Clone the thread
      const { thread: clonedThread } = await wmMemory.cloneThread({
        sourceThreadId: sourceThread.id,
      });

      // The cloned thread should have the working memory from the source
      const clonedWm = await wmMemory.getWorkingMemory({
        threadId: clonedThread.id,
        resourceId,
      });
      expect(clonedWm).toBe('User name is Alice. Lives in New York.');
    });
  });

  describe('clone utility methods', () => {
    let memory: Memory;
    const resourceId = 'test-resource';

    beforeEach(() => {
      memory = new Memory({
        storage: new InMemoryStore(),
      });
    });

    describe('isClone', () => {
      it('should return true for cloned threads', async () => {
        const sourceThread = await memory.saveThread({
          thread: {
            id: 'source-is-clone',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        const { thread: clonedThread } = await memory.cloneThread({
          sourceThreadId: sourceThread.id,
        });

        expect(memory.isClone(clonedThread)).toBe(true);
      });

      it('should return false for non-cloned threads', async () => {
        const thread = await memory.saveThread({
          thread: {
            id: 'not-a-clone',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        expect(memory.isClone(thread)).toBe(false);
      });

      it('should return false for null', () => {
        expect(memory.isClone(null)).toBe(false);
      });
    });

    describe('getCloneMetadata', () => {
      it('should return clone metadata for cloned threads', async () => {
        const sourceThread = await memory.saveThread({
          thread: {
            id: 'source-metadata',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        await memory.saveMessages({
          messages: [
            {
              id: 'msg-for-metadata',
              threadId: sourceThread.id,
              resourceId,
              role: 'user',
              content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
              createdAt: new Date(),
            },
          ],
        });

        const { thread: clonedThread } = await memory.cloneThread({
          sourceThreadId: sourceThread.id,
        });

        const metadata = memory.getCloneMetadata(clonedThread);

        expect(metadata).not.toBeNull();
        expect(metadata?.sourceThreadId).toBe(sourceThread.id);
        expect(metadata?.clonedAt).toBeInstanceOf(Date);
        expect(metadata?.lastMessageId).toBeDefined();
      });

      it('should return null for non-cloned threads', async () => {
        const thread = await memory.saveThread({
          thread: {
            id: 'not-cloned-metadata',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        expect(memory.getCloneMetadata(thread)).toBeNull();
      });
    });

    describe('getSourceThread', () => {
      it('should return the source thread for a cloned thread', async () => {
        const sourceThread = await memory.saveThread({
          thread: {
            id: 'source-for-get',
            resourceId,
            title: 'The Source',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        const { thread: clonedThread } = await memory.cloneThread({
          sourceThreadId: sourceThread.id,
        });

        const retrievedSource = await memory.getSourceThread(clonedThread.id);

        expect(retrievedSource).not.toBeNull();
        expect(retrievedSource?.id).toBe(sourceThread.id);
        expect(retrievedSource?.title).toBe('The Source');
      });

      it('should return null for non-cloned threads', async () => {
        const thread = await memory.saveThread({
          thread: {
            id: 'not-cloned-source',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        const source = await memory.getSourceThread(thread.id);
        expect(source).toBeNull();
      });
    });

    describe('listClones', () => {
      it('should list all clones of a source thread', async () => {
        const sourceThread = await memory.saveThread({
          thread: {
            id: 'source-for-list',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Create multiple clones
        await memory.cloneThread({ sourceThreadId: sourceThread.id, title: 'Clone 1' });
        await memory.cloneThread({ sourceThreadId: sourceThread.id, title: 'Clone 2' });
        await memory.cloneThread({ sourceThreadId: sourceThread.id, title: 'Clone 3' });

        const clones = await memory.listClones(sourceThread.id);

        expect(clones).toHaveLength(3);
        expect(clones.every(c => memory.isClone(c))).toBe(true);
      });

      it('should return empty array when no clones exist', async () => {
        const sourceThread = await memory.saveThread({
          thread: {
            id: 'source-no-clones',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        const clones = await memory.listClones(sourceThread.id);
        expect(clones).toHaveLength(0);
      });

      it('should return empty array when source thread does not exist', async () => {
        const clones = await memory.listClones('non-existent');
        expect(clones).toHaveLength(0);
      });
    });

    describe('getCloneHistory', () => {
      it('should return the full clone chain', async () => {
        // Create a chain: original -> clone1 -> clone2
        const original = await memory.saveThread({
          thread: {
            id: 'original-history',
            resourceId,
            title: 'Original',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        const { thread: clone1 } = await memory.cloneThread({
          sourceThreadId: original.id,
          title: 'Clone 1',
        });

        const { thread: clone2 } = await memory.cloneThread({
          sourceThreadId: clone1.id,
          title: 'Clone 2',
        });

        const history = await memory.getCloneHistory(clone2.id);

        expect(history).toHaveLength(3);
        expect(history[0]?.id).toBe(original.id);
        expect(history[1]?.id).toBe(clone1.id);
        expect(history[2]?.id).toBe(clone2.id);
      });

      it('should return single-element array for non-cloned threads', async () => {
        const thread = await memory.saveThread({
          thread: {
            id: 'not-cloned-history',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        const history = await memory.getCloneHistory(thread.id);

        expect(history).toHaveLength(1);
        expect(history[0]?.id).toBe(thread.id);
      });

      it('should return empty array for non-existent thread', async () => {
        const history = await memory.getCloneHistory('non-existent');
        expect(history).toHaveLength(0);
      });
    });

    describe('listThreads', () => {
      let memory: Memory;
      let resourceId1: string;
      let resourceId2: string;

      beforeEach(async () => {
        memory = new Memory({ storage: new InMemoryStore() });
        resourceId1 = 'resource-1';
        resourceId2 = 'resource-2';
      });

      it('should list threads filtered by resourceId', async () => {
        // Create threads with different resourceIds
        await memory.saveThread({
          thread: {
            id: 'thread-1',
            resourceId: resourceId1,
            title: 'Thread 1',
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: { type: 'test' },
          },
        });

        await memory.saveThread({
          thread: {
            id: 'thread-2',
            resourceId: resourceId1,
            title: 'Thread 2',
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: { type: 'test' },
          },
        });

        await memory.saveThread({
          thread: {
            id: 'thread-3',
            resourceId: resourceId2,
            title: 'Thread 3',
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: { type: 'test' },
          },
        });

        const result = await memory.listThreads({
          filter: { resourceId: resourceId1 },
          page: 0,
          perPage: 10,
        });

        expect(result.threads).toHaveLength(2);
        expect(result.total).toBe(2);
        expect(result.threads.map(t => t.id)).toEqual(expect.arrayContaining(['thread-1', 'thread-2']));
      });

      it('should list threads filtered by metadata', async () => {
        await memory.saveThread({
          thread: {
            id: 'thread-support-1',
            resourceId: resourceId1,
            title: 'Support Thread 1',
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: { category: 'support', priority: 'high' },
          },
        });

        await memory.saveThread({
          thread: {
            id: 'thread-support-2',
            resourceId: resourceId1,
            title: 'Support Thread 2',
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: { category: 'support', priority: 'low' },
          },
        });

        await memory.saveThread({
          thread: {
            id: 'thread-sales-1',
            resourceId: resourceId1,
            title: 'Sales Thread 1',
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: { category: 'sales', priority: 'high' },
          },
        });

        const result = await memory.listThreads({
          filter: { metadata: { category: 'support' } },
          page: 0,
          perPage: 10,
        });

        expect(result.threads).toHaveLength(2);
        expect(result.total).toBe(2);
        expect(result.threads.map(t => t.id)).toEqual(expect.arrayContaining(['thread-support-1', 'thread-support-2']));
      });

      it('should list threads filtered by both resourceId and metadata', async () => {
        await memory.saveThread({
          thread: {
            id: 'thread-r1-high',
            resourceId: resourceId1,
            title: 'High Priority Thread',
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: { priority: 'high' },
          },
        });

        await memory.saveThread({
          thread: {
            id: 'thread-r1-low',
            resourceId: resourceId1,
            title: 'Low Priority Thread',
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: { priority: 'low' },
          },
        });

        await memory.saveThread({
          thread: {
            id: 'thread-r2-high',
            resourceId: resourceId2,
            title: 'High Priority Thread R2',
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: { priority: 'high' },
          },
        });

        const result = await memory.listThreads({
          filter: {
            resourceId: resourceId1,
            metadata: { priority: 'high' },
          },
          page: 0,
          perPage: 10,
        });

        expect(result.threads).toHaveLength(1);
        expect(result.total).toBe(1);
        expect(result.threads[0]?.id).toBe('thread-r1-high');
      });

      it('should list all threads when no filter is provided', async () => {
        await memory.saveThread({
          thread: {
            id: 'thread-all-1',
            resourceId: resourceId1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        await memory.saveThread({
          thread: {
            id: 'thread-all-2',
            resourceId: resourceId2,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        const result = await memory.listThreads({
          page: 0,
          perPage: 10,
        });

        expect(result.threads.length).toBeGreaterThanOrEqual(2);
        expect(result.total).toBeGreaterThanOrEqual(2);
      });

      it('should return empty array when no threads match filter', async () => {
        const result = await memory.listThreads({
          filter: { metadata: { nonexistent: 'value' } },
          page: 0,
          perPage: 10,
        });

        expect(result.threads).toHaveLength(0);
        expect(result.total).toBe(0);
      });

      it('should paginate filtered results', async () => {
        // Create multiple threads
        for (let i = 1; i <= 5; i++) {
          await memory.saveThread({
            thread: {
              id: `thread-page-${i}`,
              resourceId: resourceId1,
              title: `Thread ${i}`,
              createdAt: new Date(Date.now() + i * 1000),
              updatedAt: new Date(Date.now() + i * 1000),
            },
          });
        }

        const page1 = await memory.listThreads({
          filter: { resourceId: resourceId1 },
          page: 0,
          perPage: 2,
        });

        expect(page1.threads).toHaveLength(2);
        expect(page1.total).toBe(5);
        expect(page1.hasMore).toBe(true);

        const page2 = await memory.listThreads({
          filter: { resourceId: resourceId1 },
          page: 1,
          perPage: 2,
        });

        expect(page2.threads).toHaveLength(2);
        expect(page2.total).toBe(5);
        expect(page2.hasMore).toBe(true);

        // Ensure different threads
        const page1Ids = page1.threads.map(t => t.id);
        const page2Ids = page2.threads.map(t => t.id);
        expect(page1Ids).not.toEqual(page2Ids);
      });
    });
  });

  describe('Working Memory - Data Corruption Prevention (Issue #12253)', () => {
    const resourceId = 'test-resource-wm';
    const template = `# User Information
- **First Name**:
- **Last Name**:
- **Location**: `;

    describe('resource-scoped working memory should persist across threads', () => {
      let memory: Memory;

      beforeEach(() => {
        memory = new Memory({
          storage: new InMemoryStore(),
          options: {
            workingMemory: {
              enabled: true,
              scope: 'resource',
              template,
            },
          },
        });
      });

      it('should retrieve working memory from a different thread with the same resourceId', async () => {
        const memoryConfig: MemoryConfig = {
          workingMemory: { enabled: true, scope: 'resource', template },
        };

        const thread1 = await memory.saveThread({
          thread: {
            id: 'thread-1-resource-scope',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        await memory.updateWorkingMemory({
          threadId: thread1.id,
          resourceId,
          workingMemory: '# User Information\n- **First Name**: Alice\n- **Interests**: I like dogs',
          memoryConfig,
        });

        const savedMemory = await memory.getWorkingMemory({
          threadId: thread1.id,
          resourceId,
          memoryConfig,
        });
        expect(savedMemory).toContain('I like dogs');

        const thread2 = await memory.saveThread({
          thread: {
            id: 'thread-2-resource-scope',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        const retrievedMemory = await memory.getWorkingMemory({
          threadId: thread2.id,
          resourceId,
          memoryConfig,
        });

        expect(retrievedMemory).not.toBeNull();
        expect(retrievedMemory).toContain('I like dogs');
        expect(retrievedMemory).toContain('Alice');
      });

      it('should not corrupt working memory when reading from different thread', async () => {
        const memoryConfig: MemoryConfig = {
          workingMemory: { enabled: true, scope: 'resource', template },
        };

        const thread1 = await memory.saveThread({
          thread: {
            id: 'thread-1-no-corrupt',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        const originalData = '# User Information\n- **First Name**: Bob\n- **Location**: NYC\n- **Facts**: Loves pizza';
        await memory.updateWorkingMemory({
          threadId: thread1.id,
          resourceId,
          workingMemory: originalData,
          memoryConfig,
        });

        const thread2 = await memory.saveThread({
          thread: {
            id: 'thread-2-no-corrupt',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        const read1 = await memory.getWorkingMemory({
          threadId: thread2.id,
          resourceId,
          memoryConfig,
        });
        const read2 = await memory.getWorkingMemory({
          threadId: thread2.id,
          resourceId,
          memoryConfig,
        });

        const finalRead = await memory.getWorkingMemory({
          threadId: thread1.id,
          resourceId,
          memoryConfig,
        });

        expect(read1).toContain('Loves pizza');
        expect(read2).toContain('Loves pizza');
        expect(finalRead).toContain('Loves pizza');

        expect(finalRead).toBe(originalData);
      });

      it('should NOT wipe working memory if updateWorkingMemoryTool is called with empty template from different thread', async () => {
        const memoryConfig: MemoryConfig = {
          workingMemory: { enabled: true, scope: 'resource', template },
        };

        const thread1 = await memory.saveThread({
          thread: {
            id: 'thread-1-wipe-test',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        const meaningfulData = '# User Information\n- **First Name**: Alice\n- **Interests**: I like dogs';
        await memory.updateWorkingMemory({
          threadId: thread1.id,
          resourceId,
          workingMemory: meaningfulData,
          memoryConfig,
        });

        const thread2 = await memory.saveThread({
          thread: {
            id: 'thread-2-wipe-test',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        const beforeWipeAttempt = await memory.getWorkingMemory({
          threadId: thread2.id,
          resourceId,
          memoryConfig,
        });
        expect(beforeWipeAttempt).toContain('I like dogs');

        const tool = updateWorkingMemoryTool(memoryConfig);

        const toolContext = {
          agent: {
            threadId: thread2.id,
            resourceId,
          },
          memory,
        };

        const toolResult = (await tool.execute!({ memory: template }, toolContext as any)) as {
          success: boolean;
          message?: string;
        };

        expect(toolResult.success).toBe(false);
        expect(toolResult.message).toContain('empty template');

        const afterWipeAttempt = await memory.getWorkingMemory({
          threadId: thread1.id,
          resourceId,
          memoryConfig,
        });

        expect(afterWipeAttempt).toContain('I like dogs');
        expect(afterWipeAttempt).toContain('Alice');
      });
    });

    describe('updateWorkingMemory with mutex', () => {
      let memory: Memory;

      beforeEach(() => {
        memory = new Memory({
          storage: new InMemoryStore(),
          options: {
            workingMemory: {
              enabled: true,
              scope: 'resource',
              template,
            },
          },
        });
      });

      it('should handle concurrent updates without data loss', async () => {
        const thread = await memory.saveThread({
          thread: {
            id: 'concurrent-test-thread',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        await memory.updateWorkingMemory({
          threadId: thread.id,
          resourceId,
          workingMemory: '# User Information\n- **First Name**: Alice',
          memoryConfig: {
            workingMemory: { enabled: true, scope: 'resource', template },
          },
        });

        const update1 = memory.updateWorkingMemory({
          threadId: thread.id,
          resourceId,
          workingMemory: '# User Information\n- **First Name**: Bob',
          memoryConfig: {
            workingMemory: { enabled: true, scope: 'resource', template },
          },
        });

        const update2 = memory.updateWorkingMemory({
          threadId: thread.id,
          resourceId,
          workingMemory: '# User Information\n- **First Name**: Charlie',
          memoryConfig: {
            workingMemory: { enabled: true, scope: 'resource', template },
          },
        });

        await Promise.all([update1, update2]);

        const finalMemory = await memory.getWorkingMemory({
          threadId: thread.id,
          resourceId,
          memoryConfig: {
            workingMemory: { enabled: true, scope: 'resource', template },
          },
        });

        // The final value should be either Bob or Charlie, not corrupted
        expect(finalMemory).toBeDefined();
        expect(finalMemory?.includes('Bob') || finalMemory?.includes('Charlie')).toBe(true);
      });
    });

    describe('__experimental_updateWorkingMemoryVNext - template duplication prevention', () => {
      let memory: TestableMemoryWithWorkingMemory;

      beforeEach(() => {
        memory = new TestableMemoryWithWorkingMemory({
          storage: new InMemoryStore(),
          options: {
            workingMemory: {
              enabled: true,
              scope: 'resource',
              template,
            },
          },
        });
      });

      it('should reject empty template insertion when data already exists', async () => {
        // Create thread
        const thread = await memory.saveThread({
          thread: {
            id: 'vnext-template-test',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        const memoryConfig: MemoryConfig = {
          workingMemory: { enabled: true, scope: 'resource', template },
        };

        await memory.updateWorkingMemory({
          threadId: thread.id,
          resourceId,
          workingMemory: '# User Information\n- **First Name**: Alice\n- **Last Name**: Smith',
          memoryConfig,
        });

        const result = await memory.testExperimentalUpdateWorkingMemoryVNext({
          threadId: thread.id,
          resourceId,
          workingMemory: template,
          memoryConfig,
        });

        expect(result.success).toBe(false);
        expect(result.reason).toContain('duplicate');
      });

      it('should reject appending empty template to existing data', async () => {
        const thread = await memory.saveThread({
          thread: {
            id: 'vnext-append-test',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        const memoryConfig: MemoryConfig = {
          workingMemory: { enabled: true, scope: 'resource', template },
        };

        await memory.updateWorkingMemory({
          threadId: thread.id,
          resourceId,
          workingMemory: '# User Information\n- **First Name**: Alice',
          memoryConfig,
        });

        const result = await memory.testExperimentalUpdateWorkingMemoryVNext({
          threadId: thread.id,
          resourceId,
          workingMemory: template.trim(),
          searchString: 'this string does not exist',
          memoryConfig,
        });

        expect(result.success).toBe(false);
      });

      it('should reject template with whitespace variations (requires normalized comparison)', async () => {
        const thread = await memory.saveThread({
          thread: {
            id: 'vnext-whitespace-test',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        const memoryConfig: MemoryConfig = {
          workingMemory: { enabled: true, scope: 'resource', template },
        };

        await memory.updateWorkingMemory({
          threadId: thread.id,
          resourceId,
          workingMemory: '# User Information\n- **First Name**: Alice',
          memoryConfig,
        });

        const templateWithExtraWhitespace = `# User Information
-  **First Name**:
-  **Last Name**:
-  **Location**:  `;

        const result = await memory.testExperimentalUpdateWorkingMemoryVNext({
          threadId: thread.id,
          resourceId,
          workingMemory: templateWithExtraWhitespace,
          memoryConfig,
        });

        expect(result.success).toBe(false);
      });

      it('should allow valid data updates', async () => {
        const thread = await memory.saveThread({
          thread: {
            id: 'vnext-valid-test',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        const memoryConfig: MemoryConfig = {
          workingMemory: { enabled: true, scope: 'resource', template },
        };

        await memory.updateWorkingMemory({
          threadId: thread.id,
          resourceId,
          workingMemory: '# User Information\n- **First Name**: Alice',
          memoryConfig,
        });

        const result = await memory.testExperimentalUpdateWorkingMemoryVNext({
          threadId: thread.id,
          resourceId,
          workingMemory: '- **Last Name**: Smith',
          memoryConfig,
        });

        expect(result.success).toBe(true);

        const finalMemory = await memory.getWorkingMemory({
          threadId: thread.id,
          resourceId,
          memoryConfig,
        });

        expect(finalMemory).toContain('Alice');
        expect(finalMemory).toContain('Smith');
      });

      it('should handle searchString replacement correctly', async () => {
        const thread = await memory.saveThread({
          thread: {
            id: 'vnext-replace-test',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        const memoryConfig: MemoryConfig = {
          workingMemory: { enabled: true, scope: 'resource', template },
        };

        await memory.updateWorkingMemory({
          threadId: thread.id,
          resourceId,
          workingMemory: '# User Information\n- **First Name**: Alice\n- **Location**: NYC',
          memoryConfig,
        });

        const result = await memory.testExperimentalUpdateWorkingMemoryVNext({
          threadId: thread.id,
          resourceId,
          workingMemory: '- **Location**: Los Angeles',
          searchString: '- **Location**: NYC',
          memoryConfig,
        });

        expect(result.success).toBe(true);
        expect(result.reason).toContain('replaced');

        const finalMemory = await memory.getWorkingMemory({
          threadId: thread.id,
          resourceId,
          memoryConfig,
        });

        expect(finalMemory).toContain('Alice');
        expect(finalMemory).toContain('Los Angeles');
        expect(finalMemory).not.toContain('NYC');
      });
    });
  });

  describe('semantic recall index naming', () => {
    it('should use the same vector index for processor writes and recall reads with non-default embedding dimensions', async () => {
      // 384-dim embeddings (like fastembed) — NOT the default 1536
      const embeddingDim = 384;
      const fakeEmbedding = new Array(embeddingDim).fill(0.1);

      const mockVector: MastraVector = {
        createIndex: vi.fn().mockResolvedValue(undefined),
        upsert: vi.fn().mockResolvedValue(undefined),
        query: vi.fn().mockResolvedValue([]),
        listIndexes: vi.fn().mockResolvedValue([]),
        deleteVectors: vi.fn().mockResolvedValue(undefined),
        describeIndex: vi.fn().mockResolvedValue({ dimension: embeddingDim }),
        id: 'mock-vector',
      } as any;

      const mockEmbedder = {
        doEmbed: vi.fn().mockResolvedValue({
          embeddings: [fakeEmbedding],
        }),
        modelId: 'mock-384-embedder',
        specificationVersion: 'v1',
        provider: 'mock',
      } as any;

      const memory = new Memory({
        storage: new InMemoryStore(),
        vector: mockVector,
        embedder: mockEmbedder,
        options: {
          semanticRecall: { scope: 'thread' },
          lastMessages: 10,
          generateTitle: false,
        },
      });

      // Create a thread
      await memory.saveThread({
        thread: {
          id: 'sr-thread-1',
          resourceId: 'sr-resource-1',
          title: 'Test Thread',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // --- WRITE PATH: SemanticRecall output processor (used by agent) ---
      const outputProcessors = await memory.getOutputProcessors();
      const semanticProcessor = outputProcessors.find(p => p.id === 'semantic-recall');
      expect(semanticProcessor).toBeDefined();

      const testMessage: MastraDBMessage = {
        id: 'sr-msg-1',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'What is machine learning?' }],
          content: 'What is machine learning?',
        },
        createdAt: new Date(),
        threadId: 'sr-thread-1',
        resourceId: 'sr-resource-1',
      };

      const messageList = new MessageList();
      messageList.add([testMessage], 'input');

      const requestContext = new RequestContext();
      requestContext.set('MastraMemory', {
        thread: { id: 'sr-thread-1', resourceId: 'sr-resource-1' },
        resourceId: 'sr-resource-1',
      });

      await semanticProcessor!.processOutputResult!({
        messages: [testMessage],
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Capture the index name used for the write (upsert)
      expect(mockVector.upsert).toHaveBeenCalled();
      const writeIndexName = vi.mocked(mockVector.upsert).mock.calls[0]![0].indexName;

      // Clear mocks for the read path
      vi.mocked(mockVector.createIndex).mockClear();
      vi.mocked(mockVector.query).mockClear();

      // --- READ PATH: memory.recall() (used by Studio's Semantic Recall search) ---
      await memory.recall({
        threadId: 'sr-thread-1',
        resourceId: 'sr-resource-1',
        vectorSearchString: 'machine learning',
      });

      // Capture the index name used for the read (query)
      expect(mockVector.query).toHaveBeenCalled();
      const readIndexName = vi.mocked(mockVector.query).mock.calls[0]![0].indexName;

      // The write and read paths MUST use the same index name.
      // With a 384-dim embedder, the processor writes to one index
      // while recall() searches a different one — causing search to return nothing.
      expect(writeIndexName).toBe(readIndexName);
      expect(writeIndexName).toContain('384');
    });
  });

  describe('toModelOutput persistence', () => {
    it('should preserve raw tool result and stored modelOutput through save/load cycle', async () => {
      const memory = new Memory({
        storage: new InMemoryStore(),
      });
      const resourceId = 'tmo-resource';
      const threadId = 'tmo-thread';

      // Create thread
      await memory.saveThread({
        thread: {
          id: threadId,
          resourceId,
          title: 'toModelOutput test',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Save messages with a tool result that has stored modelOutput on providerMetadata
      // (this simulates what llm-mapping-step.ts does at creation time)
      const messages: MastraDBMessage[] = [
        {
          id: 'tmo-msg-1',
          threadId,
          resourceId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'What is the weather?' }] },
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'tmo-msg-2',
          threadId,
          resourceId,
          role: 'assistant',
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: 'call-1',
                  toolName: 'getWeather',
                  args: { city: 'NYC' },
                  result: {
                    temperature: 72,
                    conditions: 'sunny',
                    humidity: 45,
                    windSpeed: 12,
                    forecast: [
                      { day: 'Monday', high: 75, low: 60 },
                      { day: 'Tuesday', high: 70, low: 55 },
                    ],
                  },
                },
                providerMetadata: {
                  mastra: {
                    modelOutput: { type: 'text', value: '72°F, sunny' },
                  },
                },
              },
            ],
          },
          createdAt: new Date('2024-01-01T10:01:00Z'),
        },
      ];

      await memory.saveMessages({ messages });

      // Load messages back from storage
      const { messages: loadedMessages } = await memory.recall({
        threadId,
        resourceId,
      });

      // Verify raw result is preserved in storage
      expect(loadedMessages).toHaveLength(2);
      const toolMsg = loadedMessages[1]!;
      expect(toolMsg.content).toHaveProperty('format', 2);
      const parts = (toolMsg.content as any).parts;
      expect(parts[0].type).toBe('tool-invocation');
      expect(parts[0].toolInvocation.result).toEqual({
        temperature: 72,
        conditions: 'sunny',
        humidity: 45,
        windSpeed: 12,
        forecast: [
          { day: 'Monday', high: 75, low: 60 },
          { day: 'Tuesday', high: 70, low: 55 },
        ],
      });

      // Verify stored modelOutput is also preserved
      expect(parts[0].providerMetadata?.mastra?.modelOutput).toEqual({
        type: 'text',
        value: '72°F, sunny',
      });

      // Create a MessageList from loaded messages and call llmPrompt
      const list = new MessageList({ threadId, resourceId }).add(loadedMessages, 'memory');

      // llmPrompt should use the stored modelOutput — no tools needed
      const prompt = await list.get.all.aiV5.llmPrompt();
      const toolResult = prompt.flatMap((m: any) => m.content).find((p: any) => p.type === 'tool-result');
      expect(toolResult).toBeDefined();
      expect(toolResult.output).toEqual({
        type: 'text',
        value: '72°F, sunny',
      });
    });
  });

  describe('recall pagination metadata', () => {
    let memory: Memory;
    const resourceId = 'resource-pagination';
    const threadId = 'thread-pagination';

    beforeEach(async () => {
      memory = new Memory({ storage: new InMemoryStore() });

      await memory.saveThread({
        thread: {
          id: threadId,
          resourceId,
          title: 'Pagination Thread',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Save 5 messages
      const messages: MastraDBMessage[] = [];
      for (let i = 1; i <= 5; i++) {
        messages.push({
          id: `msg-page-${i}`,
          threadId,
          resourceId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: `Message ${i}` }] },
          createdAt: new Date(`2024-01-01T10:0${i}:00Z`),
        });
      }
      await memory.saveMessages({ messages });
    });

    it('filters system reminder user messages from recall() by default', async () => {
      const reminderMarkup =
        '<system-reminder type="dynamic-agents-md" path="/repo/packages/memory/AGENTS.md">Memory guidance</system-reminder>';

      await memory.saveMessages({
        messages: [
          {
            id: 'msg-reminder-metadata',
            threadId,
            resourceId,
            role: 'user',
            content: {
              format: 2,
              parts: [{ type: 'text', text: reminderMarkup }],
              metadata: {
                dynamicAgentsMdReminder: {
                  path: '/repo/packages/memory/AGENTS.md',
                  type: 'dynamic-agents-md',
                },
              },
            },
            createdAt: new Date('2024-01-01T10:06:00Z'),
          },
          {
            id: 'msg-reminder-legacy',
            threadId,
            resourceId,
            role: 'user',
            content: {
              format: 2,
              parts: [{ type: 'text', text: reminderMarkup }],
            },
            createdAt: new Date('2024-01-01T10:07:00Z'),
          },
        ],
      });

      const result = await memory.recall({
        threadId,
        resourceId,
        perPage: false,
      });

      expect(result.messages.map(message => message.id)).not.toContain('msg-reminder-metadata');
      expect(result.messages.map(message => message.id)).not.toContain('msg-reminder-legacy');
    });

    it('includes system reminder user messages when includeSystemReminders is true', async () => {
      const reminderMarkup =
        '<system-reminder type="dynamic-agents-md" path="/repo/packages/memory/AGENTS.md">Memory guidance</system-reminder>';

      await memory.saveMessages({
        messages: [
          {
            id: 'msg-reminder-visible',
            threadId,
            resourceId,
            role: 'user',
            content: {
              format: 2,
              parts: [{ type: 'text', text: reminderMarkup }],
              metadata: {
                dynamicAgentsMdReminder: {
                  path: '/repo/packages/memory/AGENTS.md',
                  type: 'dynamic-agents-md',
                },
              },
            },
            createdAt: new Date('2024-01-01T10:06:00Z'),
          },
        ],
      });

      const result = await memory.recall({
        threadId,
        resourceId,
        perPage: false,
        includeSystemReminders: true,
      });

      expect(result.messages.map(message => message.id)).toContain('msg-reminder-visible');
      expect(getTextParts(result.messages.find(message => message.id === 'msg-reminder-visible')!)).toContain(
        reminderMarkup,
      );
    });

    it('should return pagination metadata from recall()', async () => {
      const result = await memory.recall({
        threadId,
        resourceId,
        page: 0,
        perPage: 2,
      });

      expect(result.messages).toHaveLength(2);
      // Verifies the fix for #13277 — recall() now surfaces pagination metadata
      expect(result).toHaveProperty('total', 5);
      expect(result).toHaveProperty('page', 0);
      expect(result).toHaveProperty('perPage', 2);
      expect(result).toHaveProperty('hasMore', true);
    });

    it('should return correct hasMore=false on last page', async () => {
      const result = await memory.recall({
        threadId,
        resourceId,
        page: 0,
        perPage: 10,
      });

      expect(result.messages).toHaveLength(5);
      expect(result).toHaveProperty('total', 5);
      expect(result).toHaveProperty('hasMore', false);
    });
  });

  describe('lastMessages: false (disable conversation history)', () => {
    let memory: Memory;
    const resourceId = 'test-resource';
    const threadId = 'test-thread-lm-false';

    beforeEach(async () => {
      memory = new Memory({
        storage: new InMemoryStore(),
        options: {
          lastMessages: false,
        },
      });

      // Create a thread and seed it with messages
      await memory.saveThread({
        thread: {
          id: threadId,
          resourceId,
          title: 'Test Thread',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await memory.saveMessages({
        messages: [
          {
            id: 'msg-1',
            threadId,
            resourceId,
            role: 'user',
            content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
            createdAt: new Date('2024-01-01T10:00:00Z'),
          },
          {
            id: 'msg-2',
            threadId,
            resourceId,
            role: 'assistant',
            content: { format: 2, parts: [{ type: 'text', text: 'Hi there!' }] },
            createdAt: new Date('2024-01-01T10:01:00Z'),
          },
          {
            id: 'msg-3',
            threadId,
            resourceId,
            role: 'user',
            content: { format: 2, parts: [{ type: 'text', text: 'How are you?' }] },
            createdAt: new Date('2024-01-01T10:02:00Z'),
          },
        ],
      });
    });

    it('recall() should return empty messages with valid pagination metadata when lastMessages: false', async () => {
      const result = await memory.recall({ threadId, resourceId });

      expect(result.messages).toHaveLength(0);
      expect(result).toHaveProperty('total', 0);
      expect(result).toHaveProperty('page', 0);
      expect(result).toHaveProperty('perPage', 0);
      expect(result).toHaveProperty('hasMore', false);
    });

    it('recall() should return empty when lastMessages: false even if thread has many messages', async () => {
      // Add more messages
      for (let i = 4; i <= 20; i++) {
        await memory.saveMessages({
          messages: [
            {
              id: `msg-${i}`,
              threadId,
              resourceId,
              role: i % 2 === 0 ? 'user' : 'assistant',
              content: { format: 2, parts: [{ type: 'text', text: `Message ${i}` }] },
              createdAt: new Date(`2024-01-01T10:${String(i).padStart(2, '0')}:00Z`),
            },
          ],
        });
      }

      const result = await memory.recall({ threadId, resourceId });

      expect(result.messages).toHaveLength(0);
    });

    it('recall() with explicit perPage override should still work', async () => {
      // When perPage is explicitly passed (e.g., from playground listing messages),
      // it should override the config and return messages
      const result = await memory.recall({ threadId, resourceId, perPage: false });

      // perPage: false explicitly = "no limit, return all"
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.messages).toHaveLength(3);
    });

    it('recall() with explicit perPage number should work', async () => {
      const result = await memory.recall({ threadId, resourceId, perPage: 2 });

      expect(result.messages).toHaveLength(2);
    });

    it('threadConfig should preserve lastMessages: false after construction', () => {
      const config = memory.getMergedThreadConfig();

      expect(config.lastMessages).toBe(false);
    });

    it('threadConfig should preserve lastMessages: false when merging with empty config', () => {
      const config = memory.getMergedThreadConfig({});

      expect(config.lastMessages).toBe(false);
    });

    it('threadConfig should preserve lastMessages: false when merging with unrelated options', () => {
      const config = memory.getMergedThreadConfig({
        workingMemory: { enabled: false },
      });

      expect(config.lastMessages).toBe(false);
    });

    it('per-request config can override lastMessages: false back to a number', () => {
      const config = memory.getMergedThreadConfig({
        lastMessages: 10,
      });

      expect(config.lastMessages).toBe(10);
    });

    it('getInputProcessors should return no MessageHistory processor when lastMessages: false', async () => {
      const processors = await memory.getInputProcessors();

      const messageHistoryProcessor = processors.find(p => p.id === 'message-history');
      expect(messageHistoryProcessor).toBeUndefined();
    });

    it('getOutputProcessors should return no MessageHistory processor when lastMessages: false', async () => {
      const processors = await memory.getOutputProcessors();

      const messageHistoryProcessor = processors.find(p => p.id === 'message-history');
      expect(messageHistoryProcessor).toBeUndefined();
    });
  });

  describe('Vector Deletion', () => {
    function createMemoryWithMockVector(indexSeparator = '_') {
      const mockVector = {
        deleteVectors: vi.fn(),
        listIndexes: vi.fn().mockResolvedValue([`memory${indexSeparator}messages`]),
        query: vi.fn(),
        upsert: vi.fn(),
        createIndex: vi.fn(),
        describeIndex: vi.fn(),
        listCollections: vi.fn(),
        createCollection: vi.fn(),
        describeCollection: vi.fn(),
        deleteCollection: vi.fn(),
        indexSeparator,
      };

      class MemoryWithMockVector extends Memory {
        public mockVector = mockVector;

        constructor() {
          super({ storage: new InMemoryStore() });
          // @ts-expect-error - injecting mock vector
          this.vector = this.mockVector;
        }
      }

      return new MemoryWithMockVector();
    }

    it('should delete message vectors with default separator', async () => {
      const memory = createMemoryWithMockVector('_');
      const messageId = 'msg-123';

      await memory.deleteMessages([messageId]);

      await vi.waitFor(() => {
        expect(memory.mockVector.deleteVectors).toHaveBeenCalledWith({
          indexName: 'memory_messages',
          filter: { message_id: { $in: [messageId] } },
        });
      });
    });

    it('should delete thread vectors with default separator', async () => {
      const memory = createMemoryWithMockVector('_');
      const threadId = 'thread-123';

      await memory.deleteThread(threadId);

      await vi.waitFor(() => {
        expect(memory.mockVector.deleteVectors).toHaveBeenCalledWith({
          indexName: 'memory_messages',
          filter: { thread_id: threadId },
        });
      });
    });

    it('should delete message vectors with dash separator (Pinecone/Vectorize)', async () => {
      const memory = createMemoryWithMockVector('-');
      const messageId = 'msg-456';

      await memory.deleteMessages([messageId]);

      await vi.waitFor(() => {
        expect(memory.mockVector.deleteVectors).toHaveBeenCalledWith({
          indexName: 'memory-messages',
          filter: { message_id: { $in: [messageId] } },
        });
      });
    });

    it('should delete thread vectors with dash separator (Pinecone/Vectorize)', async () => {
      const memory = createMemoryWithMockVector('-');
      const threadId = 'thread-456';

      await memory.deleteThread(threadId);

      await vi.waitFor(() => {
        expect(memory.mockVector.deleteVectors).toHaveBeenCalledWith({
          indexName: 'memory-messages',
          filter: { thread_id: threadId },
        });
      });
    });

    it('should not throw when no vector store is configured', async () => {
      const memory = new Memory({ storage: new InMemoryStore() });

      await expect(memory.deleteThread('thread-789')).resolves.not.toThrow();
      await expect(memory.deleteMessages(['msg-789'])).resolves.not.toThrow();
    });

    it('should batch message vector deletions when messageIds exceed batch size', async () => {
      const memory = createMemoryWithMockVector('_');
      const messageIds = Array.from({ length: 250 }, (_, i) => `msg-${i}`);

      await memory.deleteMessages(messageIds);

      await vi.waitFor(() => {
        expect(memory.mockVector.deleteVectors).toHaveBeenCalledTimes(3);

        expect(memory.mockVector.deleteVectors).toHaveBeenNthCalledWith(1, {
          indexName: 'memory_messages',
          filter: { message_id: { $in: messageIds.slice(0, 100) } },
        });
        expect(memory.mockVector.deleteVectors).toHaveBeenNthCalledWith(2, {
          indexName: 'memory_messages',
          filter: { message_id: { $in: messageIds.slice(100, 200) } },
        });
        expect(memory.mockVector.deleteVectors).toHaveBeenNthCalledWith(3, {
          indexName: 'memory_messages',
          filter: { message_id: { $in: messageIds.slice(200, 250) } },
        });
      });
    });

    it('should continue processing after a batch error', async () => {
      const memory = createMemoryWithMockVector('_');
      memory.mockVector.deleteVectors
        .mockRejectedValueOnce(new Error('batch 1 failed'))
        .mockResolvedValueOnce(undefined);

      const messageIds = Array.from({ length: 150 }, (_, i) => `msg-${i}`);

      await memory.deleteMessages(messageIds);

      await vi.waitFor(() => {
        // Both batches attempted despite the first one failing
        expect(memory.mockVector.deleteVectors).toHaveBeenCalledTimes(2);

        expect(memory.mockVector.deleteVectors).toHaveBeenNthCalledWith(2, {
          indexName: 'memory_messages',
          filter: { message_id: { $in: messageIds.slice(100, 150) } },
        });
      });
    });
  });

  describe('Memory tracing', () => {
    function createMockSpan() {
      const childSpan = {
        end: vi.fn(),
        error: vi.fn(),
      };
      const parentSpan = {
        createChildSpan: vi.fn().mockReturnValue(childSpan),
      };
      return { parentSpan, childSpan };
    }

    function createTracedMemory() {
      const store = new InMemoryStore();
      const memory = new Memory({ storage: store });
      return memory;
    }

    async function seedThread(memory: Memory, threadId: string, resourceId: string) {
      await memory.createThread({ threadId, resourceId });
      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          createdAt: new Date(),
          threadId,
          resourceId,
          content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
        },
        {
          id: 'msg-2',
          role: 'assistant',
          createdAt: new Date(),
          threadId,
          resourceId,
          content: { format: 2, parts: [{ type: 'text', text: 'Hi there' }] },
        },
      ];
      await memory.saveMessages({ messages });
      return messages;
    }

    it('recall creates a span and ends it with message count on success', async () => {
      const memory = createTracedMemory();
      const { parentSpan, childSpan } = createMockSpan();

      await seedThread(memory, 'thread-1', 'resource-1');

      const result = await memory.recall({
        threadId: 'thread-1',
        observabilityContext: { tracingContext: { currentSpan: parentSpan as any } },
      });

      expect(parentSpan.createChildSpan).toHaveBeenCalledTimes(1);
      const spanArgs = parentSpan.createChildSpan.mock.calls[0][0];
      expect(spanArgs.type).toBe('memory_operation');
      expect(spanArgs.attributes.operationType).toBe('recall');

      expect(childSpan.end).toHaveBeenCalledTimes(1);
      const endArgs = childSpan.end.mock.calls[0][0];
      expect(endArgs.output.success).toBe(true);
      expect(endArgs.attributes.messageCount).toBe(result.messages.length);
    });

    it('recall records error on span when it fails', async () => {
      const memory = createTracedMemory();
      const { parentSpan, childSpan } = createMockSpan();

      // Recall on a non-existent thread with resourceId triggers validation error
      await expect(
        memory.recall({
          threadId: 'nonexistent',
          resourceId: 'res-1',
          observabilityContext: { tracingContext: { currentSpan: parentSpan as any } },
        }),
      ).rejects.toThrow();

      expect(childSpan.error).toHaveBeenCalledTimes(1);
      expect(childSpan.error.mock.calls[0][0].endSpan).toBe(true);
    });

    it('saveMessages creates a span and ends it with correct attributes', async () => {
      const memory = createTracedMemory();
      const { parentSpan, childSpan } = createMockSpan();

      await memory.createThread({ threadId: 'thread-2', resourceId: 'resource-2' });

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-save-1',
          role: 'user',
          createdAt: new Date(),
          threadId: 'thread-2',
          resourceId: 'resource-2',
          content: { format: 2, parts: [{ type: 'text', text: 'Test message' }] },
        },
      ];

      await memory.saveMessages({
        messages,
        observabilityContext: { tracingContext: { currentSpan: parentSpan as any } },
      });

      expect(parentSpan.createChildSpan).toHaveBeenCalledTimes(1);
      const spanArgs = parentSpan.createChildSpan.mock.calls[0][0];
      expect(spanArgs.attributes.operationType).toBe('save');
      expect(spanArgs.attributes.messageCount).toBe(1);

      expect(childSpan.end).toHaveBeenCalledTimes(1);
      expect(childSpan.end.mock.calls[0][0].output.success).toBe(true);
    });

    it('deleteMessages creates a span and ends it with message count', async () => {
      const memory = createTracedMemory();
      const { parentSpan, childSpan } = createMockSpan();

      await seedThread(memory, 'thread-del', 'resource-del');

      await memory.deleteMessages(['msg-1'], { tracingContext: { currentSpan: parentSpan as any } });

      expect(parentSpan.createChildSpan).toHaveBeenCalledTimes(1);
      const spanArgs = parentSpan.createChildSpan.mock.calls[0][0];
      expect(spanArgs.attributes.operationType).toBe('delete');

      expect(childSpan.end).toHaveBeenCalledTimes(1);
      expect(childSpan.end.mock.calls[0][0].output.success).toBe(true);
      expect(childSpan.end.mock.calls[0][0].attributes.messageCount).toBe(1);
    });

    it('updateWorkingMemory creates a span and ends it on success', async () => {
      const memory = new Memory({
        storage: new InMemoryStore(),
        options: { workingMemory: { enabled: true, scope: 'thread' } },
      });
      const { parentSpan, childSpan } = createMockSpan();

      await memory.createThread({ threadId: 'thread-wm', resourceId: 'resource-wm' });

      await memory.updateWorkingMemory({
        threadId: 'thread-wm',
        workingMemory: 'updated memory content',
        observabilityContext: { tracingContext: { currentSpan: parentSpan as any } },
      });

      expect(parentSpan.createChildSpan).toHaveBeenCalledTimes(1);
      const spanArgs = parentSpan.createChildSpan.mock.calls[0][0];
      expect(spanArgs.attributes.operationType).toBe('update');

      expect(childSpan.end).toHaveBeenCalledTimes(1);
      expect(childSpan.end.mock.calls[0][0].output.success).toBe(true);
    });

    it('updateWorkingMemory throws without creating a span when working memory is disabled', async () => {
      const memory = createTracedMemory();
      const { parentSpan, childSpan } = createMockSpan();

      await expect(
        memory.updateWorkingMemory({
          threadId: 'thread-fail',
          workingMemory: 'data',
          observabilityContext: { tracingContext: { currentSpan: parentSpan as any } },
        }),
      ).rejects.toThrow('Working memory is not enabled');

      expect(parentSpan.createChildSpan).not.toHaveBeenCalled();
      expect(childSpan.error).not.toHaveBeenCalled();
    });
  });
});
