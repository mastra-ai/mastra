import type { MastraDBMessage } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { MastraMemory, parseMemoryRequestContext } from '@mastra/core/memory';
import type {
  GetObservationalMemoryRecordsInput,
  MemoryConfig,
  MemoryConfigInternal,
  ObservationalMemoryRecords,
  ObservationalMemorySettings,
  StorageThreadType,
  WorkingMemoryTemplate,
} from '@mastra/core/memory';
import type {
  InputProcessor,
  OutputProcessor,
  ProcessInputArgs,
  ProcessInputStepArgs,
  ProcessOutputResultArgs,
} from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import type {
  ObservationalMemoryRecord,
  StorageCloneThreadInput,
  StorageCloneThreadOutput,
  StorageListMessagesInput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
} from '@mastra/core/storage';

import { PlatformMemoryApiError, PlatformMemoryClient } from './client';
import type {
  MemoryMessage,
  MemoryObservationRecord,
  MemoryMessageInput,
  MemoryProcessorsResult,
  MemoryThread,
  PlatformMemoryClientOptions,
} from './client';

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
    content: {
      format: 2,
      parts: (message.parts?.length
        ? message.parts
        : [{ type: 'text', text: message.content }]) as MastraDBMessage['content']['parts'],
    },
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

/** User/assistant messages with all their parts (tool calls, reasoning, files). System messages are skipped. */
function toApiMessages(messages: MastraDBMessage[]): MemoryMessageInput[] {
  return messages.flatMap((message): MemoryMessageInput[] => {
    if (message.role !== 'user' && message.role !== 'assistant') return [];
    const parts = message.content.parts ?? [];
    const createdAt = new Date(message.createdAt).toISOString();
    const content = textOf(message) || undefined;
    if (!parts.length && !content) return [];
    return [{ id: message.id, role: message.role, content, parts: parts.length ? parts : undefined, createdAt }];
  });
}

function memoryContext(requestContext: RequestContext | undefined, messageList: MessageListLike) {
  const ctx = parseMemoryRequestContext(requestContext);
  if (ctx?.thread?.id) {
    return {
      threadId: ctx.thread.id,
      resourceId: ctx.resourceId ?? ctx.thread.id,
      readOnly: ctx.memoryConfig?.readOnly,
    };
  }
  const info = messageList.serialize().memoryInfo;
  if (info?.threadId) return { threadId: info.threadId, resourceId: info.resourceId ?? info.threadId, readOnly: false };
  return null;
}

/** The hosted service keeps up to this many past generations per request. */
const MAX_OBSERVATION_HISTORY = 50;

function unsupportedObservationRead(id: Uppercase<string>, text: string): MastraError {
  return new MastraError({
    id,
    domain: ErrorDomain.MASTRA_MEMORY,
    category: ErrorCategory.USER,
    details: { status: 400 },
    text,
  });
}

function observationRecordFromApi(record: MemoryObservationRecord): ObservationalMemoryRecord {
  return {
    id: record.id,
    scope: record.scope,
    threadId: record.threadId,
    resourceId: record.resourceId,
    originType: record.originType,
    generationCount: record.generationCount,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    lastObservedAt: record.lastObservedAt ? new Date(record.lastObservedAt) : undefined,
    activeObservations: record.activeObservations ?? '',
    observationTokenCount: record.observationTokenCount,
    totalTokensObserved: record.totalTokensObserved,
    pendingMessageTokens: record.pendingMessageTokens,
    isObserving: record.isObserving,
    isReflecting: record.isReflecting,
    isBufferingObservation: record.isBufferingObservation,
    isBufferingReflection: record.isBufferingReflection,
    // Buffering cursors and engine config stay on the hosted service.
    lastBufferedAtTokens: 0,
    lastBufferedAtTime: null,
    config: {},
  };
}

/**
 * What a read-only run sees of the thread, read through the context route, which writes nothing:
 * observations, the continuation reminder, then the messages not yet observed. Running the hosted
 * processors instead would save messages and start observation.
 */
async function addReadOnlyContext(
  client: PlatformMemoryClient,
  messageList: MessageListLike,
  threadId: string,
  resourceId: string,
) {
  const context = await client.getContext(threadId, resourceId);
  const prompt = context.prompt ?? [
    ...(context.system
      ? [{ id: 'om-system', role: 'system', content: context.system, parts: [], createdAt: new Date(0).toISOString() }]
      : []),
    ...(context.continuation
      ? [
          {
            id: 'om-continuation',
            role: 'user',
            content: context.continuation,
            parts: [],
            createdAt: new Date(0).toISOString(),
          },
        ]
      : []),
    ...context.messages,
  ];
  for (const message of prompt) {
    if (message.role === 'system') messageList.addSystem(message.content, 'memory');
    else messageList.add(messageFromApi(message, threadId, resourceId), 'memory');
  }
}

