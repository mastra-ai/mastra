import { describe, expect, it } from "vitest";
import { createSampleMessageV1, createSampleMessageV2 } from "./data";
import { resetRole, createSampleThread } from "./data";
import { MastraStorage } from "@mastra/core/storage";
import type { MastraMessageV1, MastraMessageV2, StorageThreadType } from "@mastra/core";

export function createMessagesPaginatedTest({
    storage,
}: {
    storage: MastraStorage;
}) {
    describe('getMessagesPaginated', () => {
        it('should return paginated messages with total count', async () => {
            const thread = createSampleThread();
            await storage.saveThread({ thread });
            // Reset role to 'assistant' before creating messages
            resetRole();
            // Create messages sequentially to ensure unique timestamps
            for (let i = 0; i < 15; i++) {
                const message = createSampleMessageV1({ threadId: thread.id, content: `Message ${i + 1}` });
                await storage.saveMessages({
                    messages: [message],
                });
                await new Promise(r => setTimeout(r, 5));
            }

            const page1 = await storage.getMessagesPaginated({
                threadId: thread.id,
                selectBy: { pagination: { page: 0, perPage: 5 } },
                format: 'v2',
            });
            expect(page1.messages).toHaveLength(5);
            expect(page1.total).toBe(15);
            expect(page1.page).toBe(0);
            expect(page1.perPage).toBe(5);
            expect(page1.hasMore).toBe(true);

            const page3 = await storage.getMessagesPaginated({
                threadId: thread.id,
                selectBy: { pagination: { page: 2, perPage: 5 } },
                format: 'v2',
            });
            expect(page3.messages).toHaveLength(5);
            expect(page3.total).toBe(15);
            expect(page3.hasMore).toBe(false);
        });

        it('should filter by date with pagination for getMessages', async () => {
            resetRole();
            const threadData = createSampleThread();
            const thread = await storage.saveThread({ thread: threadData as StorageThreadType });
            const now = new Date();
            const yesterday = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate() - 1,
                now.getHours(),
                now.getMinutes(),
                now.getSeconds(),
            );
            const dayBeforeYesterday = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate() - 2,
                now.getHours(),
                now.getMinutes(),
                now.getSeconds(),
            );

            // Ensure timestamps are distinct for reliable sorting by creating them with a slight delay for testing clarity
            const messagesToSave: MastraMessageV1[] = [];
            messagesToSave.push(createSampleMessageV1({ threadId: thread.id, createdAt: dayBeforeYesterday }));
            await new Promise(r => setTimeout(r, 5));
            messagesToSave.push(createSampleMessageV1({ threadId: thread.id, createdAt: dayBeforeYesterday }));
            await new Promise(r => setTimeout(r, 5));
            messagesToSave.push(createSampleMessageV1({ threadId: thread.id, createdAt: yesterday }));
            await new Promise(r => setTimeout(r, 5));
            messagesToSave.push(createSampleMessageV1({ threadId: thread.id, createdAt: yesterday }));
            await new Promise(r => setTimeout(r, 5));
            messagesToSave.push(createSampleMessageV1({ threadId: thread.id, createdAt: now }));
            await new Promise(r => setTimeout(r, 5));
            messagesToSave.push(createSampleMessageV1({ threadId: thread.id, createdAt: now }));

            await storage.saveMessages({ messages: messagesToSave, format: 'v1' });
            // Total 6 messages: 2 now, 2 yesterday, 2 dayBeforeYesterday (oldest to newest)

            const fromYesterday = await storage.getMessagesPaginated({
                threadId: thread.id,
                selectBy: { pagination: { page: 0, perPage: 3, dateRange: { start: yesterday } } },
                format: 'v2',
            });
            expect(fromYesterday.total).toBe(4);
            expect(fromYesterday.messages).toHaveLength(3);
            const firstMessageTime = new Date((fromYesterday.messages[0] as MastraMessageV1).createdAt).getTime();
            expect(firstMessageTime).toBeGreaterThanOrEqual(new Date(yesterday.toISOString()).getTime());
            if (fromYesterday.messages.length > 0) {
                expect(new Date((fromYesterday.messages[0] as MastraMessageV1).createdAt).toISOString().slice(0, 10)).toEqual(
                    yesterday.toISOString().slice(0, 10),
                );
            }
        });

        describe('Message Operations', () => {
            it('should save and retrieve messages', async () => {
                const thread = createSampleThread();
                await storage.saveThread({ thread });

                const messages = [
                    createSampleMessageV1({ threadId: thread.id }),
                    createSampleMessageV1({ threadId: thread.id }),
                ];

                // Save messages
                const savedMessages = await storage.saveMessages({ messages });

                expect(savedMessages).toEqual(messages);

                // Retrieve messages
                const retrievedMessages = await storage.getMessagesPaginated({ threadId: thread.id, format: 'v1' });

                expect(retrievedMessages.messages).toHaveLength(2);

                expect(retrievedMessages.messages).toEqual(expect.arrayContaining(messages));
            });

            it('should handle empty message array', async () => {
                const result = await storage.saveMessages({ messages: [] });
                expect(result).toEqual([]);
            });

            it('should maintain message order', async () => {
                const thread = createSampleThread();
                await storage.saveThread({ thread });

                const messages = [
                    createSampleMessageV1({ threadId: thread.id, content: 'First' }),
                    createSampleMessageV1({ threadId: thread.id, content: 'Second' }),
                    createSampleMessageV1({ threadId: thread.id, content: 'Third' }),
                ];

                await storage.saveMessages({ messages });

                const retrievedMessages = await storage.getMessagesPaginated({ threadId: thread.id, format: 'v1' });

                expect(retrievedMessages.messages).toHaveLength(3);

                // Verify order is maintained
                retrievedMessages.messages.forEach((msg, idx) => {
                    expect((msg as any).content[0]!.text).toBe((messages[idx] as any).content[0]!.text);
                });
            });

            it('should rollback on error during message save', async () => {
                const thread = createSampleThread();
                await storage.saveThread({ thread });

                const messages = [
                    createSampleMessageV1({ threadId: thread.id }),
                    { ...createSampleMessageV1({ threadId: thread.id }), id: null }, // This will cause an error
                ] as MastraMessageV1[];

                await expect(storage.saveMessages({ messages })).rejects.toThrow();

                // Verify no messages were saved
                const savedMessages = await storage.getMessagesPaginated({ threadId: thread.id, format: 'v1' });
                expect(savedMessages.messages).toHaveLength(0);
            });

            it('should retrieve messages w/ next/prev messages by message id + resource id', async () => {

                const thread = createSampleThread();
                await storage.saveThread({ thread });

                const thread2 = createSampleThread();
                await storage.saveThread({ thread: thread2 });

                const thread3 = createSampleThread();
                await storage.saveThread({ thread: thread3 });

                const messages: MastraMessageV2[] = [
                    createSampleMessageV2({
                        threadId: thread.id,
                        content: { content: 'First', parts: [{ type: 'text', text: 'First' }] },
                        resourceId: 'cross-thread-resource',
                    }),
                    createSampleMessageV2({
                        threadId: thread.id,
                        content: { content: 'Second', parts: [{ type: 'text', text: 'Second' }] },
                        resourceId: 'cross-thread-resource',
                    }),
                    createSampleMessageV2({
                        threadId: thread.id,
                        content: { content: 'Third', parts: [{ type: 'text', text: 'Third' }] },
                        resourceId: 'cross-thread-resource',
                    }),

                    createSampleMessageV2({
                        threadId: thread2.id,
                        content: { content: 'Fourth', parts: [{ type: 'text', text: 'Fourth' }] },
                        resourceId: 'cross-thread-resource',
                    }),
                    createSampleMessageV2({
                        threadId: thread2.id,
                        content: { content: 'Fifth', parts: [{ type: 'text', text: 'Fifth' }] },
                        resourceId: 'cross-thread-resource',
                    }),
                    createSampleMessageV2({
                        threadId: thread2.id,
                        content: { content: 'Sixth', parts: [{ type: 'text', text: 'Sixth' }] },
                        resourceId: 'cross-thread-resource',
                    }),

                    createSampleMessageV2({
                        threadId: thread3.id,
                        content: { content: 'Seventh', parts: [{ type: 'text', text: 'Seventh' }] },
                        resourceId: 'other-resource',
                    }),
                    createSampleMessageV2({
                        threadId: thread3.id,
                        content: { content: 'Eighth', parts: [{ type: 'text', text: 'Eighth' }] },
                        resourceId: 'other-resource',
                    }),
                ];

                await storage.saveMessages({ messages: messages, format: 'v2' });

                const retrievedMessages = await storage.getMessagesPaginated({ threadId: thread.id, format: 'v2' });
                expect(retrievedMessages.messages).toHaveLength(3);
                const contentParts = retrievedMessages.messages.map((m: any) =>
                    m.content.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text),
                );
                expect(contentParts).toEqual([['First'], ['Second'], ['Third']]);

                const retrievedMessages2 = await storage.getMessagesPaginated({ threadId: thread2.id, format: 'v2' });
                expect(retrievedMessages2.messages).toHaveLength(3);
                const contentParts2 = retrievedMessages2.messages.map((m: any) =>
                    m.content.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text),
                );
                expect(contentParts2).toEqual([['Fourth'], ['Fifth'], ['Sixth']]);

                const retrievedMessages3 = await storage.getMessagesPaginated({ threadId: thread3.id, format: 'v2' });
                expect(retrievedMessages3.messages).toHaveLength(2);
                const contentParts3 = retrievedMessages3.messages.map((m: any) =>
                    m.content.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text),
                );
                expect(contentParts3).toEqual([['Seventh'], ['Eighth']]);

                const { messages: crossThreadMessages } = await storage.getMessagesPaginated({
                    threadId: 'thread-doesnt-exist',
                    format: 'v2',
                    selectBy: {
                        last: 0,
                        include: [
                            {
                                id: messages[1]!.id,
                                threadId: thread.id,
                                withNextMessages: 2,
                                withPreviousMessages: 2,
                            },
                            {
                                id: messages[4]!.id,
                                threadId: thread2.id,
                                withPreviousMessages: 2,
                                withNextMessages: 2,
                            },
                        ],
                    },
                });

                expect(crossThreadMessages).toHaveLength(6);
                expect(crossThreadMessages.filter(m => m.threadId === thread.id)).toHaveLength(3);
                expect(crossThreadMessages.filter(m => m.threadId === thread2.id)).toHaveLength(3);

                const { messages: crossThreadMessages2 } = await storage.getMessagesPaginated({
                    threadId: thread.id,
                    format: 'v2',
                    selectBy: {
                        last: 0,
                        include: [
                            {
                                id: messages[4]!.id,
                                threadId: thread2.id,
                                withPreviousMessages: 1,
                                withNextMessages: 30,
                            },
                        ],
                    },
                });

                expect(crossThreadMessages2).toHaveLength(3);
                expect(crossThreadMessages2.filter(m => m.threadId === thread.id)).toHaveLength(0);
                expect(crossThreadMessages2.filter(m => m.threadId === thread2.id)).toHaveLength(3);

                const { messages: crossThreadMessages3 } = await storage.getMessagesPaginated({
                    threadId: thread2.id,
                    format: 'v2',
                    selectBy: {
                        last: 0,
                        include: [
                            {
                                id: messages[1]!.id,
                                threadId: thread.id,
                                withNextMessages: 1,
                                withPreviousMessages: 1,
                            },
                        ],
                    },
                });

                expect(crossThreadMessages3).toHaveLength(3);
                expect(crossThreadMessages3.filter(m => m.threadId === thread.id)).toHaveLength(3);
                expect(crossThreadMessages3.filter(m => m.threadId === thread2.id)).toHaveLength(0);
            });

            it('should return messages using both last and include (cross-thread, deduped)', async () => {
                const thread = createSampleThread({ id: 'thread-one' });
                await storage.saveThread({ thread });

                const thread2 = createSampleThread({ id: 'thread-two' });
                await storage.saveThread({ thread: thread2 });

                const now = new Date();

                // Setup: create messages in two threads
                const messages = [
                    createSampleMessageV2({
                        threadId: 'thread-one',
                        content: { content: 'A' },
                        createdAt: new Date(now.getTime()),
                    }),
                    createSampleMessageV2({
                        threadId: 'thread-one',
                        content: { content: 'B' },
                        createdAt: new Date(now.getTime() + 1000),
                    }),
                    createSampleMessageV2({
                        threadId: 'thread-one',
                        content: { content: 'C' },
                        createdAt: new Date(now.getTime() + 2000),
                    }),
                    createSampleMessageV2({
                        threadId: 'thread-two',
                        content: { content: 'D' },
                        createdAt: new Date(now.getTime() + 3000),
                    }),
                    createSampleMessageV2({
                        threadId: 'thread-two',
                        content: { content: 'E' },
                        createdAt: new Date(now.getTime() + 4000),
                    }),
                    createSampleMessageV2({
                        threadId: 'thread-two',
                        content: { content: 'F' },
                        createdAt: new Date(now.getTime() + 5000),
                    }),
                ];
                await storage.saveMessages({ messages, format: 'v2' });

                // Use last: 2 and include a message from another thread with context
                const { messages: result } = await storage.getMessagesPaginated({
                    threadId: 'thread-one',
                    format: 'v2',
                    selectBy: {
                        last: 2,
                        include: [
                            {
                                id: messages[4]!.id, // 'E' from thread-bar
                                threadId: 'thread-two',
                                withPreviousMessages: 1,
                                withNextMessages: 1,
                            },
                        ],
                    },
                });

                // Should include last 2 from thread-one and 3 from thread-two (D, E, F)
                expect(result.map((m: any) => m.content.content).sort()).toEqual(['B', 'C', 'D', 'E', 'F']);
                // Should include 2 from thread-one
                expect(result.filter((m: any) => m.threadId === 'thread-one').map((m: any) => m.content.content)).toEqual(['B', 'C']);
                // Should include 3 from thread-two
                expect(result.filter((m: any) => m.threadId === 'thread-two').map((m: any) => m.content.content)).toEqual([
                    'D',
                    'E',
                    'F',
                ]);
            });

            it('should update thread timestamp when saving messages', async () => {
                const thread = createSampleThread();
                await storage.saveThread({ thread });

                const initialThread = await storage.getThreadById({ threadId: thread.id });
                const initialUpdatedAt = new Date(initialThread!.updatedAt);

                // Wait a bit to ensure timestamp difference
                await new Promise(resolve => setTimeout(resolve, 10));

                const messages = [
                    createSampleMessageV1({ threadId: thread.id }),
                    createSampleMessageV1({ threadId: thread.id }),
                ];
                await storage.saveMessages({ messages });

                // Verify thread updatedAt timestamp was updated
                const updatedThread = await storage.getThreadById({ threadId: thread.id });
                const newUpdatedAt = new Date(updatedThread!.updatedAt);
                expect(newUpdatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
            });
        });
    });
}