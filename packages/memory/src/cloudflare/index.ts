import {
    MastraMemory, Thread, Message, CreateThreadParams, GetThreadParams,
    UpdateThreadParams, DeleteThreadParams, WriteMessageParams,
    GetThreadMessagesParams, SearchThreadsParams, SearchMessagesParams,
    GetMessageCountParams
} from '@mastra/core';

import type { KVNamespace } from '@cloudflare/workers-types';

export class CloudflareKVMemory extends MastraMemory {
    private namespace: KVNamespace;
    private readonly threadPrefix = 'thread:';
    private readonly messagePrefix = 'msg:';
    private readonly threadListKey = 'threadList';
    private readonly threadMessagesPrefix = 'thread-msgs:';

    constructor(namespace: KVNamespace, options = {}) {
        super(options);
        this.namespace = namespace;
    }

    private getThreadKey(threadId: string): string {
        return `${this.threadPrefix}${threadId}`;
    }

    private getMessageKey(messageId: string): string {
        return `${this.messagePrefix}${messageId}`;
    }

    private getThreadMessagesKey(threadId: string): string {
        return `${this.threadMessagesPrefix}${threadId}`;
    }

    async createThread(params: CreateThreadParams): Promise<Thread> {
        const threadCount = await this.getThreadCount();
        if (threadCount >= this.maxThreads) {
            throw new Error(`Maximum thread limit (${this.maxThreads}) reached`);
        }

        const thread: Thread = {
            id: this.generateId(),
            title: params.title,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            metadata: params.metadata
        };

        // Store the thread
        await this.namespace.put(
            this.getThreadKey(thread.id),
            JSON.stringify(thread)
        );

        // Update thread list
        const threadList = await this.getThreadList();
        threadList.push({
            id: thread.id,
            timestamp: Date.now()
        });
        await this.namespace.put(
            this.threadListKey,
            JSON.stringify(threadList)
        );

        return thread;
    }

    private async getThreadList(): Promise<Array<{ id: string; timestamp: number }>> {
        const list = await this.namespace.get(this.threadListKey);
        return list ? JSON.parse(list) : [];
    }

    async getThread(params: GetThreadParams): Promise<Thread | undefined> {
        const threadJson = await this.namespace.get(this.getThreadKey(params.threadId));
        return threadJson ? JSON.parse(threadJson) : undefined;
    }

    async getAllThreads(): Promise<Thread[]> {
        const threadList = await this.getThreadList();
        const threads = await Promise.all(
            threadList.map(({ id }) => this.getThread({ threadId: id }))
        );
        return threads.filter((thread): thread is Thread => thread !== undefined);
    }

    async updateThread(params: UpdateThreadParams): Promise<Thread | undefined> {
        const existingThread = await this.getThread({ threadId: params.threadId });
        if (!existingThread) return undefined;

        const updatedThread: Thread = {
            ...existingThread,
            title: params.title || existingThread.title,
            metadata: params.metadata || existingThread.metadata,
            updatedAt: new Date().toISOString()
        };

        await this.namespace.put(
            this.getThreadKey(params.threadId),
            JSON.stringify(updatedThread)
        );

        return updatedThread;
    }

    async deleteThread(params: DeleteThreadParams): Promise<boolean> {
        // Get thread messages
        const threadMessagesJson = await this.namespace.get(
            this.getThreadMessagesKey(params.threadId)
        );
        const threadMessages = threadMessagesJson ? JSON.parse(threadMessagesJson) : [];

        // Delete all messages
        await Promise.all(
            threadMessages.map(({ id }: { id: string }) =>
                this.namespace.delete(this.getMessageKey(id))
            )
        );

        // Delete thread messages list
        await this.namespace.delete(this.getThreadMessagesKey(params.threadId));

        // Delete thread
        await this.namespace.delete(this.getThreadKey(params.threadId));

        // Update thread list
        const threadList = await this.getThreadList();
        const updatedThreadList = threadList.filter(t => t.id !== params.threadId);
        await this.namespace.put(
            this.threadListKey,
            JSON.stringify(updatedThreadList)
        );

        return true;
    }