async function applyResult(
  result: MemoryProcessorsResult,
  agent: Pick<ProcessInputStepArgs, 'messageList' | 'writer' | 'abort' | 'rotateResponseMessageId'>,
) {
  for (const chunk of result.chunks) await agent.writer?.custom(chunk as never);
  for (let i = 0; i < result.rotations; i++) agent.rotateResponseMessageId?.();
  if (result.aborted !== null || !result.messageList) return agent.abort(result.aborted ?? undefined);
  return agent.messageList.deserialize(result.messageList);
}

/**
 * Mastra memory backed by a hosted Platform Memory instance.
 *
 * Observation and reflection run on the Platform: on each input step and on the final output this
 * class sends the serialized message list to the instance's memory processors and applies the
 * result. Messages are stored with all their parts (text, tool calls, reasoning, files).
 */
export class PlatformMemory extends MastraMemory {
  readonly client: PlatformMemoryClient;

  constructor(options: PlatformMemoryOptions = {}) {
    super({ id: options.id ?? 'platform-memory', name: 'PlatformMemory' });
    this.client = options.client ?? new PlatformMemoryClient(options);
  }

  // The instance runs the real @mastra/memory processors; these only ship the message list
  // there and apply what comes back (list, stream parts, message-id rotations, abort).
  async getInputProcessors(): Promise<InputProcessor[]> {
    const client = this.client;
    return [
      {
        id: 'platform-memory',
        name: 'Platform Memory',
        async processInputStep({
          messageList,
          requestContext,
          stepNumber,
          model,
          writer,
          abort,
          abortSignal,
          rotateResponseMessageId,
        }: ProcessInputStepArgs) {
          const ctx = memoryContext(requestContext, messageList);
          if (!ctx) return messageList;
          if (ctx.readOnly) {
            if (stepNumber === 0) {
              await addReadOnlyContext(client, messageList, ctx.threadId, ctx.resourceId);
            }
            return messageList;
          }
          const result = await client.runProcessors(
            ctx.threadId,
            {
              phase: 'inputStep',
              resourceId: ctx.resourceId,
              stepNumber,
              messageList: messageList.serialize(),
              model: model ? { provider: model.provider, modelId: model.modelId } : undefined,
            },
            abortSignal,
          );
          const list = await applyResult(result, { messageList, writer, abort, rotateResponseMessageId });
          return list;
        },
      },
    ];
  }

