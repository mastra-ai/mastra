import { jest, describe, beforeAll, afterAll, beforeEach, afterEach, expect, it } from '@jest/globals'
import { RedisMemory } from './';
import { Thread, Message } from '@mastra/core';

// Use a dedicated test database URL from environment
const REDIS_URL = process.env.TEST_REDIS_URL || 'https://your-test-redis-url.upstash.io';
const REDIS_TOKEN = process.env.TEST_REDIS_TOKEN || 'your-test-token';

describe('RedisMemory Integration Tests', () => {
    let redisMemory: RedisMemory;

    beforeAll(() => {
        redisMemory = new RedisMemory({
            url: REDIS_URL,
            token: REDIS_TOKEN,
            maxThreads: 100,
            maxMessagesPerThread: 1000
        });
    });

    afterEach(async () => {
        // Clean up after each test
        await redisMemory.clearAll();
    });

    afterAll(async () => {
        // Final cleanup
        await redisMemory.clearAll();
    });

    describe('Thread Operations', () => {
        it('should create and retrieve a thread', async () => {
            const thread = await redisMemory.createThread({
                title: 'Test Thread',
                metadata: { tag: 'test' }
            });

            expect(thread.id).toBeDefined();
            expect(thread.title).toBe('Test Thread');

            const retrieved = await redisMemory.getThread({ threadId: thread.id });
            expect(retrieved).toEqual(thread);
        });

        it('should handle thread limits', async () => {
            // Create max threads
            const threads = await Promise.all(
                Array(100).fill(null).map((_, i) =>
                    redisMemory.createThread({ title: `Thread ${i}` })
                )
            );

            // Create one more thread
            const newThread = await redisMemory.createThread({ title: 'New Thread' });

            // Check that the oldest thread was removed
            const oldestThread = await redisMemory.getThread({ threadId: threads[0].id });
            expect(oldestThread).toBeUndefined();

            // Check that the new thread exists
            const retrievedNew = await redisMemory.getThread({ threadId: newThread.id });
            expect(retrievedNew).toBeDefined();
        });

        it('should update thread metadata', async () => {
            const thread = await redisMemory.createThread({
                title: 'Original Title',
                metadata: { original: true }
            });

            const updated = await redisMemory.updateThread({
                threadId: thread.id,
                title: 'Updated Title',
                metadata: { updated: true }
            });

            expect(updated?.title).toBe('Updated Title');
            expect(updated?.metadata).toEqual({ updated: true });
        });
    });

    describe('Message Operations', () => {
        let testThread: Thread;

        beforeEach(async () => {
            testThread = await redisMemory.createThread({ title: 'Test Thread' });
        });

        it('should write and retrieve messages', async () => {
            const message1 = await redisMemory.writeMessage({
                threadId: testThread.id,
                role: 'user',
                content: 'Hello',
                metadata: { first: true }
            });

            const message2 = await redisMemory.writeMessage({
                threadId: testThread.id,
                role: 'assistant',
                content: 'Hi there!',
                metadata: { second: true }
            });

            const messages = await redisMemory.getThreadMessages({ threadId: testThread.id });
            expect(messages).toHaveLength(2);
            expect(messages[0].content).toBe('Hello');
            expect(messages[1].content).toBe('Hi there!');
        });

        it('should handle message limits per thread', async () => {
            // Create max messages
            const messages = await Promise.all(
                Array(1000).fill(null).map((_, i) =>
                    redisMemory.writeMessage({
                        threadId: testThread.id,
                        role: 'user',
                        content: `Message ${i}`
                    })
                )
            );

            // Write one more message
            const newMessage = await redisMemory.writeMessage({
                threadId: testThread.id,
                role: 'user',
                content: 'New Message'
            });

            // Get all messages
            const allMessages = await redisMemory.getThreadMessages({ threadId: testThread.id });

            // Check that we haven't exceeded the limit
            expect(allMessages.length).toBeLessThanOrEqual(1000);

            // Check that the new message exists
            expect(allMessages.find(m => m.id === newMessage?.id)).toBeDefined();

            // Check that the oldest message was removed
            expect(allMessages.find(m => m.id === messages?.[0]?.id)).toBeUndefined();
        });

        it('should search messages by content', async () => {
            await redisMemory.writeMessage({
                threadId: testThread.id,
                role: 'user',
                content: 'Unique test message'
            });

            await redisMemory.writeMessage({
                threadId: testThread.id,
                role: 'assistant',
                content: 'Regular message'
            });

            const searchResults = await redisMemory.searchMessages({
                query: 'unique',
                threadId: testThread.id
            });

            expect(searchResults).toHaveLength(1);
            expect(searchResults[0].content).toContain('unique');
        });

        it('should filter messages by role', async () => {
            await redisMemory.writeMessage({
                threadId: testThread.id,
                role: 'user',
                content: 'User message'
            });

            await redisMemory.writeMessage({
                threadId: testThread.id,
                role: 'assistant',
                content: 'Assistant message'
            });

            const userMessages = await redisMemory.getThreadMessages({
                threadId: testThread.id,
                role: 'user'
            });

            expect(userMessages).toHaveLength(1);
            expect(userMessages[0].role).toBe('user');
        });
    });

    describe('Search Operations', () => {
        it('should search threads by title and metadata', async () => {
            await redisMemory.createThread({
                title: 'Unique Thread',
                metadata: { tag: 'test' }
            });

            await redisMemory.createThread({
                title: 'Regular Thread',
                metadata: { tag: 'normal' }
            });

            const searchResults = await redisMemory.searchThreads({
                query: 'unique'
            });

            expect(searchResults).toHaveLength(1);
            expect(searchResults[0].title).toContain('Unique');
        });

        it('should search messages across all threads', async () => {
            const thread1 = await redisMemory.createThread({ title: 'Thread 1' });
            const thread2 = await redisMemory.createThread({ title: 'Thread 2' });

            await redisMemory.writeMessage({
                threadId: thread1.id,
                role: 'user',
                content: 'Unique message in thread 1'
            });

            await redisMemory.writeMessage({
                threadId: thread2.id,
                role: 'user',
                content: 'Regular message in thread 2'
            });

            const searchResults = await redisMemory.searchMessages({
                query: 'unique'
            });

            expect(searchResults).toHaveLength(1);
            expect(searchResults[0].content).toContain('unique');
            expect(searchResults[0].threadId).toBe(thread1.id);
        });
    });
});