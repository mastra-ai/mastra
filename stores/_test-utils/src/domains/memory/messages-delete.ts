import { describe, it, expect, vi } from 'vitest';
import type { MastraStorage, StorageThreadType } from '@mastra/core/storage';
import { createSampleThread, createSampleMessageV1 } from './data';

// Helper to convert dates to ISO strings
const toISOThread = (thread: ReturnType<typeof createSampleThread>) => ({
  ...thread,
  createdAt: thread.createdAt.toISOString(),
  updatedAt: thread.updatedAt.toISOString(),
});

const toISOMessage = (message: ReturnType<typeof createSampleMessageV1>) => ({
  ...message,
  createdAt: message.createdAt.toISOString(),
});

export function createMessagesDeleteTest({ storage }: { storage: MastraStorage }) {
  describe('Messages Delete', () => {
    it('should delete a message successfully', async () => {
      // Create a thread first
      const thread = toISOThread(createSampleThread());
      await storage.saveThread({ thread });

      // Save a message
      const message = toISOMessage(createSampleMessageV1({ threadId: thread.id }));
      const [savedMessage] = await storage.saveMessages({ messages: [message] });
      expect(savedMessage).toBeDefined();

      // Delete the message
      await storage.deleteMessage(savedMessage!.id);

      // Verify message is deleted
      const messages = await storage.getMessages({ threadId: thread.id });
      expect(messages).toHaveLength(0);
    });

    it('should throw error when deleting non-existent message', async () => {
      await expect(storage.deleteMessage('non-existent-id')).rejects.toThrow();
    });

    it('should update thread timestamp when message is deleted', async () => {
      // Create a thread
      const thread = toISOThread(createSampleThread());
      const savedThread = await storage.saveThread({ thread });
      const originalUpdatedAt = new Date(savedThread.updatedAt).getTime();

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Save a message
      const message = toISOMessage(createSampleMessageV1({ threadId: thread.id }));
      const [savedMessage] = await storage.saveMessages({ messages: [message] });

      // Wait a bit more
      await new Promise(resolve => setTimeout(resolve, 10));

      // Delete the message
      await storage.deleteMessage(savedMessage!.id);

      // Check thread timestamp was updated
      const updatedThread = await storage.getThreadById({ threadId: thread.id });
      const newUpdatedAt = new Date(updatedThread!.updatedAt).getTime();
      expect(newUpdatedAt).toBeGreaterThan(originalUpdatedAt);
    });

    it('should only delete the specified message', async () => {
      // Create a thread
      const thread = toISOThread(createSampleThread());
      await storage.saveThread({ thread });

      // Save multiple messages
      const messages = Array.from({ length: 3 }, (_, index) => {
        const msg = toISOMessage(createSampleMessageV1({ 
          threadId: thread.id,
          content: `Message ${index}`
        }));
        msg.id = `msg-${index}`;
        return msg;
      });
      
      const savedMessages = await storage.saveMessages({ messages });
      expect(savedMessages).toHaveLength(3);

      // Delete the middle message
      await storage.deleteMessage('msg-1');

      // Verify only that message was deleted
      const remainingMessages = await storage.getMessages({ threadId: thread.id });
      expect(remainingMessages).toHaveLength(2);
      expect(remainingMessages.map(m => m.id).sort()).toEqual(['msg-0', 'msg-2']);
    });

    it('should handle concurrent deletes correctly', async () => {
      // Create a thread
      const thread = toISOThread(createSampleThread());
      await storage.saveThread({ thread });

      // Save multiple messages
      const messages = Array.from({ length: 5 }, (_, index) => {
        const msg = toISOMessage(createSampleMessageV1({ 
          threadId: thread.id,
          content: `Message ${index}`
        }));
        msg.id = `concurrent-${index}`;
        return msg;
      });
      await storage.saveMessages({ messages });

      // Delete multiple messages concurrently
      const deletePromises = [
        storage.deleteMessage('concurrent-1'),
        storage.deleteMessage('concurrent-3'),
      ];
      
      await Promise.all(deletePromises);

      // Verify correct messages were deleted
      const remainingMessages = await storage.getMessages({ threadId: thread.id });
      expect(remainingMessages).toHaveLength(3);
      expect(remainingMessages.map(m => m.id).sort()).toEqual([
        'concurrent-0',
        'concurrent-2',
        'concurrent-4',
      ]);
    });

    it('should not affect messages in other threads', async () => {
      // Create two threads
      const thread1 = toISOThread(createSampleThread({ id: 'thread-1' }));
      const thread2 = toISOThread(createSampleThread({ id: 'thread-2' }));
      await storage.saveThread({ thread: thread1 });
      await storage.saveThread({ thread: thread2 });

      // Save messages to both threads
      const messages1 = Array.from({ length: 2 }, (_, index) => {
        const msg = toISOMessage(createSampleMessageV1({ 
          threadId: 'thread-1',
          content: `Thread 1 Message ${index}`
        }));
        msg.id = `thread1-msg-${index}`;
        return msg;
      });
      const messages2 = Array.from({ length: 2 }, (_, index) => {
        const msg = toISOMessage(createSampleMessageV1({ 
          threadId: 'thread-2',
          content: `Thread 2 Message ${index}`
        }));
        msg.id = `thread2-msg-${index}`;
        return msg;
      });
      
      await storage.saveMessages({ messages: messages1 });
      await storage.saveMessages({ messages: messages2 });

      // Delete a message from thread 1
      await storage.deleteMessage('thread1-msg-0');

      // Verify thread 1 has one message
      const thread1Messages = await storage.getMessages({ threadId: 'thread-1' });
      expect(thread1Messages).toHaveLength(1);
      expect(thread1Messages[0]!.id).toBe('thread1-msg-1');

      // Verify thread 2 still has both messages
      const thread2Messages = await storage.getMessages({ threadId: 'thread-2' });
      expect(thread2Messages).toHaveLength(2);
    });
  });
}