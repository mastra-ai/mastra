import {
    GetMessageCountParams,
    SearchMessagesParams,
    GetThreadMessagesParams,
    SearchThreadsParams,
    WriteMessageParams,
    DeleteThreadParams,
    UpdateThreadParams,
    GetThreadParams,
    MemoryOptions,
    Message,
    CreateThreadParams,
    Thread,
    MastraMemory
} from '@mastra/core';
import { Redis } from '@upstash/redis';

export interface RedisMemoryOptions extends MemoryOptions {
    url: string;
    token: string;
}

export class RedisMemory extends MastraMemory {
    private redis: Redis;
    private readonly THREAD_KEY = 'threads';  // Hash storing thread data
    private readonly MESSAGE_KEY = 'messages'; // Hash storing message data
    private readonly THREAD_MESSAGES_KEY = 'thread:messages:'; // Sorted set per thread
    private readonly THREAD_TIMELINE_KEY = 'thread:timeline'; // Sorted set of thread updates
    private readonly MESSAGE_TIMELINE_KEY = 'message:timeline'; // Sorted set of all messages

    constructor(options: RedisMemoryOptions) {
        super(options);
        this.redis = new Redis({
            url: options.url,
            token: options.token
        });
    }

    async createThread({ title, metadata }: CreateThreadParams): Promise<Thread> {
        const thread: Thread = {
            id: this.generateId(),
            title,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            metadata
        };

        const timestamp = Date.now();

        // Start a Redis transaction
        const pipeline = this.redis.pipeline();

        // Store thread data
        pipeline.hset(this.THREAD_KEY, { [thread.id]: JSON.stringify(thread) });

        // Add to thread timeline
        pipeline.zadd(this.THREAD_TIMELINE_KEY, { score: timestamp, member: thread.id });

        // Check thread count and remove oldest if needed
        const threadCount = await this.getThreadCount();
        if (threadCount >= this.maxThreads) {
            // Get oldest thread
            const oldestThread = await this.redis.zrange(this.THREAD_TIMELINE_KEY, 0, 0) as string[];
            if (oldestThread.length > 0) {
                await this.deleteThread({ threadId: oldestThread[0] });
            }
        }

        await pipeline.exec();
        return thread;
    }

    async getThread({ threadId }: GetThreadParams): Promise<Thread | undefined> {
        const threadData = await this.redis.hget<string>(this.THREAD_KEY, threadId);
        return threadData ? JSON.parse(threadData) : undefined;
    }

    async getAllThreads(): Promise<Thread[]> {
        // Get all threads sorted by update time
        const threadIds = await this.redis.zrange<string[]>(this.THREAD_TIMELINE_KEY, 0, -1, { rev: true });

        const threads = await Promise.all(
            threadIds.map(id => this.redis.hget<string>(this.THREAD_KEY, id))
        );

        return threads.filter(Boolean).map(thread => JSON.parse(thread!));
    }

    async updateThread({ threadId, title, metadata }: UpdateThreadParams): Promise<Thread | undefined> {
        const thread = await this.getThread({ threadId });
        if (!thread) return undefined;

        const updatedThread: Thread = {
            ...thread,
            ...(title && { title }),
            ...(metadata && { metadata }),
            updatedAt: new Date().toISOString()
        };

        const pipeline = this.redis.pipeline();
        pipeline.hset(this.THREAD_KEY, { [thread.id]: JSON.stringify(updatedThread) });
        pipeline.zadd(this.THREAD_TIMELINE_KEY, { score: Date.now(), member: threadId });
        await pipeline.exec();

        return updatedThread;
    }

    async deleteThread({ threadId }: DeleteThreadParams): Promise<boolean> {
        const pipeline = this.redis.pipeline();

        // Delete thread data
        pipeline.hdel(this.THREAD_KEY, threadId);
        pipeline.zrem(this.THREAD_TIMELINE_KEY, [threadId]);

        // Delete thread messages
        const messageIds = await this.redis.zrange<string[]>(this.THREAD_MESSAGES_KEY + threadId, 0, -1);
        if (messageIds.length > 0) {
            pipeline.hdel(this.MESSAGE_KEY, ...messageIds);
            pipeline.zrem(this.MESSAGE_TIMELINE_KEY, messageIds);
            pipeline.del(this.THREAD_MESSAGES_KEY + threadId);
        }

        const results = await pipeline.exec();
        if (!results) return false;

        return results.some(result => {
            if (typeof result === 'number') {
                return result > 0;
            }
            return false;
        });
    }

