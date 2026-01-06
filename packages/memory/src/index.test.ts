import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, beforeEach } from 'vitest';
import { Memory } from './index';

// Expose protected method for testing
class TestableMemory extends Memory {
  public testUpdateMessageToHideWorkingMemoryV2(message: MastraDBMessage): MastraDBMessage | null {
    return this.updateMessageToHideWorkingMemoryV2(message);
  }
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
  });
});
