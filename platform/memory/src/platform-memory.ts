import type { MastraDBMessage } from '@mastra/core/agent';
import { MastraMemory, parseMemoryRequestContext } from '@mastra/core/memory';
import type { MemoryConfig, MemoryConfigInternal, StorageThreadType, WorkingMemoryTemplate } from '@mastra/core/memory';
import type { InputProcessor, OutputProcessor, ProcessInputArgs, ProcessOutputResultArgs } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import type {
  StorageCloneThreadInput,
  StorageCloneThreadOutput,
  StorageListMessagesInput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
} from '@mastra/core/storage';

import { PlatformMemoryClient } from './client';
import type { MemoryMessage, MemoryMessageInput, MemoryThread, PlatformMemoryClientOptions } from './client';

export type PlatformMemoryOptions = PlatformMemoryClientOptions & {
  id?: string;
  /** Use a preconfigured client instead of building one from the options above. */
  client?: PlatformMemoryClient;
};

type MessageListLike = ProcessInputArgs['messageList'];

function threadFromApi(thread: MemoryThread): StorageThreadType {
  return {
    id: thread.id,
    resourceId: thread.resourceId,
    title: thread.title ?? undefined,
    metadata: thread.metadata ?? undefined,
    createdAt: new Date(thread.createdAt),
    updatedAt: new Date(thread.updatedAt),
  };
}

function messageFromApi(message: MemoryMessage, threadId: string, resourceId?: string): MastraDBMessage {
  return {
    id: message.id,
    role: message.role === 'assistant' ? 'assistant' : 'user',
    createdAt: new Date(message.createdAt),
    threadId,
    resourceId,
    content: { format: 2, parts: [{ type: 'text', text: message.content }] },
  };
}

function textOf(message: MastraDBMessage): string {
  const parts = message.content.parts ?? [];
  const text = parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map(part => part.text)
    .join('\n');
  return text || message.content.content || '';
}

/** Messages the Memory API can store: user/assistant text. Tool-only and system messages are skipped. */
function toApiMessages(messages: MastraDBMessage[]): MemoryMessageInput[] {
  return messages.flatMap(message => {
    if (message.role !== 'user' && message.role !== 'assistant') return [];
    const content = textOf(message);
    if (!content) return [];
    return [{ id: message.id, role: message.role, content, createdAt: new Date(message.createdAt).toISOString() }];
  });
}

function memoryContext(requestContext: RequestContext | undefined, messageList: MessageListLike) {
  const ctx = parseMemoryRequestContext(requestContext);
  if (ctx?.thread?.id) {
    return { threadId: ctx.thread.id, resourceId: ctx.resourceId ?? ctx.thread.id, readOnly: ctx.memoryConfig?.readOnly };
  }
  const info = messageList.serialize().memoryInfo;
  if (info?.threadId) return { threadId: info.threadId, resourceId: info.resourceId ?? info.threadId, readOnly: false };
  return null;
}

/**
 * Mastra memory backed by a hosted Platform Memory instance.
 *
 * Observation and reflection run on the Platform; this class loads the rendered
 * observations plus the unobserved message tail before each generation and writes
 * new messages back afterwards. Only text content is stored.
 */
export class PlatformMemory extends MastraMemory {
  readonly client: PlatformMemoryClient;

  constructor(options: PlatformMemoryOptions = {}) {
    super({ id: options.id ?? 'platform-memory', name: 'PlatformMemory' });
    this.client = options.client ?? new PlatformMemoryClient(options);
  }

  async getInputProcessors(): Promise<InputProcessor[]> {
    const client = this.client;
    return [
      {
        id: 'platform-memory-context',
        name: 'Platform Memory context',
        async processInput({ messageList, requestContext }: ProcessInputArgs) {
          const ctx = memoryContext(requestContext, messageList);
          if (!ctx) return messageList;
          const context = await client.getContext(ctx.threadId, ctx.resourceId);
          if (context.system) messageList.addSystem(context.system, 'memory');
          for (const message of context.messages) {
            messageList.add(messageFromApi(message, ctx.threadId, ctx.resourceId), 'memory');
          }
          return messageList;
        },
      },
    ];
  }

