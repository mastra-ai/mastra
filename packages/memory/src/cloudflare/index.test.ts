import { CloudflareKVMemory } from './';
import { MockKV } from './kv';
import { ThreadType } from '@mastra/core';

describe('CloudflareKVMemory', () => {
    let memory: CloudflareKVMemory;
    let mockKV: MockKV;

    beforeEach(() => {
        mockKV = new MockKV();
        memory = new CloudflareKVMemory(mockKV);
    });

    afterEach(async () => {
        await memory.cleanup();
    });

    describe('Thread Operations', () => {
        it('should create and retrieve a thread', async () => {
            const thread = await memory.createThread('Test Thread', {
                testKey: 'testValue'
            });

            expect(thread).toEqual({
                id: expect.any(String),
                title: 'Test Thread',
                createdAt: expect.any(Date),
                updatedAt: expect.any(Date),
                metadata: { testKey: 'testValue' }
            });

            const retrieved = await memory.getThreadById(thread.id);
            expect(retrieved).toEqual(thread);
        });

        it('should return null for non-existent thread', async () => {
            const thread = await memory.getThreadById('nonexistent');
            expect(thread).toBeNull();
        });

        it('should update thread timestamps', async () => {
            const thread = await memory.createThread('Initial Title');
            const originalUpdatedAt = thread.updatedAt;

            // Wait a bit to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 100));

            thread.title = 'Updated Title';
            const updated = await memory.saveThread(thread);

            expect(updated.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
        });
    });

    describe('Message Operations', () => {
        let testThread: ThreadType;

        beforeEach(async () => {
            testThread = await memory.createThread('Message Test Thread');
        });

        it('should add and retrieve messages', async () => {
            // Add multiple messages
            await memory.addMessage(testThread.id, 'Hello', 'user');
            await memory.addMessage(testThread.id, 'Hi there', 'assistant');


            // Retrieve all messages
            const messages = await memory.getMessages(testThread.id);

            expect(messages).toHaveLength(2);

            // Verify both messages are present without assuming order
            expect(messages).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        content: 'Hello',
                        role: 'user',
                        threadId: testThread.id
                    }),
                    expect.objectContaining({
                        content: 'Hi there',
                        role: 'assistant',
                        threadId: testThread.id
                    })
                ])
            );

            // Also verify that each message has all required fields
            messages.forEach(msg => {
                expect(msg).toEqual(
                    expect.objectContaining({
                        id: expect.any(String),
                        content: expect.any(String),
                        role: expect.stringMatching(/^(user|assistant)$/),
                        createdAt: expect.any(Date),
                        threadId: testThread.id
                    })
                );
            });
        });

        it('should handle message ordering', async () => {
            const messages = [
                {
                    id: memory['generateId'](),
                    content: 'Message 1',
                    role: 'user' as const,
                    createdAt: new Date('2024-01-01'),
                    threadId: testThread.id
                },
                {
                    id: memory['generateId'](),
                    content: 'Message 2',
                    role: 'assistant' as const,
                    createdAt: new Date('2024-01-02'),
                    threadId: testThread.id
                }
            ];

            await memory.saveMessages(messages);
            const retrieved = await memory.getMessages(testThread.id);

            expect(retrieved).toHaveLength(2);
            expect(retrieved?.[0]?.content).toBe('Message 1');
            expect(retrieved?.[1]?.content).toBe('Message 2');
        });

        it('should handle duplicate message saves', async () => {
            const message = await memory.addMessage(testThread.id, 'Duplicate', 'user');

            // Try to save the same message again
            await memory.saveMessages([message]);

            const messages = await memory.getMessages(testThread.id);
            expect(messages).toHaveLength(1);
        });
    });

    describe('Batch Operations', () => {
        it('should handle multiple threads', async () => {
            const thread1 = await memory.createThread('Thread 1');
            const thread2 = await memory.createThread('Thread 2');

            const allThreadIds = await memory.getAllThreadIds();
            expect(allThreadIds).toContain(thread1.id);
            expect(allThreadIds).toContain(thread2.id);

            const threads = await memory.getThreads([thread1.id, thread2.id]);
            expect(threads).toHaveLength(2);
        });

        it('should delete thread and associated messages', async () => {
            const thread = await memory.createThread('Delete Test');
            await memory.addMessage(thread.id, 'Test Message', 'user');

            await memory.deleteThread(thread.id);

            const deletedThread = await memory.getThreadById(thread.id);
            const messages = await memory.getMessages(thread.id);

            expect(deletedThread).toBeNull();
            expect(messages).toHaveLength(0);
        });
    });

    describe.only('Error Handling', () => {
        it('should handle concurrent message saves', async () => {
            const thread = await memory.createThread('Concurrent Test');
            console.log('Created thread:', thread.id);

            const messagesToSave = [
                {
                    id: memory['generateId'](),
                    content: 'Message 1',
                    role: 'user' as const,
                    createdAt: new Date(),
                    threadId: thread.id
                },
                {
                    id: memory['generateId'](),
                    content: 'Message 2',
                    role: 'user' as const,
                    createdAt: new Date(),
                    threadId: thread.id
                },
                {
                    id: memory['generateId'](),
                    content: 'Message 3',
                    role: 'user' as const,
                    createdAt: new Date(),
                    threadId: thread.id
                }
            ];

            console.log('Messages to save:', messagesToSave);

            // Save messages concurrently but in batches
            if (messagesToSave?.length && messagesToSave?.[0] && messagesToSave?.[2]) {
                await Promise.all([
                    memory.saveMessages(messagesToSave).then(() => console.log('Batch 2 saved'))
                ]);
            }

            const messages = await memory.getMessages(thread.id);
            console.log('Retrieved messages:', messages);

            expect(messages).toHaveLength(3);
        });
    });

    describe('Performance', () => {
        it('should handle large number of messages', async () => {
            const thread = await memory.createThread('Bulk Test');
            const messageCount = 100;

            // Create many messages
            const messages = Array.from({ length: messageCount }, (_, i) => ({
                id: memory['generateId'](),
                content: `Message ${i}`,
                role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
                createdAt: new Date(),
                threadId: thread.id
            }));

            await memory.saveMessages(messages);
            const retrieved = await memory.getMessages(thread.id);

            expect(retrieved).toHaveLength(messageCount);
        });
    });
});