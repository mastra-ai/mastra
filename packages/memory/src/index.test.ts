import type { MastraDBMessage } from '@mastra/core/agent';
import type { StorageThreadType } from '@mastra/core/memory';
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

  describe('branchThread', () => {
    let memory: Memory;
    const resourceId = 'test-resource';

    beforeEach(() => {
      memory = new Memory({
        storage: new InMemoryStore(),
      });
    });

    it('should branch a thread at the latest message by default', async () => {
      // Create a source thread
      const sourceThread = await memory.saveThread({
        thread: {
          id: 'source-thread-branch-1',
          resourceId,
          title: 'Original Thread',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Save some messages to the source thread
      const messages: MastraDBMessage[] = [
        {
          id: 'msg-b1',
          threadId: sourceThread.id,
          resourceId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'msg-b2',
          threadId: sourceThread.id,
          resourceId,
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'Hi there!' }] },
          createdAt: new Date('2024-01-01T10:01:00Z'),
        },
        {
          id: 'msg-b3',
          threadId: sourceThread.id,
          resourceId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'How are you?' }] },
          createdAt: new Date('2024-01-01T10:02:00Z'),
        },
      ];

      await memory.saveMessages({ messages });

      // Branch the thread
      const { thread: branchedThread, inheritedMessageCount } = await memory.branchThread({
        sourceThreadId: sourceThread.id,
      });

      // Verify the branched thread
      expect(branchedThread.id).not.toBe(sourceThread.id);
      expect(branchedThread.resourceId).toBe(resourceId);
      expect(branchedThread.title).toBe('Branch of Original Thread');
      expect(branchedThread.metadata?.branch).toBeDefined();
      expect((branchedThread.metadata?.branch as any).parentThreadId).toBe(sourceThread.id);
      expect((branchedThread.metadata?.branch as any).branchPointMessageId).toBe('msg-b3');
      expect(inheritedMessageCount).toBe(3);
    });

    it('should branch a thread at a specific message', async () => {
      const sourceThread = await memory.saveThread({
        thread: {
          id: 'source-thread-branch-2',
          resourceId,
          title: 'Original Thread',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-bp1',
          threadId: sourceThread.id,
          resourceId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Message 1' }] },
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'msg-bp2',
          threadId: sourceThread.id,
          resourceId,
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'Message 2' }] },
          createdAt: new Date('2024-01-01T10:01:00Z'),
        },
        {
          id: 'msg-bp3',
          threadId: sourceThread.id,
          resourceId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Message 3' }] },
          createdAt: new Date('2024-01-01T10:02:00Z'),
        },
        {
          id: 'msg-bp4',
          threadId: sourceThread.id,
          resourceId,
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'Message 4' }] },
          createdAt: new Date('2024-01-01T10:03:00Z'),
        },
      ];

      await memory.saveMessages({ messages });

      // Branch at message 2
      const { thread: branchedThread, inheritedMessageCount } = await memory.branchThread({
        sourceThreadId: sourceThread.id,
        branchPointMessageId: 'msg-bp2',
      });

      expect((branchedThread.metadata?.branch as any).branchPointMessageId).toBe('msg-bp2');
      expect(inheritedMessageCount).toBe(2); // Messages 1 and 2
    });

    it('should return inherited messages when listing messages from a branch', async () => {
      const sourceThread = await memory.saveThread({
        thread: {
          id: 'source-thread-branch-3',
          resourceId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const parentMessages: MastraDBMessage[] = [
        {
          id: 'parent-msg-1',
          threadId: sourceThread.id,
          resourceId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Parent message 1' }] },
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'parent-msg-2',
          threadId: sourceThread.id,
          resourceId,
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'Parent message 2' }] },
          createdAt: new Date('2024-01-01T10:01:00Z'),
        },
      ];

      await memory.saveMessages({ messages: parentMessages });

      // Branch the thread
      const { thread: branchedThread } = await memory.branchThread({
        sourceThreadId: sourceThread.id,
      });

      // Add messages to the branch
      const branchMessages: MastraDBMessage[] = [
        {
          id: 'branch-msg-1',
          threadId: branchedThread.id,
          resourceId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Branch message 1' }] },
          createdAt: new Date('2024-01-01T10:02:00Z'),
        },
      ];

      await memory.saveMessages({ messages: branchMessages });

      // List messages from the branch - should include parent messages
      const { messages } = await memory.recall({ threadId: branchedThread.id });

      expect(messages).toHaveLength(3); // 2 parent + 1 branch
      expect(messages.map(m => m.content.parts[0].text)).toEqual([
        'Parent message 1',
        'Parent message 2',
        'Branch message 1',
      ]);
    });

    it('should not include parent messages after branch point in branch listing', async () => {
      const sourceThread = await memory.saveThread({
        thread: {
          id: 'source-thread-branch-4',
          resourceId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const parentMessages: MastraDBMessage[] = [
        {
          id: 'p-msg-1',
          threadId: sourceThread.id,
          resourceId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Parent message 1' }] },
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'p-msg-2',
          threadId: sourceThread.id,
          resourceId,
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'Parent message 2' }] },
          createdAt: new Date('2024-01-01T10:01:00Z'),
        },
      ];

      await memory.saveMessages({ messages: parentMessages });

      // Branch at message 1 (before message 2)
      const { thread: branchedThread } = await memory.branchThread({
        sourceThreadId: sourceThread.id,
        branchPointMessageId: 'p-msg-1',
      });

      // List messages from the branch - should only include message 1
      const { messages } = await memory.recall({ threadId: branchedThread.id });

      expect(messages).toHaveLength(1);
      expect(messages[0]?.content.parts[0].text).toBe('Parent message 1');
    });

    it('should handle messages added to parent after branching', async () => {
      const sourceThread = await memory.saveThread({
        thread: {
          id: 'source-thread-branch-5',
          resourceId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const initialMessages: MastraDBMessage[] = [
        {
          id: 'initial-1',
          threadId: sourceThread.id,
          resourceId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Initial message' }] },
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      await memory.saveMessages({ messages: initialMessages });

      // Branch the thread
      const { thread: branchedThread } = await memory.branchThread({
        sourceThreadId: sourceThread.id,
      });

      // Add a new message to the PARENT after branching
      const parentNewMessage: MastraDBMessage[] = [
        {
          id: 'parent-new-1',
          threadId: sourceThread.id,
          resourceId,
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'New parent message after branch' }] },
          createdAt: new Date('2024-01-01T10:05:00Z'),
        },
      ];

      await memory.saveMessages({ messages: parentNewMessage });

      // List messages from the branch - should NOT include the new parent message
      const { messages: branchMessages } = await memory.recall({ threadId: branchedThread.id });

      expect(branchMessages).toHaveLength(1);
      expect(branchMessages[0]?.content.parts[0].text).toBe('Initial message');

      // Parent should have both messages
      const { messages: parentMessages } = await memory.recall({ threadId: sourceThread.id });
      expect(parentMessages).toHaveLength(2);
    });

    it('should throw error when source thread does not exist', async () => {
      await expect(memory.branchThread({ sourceThreadId: 'non-existent-thread' })).rejects.toThrow(
        'Source thread with id non-existent-thread not found',
      );
    });

    it('should throw error when branch point message does not exist', async () => {
      const sourceThread = await memory.saveThread({
        thread: {
          id: 'source-thread-branch-6',
          resourceId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await expect(
        memory.branchThread({
          sourceThreadId: sourceThread.id,
          branchPointMessageId: 'non-existent-message',
        }),
      ).rejects.toThrow('Branch point message non-existent-message not found in source thread');
    });

    it('should branch with custom thread ID', async () => {
      const sourceThread = await memory.saveThread({
        thread: {
          id: 'source-thread-branch-7',
          resourceId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const { thread: branchedThread } = await memory.branchThread({
        sourceThreadId: sourceThread.id,
        newThreadId: 'my-custom-branch-id',
      });

      expect(branchedThread.id).toBe('my-custom-branch-id');
    });

    it('should throw error when custom thread ID already exists', async () => {
      const sourceThread = await memory.saveThread({
        thread: {
          id: 'source-thread-branch-8',
          resourceId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Create another thread with the ID we want to use
      await memory.saveThread({
        thread: {
          id: 'existing-branch-id',
          resourceId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await expect(
        memory.branchThread({
          sourceThreadId: sourceThread.id,
          newThreadId: 'existing-branch-id',
        }),
      ).rejects.toThrow('Thread with id existing-branch-id already exists');
    });

    it('should copy working memory to branch for thread-scoped working memory', async () => {
      const sourceThread = await memory.saveThread({
        thread: {
          id: 'source-thread-branch-wm',
          resourceId,
          metadata: {
            workingMemory: JSON.stringify({ key: 'value', count: 42 }),
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const { thread: branchedThread } = await memory.branchThread({
        sourceThreadId: sourceThread.id,
      });

      // Branch should have a copy of working memory
      expect(branchedThread.metadata?.workingMemory).toBe(JSON.stringify({ key: 'value', count: 42 }));
      expect((branchedThread.metadata?.branch as any).workingMemorySnapshot).toBe(
        JSON.stringify({ key: 'value', count: 42 }),
      );
    });

    it('should handle nested branches (branch from a branch)', async () => {
      // Create original thread
      const originalThread = await memory.saveThread({
        thread: {
          id: 'original-nested',
          resourceId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await memory.saveMessages({
        messages: [
          {
            id: 'original-msg-1',
            threadId: originalThread.id,
            resourceId,
            role: 'user',
            content: { format: 2, parts: [{ type: 'text', text: 'Original message' }] },
            createdAt: new Date('2024-01-01T10:00:00Z'),
          },
        ],
      });

      // Create first branch
      const { thread: branch1 } = await memory.branchThread({
        sourceThreadId: originalThread.id,
      });

      await memory.saveMessages({
        messages: [
          {
            id: 'branch1-msg-1',
            threadId: branch1.id,
            resourceId,
            role: 'user',
            content: { format: 2, parts: [{ type: 'text', text: 'Branch 1 message' }] },
            createdAt: new Date('2024-01-01T10:01:00Z'),
          },
        ],
      });

      // Create branch from branch (nested)
      const { thread: branch2 } = await memory.branchThread({
        sourceThreadId: branch1.id,
      });

      await memory.saveMessages({
        messages: [
          {
            id: 'branch2-msg-1',
            threadId: branch2.id,
            resourceId,
            role: 'user',
            content: { format: 2, parts: [{ type: 'text', text: 'Branch 2 message' }] },
            createdAt: new Date('2024-01-01T10:02:00Z'),
          },
        ],
      });

      // List messages from nested branch - should include all ancestor messages
      const { messages } = await memory.recall({ threadId: branch2.id });

      expect(messages).toHaveLength(3);
      expect(messages.map(m => m.content.parts[0].text)).toEqual([
        'Original message',
        'Branch 1 message',
        'Branch 2 message',
      ]);
    });
  });

  describe('promoteBranch', () => {
    let memory: Memory;
    const resourceId = 'test-resource';

    beforeEach(() => {
      memory = new Memory({
        storage: new InMemoryStore(),
      });
    });

    it('should promote a branch and archive parent messages after branch point', async () => {
      // Create parent thread with messages
      const parentThread = await memory.saveThread({
        thread: {
          id: 'parent-promote-1',
          resourceId,
          title: 'Parent Thread',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const parentMessages: MastraDBMessage[] = [
        {
          id: 'pm-1',
          threadId: parentThread.id,
          resourceId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Parent msg 1' }] },
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'pm-2',
          threadId: parentThread.id,
          resourceId,
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'Parent msg 2' }] },
          createdAt: new Date('2024-01-01T10:01:00Z'),
        },
      ];

      await memory.saveMessages({ messages: parentMessages });

      // Branch at message 1
      const { thread: branchedThread } = await memory.branchThread({
        sourceThreadId: parentThread.id,
        branchPointMessageId: 'pm-1',
      });

      // Add message to parent after branch point
      await memory.saveMessages({
        messages: [
          {
            id: 'pm-3',
            threadId: parentThread.id,
            resourceId,
            role: 'user',
            content: { format: 2, parts: [{ type: 'text', text: 'Parent msg 3 (after branch)' }] },
            createdAt: new Date('2024-01-01T10:02:00Z'),
          },
        ],
      });

      // Add messages to branch
      await memory.saveMessages({
        messages: [
          {
            id: 'bm-1',
            threadId: branchedThread.id,
            resourceId,
            role: 'user',
            content: { format: 2, parts: [{ type: 'text', text: 'Branch msg 1' }] },
            createdAt: new Date('2024-01-01T10:03:00Z'),
          },
        ],
      });

      // Promote the branch
      const { promotedThread, archiveThread, archivedMessageCount } = await memory.promoteBranch({
        branchThreadId: branchedThread.id,
      });

      // Verify promotion
      expect(promotedThread.id).toBe(parentThread.id); // Parent becomes the promoted thread
      expect(archiveThread).toBeDefined();
      expect(archivedMessageCount).toBe(2); // pm-2 and pm-3 were after branch point

      // Verify promoted thread has branch messages
      const { messages: promotedMessages } = await memory.recall({ threadId: promotedThread.id });
      expect(promotedMessages).toHaveLength(2); // pm-1 + bm-1
      expect(promotedMessages.map(m => m.content.parts[0].text)).toEqual(['Parent msg 1', 'Branch msg 1']);

      // Verify archive thread has parent's divergent messages
      const { messages: archivedMessages } = await memory.recall({ threadId: archiveThread!.id });
      expect(archivedMessages).toHaveLength(2);

      // Branch thread should no longer exist
      const deletedBranch = await memory.getThreadById({ threadId: branchedThread.id });
      expect(deletedBranch).toBeNull();
    });

    it('should delete parent messages instead of archiving when deleteParentMessages is true', async () => {
      const parentThread = await memory.saveThread({
        thread: {
          id: 'parent-promote-2',
          resourceId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await memory.saveMessages({
        messages: [
          {
            id: 'del-pm-1',
            threadId: parentThread.id,
            resourceId,
            role: 'user',
            content: { format: 2, parts: [{ type: 'text', text: 'Parent msg 1' }] },
            createdAt: new Date('2024-01-01T10:00:00Z'),
          },
          {
            id: 'del-pm-2',
            threadId: parentThread.id,
            resourceId,
            role: 'assistant',
            content: { format: 2, parts: [{ type: 'text', text: 'Parent msg 2' }] },
            createdAt: new Date('2024-01-01T10:01:00Z'),
          },
        ],
      });

      const { thread: branchedThread } = await memory.branchThread({
        sourceThreadId: parentThread.id,
        branchPointMessageId: 'del-pm-1',
      });

      // Promote with deletion
      const { archiveThread, archivedMessageCount } = await memory.promoteBranch({
        branchThreadId: branchedThread.id,
        deleteParentMessages: true,
      });

      // No archive thread should be created
      expect(archiveThread).toBeUndefined();
      expect(archivedMessageCount).toBe(1); // Only pm-2 was after branch point
    });

    it('should throw error when branch thread does not exist', async () => {
      await expect(memory.promoteBranch({ branchThreadId: 'non-existent' })).rejects.toThrow(
        'Branch thread with id non-existent not found',
      );
    });

    it('should throw error when thread is not a branch', async () => {
      const regularThread = await memory.saveThread({
        thread: {
          id: 'regular-thread',
          resourceId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await expect(memory.promoteBranch({ branchThreadId: regularThread.id })).rejects.toThrow(
        'Thread regular-thread is not a branch',
      );
    });

    it('should copy working memory from branch to promoted thread', async () => {
      const parentThread = await memory.saveThread({
        thread: {
          id: 'parent-wm-promote',
          resourceId,
          metadata: { workingMemory: 'parent-wm' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const { thread: branchedThread } = await memory.branchThread({
        sourceThreadId: parentThread.id,
      });

      // Update working memory on the branch
      await memory.saveThread({
        thread: {
          ...branchedThread,
          metadata: { ...branchedThread.metadata, workingMemory: 'updated-branch-wm' },
        },
      });

      const { promotedThread } = await memory.promoteBranch({
        branchThreadId: branchedThread.id,
      });

      expect(promotedThread.metadata?.workingMemory).toBe('updated-branch-wm');
    });
  });

  describe('branch utility methods', () => {
    let memory: Memory;
    const resourceId = 'test-resource';

    beforeEach(() => {
      memory = new Memory({
        storage: new InMemoryStore(),
      });
    });

    describe('isBranch', () => {
      it('should return true for a branched thread', async () => {
        const sourceThread = await memory.saveThread({
          thread: {
            id: 'is-branch-source',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        const { thread: branchedThread } = await memory.branchThread({
          sourceThreadId: sourceThread.id,
        });

        expect(memory.isBranch(branchedThread)).toBe(true);
      });

      it('should return false for a regular thread', async () => {
        const regularThread = await memory.saveThread({
          thread: {
            id: 'is-branch-regular',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        expect(memory.isBranch(regularThread)).toBe(false);
      });

      it('should return false for null', () => {
        expect(memory.isBranch(null)).toBe(false);
      });
    });

    describe('getBranchMetadata', () => {
      it('should return branch metadata for a branched thread', async () => {
        const sourceThread = await memory.saveThread({
          thread: {
            id: 'get-branch-meta-source',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        await memory.saveMessages({
          messages: [
            {
              id: 'gbm-msg-1',
              threadId: sourceThread.id,
              resourceId,
              role: 'user',
              content: { format: 2, parts: [{ type: 'text', text: 'Test' }] },
              createdAt: new Date(),
            },
          ],
        });

        const { thread: branchedThread } = await memory.branchThread({
          sourceThreadId: sourceThread.id,
        });

        const metadata = memory.getBranchMetadata(branchedThread);

        expect(metadata).not.toBeNull();
        expect(metadata?.parentThreadId).toBe(sourceThread.id);
        expect(metadata?.branchPointMessageId).toBe('gbm-msg-1');
        expect(metadata?.branchCreatedAt).toBeInstanceOf(Date);
      });

      it('should return null for a regular thread', async () => {
        const regularThread = await memory.saveThread({
          thread: {
            id: 'get-branch-meta-regular',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        expect(memory.getBranchMetadata(regularThread)).toBeNull();
      });
    });

    describe('getParentThread', () => {
      it('should return parent thread for a branch', async () => {
        const sourceThread = await memory.saveThread({
          thread: {
            id: 'get-parent-source',
            resourceId,
            title: 'The Parent',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        const { thread: branchedThread } = await memory.branchThread({
          sourceThreadId: sourceThread.id,
        });

        const parentThread = await memory.getParentThread(branchedThread.id);

        expect(parentThread).not.toBeNull();
        expect(parentThread?.id).toBe(sourceThread.id);
        expect(parentThread?.title).toBe('The Parent');
      });

      it('should return null for a regular thread', async () => {
        const regularThread = await memory.saveThread({
          thread: {
            id: 'get-parent-regular',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        const parent = await memory.getParentThread(regularThread.id);
        expect(parent).toBeNull();
      });
    });

    describe('listBranches', () => {
      it('should list all branches of a thread', async () => {
        const sourceThread = await memory.saveThread({
          thread: {
            id: 'list-branches-source',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Create multiple branches
        const { thread: branch1 } = await memory.branchThread({
          sourceThreadId: sourceThread.id,
          newThreadId: 'branch-1',
        });

        const { thread: branch2 } = await memory.branchThread({
          sourceThreadId: sourceThread.id,
          newThreadId: 'branch-2',
        });

        const { thread: branch3 } = await memory.branchThread({
          sourceThreadId: sourceThread.id,
          newThreadId: 'branch-3',
        });

        const branches = await memory.listBranches(sourceThread.id);

        expect(branches).toHaveLength(3);
        expect(branches.map(b => b.id).sort()).toEqual(['branch-1', 'branch-2', 'branch-3']);
      });

      it('should return empty array for thread with no branches', async () => {
        const sourceThread = await memory.saveThread({
          thread: {
            id: 'list-branches-none',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        const branches = await memory.listBranches(sourceThread.id);
        expect(branches).toHaveLength(0);
      });
    });

    describe('getBranchHistory', () => {
      it('should return full ancestry chain', async () => {
        // Create original thread
        const original = await memory.saveThread({
          thread: {
            id: 'history-original',
            resourceId,
            title: 'Original',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Create first branch
        const { thread: branch1 } = await memory.branchThread({
          sourceThreadId: original.id,
          newThreadId: 'history-branch-1',
          title: 'Branch 1',
        });

        // Create nested branch
        const { thread: branch2 } = await memory.branchThread({
          sourceThreadId: branch1.id,
          newThreadId: 'history-branch-2',
          title: 'Branch 2',
        });

        const history = await memory.getBranchHistory(branch2.id);

        expect(history).toHaveLength(3);
        expect(history[0]?.id).toBe('history-original');
        expect(history[1]?.id).toBe('history-branch-1');
        expect(history[2]?.id).toBe('history-branch-2');
      });

      it('should return single thread for non-branch', async () => {
        const regularThread = await memory.saveThread({
          thread: {
            id: 'history-regular',
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        const history = await memory.getBranchHistory(regularThread.id);

        expect(history).toHaveLength(1);
        expect(history[0]?.id).toBe('history-regular');
      });
    });
  });
});