    async writeMessage(params: WriteMessageParams): Promise<Message | undefined> {
        const thread = await this.getThread({ threadId: params.threadId });
        if (!thread) return undefined;

        const messageCount = await this.getMessageCount({ threadId: params.threadId });
        if (messageCount >= this.maxMessagesPerThread) {
            throw new Error(`Maximum messages per thread (${this.maxMessagesPerThread}) reached`);
        }

        const message: Message = {
            id: this.generateId(),
            threadId: params.threadId,
            role: params.role,
            content: params.content,
            timestamp: new Date().toISOString(),
            metadata: params.metadata
        };

        // Store the message
        await this.namespace.put(
            this.getMessageKey(message.id),
            JSON.stringify(message)
        );

        // Update thread messages list
        const threadMessagesKey = this.getThreadMessagesKey(params.threadId);
        const threadMessagesJson = await this.namespace.get(threadMessagesKey);
        const threadMessages = threadMessagesJson ? JSON.parse(threadMessagesJson) : [];

        threadMessages.push({
            id: message.id,
            timestamp: Date.now(),
            role: message.role
        });

        await this.namespace.put(
            threadMessagesKey,
            JSON.stringify(threadMessages)
        );

        // Update thread
        await this.updateThread({
            threadId: params.threadId,
            metadata: thread.metadata
        });

        return message;
    }

    async getThreadMessages(params: GetThreadMessagesParams): Promise<Message[]> {
        const threadMessagesJson = await this.namespace.get(
            this.getThreadMessagesKey(params.threadId)
        );

        if (!threadMessagesJson) return [];

        let messageList = JSON.parse(threadMessagesJson);

        // Apply filters
        if (params.fromTimestamp || params.toTimestamp) {
            messageList = messageList.filter(({ timestamp }: { timestamp: number }) => {
                if (params.fromTimestamp && timestamp < new Date(params.fromTimestamp).getTime()) return false;
                if (params.toTimestamp && timestamp > new Date(params.toTimestamp).getTime()) return false;
                return true;
            });
        }

        if (params.role) {
            messageList = messageList.filter(({ role }: { role: string }) => role === params.role);
        }

        // Apply limit
        if (params.limit) {
            messageList = messageList.slice(-params.limit);
        }

        // Fetch actual messages
        const messages = await Promise.all(
            messageList.map(({ id }: { id: string }) =>
                this.namespace.get(this.getMessageKey(id)).then((json: any) => json ? JSON.parse(json) : null)
            )
        );

        return messages.filter((msg): msg is Message => msg !== null);
    }

    async searchThreads(params: SearchThreadsParams): Promise<Thread[]> {
        const threads = await this.getAllThreads();
        const searchTerms = params.query.toLowerCase().split(' ');

        return threads.filter(thread => {
            const searchText = `${thread.title} ${JSON.stringify(thread.metadata)}`.toLowerCase();
            return searchTerms.every(term => searchText.includes(term));
        });
    }

    async searchMessages(params: SearchMessagesParams): Promise<Message[]> {
        const searchTerms = params.query.toLowerCase().split(' ');
        let messages: Message[] = [];

        if (params.threadId) {
            messages = await this.getThreadMessages({
                threadId: params.threadId
            });
        } else {
            const threads = await this.getAllThreads();
            for (const thread of threads) {
                const threadMessages = await this.getThreadMessages({
                    threadId: thread.id
                });
                messages.push(...threadMessages);
            }
        }

        return messages.filter(message => {
            const searchText = `${message.content} ${JSON.stringify(message.metadata)}`.toLowerCase();
            return searchTerms.every(term => searchText.includes(term));
        });
    }

    async getMessageCount(params: GetMessageCountParams): Promise<number> {
        if (params.threadId) {
            const threadMessagesJson = await this.namespace.get(
                this.getThreadMessagesKey(params.threadId)
            );
            return threadMessagesJson ? JSON.parse(threadMessagesJson).length : 0;
        }

        const threads = await this.getAllThreads();
        let totalCount = 0;

        for (const thread of threads) {
            const count = await this.getMessageCount({ threadId: thread.id });
            totalCount += count;
        }

        return totalCount;
    }

    async getThreadCount(): Promise<number> {
        const threadList = await this.getThreadList();
        return threadList.length;
    }

    async clearAll(): Promise<void> {
        const threads = await this.getAllThreads();
        await Promise.all(threads.map(thread =>
            this.deleteThread({ threadId: thread.id })
        ));
        await this.namespace.delete(this.threadListKey);
    }
}