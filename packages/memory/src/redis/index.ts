import { MastraMemory, ThreadType, MessageType } from '@mastra/core';
import { RedisClient } from './types';

export * from './types';
export * from './providers';

// export class RedisMemory extends MastraMemory {
//     private redis: RedisClient;
//     private threadPrefix = 'thread:';
//     private messagePrefix = 'messages:';

//     constructor(redis: RedisClient) {
//         super();
//         this.redis = redis;
//     }

//     private async acquireLock(key: string, timeout = 5000): Promise<boolean> {
//         const lockKey = `lock:${key}`;
//         const lockValue = Date.now().toString();

//         const acquired = await this.redis.sadd(lockKey, lockValue);
//         if (!acquired) {
//             return false;
//         }

//         // Set expiry on lock to prevent deadlocks
//         setTimeout(async () => {
//             await this.redis.del(lockKey);
//         }, timeout);

//         return true;
//     }

//     private async releaseLock(key: string): Promise<void> {
//         const lockKey = `lock:${key}`;
//         await this.redis.del(lockKey);
//     }

//     async saveMessages(messages: MessageType[]): Promise<MessageType[]> {
//         if (!messages.length) return [];

//         const messagesByThread = messages.reduce((acc, message) => {
//             const key = `${this.messagePrefix}${message.threadId}`;
//             if (!acc[key]) {
//                 acc[key] = [];
//             }
//             acc[key].push(message);
//             return acc;
//         }, {} as Record<string, MessageType[]>);

//         for (const [key, threadMessages] of Object.entries(messagesByThread)) {
//             const threadId = threadMessages?.[0]?.threadId;
//             let retries = 3;
//             let saved = false;

//             while (retries > 0 && !saved) {
//                 try {
//                     if (await this.acquireLock(key)) {
//                         try {
//                             // Get existing messages atomically
//                             const existingMessages = await this.redis.get(key) || [];

//                             // Use a Map for efficient deduplication
//                             const messageMap = new Map<string, MessageType>();

//                             // Process existing messages
//                             for (const msg of existingMessages) {
//                                 messageMap.set(msg.id, {
//                                     ...msg,
//                                     createdAt: new Date(msg.createdAt)
//                                 });
//                             }

//                             // Add new messages
//                             for (const msg of threadMessages) {
//                                 messageMap.set(msg.id, {
//                                     ...msg,
//                                     createdAt: new Date(msg.createdAt)
//                                 });
//                             }

//                             const updatedMessages = Array.from(messageMap.values());

//                             // Sort by creation time and message ID for stable ordering
//                             updatedMessages.sort((a, b) => {
//                                 const timeCompare = a.createdAt.getTime() - b.createdAt.getTime();
//                                 return timeCompare === 0 ? a.id.localeCompare(b.id) : timeCompare;
//                             });

//                             // Save atomically
//                             await this.redis.set(key, updatedMessages);

//                             if (threadId) {
//                                 // Update thread timestamp
//                                 const thread = await this.getThreadById(threadId);
//                                 if (thread) {
//                                     thread.updatedAt = new Date();
//                                     await this.redis.set(`${this.threadPrefix}${thread.id}`, thread);
//                                 }
//                             }

//                             saved = true;
//                         } finally {
//                             await this.releaseLock(key);
//                         }
//                     }
//                 } catch (error) {
//                     console.error('Error saving messages:', error);
//                 }

//                 if (!saved && retries > 1) {
//                     await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
//                 }
//                 retries--;
//             }

//             if (!saved) {
//                 throw new Error(`Failed to save messages after ${retries} attempts`);
//             }
//         }

//         return messages;
//     }

//     async getThreadById(threadId: string): Promise<ThreadType | null> {
//         const thread = await this.redis.get(`${this.threadPrefix}${threadId}`);
//         if (thread && typeof thread.createdAt === 'string') {
//             thread.createdAt = new Date(thread.createdAt);
//             thread.updatedAt = new Date(thread.updatedAt);
//         }
//         return thread;
//     }

//     async saveThread(thread: ThreadType): Promise<ThreadType> {
//         thread.updatedAt = new Date();
//         await this.redis.set(
//             `${this.threadPrefix}${thread.id}`,
//             thread
//         );
//         await this.redis.sadd('threads', thread.id);
//         return thread;
//     }

//     async getMessages(threadId: string): Promise<MessageType[]> {
//         const messages = await this.redis.get(`${this.messagePrefix}${threadId}`) || [];
//         return messages.map((msg: MessageType) => ({
//             ...msg,
//             createdAt: new Date(msg.createdAt)
//         }));
//     }

//     async getAllThreadIds(): Promise<string[]> {
//         return this.redis.smembers('threads');
//     }

//     async deleteThread(threadId: string): Promise<void> {
//         const pipeline = this.redis.pipeline();
//         pipeline.del(`${this.threadPrefix}${threadId}`);
//         pipeline.del(`${this.messagePrefix}${threadId}`);
//         pipeline.srem('threads', threadId);
//         await pipeline.exec();
//     }

//     async getThreads(threadIds: string[]): Promise<ThreadType[]> {
//         const threads = await Promise.all(
//             threadIds.map(id => this.getThreadById(id))
//         );
//         return threads.filter((t): t is ThreadType => t !== null);
//     }
// }