    async writeMessage({ threadId, role, content, metadata }: WriteMessageParams): Promise<Message | undefined> {
        const thread = await this.getThread({ threadId });
        if (!thread) return undefined;

        const message: Message = {
            id: this.generateId(),
            threadId,
            role,
            content,
            timestamp: new Date().toISOString(),
            metadata
        };

        const timestamp = Date.now();
        const pipeline = this.redis.pipeline();

        // Store message
        pipeline.hset(this.THREAD_KEY, { [message.id]: JSON.stringify(message) });

        // Add to thread's message timeline
        pipeline.zadd(this.THREAD_MESSAGES_KEY + threadId, { score: timestamp, member: message.id });

        // Add to global message timeline
        pipeline.zadd(this.MESSAGE_TIMELINE_KEY, { score: timestamp, member: message.id });

        // Update thread's last activity
        await this.updateThread({ threadId });

        // Check message count and remove oldest if needed
        const messageCount = await this.getMessageCount({ threadId });
        if (messageCount >= this.maxMessagesPerThread) {
            const oldestMessageId = await this.redis.zrange<string[]>(this.THREAD_MESSAGES_KEY + threadId, 0, 0);
            if (oldestMessageId.length > 0) {
                pipeline.zrem(this.THREAD_MESSAGES_KEY + threadId, oldestMessageId[0]);
                pipeline.zrem(this.MESSAGE_TIMELINE_KEY, oldestMessageId[0]);
                pipeline.hdel(this.MESSAGE_KEY, oldestMessageId[0]);
            }
        }

        await pipeline.exec();
        return message;
    }

    async getThreadMessages({
        threadId,
        limit,
        role,
        fromTimestamp,
        toTimestamp
    }: GetThreadMessagesParams): Promise<Message[]> {
        // Get message IDs for the thread
        const messageIds = await this.redis.zrange<string[]>(this.THREAD_MESSAGES_KEY + threadId, 0, -1);
        if (messageIds.length === 0) return [];

        // Get all messages with correct hget syntax
        const messages = await Promise.all(
            messageIds.map(id => this.redis.hget<string>(this.MESSAGE_KEY, id))
        );

        let filteredMessages = messages
            .filter(Boolean)
            .map(msg => JSON.parse(msg!))
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        // Apply filters
        if (role) {
            filteredMessages = filteredMessages.filter(msg => msg.role === role);
        }
        if (fromTimestamp) {
            filteredMessages = filteredMessages.filter(msg => msg.timestamp >= fromTimestamp);
        }
        if (toTimestamp) {
            filteredMessages = filteredMessages.filter(msg => msg.timestamp <= toTimestamp);
        }
        if (limit) {
            filteredMessages = filteredMessages.slice(-limit);
        }

        return filteredMessages;
    }

    async searchThreads({ query }: SearchThreadsParams): Promise<Thread[]> {
        const threads = await this.getAllThreads();
        const lowercaseQuery = query.toLowerCase();

        return threads.filter(thread =>
            thread.title.toLowerCase().includes(lowercaseQuery) ||
            (thread.metadata && JSON.stringify(thread.metadata).toLowerCase().includes(lowercaseQuery))
        );
    }

    async searchMessages({ query, threadId }: SearchMessagesParams): Promise<Message[]> {
        const lowercaseQuery = query.toLowerCase();
        let messageIds: string[] = [];

        if (threadId) {
            messageIds = await this.redis.zrange<string[]>(this.THREAD_MESSAGES_KEY + threadId, 0, -1);
        } else {
            messageIds = await this.redis.zrange<string[]>(this.MESSAGE_TIMELINE_KEY, 0, -1);
        }

        const messages = await Promise.all(
            messageIds.map(id => this.redis.hget<string>(this.MESSAGE_KEY, id))
        );

        return messages
            .filter(Boolean)
            .map(msg => JSON.parse(msg!))
            .filter(msg => msg.content.toLowerCase().includes(lowercaseQuery))
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }

    async getMessageCount({ threadId }: GetMessageCountParams): Promise<number> {
        if (threadId) {
            return this.redis.zcard(this.THREAD_MESSAGES_KEY + threadId);
        }
        return this.redis.hlen(this.MESSAGE_KEY);
    }

    async getThreadCount(): Promise<number> {
        return this.redis.hlen(this.THREAD_KEY);
    }

    async clearAll(): Promise<void> {
        const pipeline = this.redis.pipeline();

        // Clear main data structures
        pipeline.del(this.THREAD_KEY);
        pipeline.del(this.MESSAGE_KEY);
        pipeline.del(this.THREAD_TIMELINE_KEY);
        pipeline.del(this.MESSAGE_TIMELINE_KEY);

        // Clear thread message timelines
        const threadIds = await this.redis.zrange(this.THREAD_TIMELINE_KEY, 0, -1);
        threadIds.forEach(threadId => {
            pipeline.del(this.THREAD_MESSAGES_KEY + threadId);
        });

        await pipeline.exec();
    }
}