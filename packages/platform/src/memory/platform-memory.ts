import type { MastraDBMessage } from '@mastra/core/agent';
import { MastraMemory, parseMemoryRequestContext } from '@mastra/core/memory';
import type {
  MemoryConfig,
  MemoryConfigInternal,
  ObservationalMemoryInspector,
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
import { createTool } from '@mastra/core/tools';
import type { ToolAction } from '@mastra/core/tools';

import { z } from 'zod';

import { PlatformMemoryApiError, PlatformMemoryClient } from './client';
import type {
  MemoryMessage,
  MemoryMessageInput,
  MemoryObservationRecord,
  MemoryProcessorsResult,
  MemoryThread,
  PlatformMemoryClientOptions,
} from './client';

export type PlatformMemoryOptions = PlatformMemoryClientOptions & {
  id?: string;
  /** Use a preconfigured client instead of building one from the options above. */
  client?: PlatformMemoryClient;
  /**
   * How working memory is shown to the model. Defaults to `readonly`;
   * `tool` also gives the agent an `updateWorkingMemory` tool; `off` omits it.
   */
  workingMemory?: 'readonly' | 'tool' | 'off';
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
  private readonly workingMemoryMode: 'readonly' | 'tool' | 'off';

  constructor(options: PlatformMemoryOptions = {}) {
    super({ id: options.id ?? 'platform-memory', name: 'PlatformMemory' });
    this.client = options.client ?? new PlatformMemoryClient(options);
    this.workingMemoryMode = options.workingMemory ?? 'readonly';
  }

  listTools(config?: MemoryConfig): Record<string, ToolAction<any, any, any, any, any>> {
    if (this.workingMemoryMode !== 'tool' || config?.readOnly) return {};
    this.assertResourceScopedWorkingMemory(config);
    const client = this.client;
    return {
      updateWorkingMemory: createTool({
        id: 'update-working-memory',
        description:
          'Update the working memory with new information. Any data not included will be overwritten. Always pass data as string to the memory field. Never pass an object.',
        inputSchema: z.object({
          memory: z.string().describe('The Markdown formatted working memory content to store.'),
        }),
        execute: async ({ memory }, context) => {
          const resourceId = context?.agent?.resourceId ?? context?.agent?.threadId;
          if (!resourceId) throw new Error('updateWorkingMemory needs a thread or resource');
          await client.updateWorkingMemory(resourceId, memory);
          return { success: true };
        },
      }),
    };
  }

  /** Observational Memory runs on the Platform instance; this reports it to Studio from there. */
  override getObservationalMemoryInspector(): ObservationalMemoryInspector {
    const client = this.client;
    const workingMemory = this.workingMemoryMode;
    const getRecord: ObservationalMemoryInspector['getRecord'] = async ({ threadId, historyLimit }) => {
      // Platform OM is thread-scoped; there is no resource-level record.
      if (!threadId) return { record: null };
      const res = await client.getObservationHistory(threadId, { historyLimit });
      return {
        record: res.record ? toObservationalMemoryRecord(res.record, threadId) : null,
        history: res.history?.map(r => toObservationalMemoryRecord(r, threadId)),
      };
    };
    return {
      kind: 'platform',
      async getConfig() {
        const config = await client.getInstanceConfig().catch(error => {
          // Servers before the instance config route: report the Platform defaults.
          if (error instanceof PlatformMemoryApiError && error.status === 404) {
            return { observationTokens: 30_000, reflectionTokens: 40_000 };
          }
          throw error;
        });
        return {
          scope: 'thread',
          messageTokens: config.observationTokens,
          observationTokens: config.reflectionTokens,
        };
      },
      // History is assembled on the Platform from unobserved messages, not a recent-message
      // window, and there is no semantic recall.
      getDisplayConfig: () => ({
        lastMessages: false,
        semanticRecall: false,
        workingMemory: { enabled: workingMemory !== 'off' },
      }),
      getRecord,
      // Buffering runs on the Platform; poll its record until the flags clear (30s cap).
      async waitForBuffering({ threadId, resourceId }) {
        const deadline = Date.now() + 30_000;
        while (Date.now() < deadline) {
          const { record } = await getRecord({ threadId, resourceId });
          if (!record || (!record.isBufferingObservation && !record.isBufferingReflection)) return;
          await new Promise(resolve => setTimeout(resolve, 1_000));
        }
      },
    };
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
          if (!ctx || ctx.readOnly) return messageList;
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
          return applyResult(result, { messageList, writer, abort, rotateResponseMessageId });
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

  // Hosted working memory is keyed by resource only, so thread scope would silently be shared
  // across every thread of the same resource.
  private assertResourceScopedWorkingMemory(config?: MemoryConfig | MemoryConfigInternal): void {
    if (this.getMergedThreadConfig(config ?? {}).workingMemory?.scope === 'thread') {
      throw new Error('PlatformMemory does not support thread-scoped working memory');
    }
  }

  async getWorkingMemory({
    threadId,
    resourceId,
    memoryConfig,
  }: {
    threadId: string;
    resourceId?: string;
    memoryConfig?: MemoryConfigInternal;
  }): Promise<string | null> {
    this.assertResourceScopedWorkingMemory(memoryConfig);
    return this.client.getWorkingMemory(resourceId ?? threadId);
  }

  async getWorkingMemoryTemplate(): Promise<WorkingMemoryTemplate | null> {
    return null;
  }

  async updateWorkingMemory({
    threadId,
    resourceId,
    workingMemory,
    memoryConfig,
  }: {
    threadId: string;
    resourceId?: string;
    workingMemory: string;
    memoryConfig?: MemoryConfigInternal;
  }): Promise<void> {
    this.assertResourceScopedWorkingMemory(memoryConfig);
    await this.client.updateWorkingMemory(resourceId ?? threadId, workingMemory);
  }

  async __experimental_updateWorkingMemoryVNext(args: {
    threadId: string;
    resourceId?: string;
    workingMemory: string;
    memoryConfig?: MemoryConfigInternal;
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

function toObservationalMemoryRecord(r: MemoryObservationRecord, threadId: string): ObservationalMemoryRecord {
  const at = (v: string | null | undefined) => (v ? new Date(v) : undefined);
  const lastObservedAt = at(r.lastObservedAt);
  return {
    id: r.id ?? threadId,
    scope: r.scope ?? 'thread',
    threadId: r.threadId ?? threadId,
    resourceId: r.resourceId ?? '',
    createdAt: at(r.createdAt) ?? lastObservedAt ?? new Date(0),
    updatedAt: at(r.updatedAt) ?? lastObservedAt ?? new Date(0),
    lastObservedAt,
    originType: (r.originType ?? 'initial') as 'initial' | 'reflection',
    generationCount: r.generationCount ?? 0,
    activeObservations: r.activeObservations ?? '',
    totalTokensObserved: r.totalTokensObserved ?? 0,
    observationTokenCount: r.observationTokenCount ?? 0,
    pendingMessageTokens: r.pendingMessageTokens ?? 0,
    isObserving: r.isObserving ?? false,
    isReflecting: r.isReflecting ?? false,
    isBufferingObservation: r.isBufferingObservation ?? false,
    isBufferingReflection: r.isBufferingReflection ?? false,
    // Buffering watermarks stay on the Platform; Studio doesn't read them.
    lastBufferedAtTokens: 0,
    lastBufferedAtTime: null,
    config: {},
  };
}
