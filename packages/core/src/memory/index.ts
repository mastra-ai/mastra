// Types and Interfaces
export interface Message {
    id: string;
    threadId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    metadata?: Record<string, any>;
}

export interface Thread {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, any>;
}

export interface MemoryOptions {
    maxThreads?: number;
    maxMessagesPerThread?: number;
}

export interface CreateThreadParams {
    title: string;
    metadata?: Record<string, any>;
}

export interface GetThreadParams {
    threadId: string;
}

export interface UpdateThreadParams {
    threadId: string;
    title?: string;
    metadata?: Record<string, any>;
}

export interface DeleteThreadParams {
    threadId: string;
}

export interface WriteMessageParams {
    threadId: string;
    role: Message['role'];
    content: string;
    metadata?: Record<string, any>;
}

export interface GetThreadMessagesParams {
    threadId: string;
    limit?: number;
    role?: Message['role'];
    fromTimestamp?: string;
    toTimestamp?: string;
}

export interface SearchThreadsParams {
    query: string;
}

export interface SearchMessagesParams {
    query: string;
    threadId?: string;
}

export interface GetMessageCountParams {
    threadId?: string;
}

// Abstract base class
export abstract class MastraMemory {
    protected maxThreads: number;
    protected maxMessagesPerThread: number;

    constructor(options: MemoryOptions = {}) {
        this.maxThreads = options.maxThreads || 100;
        this.maxMessagesPerThread = options.maxMessagesPerThread || 1000;
    }

    protected generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Abstract methods
    abstract createThread(params: CreateThreadParams): Promise<Thread>;
    abstract getThread(params: GetThreadParams): Promise<Thread | undefined>;
    abstract getAllThreads(): Promise<Thread[]>;
    abstract updateThread(params: UpdateThreadParams): Promise<Thread | undefined>;
    abstract deleteThread(params: DeleteThreadParams): Promise<boolean>;

    abstract writeMessage(params: WriteMessageParams): Promise<Message | undefined>;
    abstract getThreadMessages(params: GetThreadMessagesParams): Promise<Message[]>;
    abstract searchThreads(params: SearchThreadsParams): Promise<Thread[]>;
    abstract searchMessages(params: SearchMessagesParams): Promise<Message[]>;
    abstract getMessageCount(params: GetMessageCountParams): Promise<number>;
    abstract getThreadCount(): Promise<number>;
    abstract clearAll(): Promise<void>;
}