  async getOutputProcessors(): Promise<OutputProcessor[]> {
    const client = this.client;
    return [
      {
        id: 'platform-memory',
        name: 'Platform Memory',
        async processOutputResult({ messageList, requestContext, result, writer, abort }: ProcessOutputResultArgs) {
          const ctx = memoryContext(requestContext, messageList);
          if (!ctx || ctx.readOnly) return messageList;
          // No abortSignal here: this call saves the turn's messages, and aborting mid-save can lose them.
          const res = await client.runProcessors(ctx.threadId, {
            phase: 'output',
            resourceId: ctx.resourceId,
            messageList: messageList.serialize(),
            finishReason: result?.finishReason,
          });
          return applyResult(res, { messageList, writer, abort });
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
    const threads: StorageThreadType[] = [];
    for (let next = 0; ; next++) {
      const res = await this.client.listThreads({ resourceId: args.filter?.resourceId, page: next, perPage: 200 });
      threads.push(...res.threads.map(threadFromApi));
      if (!res.hasMore) break;
    }
    const filtered = threads.filter(thread =>
      Object.entries(args.filter?.metadata ?? {}).every(([key, value]) => thread.metadata?.[key] === value),
    );
    const field = args.orderBy?.field ?? 'updatedAt';
    const direction = args.orderBy?.direction === 'ASC' ? 1 : -1;
    filtered.sort((a, b) => direction * (a[field].getTime() - b[field].getTime()));
    const selected = args.perPage === false ? filtered : filtered.slice(page * perPage, (page + 1) * perPage);
    return {
      threads: selected,
      hasMore: args.perPage === false ? false : (page + 1) * perPage < filtered.length,
      page,
      perPage: args.perPage === false ? (false as const) : perPage,
      total: filtered.length,
    };
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
    const threadIds = Array.isArray(args.threadId) ? args.threadId : [args.threadId];
    if (!threadIds.length || threadIds.some(id => !id)) throw new Error('PlatformMemory.recall requires a threadId');
    if (Object.keys(args.filter?.metadata ?? {}).length || args.include?.length) {
      throw new Error('PlatformMemory.recall does not support metadata filters or include windows');
    }
    const page = args.page ?? 0;
    const perPage = args.perPage === false ? 200 : (args.perPage ?? 40);
    const messages: MastraDBMessage[] = [];
    for (const threadId of threadIds) {
      const thread = await this.client.getThread(threadId);
      if (!thread || (args.resourceId && thread.resourceId !== args.resourceId)) continue;
      const resourceId = thread.resourceId;
      for (let next = 0; ; next++) {
        const res = await this.client.listMessages(threadId, { page: next, perPage: 200 });
        messages.push(...res.messages.map(message => messageFromApi(message, threadId, resourceId)));
        if (!res.hasMore) break;
      }
    }
    const { start, end, startExclusive, endExclusive } = args.filter?.dateRange ?? {};
    const filtered = messages.filter(message => {
      const timestamp = message.createdAt.getTime();
      return (
        (!start || (startExclusive ? timestamp > start.getTime() : timestamp >= start.getTime())) &&
        (!end || (endExclusive ? timestamp < end.getTime() : timestamp <= end.getTime()))
      );
    });
    const direction = args.orderBy?.direction === 'DESC' ? -1 : 1;
    filtered.sort((a, b) => direction * (a.createdAt.getTime() - b.createdAt.getTime()));
    const selected = args.perPage === false ? filtered : filtered.slice(page * perPage, (page + 1) * perPage);
    return {
      messages: selected,
      total: filtered.length,
      page,
      perPage: args.perPage === false ? (false as const) : perPage,
      hasMore: args.perPage === false ? false : (page + 1) * perPage < filtered.length,
    };
  }

  async getWorkingMemory(): Promise<string | null> {
    throw new Error('PlatformMemory does not support working memory');
  }

  async getWorkingMemoryTemplate(): Promise<WorkingMemoryTemplate | null> {
    return null;
  }

  async updateWorkingMemory(): Promise<void> {
    throw new Error('PlatformMemory does not support working memory');
  }

  async __experimental_updateWorkingMemoryVNext(): Promise<{ success: boolean; reason: string }> {
    throw new Error('PlatformMemory does not support working memory');
  }

  async deleteMessages(): Promise<void> {
    throw new Error('PlatformMemory does not support deleting individual messages yet');
  }

  async cloneThread(_args: StorageCloneThreadInput): Promise<StorageCloneThreadOutput> {
    throw new Error('PlatformMemory does not support cloning threads yet');
  }

  /** Observational Memory always runs on the hosted service, scoped to the thread. */
  async getObservationalMemoryConfig(): Promise<ObservationalMemorySettings> {
    const config = await this.client.getInstanceConfig();
    return {
      enabled: true,
      scope: 'thread',
      messageTokens: config.observationTokens,
      observationTokens: config.reflectionTokens,
    };
  }

  async waitForObservationalMemoryBuffering(args: { threadId: string; resourceId: string }) {
    const status = await this.client.waitForBuffering(args.threadId);
    if (status === 'idle') return { record: null };
    const { record } = await this.getObservationalMemoryRecords(args);
    return { record };
  }

  /**
   * Reads a thread's hosted record and an optional filtered page of history.
   */
  async getObservationalMemoryRecords(args: GetObservationalMemoryRecordsInput): Promise<ObservationalMemoryRecords> {
    if (!args.threadId) {
      throw unsupportedObservationRead(
        'PLATFORM_MEMORY_OBSERVATIONS_THREAD_ID_REQUIRED',
        'PlatformMemory reads Observational Memory per thread; pass a threadId',
      );
    }
    if (args.historyLimit !== undefined && args.historyLimit > MAX_OBSERVATION_HISTORY) {
      throw unsupportedObservationRead(
        'PLATFORM_MEMORY_OBSERVATIONS_HISTORY_LIMIT',
        `PlatformMemory returns at most ${MAX_OBSERVATION_HISTORY} Observational Memory history records`,
      );
    }

    let result;
    try {
      result = await this.client.getObservationRecords(args.threadId, {
        historyLimit: args.historyLimit,
        from: args.from?.toISOString(),
        to: args.to?.toISOString(),
        offset: args.offset,
      });
    } catch (error) {
      // The thread is gone, so it has no observations.
      if (error instanceof PlatformMemoryApiError && error.status === 404) return { record: null, history: [] };
      throw error;
    }
    const owned = (record: MemoryObservationRecord) => !args.resourceId || record.resourceId === args.resourceId;
    return {
      record: result.record && owned(result.record) ? observationRecordFromApi(result.record) : null,
      history: result.history.filter(owned).map(observationRecordFromApi),
    };
  }
}
