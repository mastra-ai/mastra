import { describe, it, expect, vi } from 'vitest';
import type { MastraStorage } from '@mastra/core/storage';
import type { StorageThreadType } from '@mastra/core/memory';
import { createSampleThread, createSampleMessageV1 } from './data';

export function createMessagesBulkDeleteTest({ storage }: { storage: MastraStorage }) {
  describe('Messages Bulk Delete', () => {
    // Skip tests if the storage adapter doesn't support deleteMessages
    if (!storage.supports.deleteMessages) {
      it.skip('deleteMessages is not supported by this storage adapter', () => {
        expect(true).toBe(true);
      });
      return;
    }
    it('should delete multiple messages successfully', async () => {
      // Create a thread first
      const thread = createSampleThread();
      await storage.saveThread({ thread });

      // Save multiple messages
      const messages = Array.from({ length: 5 }, (_, index) => {
        const msg = createSampleMessageV1({
          threadId: thread.id,
          content: `Message ${index}`,
        });
        msg.id = `msg-${index}`;
        return msg;
      });

      const savedMessages = await storage.saveMessages({ messages });
      expect(savedMessages).toHaveLength(5);

      // Delete messages 1, 2, and 4
      await storage.deleteMessages(['msg-1', 'msg-2', 'msg-4']);

      // Verify only messages 0 and 3 remain
      const remainingMessages = await storage.getMessages({ threadId: thread.id });
      expect(remainingMessages).toHaveLength(2);
      expect(remainingMessages.map(m => m.id).sort()).toEqual(['msg-0', 'msg-3']);
    });

    it('should handle empty array gracefully', async () => {
      // Should not throw when deleting empty array
      await expect(storage.deleteMessages([])).resolves.not.toThrow();
    });

    it('should handle deleting non-existent messages', async () => {
      // Should not throw when deleting messages that don't exist
      await expect(storage.deleteMessages(['non-existent-1', 'non-existent-2'])).resolves.not.toThrow();
    });

    it('should update thread timestamp when messages are deleted', async () => {
      // Create a thread
      const thread = createSampleThread();
      const savedThread = await storage.saveThread({ thread });
      const originalUpdatedAt = new Date(savedThread.updatedAt).getTime();

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Save multiple messages
      const messages = Array.from({ length: 3 }, (_, index) => {
        const msg = createSampleMessageV1({
          threadId: thread.id,
          content: `Message ${index}`,
        });
        msg.id = `bulk-msg-${index}`;
        return msg;
      });
      await storage.saveMessages({ messages });

      // Wait a bit more
      await new Promise(resolve => setTimeout(resolve, 10));

      // Delete all messages
      await storage.deleteMessages(['bulk-msg-0', 'bulk-msg-1', 'bulk-msg-2']);

      // Check thread timestamp was updated
      const updatedThread = await storage.getThreadById({ threadId: thread.id });
      const newUpdatedAt = new Date(updatedThread!.updatedAt).getTime();
      expect(newUpdatedAt).toBeGreaterThan(originalUpdatedAt);
    });

    it('should handle messages from different threads', async () => {
      // Create two threads
      const thread1 = createSampleThread({ id: 'bulk-thread-1' });
      const thread2 = createSampleThread({ id: 'bulk-thread-2' });
      await storage.saveThread({ thread: thread1 });
      await storage.saveThread({ thread: thread2 });

      // Save messages to both threads
      const messages1 = Array.from({ length: 2 }, (_, index) => {
        const msg = createSampleMessageV1({
          threadId: 'bulk-thread-1',
          content: `Thread 1 Message ${index}`,
        });
        msg.id = `bulk-thread1-msg-${index}`;
        return msg;
      });
      const messages2 = Array.from({ length: 2 }, (_, index) => {
        const msg = createSampleMessageV1({
          threadId: 'bulk-thread-2',
          content: `Thread 2 Message ${index}`,
        });
        msg.id = `bulk-thread2-msg-${index}`;
        return msg;
      });

      await storage.saveMessages({ messages: messages1 });
      await storage.saveMessages({ messages: messages2 });

      // Delete one message from each thread
      await storage.deleteMessages(['bulk-thread1-msg-0', 'bulk-thread2-msg-1']);

      // Verify thread 1 has one message remaining
      const thread1Messages = await storage.getMessages({ threadId: 'bulk-thread-1' });
      expect(thread1Messages).toHaveLength(1);
      expect(thread1Messages[0]!.id).toBe('bulk-thread1-msg-1');

      // Verify thread 2 has one message remaining
      const thread2Messages = await storage.getMessages({ threadId: 'bulk-thread-2' });
      expect(thread2Messages).toHaveLength(1);
      expect(thread2Messages[0]!.id).toBe('bulk-thread2-msg-0');
    });

    it('should handle large batches of message deletions', async () => {
      // Create a thread with a unique ID for this test
      const thread = createSampleThread({ id: `bulk-delete-test-thread-${Date.now()}` });
      await storage.saveThread({ thread });

      // Save 100 messages with alternating roles
      const messages = Array.from({ length: 100 }, (_, index) => {
        const msg = createSampleMessageV1({
          threadId: thread.id,
          content: `Message ${index}`,
        });
        msg.id = `large-batch-msg-${index}`;
        // Alternate between user and assistant roles
        msg.role = index % 2 === 0 ? 'user' : 'assistant';
        return msg;
      });

      await storage.saveMessages({ messages });

      // Verify all 100 messages were saved
      const allMessages = await storage.getMessages({ threadId: thread.id, selectBy: { last: 100 } });

      // Delete the most recent 50 messages (indices 50-99)
      const messagesToDelete = messages.slice(50).map(msg => msg.id);

      await storage.deleteMessages(messagesToDelete);

      // Verify 50 messages remain - need to specify limit to get all remaining messages
      const remainingMessages = await storage.getMessages({ threadId: thread.id, selectBy: { last: 100 } });
      expect(remainingMessages).toHaveLength(50);

      // Verify the correct messages remain (first 50 messages, indices 0-49)
      const remainingIds = remainingMessages.map(m => m.id);
      for (let i = 0; i < 50; i++) {
        expect(remainingIds).toContain(`large-batch-msg-${i}`);
      }

      // Verify the deleted messages are not present (indices 50-99)
      for (let i = 50; i < 100; i++) {
        expect(remainingIds).not.toContain(`large-batch-msg-${i}`);
      }
    });

    it('should handle mixed valid and invalid message IDs', async () => {
      // Create a thread
      const thread = createSampleThread();
      await storage.saveThread({ thread });

      // Save some messages
      const messages = Array.from({ length: 3 }, (_, index) => {
        const msg = createSampleMessageV1({
          threadId: thread.id,
          content: `Message ${index}`,
        });
        msg.id = `mixed-msg-${index}`;
        return msg;
      });

      await storage.saveMessages({ messages });

      // Delete mix of valid and invalid IDs
      await storage.deleteMessages(['mixed-msg-0', 'invalid-id-1', 'mixed-msg-2', 'invalid-id-2']);

      // Verify only the valid messages were deleted
      const remainingMessages = await storage.getMessages({ threadId: thread.id });
      expect(remainingMessages).toHaveLength(1);
      expect(remainingMessages[0]!.id).toBe('mixed-msg-1');
    });
  });
}