  async getOutputProcessors(): Promise<OutputProcessor[]> {
    const client = this.client;
    return [
      {
        id: 'platform-memory-save',
        name: 'Platform Memory save',
        async processOutputResult({ messageList, requestContext, result }: ProcessOutputResultArgs) {
          const ctx = memoryContext(requestContext, messageList);
          if (!ctx || ctx.readOnly) return messageList;
          const output = messageList.get.response.db();
          // Don't persist an input-only failed turn; it would orphan the user message.
          if (result?.finishReason === 'error' && output.length === 0) return messageList;
          const messages = toApiMessages([...messageList.get.input.db(), ...output]);
          if (messages.length) await client.saveMessages(ctx.threadId, { resourceId: ctx.resourceId, messages });
          return messageList;
        },
      },
    ];
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    const thread = await this.client.getThread(threadId);
    return thread ? threadFromApi(thread) : null;
  }

  async listThreads(args: StorageListThreadsInput): Promise<StorageListThreadsOutput> {
    const page = args.page ?? 0;
    const perPage = args.perPage === false ? 200 : (args.perPage ?? 100);
    const res = await this.client.listThreads({ resourceId: args.filter?.resourceId, page, perPage });
    return { threads: res.threads.map(threadFromApi), hasMore: res.hasMore, page, perPage, total: res.threads.length };
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    const existing = await this.client.getThread(thread.id);
    const saved = existing
      ? await this.client.updateThread(thread.id, { title: thread.title, metadata: thread.metadata })
      : await this.client.createThread({
          id: thread.id,
          resourceId: thread.resourceId,
          title: thread.title,
          metadata: thread.metadata,
        });
    return threadFromApi(saved);
  }

  async updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title?: string;
    metadata?: Record<string, unknown>;
    memoryConfig?: MemoryConfigInternal;
  }): Promise<StorageThreadType> {
    return threadFromApi(await this.client.updateThread(id, { title, metadata }));
  }

  async deleteThread(threadId: string): Promise<void> {
    await this.client.deleteThread(threadId);
  }

  async saveMessages(args: {
    messages: MastraDBMessage[];
    memoryConfig?: MemoryConfig;
  }): Promise<{ messages: MastraDBMessage[] }> {
    const byThread = new Map<string, MastraDBMessage[]>();
    for (const message of args.messages) {
      if (!message.threadId) continue;
      byThread.set(message.threadId, [...(byThread.get(message.threadId) ?? []), message]);
    }
    for (const [threadId, messages] of byThread) {
      const apiMessages = toApiMessages(messages);
      if (!apiMessages.length) continue;
      const resourceId = messages[0]!.resourceId ?? threadId;
      await this.client.saveMessages(threadId, { resourceId, messages: apiMessages });
    }
    return { messages: args.messages };
  }

  async recall(args: StorageListMessagesInput) {
    const threadId = Array.isArray(args.threadId) ? args.threadId[0] : args.threadId;
    if (!threadId) throw new Error('PlatformMemory.recall requires a threadId');
    const page = args.page ?? 0;
    const perPage = args.perPage === false ? 200 : (args.perPage ?? 40);
    const res = await this.client.listMessages(threadId, { page, perPage });
    const messages = res.messages.map(message => messageFromApi(message, threadId, args.resourceId));
    return { messages, total: messages.length, page, perPage, hasMore: res.hasMore };
  }

  async getWorkingMemory({ threadId, resourceId }: { threadId: string; resourceId?: string }): Promise<string | null> {
    return this.client.getWorkingMemory(resourceId ?? threadId);
  }

  async getWorkingMemoryTemplate(): Promise<WorkingMemoryTemplate | null> {
    return null;
  }

  async updateWorkingMemory({
    threadId,
    resourceId,
    workingMemory,
  }: {
    threadId: string;
    resourceId?: string;
    workingMemory: string;
  }): Promise<void> {
    await this.client.updateWorkingMemory(resourceId ?? threadId, workingMemory);
  }

  async __experimental_updateWorkingMemoryVNext(args: {
    threadId: string;
    resourceId?: string;
    workingMemory: string;
  }): Promise<{ success: boolean; reason: string }> {
    await this.updateWorkingMemory(args);
    return { success: true, reason: 'replaced' };
  }

  async deleteMessages(): Promise<void> {
    throw new Error('PlatformMemory does not support deleting individual messages yet');
  }

  async cloneThread(_args: StorageCloneThreadInput): Promise<StorageCloneThreadOutput> {
    throw new Error('PlatformMemory does not support cloning threads yet');
  }
}