export class RedisMemory extends MastraMemory {
    private redis: RedisClient;
    private threadPrefix = 'thread:';
    private messagePrefix = 'messages:';
    private lockTimeouts: Map<string, NodeJS.Timeout> = new Map();

    constructor(redis: RedisClient) {
        super();
        this.redis = redis;
    }

    async getThreadById(threadId: string): Promise<ThreadType | null> {
        const thread = await this.redis.get(`${this.threadPrefix}${threadId}`);
        if (thread && typeof thread.createdAt === 'string') {
            thread.createdAt = new Date(thread.createdAt);
            thread.updatedAt = new Date(thread.updatedAt);
        }
        return thread;
    }

    async saveThread(thread: ThreadType): Promise<ThreadType> {
        thread.updatedAt = new Date();
        await this.redis.set(
            `${this.threadPrefix}${thread.id}`,
            thread
        );
        await this.redis.sadd('threads', thread.id);
        return thread;
    }

    private async withLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
        const lockKey = `lock:${key}`;
        const lockTimeout = 5000;
        let locked = false;
        let timeoutId: NodeJS.Timeout | undefined;

        try {
            // Try to acquire lock with retries
            for (let i = 0; i < 3; i++) {
                locked = await this.redis.sadd(lockKey, '1');
                if (locked) break;
                await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
            }

            if (!locked) {
                throw new Error('Could not acquire lock');
            }

            // Set lock timeout
            timeoutId = setTimeout(async () => {
                try {
                    await this.redis.del(lockKey);
                } catch {
                    // Ignore errors during cleanup
                }
                this.lockTimeouts.delete(lockKey);
            }, lockTimeout);

            this.lockTimeouts.set(lockKey, timeoutId);

            // Execute operation
            return await operation();
        } finally {
            if (timeoutId !== undefined) {
                clearTimeout(timeoutId);
                this.lockTimeouts.delete(lockKey);
            }
            if (locked) {
                try {
                    await this.redis.del(lockKey);
                } catch {
                    // Ignore errors during cleanup
                }
            }
        }
    }

    // Add cleanup method
    async cleanup(): Promise<void> {
        // Clear all timeouts
        for (const timeout of this.lockTimeouts.values()) {
            clearTimeout(timeout);
        }
        this.lockTimeouts.clear();
    }

    async saveMessages(messages: MessageType[]): Promise<MessageType[]> {
        if (!messages.length) return [];

        const messagesByThread = messages.reduce((acc, message) => {
            const key = `${this.messagePrefix}${message.threadId}`;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push({
                ...message,
                createdAt: new Date(message.createdAt)
            });
            return acc;
        }, {} as Record<string, MessageType[]>);

        for (const [key, threadMessages] of Object.entries(messagesByThread)) {
            await this.withLock(key, async () => {
                const existingMessages = await this.redis.get(key) || [];

                const messageMap = new Map<string, MessageType>();

                // Process existing messages
                existingMessages.forEach((msg: MessageType) => {
                    messageMap.set(msg.id, {
                        ...msg,
                        createdAt: new Date(msg.createdAt)
                    });
                });

                // Add new messages
                threadMessages.forEach(msg => {
                    messageMap.set(msg.id, msg);
                });

                const updatedMessages = Array.from(messageMap.values());
                updatedMessages.sort((a, b) => {
                    const timeCompare = a.createdAt.getTime() - b.createdAt.getTime();
                    return timeCompare === 0 ? a.id.localeCompare(b.id) : timeCompare;
                });

                await this.redis.set(key, updatedMessages);
                if (threadMessages?.[0]?.threadId) {
                    const thread = await this.getThreadById(threadMessages?.[0]?.threadId);
                    if (thread) {
                        thread.updatedAt = new Date();
                        await this.redis.set(`${this.threadPrefix}${thread.id}`, thread);
                    }
                }
            });
        }

        return messages;
    }

    async addMessage(threadId: string, content: string, role: 'user' | 'assistant'): Promise<MessageType> {
        const message: MessageType = {
            id: this.generateId(),
            content,
            role,
            createdAt: new Date(),
            threadId
        };

        await this.saveMessages([message]);
        return message;
    }

    async getMessages(threadId: string): Promise<MessageType[]> {
        const messages = await this.redis.get(`${this.messagePrefix}${threadId}`) || [];
        return messages.map((msg: MessageType) => ({
            ...msg,
            createdAt: new Date(msg.createdAt)
        }));
    }

    async getAllThreadIds(): Promise<string[]> {
        return this.redis.smembers('threads');
    }

    async deleteThread(threadId: string): Promise<void> {
        const pipeline = this.redis.pipeline();
        pipeline.del(`${this.threadPrefix}${threadId}`);
        pipeline.del(`${this.messagePrefix}${threadId}`);
        pipeline.srem('threads', threadId);
        await pipeline.exec();
    }

    async getThreads(threadIds: string[]): Promise<ThreadType[]> {
        const threads = await Promise.all(
            threadIds.map(id => this.getThreadById(id))
        );
        return threads.filter((t): t is ThreadType => t !== null);
    }

    protected generateId(): string {
        return crypto.randomUUID();
    }
}