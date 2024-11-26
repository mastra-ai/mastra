import { test, jest, describe, beforeEach, afterEach, expect, it } from '@jest/globals'
import { CloudflareKVMemory } from './';
import type { KVNamespace, KVNamespaceGetWithMetadataResult } from '@cloudflare/workers-types';
import {
    Thread, Message, CreateThreadParams, WriteMessageParams
} from '@mastra/core';

describe('CloudflareKVMemory', () => {
    let kvNamespace: KVNamespace;
    let memory: CloudflareKVMemory;
    const mockStore: { [key: string]: string } = {};

    beforeEach(() => {
        // Reset mock store
        Object.keys(mockStore).forEach(key => delete mockStore[key]);

        // Create properly typed mock functions
        const getMock = jest.fn(
            (key: string): Promise<string | null> =>
                Promise.resolve(mockStore[key] ?? null)
        );

        const putMock = jest.fn(
            (key: string, value: string): Promise<void> => {
                mockStore[key] = value;
                return Promise.resolve();
            }
        );

        const deleteMock = jest.fn(
            (key: string): Promise<void> => {
                delete mockStore[key];
                return Promise.resolve();
            }
        );

        const listMock = jest.fn(
            (): Promise<{ keys: { name: string; expiration?: number; metadata?: unknown }[]; list_complete: boolean; cursor: string }> =>
                Promise.resolve({
                    keys: [],
                    list_complete: true,
                    cursor: ''
                })
        );

        const getWithMetadataMock = jest.fn(
            (key: string): Promise<KVNamespaceGetWithMetadataResult<string, unknown>> =>
                Promise.resolve({
                    value: mockStore[key] ?? null,
                    metadata: null,
                    cacheStatus: null,
                })
        );

        // Create mock KV namespace
        kvNamespace = {
            get: getMock,
            put: putMock,
            delete: deleteMock,
            list: listMock,
            getWithMetadata: getWithMetadataMock
        } as unknown as KVNamespace;

        memory = new CloudflareKVMemory(kvNamespace, {
            maxThreads: 2,
            maxMessagesPerThread: 3
        });
    });

    describe('Thread Operations', () => {
        test('should create a thread successfully', async () => {
            const params: CreateThreadParams = {
                title: 'Test Thread',
                metadata: { category: 'test' }
            };

            const thread = await memory.createThread(params);

            expect(thread).toMatchObject({
                title: params.title,
                metadata: params.metadata
            });
            expect(thread.id).toBeDefined();
            expect(thread.createdAt).toBeDefined();
            expect(thread.updatedAt).toBeDefined();

            // Verify KV operations
            expect(kvNamespace.put).toHaveBeenCalledTimes(2); // One for thread, one for thread list

            // Verify thread was stored
            const storedThread = await memory.getThread({ threadId: thread.id });
            expect(storedThread).toEqual(thread);
        });

        test('should enforce maximum thread limit', async () => {
            // Create max number of threads
            await memory.createThread({ title: 'Thread 1' });
            await memory.createThread({ title: 'Thread 2' });

            // Attempt to create one more
            await expect(
                memory.createThread({ title: 'Thread 3' })
            ).rejects.toThrow('Maximum thread limit (2) reached');
        });

        test('should update thread successfully', async () => {
            const thread = await memory.createThread({ title: 'Original Title' });
            const updatedThread = await memory.updateThread({
                threadId: thread.id,
                title: 'Updated Title',
                metadata: { updated: true }
            });

            expect(updatedThread).toBeDefined();
            expect(updatedThread?.title).toBe('Updated Title');
            expect(updatedThread?.metadata).toEqual({ updated: true });
            expect(updatedThread?.updatedAt).not.toBe(thread.updatedAt);
        });

        test('should delete thread and its messages', async () => {
            const thread = await memory.createThread({ title: 'Test Thread' });

            // Add some messages
            await memory.writeMessage({
                threadId: thread.id,
                role: 'user',
                content: 'Test message'
            });

            // Delete thread
            const result = await memory.deleteThread({ threadId: thread.id });
            expect(result).toBe(true);

            // Verify thread is gone
            const deletedThread = await memory.getThread({ threadId: thread.id });
            expect(deletedThread).toBeUndefined();

            // Verify messages are gone
            const messages = await memory.getThreadMessages({ threadId: thread.id });
            expect(messages).toHaveLength(0);
        });
    });

    describe('Message Operations', () => {
        let testThread: Thread;

        beforeEach(async () => {
            testThread = await memory.createThread({ title: 'Test Thread' });
        });

        test('should write message successfully', async () => {
            const params: WriteMessageParams = {
                threadId: testThread.id,
                role: 'user',
                content: 'Test message',
                metadata: { important: true }
            };

            const message = await memory.writeMessage(params);

            expect(message).toBeDefined();
            expect(message?.content).toBe(params.content);
            expect(message?.role).toBe(params.role);
            expect(message?.metadata).toEqual(params.metadata);
            expect(message?.threadId).toBe(testThread.id);
        });

        test('should enforce maximum messages per thread limit', async () => {
            // Write max number of messages
            for (let i = 0; i < 3; i++) {
                await memory.writeMessage({
                    threadId: testThread.id,
                    role: 'user',
                    content: `Message ${i}`
                });
            }

            // Attempt to write one more
            await expect(
                memory.writeMessage({
                    threadId: testThread.id,
                    role: 'user',
                    content: 'Extra message'
                })
            ).rejects.toThrow('Maximum messages per thread (3) reached');
        });

        test('should retrieve messages with filters', async () => {
            // Write test messages
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
            await memory.writeMessage({
                threadId: testThread.id,
                role: 'user',
                content: 'User message 2'
            });

            // Test role filter
            const userMessages = await memory.getThreadMessages({
                threadId: testThread.id,
                role: 'user'
            });
            expect(userMessages).toHaveLength(2);
            expect(userMessages.every(m => m.role === 'user')).toBe(true);

            // Test limit
            const limitedMessages = await memory.getThreadMessages({
                threadId: testThread.id,
                limit: 2
            });
            expect(limitedMessages).toHaveLength(2);
        });
    });

    describe('Search Operations', () => {
        beforeEach(async () => {
            // Create test data
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

        test('should search threads successfully', async () => {
            const workThreads = await memory.searchThreads({ query: 'meeting work' });
            expect(workThreads).toHaveLength(1);
            expect(workThreads[0].title).toBe('Important Meeting');

            const nonexistentThreads = await memory.searchThreads({ query: 'nonexistent' });
            expect(nonexistentThreads).toHaveLength(0);
        });

        test('should search messages successfully', async () => {
            const projectMessages = await memory.searchMessages({ query: 'project' });
            expect(projectMessages).toHaveLength(1);
            expect(projectMessages[0].content).toContain('project timeline');

            const groceryMessages = await memory.searchMessages({ query: 'groceries' });
            expect(groceryMessages).toHaveLength(1);
            expect(groceryMessages[0].content).toBe('Buy groceries');
        });
    });

    describe('Utility Operations', () => {
        test('should get correct message count', async () => {
            const thread = await memory.createThread({ title: 'Test Thread' });

            expect(await memory.getMessageCount({ threadId: thread.id })).toBe(0);

            await memory.writeMessage({
                threadId: thread.id,
                role: 'user',
                content: 'Message 1'
            });
            await memory.writeMessage({
                threadId: thread.id,
                role: 'user',
                content: 'Message 2'
            });

            expect(await memory.getMessageCount({ threadId: thread.id })).toBe(2);
            expect(await memory.getMessageCount({})).toBe(2);
        });

        test('should clear all data', async () => {
            // Create some test data
            const thread = await memory.createThread({ title: 'Test Thread' });
            await memory.writeMessage({
                threadId: thread.id,
                role: 'user',
                content: 'Test message'
            });

            await memory.clearAll();

            expect(await memory.getThreadCount()).toBe(0);
            expect(await memory.getMessageCount({})).toBe(0);
            expect(await memory.getAllThreads()).toHaveLength(0);
        });
    });
});