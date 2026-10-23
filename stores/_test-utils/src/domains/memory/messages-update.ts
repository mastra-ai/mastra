import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSampleMessageV2, createSampleThread } from './data';
import type { MastraStorage, MemoryStorage } from '@mastra/core/storage';
import { randomUUID } from 'node:crypto';

export function createMessagesUpdateTest({ storage }: { storage: MastraStorage }) {
  let memoryStorage: MemoryStorage;

  beforeAll(async () => {
    const store = await storage.getStore('memory');
    if (!store) {
      throw new Error('Memory storage not found');
    }
    memoryStorage = store;
  });

  describe('updateMessages', () => {
    let thread: StorageThreadType;
    beforeEach(async () => {
      const threadData = createSampleThread();
      thread = await memoryStorage.saveThread({ thread: threadData as StorageThreadType });
    });

    it('should update a single field of a message (e.g., role)', async () => {
      const originalMessage = createSampleMessageV2({ threadId: thread.id, role: 'user' });
      await memoryStorage.saveMessages({ messages: [originalMessage] });

      const updatedMessages = await memoryStorage.updateMessages({
        messages: [{ id: originalMessage.id, role: 'assistant' }] as MastraDBMessage[],
      });

      expect(updatedMessages).toHaveLength(1);
      expect(updatedMessages[0]!.role).toBe('assistant');

      const { messages: fromDb } = await memoryStorage.listMessages({ threadId: thread.id });
      expect(fromDb[0]!.role).toBe('assistant');
    });

    it('should update only the metadata within the content field, preserving other content fields', async () => {
      const originalMessage = createSampleMessageV2({
        threadId: thread.id,
        content: { content: 'hello world', parts: [{ type: 'text', text: 'hello world' }] },
      });
      await memoryStorage.saveMessages({ messages: [originalMessage] });

      const newMetadata = { someKey: 'someValue' };
      await memoryStorage.updateMessages({
        messages: [{ id: originalMessage.id, content: { metadata: newMetadata } as any }],
      });

      const { messages: fromDb } = await memoryStorage.listMessages({ threadId: thread.id });
      expect(fromDb).toHaveLength(1);
      expect(fromDb[0]!.content.metadata).toEqual(newMetadata);
      expect(fromDb[0]!.content.content).toBe('hello world');
      expect(fromDb[0]!.content.parts).toEqual([{ type: 'text', text: 'hello world' }]);
    });

    it('should update only the content string within the content field, preserving metadata', async () => {
      const originalMessage = createSampleMessageV2({
        threadId: thread.id,
        content: { metadata: { initial: true } },
      });
      await memoryStorage.saveMessages({ messages: [originalMessage] });

      const newContentString = 'This is the new content string';
      await memoryStorage.updateMessages({
        messages: [{ id: originalMessage.id, content: { content: newContentString } as any }],
      });

      const { messages: fromDb } = await memoryStorage.listMessages({ threadId: thread.id });
      expect(fromDb[0]!.content.content).toBe(newContentString);
      expect(fromDb[0]!.content.metadata).toEqual({ initial: true });
    });

    it('should deep merge metadata, not overwrite it', async () => {
      const originalMessage = createSampleMessageV2({
        threadId: thread.id,
        content: { metadata: { initial: true }, content: 'old content' },
      });
      await memoryStorage.saveMessages({ messages: [originalMessage] });

      const newMetadata = { updated: true };
      await memoryStorage.updateMessages({
        messages: [{ id: originalMessage.id, content: { metadata: newMetadata } as any }],
      });

      const { messages: fromDb } = await memoryStorage.listMessages({ threadId: thread.id });
      expect(fromDb[0]!.content.content).toBe('old content');
      expect(fromDb[0]!.content.metadata).toEqual({ initial: true, updated: true });
    });

    it('should record unavailable attachments on a stored message without losing its parts or other metadata', async () => {
      const parts: MastraDBMessage['content']['parts'] = [
        { type: 'text', text: 'What is in this picture?' },
        { type: 'file', data: 'https://example.com/gone.png', mimeType: 'image/png' },
      ];
      const originalMessage = createSampleMessageV2({
        threadId: thread.id,
        role: 'user',
        content: { content: 'What is in this picture?', parts, metadata: { mastra: { sealed: true }, other: 1 } },
      });
      await memoryStorage.saveMessages({ messages: [originalMessage] });

      // Mirrors what the agent sends when it records an attachment it could not download.
      const {
        messages: [stored],
      } = await memoryStorage.listMessagesById({ messageIds: [originalMessage.id] });
      const storedMetadata = stored!.content.metadata as Record<string, any>;
      await memoryStorage.updateMessages({
        messages: [
          {
            id: stored!.id,
            content: {
              ...stored!.content,
              metadata: {
                ...storedMetadata,
                mastra: { ...storedMetadata.mastra, unavailableAttachments: ['https://example.com/gone.png'] },
              },
            },
          },
        ],
      });

      const {
        messages: [fromDb],
      } = await memoryStorage.listMessagesById({ messageIds: [originalMessage.id] });
      const metadata = fromDb!.content.metadata as Record<string, any>;
      expect(fromDb!.content.parts).toEqual(parts);
      expect(metadata.mastra.unavailableAttachments).toEqual(['https://example.com/gone.png']);
      expect(metadata.mastra.sealed).toBe(true);
      expect(metadata.other).toBe(1);
    });

    it('should update multiple messages at once', async () => {
      const msg1 = createSampleMessageV2({ threadId: thread.id, role: 'user' });
      const msg2 = createSampleMessageV2({ threadId: thread.id, content: { content: 'original' } });
      await memoryStorage.saveMessages({ messages: [msg1, msg2] });

      await memoryStorage.updateMessages({
        messages: [
          { id: msg1.id, role: 'assistant' } as MastraDBMessage,
          { id: msg2.id, content: { content: 'updated' } as any },
        ],
      });

      const { messages: fromDb } = await memoryStorage.listMessages({ threadId: thread.id });
      const updatedMsg1 = fromDb.find(m => m.id === msg1.id);
      const updatedMsg2 = fromDb.find(m => m.id === msg2.id);

      expect(updatedMsg1!.role).toBe('assistant');
      expect(updatedMsg2!.content.content).toBe('updated');
    });

    it('should update the parent thread updatedAt timestamp', async () => {
      const originalMessage = createSampleMessageV2({ threadId: thread.id });
      await memoryStorage.saveMessages({ messages: [originalMessage] });
      const initialThread = await memoryStorage.getThreadById({ threadId: thread.id });

      await new Promise(r => setTimeout(r, 10));

      await memoryStorage.updateMessages({
        messages: [{ id: originalMessage.id, role: 'assistant' }] as MastraDBMessage[],
      });

      const updatedThread = await memoryStorage.getThreadById({ threadId: thread.id });

      expect(new Date(updatedThread!.updatedAt).getTime()).toBeGreaterThan(
        new Date(initialThread!.updatedAt).getTime(),
      );
    });

    it('should update timestamps on both threads when moving a message', async () => {
      const thread2 = await memoryStorage.saveThread({ thread: createSampleThread() });
      const message = createSampleMessageV2({ threadId: thread.id });
      await memoryStorage.saveMessages({ messages: [message] });

      const initialThread1 = await memoryStorage.getThreadById({ threadId: thread.id });
      const initialThread2 = await memoryStorage.getThreadById({ threadId: thread2.id });

      await new Promise(r => setTimeout(r, 10));

      await memoryStorage.updateMessages({
        messages: [{ id: message.id, threadId: thread2.id } as MastraDBMessage],
      });

      const updatedThread1 = await memoryStorage.getThreadById({ threadId: thread.id });
      const updatedThread2 = await memoryStorage.getThreadById({ threadId: thread2.id });

      expect(new Date(updatedThread1!.updatedAt).getTime()).toBeGreaterThan(
        new Date(initialThread1!.updatedAt).getTime(),
      );
      expect(new Date(updatedThread2!.updatedAt).getTime()).toBeGreaterThan(
        new Date(initialThread2!.updatedAt).getTime(),
      );

      // Verify the message was moved
      const { messages: thread1Messages } = await memoryStorage.listMessages({ threadId: thread.id });
      const { messages: thread2Messages } = await memoryStorage.listMessages({ threadId: thread2.id });
      expect(thread1Messages).toHaveLength(0);
      expect(thread2Messages).toHaveLength(1);
      expect(thread2Messages[0]!.id).toBe(message.id);
    });

    it('should not fail when trying to update a non-existent message', async () => {
      const originalMessage = createSampleMessageV2({ threadId: thread.id });
      await memoryStorage.saveMessages({ messages: [originalMessage] });

      const messages = [{ id: randomUUID(), role: 'assistant' }] as MastraDBMessage[];

      await expect(
        memoryStorage.updateMessages({
          messages,
        }),
      ).resolves.not.toThrow();

      const { messages: fromDb } = await memoryStorage.listMessages({ threadId: thread.id });
      expect(fromDb[0]!.role).toBe(originalMessage.role);
    });
  });
}
