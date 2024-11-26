import { jest, describe, beforeEach, afterEach, expect, it } from '@jest/globals'
import { InMemory } from './index';
import { Thread, Message } from '@mastra/core';

describe('InMemory', () => {
    let memory: InMemory;

    beforeEach(() => {
        memory = new InMemory({ maxThreads: 3, maxMessagesPerThread: 5 });
    });

    afterEach(async () => {
        await memory.clearAll();
    });

    describe('Thread Operations', () => {
        it('should create a thread successfully', async () => {
            const thread = await memory.createThread({
                title: 'Test Thread',
                metadata: { category: 'test' }
            });

            expect(thread).toBeDefined();
            expect(thread.title).toBe('Test Thread');
            expect(thread.metadata).toEqual({ category: 'test' });
            expect(thread.id).toBeDefined();
            expect(thread.createdAt).toBeDefined();
            expect(thread.updatedAt).toBeDefined();
        });

        it('should enforce maximum thread limit', async () => {
            // Create max number of threads
            const thread1 = await memory.createThread({ title: 'Thread 1' });
            await new Promise(resolve => setTimeout(resolve, 10)); // Ensure different timestamps
            const thread2 = await memory.createThread({ title: 'Thread 2' });
            await new Promise(resolve => setTimeout(resolve, 10));
            const thread3 = await memory.createThread({ title: 'Thread 3' });

            // Create one more thread
            await new Promise(resolve => setTimeout(resolve, 10));
            const thread4 = await memory.createThread({ title: 'Thread 4' });

            // Check that oldest thread was removed
            const oldestThread = await memory.getThread({ threadId: thread1.id });
            expect(oldestThread).toBeUndefined();

            // Check that newest threads remain
            const remainingThreads = await memory.getAllThreads();
            expect(remainingThreads.length).toBe(3);
            expect(remainingThreads.map(t => t.id)).toContain(thread4.id);
        });

        it('should update thread successfully', async () => {
            const thread = await memory.createThread({ title: 'Original Title' });

            // Add a small delay to ensure different timestamps
            await new Promise(resolve => setTimeout(resolve, 10));

            const updatedThread = await memory.updateThread({
                threadId: thread.id,
                title: 'Updated Title',
                metadata: { updated: true }
            });

            expect(updatedThread).toBeDefined();
            expect(updatedThread?.title).toBe('Updated Title');
            expect(updatedThread?.metadata).toEqual({ updated: true });
            expect(updatedThread?.updatedAt).not.toBe(thread.updatedAt);

            // Additional verification that timestamps are actually different
            const originalDate = new Date(thread.updatedAt).getTime();
            const updatedDate = new Date(updatedThread!.updatedAt).getTime();
            expect(updatedDate).toBeGreaterThan(originalDate);
        });

        it('should delete thread and its messages', async () => {
            const thread = await memory.createThread({ title: 'Test Thread' });
            await memory.writeMessage({
                threadId: thread.id,
                role: 'user',
                content: 'Test message'
            });

            const deleted = await memory.deleteThread({ threadId: thread.id });
            expect(deleted).toBe(true);

            const messages = await memory.getThreadMessages({ threadId: thread.id });
            expect(messages.length).toBe(0);
        });
    });

    describe('Message Operations', () => {
        let testThread: Thread;

        beforeEach(async () => {
            testThread = await memory.createThread({ title: 'Test Thread' });
        });

        it('should write message successfully', async () => {
            const message = await memory.writeMessage({
                threadId: testThread.id,
                role: 'user',
                content: 'Test message',
                metadata: { important: true }
            });

            expect(message).toBeDefined();
            expect(message?.threadId).toBe(testThread.id);
            expect(message?.role).toBe('user');
            expect(message?.content).toBe('Test message');
            expect(message?.metadata).toEqual({ important: true });
        });

        it('should enforce maximum messages per thread limit', async () => {
            // Write max number of messages
            const messages: Message[] = [];
            for (let i = 0; i < 6; i++) {
                const msg = await memory.writeMessage({
                    threadId: testThread.id,
                    role: 'user',
                    content: `Message ${i}`
                });
                if (msg) messages.push(msg);
                await new Promise(resolve => setTimeout(resolve, 10)); // Ensure different timestamps
            }

            const threadMessages = await memory.getThreadMessages({ threadId: testThread.id });
            expect(threadMessages.length).toBe(5);
            expect(threadMessages[0].content).toBe('Message 1'); // First message should be removed
        });

        it('should filter messages by role and timestamp', async () => {
            // Create test dates
            const date1 = new Date('2024-01-01T00:00:00.000Z');
            const date2 = new Date('2024-01-02T00:00:00.000Z');

            // Mock Date.now() for each message creation
            const realDateNow = Date.now;

            // First message
            Date.now = jest.fn(() => date1.getTime());
            await memory.writeMessage({
                threadId: testThread.id,
                role: 'user',
                content: 'User message 1'
            });

            await memory.writeMessage({
                threadId: testThread.id,
                role: 'assistant',
                content: 'Assistant message'
            });

            // Second user message with later timestamp
            Date.now = jest.fn(() => date2.getTime());
            await memory.writeMessage({
                threadId: testThread.id,
                role: 'user',
                content: 'User message 2'
            });

            // Restore original Date.now
            Date.now = realDateNow;

            const userMessages = await memory.getThreadMessages({
                threadId: testThread.id,
                role: 'user'
            });
            expect(userMessages.length).toBe(2);

            const filteredByTime = await memory.getThreadMessages({
                threadId: testThread.id,
                fromTimestamp: date2.toISOString()
            });

            expect(filteredByTime.length).toBe(3);
            expect(filteredByTime[0].content).toBe('User message 1');
        });
    });

    describe('Search Operations', () => {
        beforeEach(async () => {
            const thread1 = await memory.createThread({
                title: 'Important Meeting',
                metadata: { category: 'work' }
            });
            const thread2 = await memory.createThread({
                title: 'Shopping List',
                metadata: { category: 'personal' }
            });

            await memory.writeMessage({
                threadId: thread1.id,
                role: 'user',
                content: 'Discuss project timeline'
            });

            await memory.writeMessage({
                threadId: thread2.id,
                role: 'user',
                content: 'Buy groceries'
            });
        });

        it('should search threads by title and metadata', async () => {
            const workThreads = await memory.searchThreads({ query: 'meeting' });
            expect(workThreads.length).toBe(1);
            expect(workThreads[0].title).toBe('Important Meeting');

            const personalThreads = await memory.searchThreads({ query: 'personal' });
            expect(personalThreads.length).toBe(1);
            expect(personalThreads[0].title).toBe('Shopping List');
        });

        it('should search messages by content', async () => {
            const projectMessages = await memory.searchMessages({ query: 'project' });
            expect(projectMessages.length).toBe(1);
            expect(projectMessages[0].content).toBe('Discuss project timeline');

            const groceryMessages = await memory.searchMessages({ query: 'groceries' });
            expect(groceryMessages.length).toBe(1);
            expect(groceryMessages[0].content).toBe('Buy groceries');
        });
    });

    describe('Count Operations', () => {
        it('should return correct message and thread counts', async () => {
            const thread = await memory.createThread({ title: 'Test Thread' });
            await memory.writeMessage({
                threadId: thread.id,
                role: 'user',
                content: 'Message 1'
            });
            await memory.writeMessage({
                threadId: thread.id,
                role: 'assistant',
                content: 'Message 2'
            });

            const messageCount = await memory.getMessageCount({});
            expect(messageCount).toBe(2);

            const threadMessageCount = await memory.getMessageCount({ threadId: thread.id });
            expect(threadMessageCount).toBe(2);

            const threadCount = await memory.getThreadCount();
            expect(threadCount).toBe(1);
        });
    });
});