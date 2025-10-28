import { beforeEach, describe, expect, it } from 'vitest';
import { createSampleMessageV2, createSampleThread } from './data';
import type { MastraStorage } from '@mastra/core/storage';
import type { MastraMessageV2, StorageThreadType } from '@mastra/core/memory';
import { MessageList } from '@mastra/core/agent';

export function createMessagesListTest({ storage }: { storage: MastraStorage }) {
    describe('listMessages', () => {
        let thread: StorageThreadType;
        let thread2: StorageThreadType;
        let messages: MastraMessageV2[];

        beforeEach(async () => {
            // Create test threads
            thread = createSampleThread();
            thread2 = createSampleThread();
            await storage.saveThread({ thread });
            await storage.saveThread({ thread: thread2 });

            // Create test messages
            const now = Date.now();
            messages = [
                createSampleMessageV2({
                    threadId: thread.id,
                    resourceId: thread.resourceId,
                    content: { content: 'Message 1' },
                    createdAt: new Date(now + 1000),
                }),
                createSampleMessageV2({
                    threadId: thread.id,
                    resourceId: thread.resourceId,
                    content: { content: 'Message 2' },
                    createdAt: new Date(now + 2000),
                }),
                createSampleMessageV2({
                    threadId: thread.id,
                    resourceId: thread.resourceId,
                    content: { content: 'Message 3' },
                    createdAt: new Date(now + 3000),
                }),
                createSampleMessageV2({
                    threadId: thread.id,
                    resourceId: thread.resourceId,
                    content: { content: 'Message 4' },
                    createdAt: new Date(now + 4000),
                }),
                createSampleMessageV2({
                    threadId: thread.id,
                    resourceId: thread.resourceId,
                    content: { content: 'Message 5' },
                    createdAt: new Date(now + 5000),
                }),
                createSampleMessageV2({
                    threadId: thread2.id,
                    resourceId: thread2.resourceId,
                    content: { content: 'Thread2 Message 1' },
                    createdAt: new Date(now + 6000),
                }),
            ];

            await storage.saveMessages({ messages, format: 'v2' });
        });

        it('should list all messages for a thread without pagination', async () => {
            const result = await storage.listMessages({
                threadId: thread.id,
            });

            expect(result.messages).toHaveLength(5);
            expect(result.total).toBe(5);
            expect(result.messages.every(MessageList.isMastraMessageV2)).toBe(true);
        });

        it('should list messages with pagination', async () => {
            const page1 = await storage.listMessages({
                threadId: thread.id,
                pagination: { page: 0, perPage: 2 },
            });

            expect(page1.messages).toHaveLength(2);
            expect(page1.total).toBe(5);
            expect(page1.page).toBe(0);
            expect(page1.perPage).toBe(2);
            expect(page1.hasMore).toBe(true);

            const page2 = await storage.listMessages({
                threadId: thread.id,
                pagination: { page: 1, perPage: 2 },
            });

            expect(page2.messages).toHaveLength(2);
            expect(page2.total).toBe(5);
            expect(page2.page).toBe(1);
            expect(page2.hasMore).toBe(true);

            const page3 = await storage.listMessages({
                threadId: thread.id,
                pagination: { page: 2, perPage: 2 },
            });

            expect(page3.messages).toHaveLength(1);
            expect(page3.total).toBe(5);
            expect(page3.hasMore).toBe(false);
        });

        it('should filter by resourceId', async () => {
            // Add a message with different resourceId to the same thread
            const differentResourceMessage = createSampleMessageV2({
                threadId: thread.id,
                resourceId: 'different-resource',
                content: { content: 'Different Resource' },
                createdAt: new Date(),
            });
            await storage.saveMessages({ messages: [differentResourceMessage], format: 'v2' });

            const result = await storage.listMessages({
                threadId: thread.id,
                resourceId: thread.resourceId,
            });

            expect(result.total).toBe(5);
            expect(result.messages.every(m => m.resourceId === thread.resourceId)).toBe(true);
        });

        it('should filter by date range', async () => {
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

            const dateThread = createSampleThread();
            await storage.saveThread({ thread: dateThread });

            const dateMessages = [
                createSampleMessageV2({
                    threadId: dateThread.id,
                    content: { content: 'Old Message' },
                    createdAt: twoDaysAgo,
                }),
                createSampleMessageV2({
                    threadId: dateThread.id,
                    content: { content: 'Yesterday Message' },
                    createdAt: yesterday,
                }),
                createSampleMessageV2({
                    threadId: dateThread.id,
                    content: { content: 'Recent Message' },
                    createdAt: now,
                }),
            ];

            await storage.saveMessages({ messages: dateMessages, format: 'v2' });

            const result = await storage.listMessages({
                threadId: dateThread.id,
                pagination: {
                    dateRange: { start: yesterday },
                },
            });

            expect(result.total).toBe(2);
            expect(result.messages.every(m => new Date(m.createdAt) >= yesterday)).toBe(true);
        });

        it('should include specific messages with previous context', async () => {
            const result = await storage.listMessages({
                threadId: thread.id,
                include: [
                    {
                        id: messages[2]!.id, // Message 3
                        withPreviousMessages: 2,
                    },
                ],
            });

            expect(result.messages).toHaveLength(3);
            expect(result.messages.map((m: any) => m.content.content)).toEqual(['Message 1', 'Message 2', 'Message 3']);
        });

        it('should include specific messages with next context', async () => {
            const result = await storage.listMessages({
                threadId: thread.id,
                include: [
                    {
                        id: messages[1]!.id, // Message 2
                        withNextMessages: 2,
                    },
                ],
            });

            expect(result.messages).toHaveLength(3);
            expect(result.messages.map((m: any) => m.content.content)).toEqual(['Message 2', 'Message 3', 'Message 4']);
        });

        it('should include specific messages with both previous and next context', async () => {
            const result = await storage.listMessages({
                threadId: thread.id,
                include: [
                    {
                        id: messages[2]!.id, // Message 3
                        withPreviousMessages: 1,
                        withNextMessages: 1,
                    },
                ],
            });

            expect(result.messages).toHaveLength(3);
            expect(result.messages.map((m: any) => m.content.content)).toEqual(['Message 2', 'Message 3', 'Message 4']);
        });

        it('should include multiple messages from different threads', async () => {
            const result = await storage.listMessages({
                threadId: thread.id,
                include: [
                    {
                        id: messages[1]!.id, // Message 2 from thread 1
                        threadId: thread.id,
                        withPreviousMessages: 1,
                    },
                    {
                        id: messages[5]!.id, // Thread2 Message 1
                        threadId: thread2.id,
                    },
                ],
            });

            expect(result.messages).toHaveLength(3);
            expect(result.messages.some(m => m.threadId === thread.id)).toBe(true);
            expect(result.messages.some(m => m.threadId === thread2.id)).toBe(true);
        });

        it('should deduplicate messages when include has overlapping context', async () => {
            const result = await storage.listMessages({
                threadId: thread.id,
                include: [
                    {
                        id: messages[1]!.id, // Message 2
                        withNextMessages: 2,
                    },
                    {
                        id: messages[2]!.id, // Message 3 (overlaps with previous)
                        withNextMessages: 1,
                    },
                ],
            });

            // Should have Messages 2, 3, 4 (deduplicated)
            expect(result.messages).toHaveLength(3);
            const contents = result.messages.map((m: any) => m.content.content);
            expect(contents).toEqual(['Message 2', 'Message 3', 'Message 4']);
        });

        it('should sort messages by createdAt', async () => {
            const result = await storage.listMessages({
                threadId: thread.id,
            });

            const timestamps = result.messages.map(m => new Date(m.createdAt).getTime());
            const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
            expect(timestamps).toEqual(sortedTimestamps);
        });

        it('should handle empty thread', async () => {
            const emptyThread = createSampleThread();
            await storage.saveThread({ thread: emptyThread });

            const result = await storage.listMessages({
                threadId: emptyThread.id,
            });

            expect(result.messages).toHaveLength(0);
            expect(result.total).toBe(0);
            expect(result.hasMore).toBe(false);
        });

        it('should handle non-existent message in include', async () => {
            const result = await storage.listMessages({
                threadId: thread.id,
                include: [
                    {
                        id: 'non-existent-id',
                        withPreviousMessages: 1,
                        withNextMessages: 1,
                    },
                ],
            });

            // Should return empty if the included message doesn't exist
            expect(result.messages).toHaveLength(0);
        });

        it('should throw when threadId is empty or whitespace', async () => {
            await expect(() => storage.listMessages({ threadId: '' })).rejects.toThrowError(
                'threadId must be a non-empty string',
            );

            await expect(() => storage.listMessages({ threadId: '   ' })).rejects.toThrowError(
                'threadId must be a non-empty string',
            );
        });

        it('should respect pagination when using include', async () => {
            const result = await storage.listMessages({
                threadId: thread.id,
                include: [
                    {
                        id: messages[0]!.id,
                        withNextMessages: 10, // Request more than available
                    },
                ],
                pagination: { page: 0, perPage: 3 },
            });

            expect(result.messages).toHaveLength(3);
            expect(result.total).toBe(5);
            expect(result.hasMore).toBe(true);
        });

        it('should default to format v2', async () => {
            const result = await storage.listMessages({
                threadId: thread.id,
            });

            expect(result.messages.every(MessageList.isMastraMessageV2)).toBe(true);
        });

        it('should handle include with threadId parameter', async () => {
            // This tests cross-thread message inclusion
            const result = await storage.listMessages({
                threadId: thread.id,
                include: [
                    {
                        id: messages[5]!.id, // Message from thread2
                        threadId: thread2.id,
                    },
                ],
            });

            expect(result.messages).toHaveLength(1);
            expect(result.messages[0]?.threadId).toBe(thread2.id);
        });

        it('should handle pagination with date range', async () => {
            const dateThread = createSampleThread();
            await storage.saveThread({ thread: dateThread });

            const now = new Date();
            const dateMessages = Array.from({ length: 10 }, (_, i) =>
                createSampleMessageV2({
                    threadId: dateThread.id,
                    content: { content: `Message ${i + 1}` },
                    createdAt: new Date(now.getTime() + i * 1000),
                }),
            );

            await storage.saveMessages({ messages: dateMessages, format: 'v2' });

            // Get messages from the last 5 seconds, paginated
            const cutoffDate = new Date(now.getTime() + 5000);
            const result = await storage.listMessages({
                threadId: dateThread.id,
                pagination: {
                    dateRange: { start: cutoffDate },
                    page: 0,
                    perPage: 3,
                },
            });

            expect(result.messages).toHaveLength(3);
            expect(result.total).toBe(5); // Messages 6-10
            expect(result.messages.every(m => new Date(m.createdAt) >= cutoffDate)).toBe(true);
        });
    });
}

