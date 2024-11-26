import {
    GetMessageCountParams,
    SearchMessagesParams,
    GetThreadMessagesParams,
    SearchThreadsParams,
    WriteMessageParams,
    DeleteThreadParams, UpdateThreadParams, GetThreadParams, MemoryOptions, Message, CreateThreadParams, Thread, MastraMemory
} from '@mastra/core';

export class InMemory extends MastraMemory {
    private threads: Map<string, Thread>;
    private messages: Map<string, Message>;

    constructor(options: MemoryOptions = {}) {
        super(options);
        this.threads = new Map();
        this.messages = new Map();
    }

    async createThread({ title, metadata }: CreateThreadParams): Promise<Thread> {
        const thread: Thread = {
            id: this.generateId(),
            title,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            metadata
        };

        if (this.threads.size >= this.maxThreads) {
            const oldestThread = Array.from(this.threads.values())
                .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))[0];
            await this.deleteThread({ threadId: oldestThread.id });
        }

        this.threads.set(thread.id, thread);
        return thread;
    }

    async getThread({ threadId }: GetThreadParams): Promise<Thread | undefined> {
        return this.threads.get(threadId);
    }

    async getAllThreads(): Promise<Thread[]> {
        return Array.from(this.threads.values())
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }

    async updateThread({ threadId, title, metadata }: UpdateThreadParams): Promise<Thread | undefined> {
        const thread = this.threads.get(threadId);
        if (!thread) return undefined;

        const updatedThread: Thread = {
            ...thread,
            ...(title && { title }),
            ...(metadata && { metadata }),
            updatedAt: new Date().toISOString()
        };

        this.threads.set(threadId, updatedThread);
        return updatedThread;
    }

    async deleteThread({ threadId }: DeleteThreadParams): Promise<boolean> {
        const threadMessages = await this.getThreadMessages({ threadId });
        threadMessages.forEach(msg => this.messages.delete(msg.id));
        return this.threads.delete(threadId);
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

        await this.updateThread({ threadId });

        const threadMessages = await this.getThreadMessages({ threadId });
        if (threadMessages.length >= this.maxMessagesPerThread) {
            const oldestMessage = threadMessages[0];
            this.messages.delete(oldestMessage.id);
        }

        this.messages.set(message.id, message);
        return message;
    }

    async getThreadMessages({
        threadId,
        limit,
        role,
        fromTimestamp,
        toTimestamp
    }: GetThreadMessagesParams): Promise<Message[]> {
        let messages = Array.from(this.messages.values())
            .filter(msg => msg.threadId === threadId)
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        if (role) {
            messages = messages.filter(msg => msg.role === role);
        }

        if (fromTimestamp) {
            messages = messages.filter(msg => msg.timestamp >= fromTimestamp);
        }

        if (toTimestamp) {
            messages = messages.filter(msg => msg.timestamp <= toTimestamp);
        }

        if (limit) {
            messages = messages.slice(-limit);
        }

        return messages;
    }

    async searchThreads({ query }: SearchThreadsParams): Promise<Thread[]> {
        const lowercaseQuery = query.toLowerCase();
        return Array.from(this.threads.values())
            .filter(thread =>
                thread.title.toLowerCase().includes(lowercaseQuery) ||
                (thread.metadata && JSON.stringify(thread.metadata).toLowerCase().includes(lowercaseQuery))
            )
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }

    async searchMessages({ query, threadId }: SearchMessagesParams): Promise<Message[]> {
        let messages = Array.from(this.messages.values());

        if (threadId) {
            messages = messages.filter(msg => msg.threadId === threadId);
        }

        return messages
            .filter(msg => msg.content.toLowerCase().includes(query.toLowerCase()))
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }

    async getMessageCount({ threadId }: GetMessageCountParams): Promise<number> {
        if (threadId) {
            const messages = await this.getThreadMessages({ threadId });
            return messages.length;
        }
        return this.messages.size;
    }

    async getThreadCount(): Promise<number> {
        return this.threads.size;
    }

    async clearAll(): Promise<void> {
        this.threads.clear();
        this.messages.clear();
    }
}