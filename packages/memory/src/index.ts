import { embedMany } from '@internal/ai-sdk-v4';
import type { TextPart } from '@internal/ai-sdk-v4';
import { embedMany as embedManyV5 } from '@internal/ai-sdk-v5';
import { embedMany as embedManyV6 } from '@internal/ai-v6';
import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';

import { coreFeatures } from '@mastra/core/features';
import type { Mastra } from '@mastra/core/mastra';
import { MastraMemory } from '@mastra/core/memory';
import type {
  MemoryConfigInternal,
  SharedMemoryConfig,
  StorageThreadType,
  WorkingMemoryTemplate,
  MessageDeleteInput,
  ObservationalMemoryOptions,
  MemoryConfig,
} from '@mastra/core/memory';
import { SpanType, EntityType } from '@mastra/core/observability';
import type { ObservabilityContext, MemoryOperationAttributes } from '@mastra/core/observability';
import type {
  InputProcessor,
  InputProcessorOrWorkflow,
  OutputProcessor,
  OutputProcessorOrWorkflow,
} from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import type {
  StorageListThreadsInput,
  StorageListThreadsOutput,
  StorageListMessagesInput,
  MemoryStorage,
  StorageCloneThreadInput,
  StorageCloneThreadOutput,
  ThreadCloneMetadata,
  ObservationalMemoryRecord,
  BufferedObservationChunk,
} from '@mastra/core/storage';
import type { ToolAction } from '@mastra/core/tools';
import { generateEmptyFromSchema } from '@mastra/core/utils';
import type { VectorFilter } from '@mastra/core/vector';
import { isStandardSchemaWithJSON, toStandardSchema } from '@mastra/schema-compat/schema';
import { Mutex } from 'async-mutex';
import type { JSONSchema7 } from 'json-schema';
import xxhash from 'xxhash-wasm';
import type { ObservationalMemory, ObservationalMemoryConfig } from './processors/observational-memory';
import { recallTool } from './tools/om-tools';
import {
  updateWorkingMemoryTool,
  __experimental_updateWorkingMemoryToolVNext,
  deepMergeWorkingMemory,
} from './tools/working-memory';

export {
  ModelByInputTokens,
  type ModelByInputTokensConfig,
} from './processors/observational-memory/model-by-input-tokens';

/**
 * Normalize a `boolean | object` observational memory config.
 * Returns the options object if enabled, undefined if disabled.
 * Inlined here to avoid importing runtime exports that don't exist on older @mastra/core versions.
 */
type MemoryObservationalMemoryOptions = Omit<ObservationalMemoryOptions, 'model' | 'observation' | 'reflection'> & {
  model?: ObservationalMemoryConfig['model'];
  observation?: ObservationalMemoryConfig['observation'];
  reflection?: ObservationalMemoryConfig['reflection'];
  activateAfterIdle?: ObservationalMemoryConfig['activateAfterIdle'];
  activateOnProviderChange?: ObservationalMemoryConfig['activateOnProviderChange'];
  temporalMarkers?: boolean;
};

type MemoryOptions = Omit<MemoryConfigInternal, 'observationalMemory'> & {
  observationalMemory?: boolean | MemoryObservationalMemoryOptions;
};

type MemoryConstructorConfig = Omit<SharedMemoryConfig, 'options'> & {
  options?: MemoryOptions;
};

type RuntimeMemoryConfig = Omit<MemoryConfig, 'observationalMemory'> & {
  observationalMemory?: boolean | MemoryObservationalMemoryOptions;
};

type NormalizedObservationalMemoryConfig = MemoryObservationalMemoryOptions & {
  retrieval?: boolean | { vector?: boolean; scope?: 'thread' | 'resource' };
};

/*
 * Compatibility note: the working-memory and system-reminder helpers below are
 * intentionally copied from @mastra/core instead of imported from
 * @mastra/core/memory. @mastra/memory's peer range permits older core versions
 * that do not export these newer helper names, and importing them can crash a
 * published memory build during ESM instantiation before user code runs.
 *
 * Until v2 can tighten the peer contract, keep these copies manually in sync
 * with packages/core/src/memory/working-memory-utils.ts and
 * packages/core/src/memory/system-reminders.ts. Those source files also carry
 * compatibility notes that point back here.
 */
const WORKING_MEMORY_START_TAG = '<working_memory>';
const WORKING_MEMORY_END_TAG = '</working_memory>';
const LEGACY_SYSTEM_REMINDER_METADATA_KEY = 'dynamicAgentsMdReminder';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function extractWorkingMemoryTags(text: string): string[] | null {
  const results: string[] = [];
  let pos = 0;

  while (pos < text.length) {
    const start = text.indexOf(WORKING_MEMORY_START_TAG, pos);
    if (start === -1) break;

    const end = text.indexOf(WORKING_MEMORY_END_TAG, start + WORKING_MEMORY_START_TAG.length);
    if (end === -1) break;

    results.push(text.substring(start, end + WORKING_MEMORY_END_TAG.length));
    pos = end + WORKING_MEMORY_END_TAG.length;
  }

  return results.length > 0 ? results : null;
}

export function removeWorkingMemoryTags(text: string): string {
  let result = '';
  let pos = 0;

  while (pos < text.length) {
    const start = text.indexOf(WORKING_MEMORY_START_TAG, pos);
    if (start === -1) {
      result += text.substring(pos);
      break;
    }

    result += text.substring(pos, start);

    const end = text.indexOf(WORKING_MEMORY_END_TAG, start + WORKING_MEMORY_START_TAG.length);
    if (end === -1) {
      result += text.substring(start);
      break;
    }

    pos = end + WORKING_MEMORY_END_TAG.length;
  }

  return result;
}

export function extractWorkingMemoryContent(text: string): string | null {
  const start = text.indexOf(WORKING_MEMORY_START_TAG);
  if (start === -1) return null;

  const contentStart = start + WORKING_MEMORY_START_TAG.length;
  const end = text.indexOf(WORKING_MEMORY_END_TAG, contentStart);
  if (end === -1) return null;

  return text.substring(contentStart, end);
}

function isSystemReminderMessage(message: MastraDBMessage): boolean {
  if (message.role !== 'user' || !isRecord(message.content)) {
    return false;
  }

  const metadata = message.content.metadata;
  if (isRecord(metadata) && (isRecord(metadata.systemReminder) || LEGACY_SYSTEM_REMINDER_METADATA_KEY in metadata)) {
    return true;
  }

  const firstTextPart = message.content.parts.find(part => part.type === 'text');
  return typeof firstTextPart?.text === 'string' && firstTextPart.text.startsWith('<system-reminder');
}

function filterSystemReminderMessages(
  messages: MastraDBMessage[],
  includeSystemReminders?: boolean,
): MastraDBMessage[] {
  if (includeSystemReminders) {
    return messages;
  }

  return messages.filter(message => !isSystemReminderMessage(message));
}

function normalizeObservationalMemoryConfig(
  config: boolean | MemoryObservationalMemoryOptions | undefined,
): NormalizedObservationalMemoryConfig | undefined {
  if (config === true) return { model: 'google/gemini-2.5-flash' };
  if (config === false || config === undefined) return undefined;
  if (typeof config === 'object' && config.enabled === false) return undefined;
  return config as NormalizedObservationalMemoryConfig;
}

// Re-export for testing purposes
export { deepMergeWorkingMemory };

// Average characters per token based on OpenAI's tokenization
const CHARS_PER_TOKEN = 4;

const DEFAULT_MESSAGE_RANGE = { before: 1, after: 1 } as const;
const DEFAULT_TOP_K = 4;
const VECTOR_DELETE_BATCH_SIZE = 100;

/**
 * Concrete implementation of MastraMemory that adds support for thread configuration
 * and message injection.
 */
export class Memory extends MastraMemory {
  private _omEngine: Promise<ObservationalMemory | null> | undefined;
  private _omEngineInstance: ObservationalMemory | null | undefined;
  private _mastraInstance: Mastra | undefined;

  /** The shared ObservationalMemory engine. Lazily created on first access. */
  get omEngine(): Promise<ObservationalMemory | null> {
    if (!this._omEngine) {
      this._omEngine = this._initOMEngine().then(engine => {
        this._omEngineInstance = engine;
        if (engine && this._mastraInstance) {
          engine.__registerMastra(this._mastraInstance);
        }
        return engine;
      });
    }
    return this._omEngine;
  }

  __registerMastra(mastra: Mastra): void {
    super.__registerMastra(mastra);
    this._mastraInstance = mastra;
    if (this._omEngineInstance) {
      this._omEngineInstance.__registerMastra(mastra);
    } else {
      void this._omEngine?.then(engine => engine?.__registerMastra(mastra));
    }
  }

  constructor(config: MemoryConstructorConfig = {}) {
    super({ name: 'Memory', ...config } as { name: string } & SharedMemoryConfig);

    const mergedConfig = this.getMergedThreadConfig({
      workingMemory: config.options?.workingMemory || {
        // these defaults are now set inside @mastra/core/memory in getMergedThreadConfig.
        // In a future release we can remove it from this block - for now if we remove it
        // and someone bumps @mastra/memory without bumping @mastra/core the defaults wouldn't exist yet
        enabled: false,
        template: this.defaultWorkingMemoryTemplate,
      },
      observationalMemory: config.options?.observationalMemory as ObservationalMemoryOptions | boolean | undefined,
    });
    this.threadConfig = mergedConfig;

    // Validate retrieval vector config at construction time
    const omConfig = normalizeObservationalMemoryConfig(mergedConfig.observationalMemory);
    if (omConfig?.retrieval && typeof omConfig.retrieval === 'object' && omConfig.retrieval.vector) {
      if (!this.vector) {
        throw new Error(
          '`retrieval: { vector: true }` requires a vector store. Pass a `vector` option to your Memory instance.',
        );
      }
      if (!this.embedder) {
        throw new Error(
          '`retrieval: { vector: true }` requires an embedder. Pass an `embedder` option to your Memory instance.',
        );
      }
    }
  }

  /**
   * Gets the memory storage domain, throwing if not available.
   */
  protected async getMemoryStore(): Promise<MemoryStorage> {
    const store = await this.storage.getStore('memory');
    if (!store) {
      throw new Error(`Memory storage domain is not available on ${this.storage.constructor.name}`);
    }
    return store;
  }

  async listMessagesByResourceId(args: {
    resourceId: string;
    perPage?: number | false;
    page?: number;
    orderBy?: { field?: 'createdAt'; direction?: 'ASC' | 'DESC' };
    filter?: {
      dateRange?: {
        start?: Date;
        end?: Date;
        startExclusive?: boolean;
        endExclusive?: boolean;
      };
    };
    include?: Array<{
      id: string;
      threadId?: string;
      withPreviousMessages?: number;
      withNextMessages?: number;
    }>;
  }): Promise<{ messages: MastraDBMessage[]; total: number; page: number; perPage: number | false; hasMore: boolean }> {
    const memoryStore = await this.getMemoryStore();
    return memoryStore.listMessagesByResourceId(args);
  }

  protected async validateThreadIsOwnedByResource(threadId: string, resourceId: string, config: MemoryConfigInternal) {
    const resourceScope =
      (typeof config?.semanticRecall === 'object' && config?.semanticRecall?.scope !== `thread`) ||
      config.semanticRecall === true;

    const thread = await this.getThreadById({ threadId });

    // For resource-scoped semantic recall, we don't need to validate that the specific thread exists
    // because we're searching across all threads for the resource
    if (!thread && !resourceScope) {
      throw new Error(`No thread found with id ${threadId}`);
    }

    // If thread exists, validate it belongs to the correct resource
    if (thread && thread.resourceId !== resourceId) {
      throw new Error(
        `Thread with id ${threadId} is for resource with id ${thread.resourceId} but resource ${resourceId} was queried.`,
      );
    }
  }

  private createMemorySpan(
    operationType: MemoryOperationAttributes['operationType'],
    observabilityContext?: Partial<ObservabilityContext>,
    input?: any,
    attributes?: Partial<MemoryOperationAttributes>,
  ) {
    const currentSpan = observabilityContext?.tracingContext?.currentSpan;
    if (!currentSpan) return undefined;
    return currentSpan.createChildSpan({
      type: SpanType.MEMORY_OPERATION,
      name: `memory: ${operationType}`,
      entityType: EntityType.MEMORY,
      entityName: 'Memory',
      input,
      attributes: { operationType, ...attributes },
    });
  }

  async recall(
    args: StorageListMessagesInput & {
      threadConfig?: MemoryConfigInternal;
      vectorSearchString?: string;
      includeSystemReminders?: boolean;
      threadId: string;
      observabilityContext?: Partial<ObservabilityContext>;
    },
  ): Promise<{
    messages: MastraDBMessage[];
    usage?: { tokens: number };
    total: number;
    page: number;
    perPage: number | false;
    hasMore: boolean;
  }> {
    const {
      threadId,
      resourceId,
      perPage: perPageArg,
      page,
      orderBy,
      threadConfig,
      vectorSearchString,
      includeSystemReminders,
      filter,
    } = args;
    const config = this.getMergedThreadConfig(threadConfig || {});
    const semanticRecallEnabled = Boolean(config.semanticRecall);

    const span = this.createMemorySpan(
      'recall',
      args.observabilityContext,
      { threadId, resourceId, vectorSearchString },
      {
        semanticRecallEnabled,
        lastMessages: config.lastMessages,
      },
    );

    try {
      if (resourceId) await this.validateThreadIsOwnedByResource(threadId, resourceId, config);

      // Use perPage from args if provided, otherwise use threadConfig.lastMessages
      const perPage = perPageArg !== undefined ? perPageArg : config.lastMessages;

      // lastMessages: false means "disable conversation history entirely".
      // When the resolved perPage is false from config (not an explicit caller override),
      // return empty messages. This prevents recall() from treating false as "no limit"
      // and returning ALL messages when the user intended to disable history.
      const historyDisabledByConfig = config.lastMessages === false && perPageArg === undefined;

      // When limiting messages (perPage !== false) without explicit orderBy, we need to:
      // 1. Query DESC to get the NEWEST messages (not oldest)
      // 2. Reverse results to restore chronological order for the LLM
      // Without this fix, "lastMessages: 64" returns the OLDEST 64 messages, not the last 64.
      const shouldGetNewestAndReverse = !orderBy && perPage !== false;
      const effectiveOrderBy = shouldGetNewestAndReverse
        ? { field: 'createdAt' as const, direction: 'DESC' as const }
        : orderBy;

      const vectorResults: {
        id: string;
        score: number;
        metadata?: Record<string, any>;
        vector?: number[];
      }[] = [];

      // Log memory recall parameters, excluding potentially large schema objects
      this.logger.debug('Memory recall', {
        threadId,
        perPage,
        page,
        orderBy: effectiveOrderBy,
        hasWorkingMemorySchema: Boolean(config.workingMemory?.schema),
        workingMemoryEnabled: config.workingMemory?.enabled,
        semanticRecallEnabled,
        historyDisabledByConfig,
      });

      const defaultRange = DEFAULT_MESSAGE_RANGE;
      const defaultTopK = DEFAULT_TOP_K;

      const vectorConfig =
        typeof config?.semanticRecall === `boolean`
          ? {
              topK: defaultTopK,
              messageRange: defaultRange,
            }
          : {
              topK: config?.semanticRecall?.topK ?? defaultTopK,
              messageRange: config?.semanticRecall?.messageRange ?? defaultRange,
            };

      const resourceScope =
        (typeof config?.semanticRecall === 'object' && config?.semanticRecall?.scope !== `thread`) ||
        config.semanticRecall === true;

      // Guard: If resource-scoped semantic recall is enabled but no resourceId is provided, throw an error
      if (resourceScope && !resourceId && config?.semanticRecall && vectorSearchString) {
        throw new Error(
          `Memory error: Resource-scoped semantic recall is enabled but no resourceId was provided. ` +
            `Either provide a resourceId or explicitly set semanticRecall.scope to 'thread'.`,
        );
      }

      let usage: { tokens: number } | undefined;

      // If history is disabled and there's no semantic recall to perform, return empty immediately
      if (historyDisabledByConfig && (!config.semanticRecall || !vectorSearchString || !this.vector)) {
        const result = {
          messages: [],
          usage: undefined,
          total: 0,
          page: page ?? 0,
          perPage: 0,
          hasMore: false,
        };
        span?.end({ output: { success: true }, attributes: { messageCount: 0 } });
        return result;
      }

      if (config?.semanticRecall && vectorSearchString && this.vector) {
        const result = await this.embedMessageContent(vectorSearchString!);
        usage = result.usage;
        const { embeddings, dimension } = result;
        const { indexName } = await this.createEmbeddingIndex(dimension, config);

        await Promise.all(
          embeddings.map(async embedding => {
            if (typeof this.vector === `undefined`) {
              throw new Error(
                `Tried to query vector index ${indexName} but this Memory instance doesn't have an attached vector db.`,
              );
            }

            vectorResults.push(
              ...(await this.vector.query({
                indexName,
                queryVector: embedding,
                topK: vectorConfig.topK,
                filter: resourceScope
                  ? {
                      resource_id: resourceId,
                    }
                  : {
                      thread_id: threadId,
                    },
              })),
            );
          }),
        );
      }

      // Get raw messages from storage
      const memoryStore = await this.getMemoryStore();

      // When history is disabled by config, use perPage: 0 so only semantic recall
      // include results are returned (not the full message history)
      const effectivePerPage = historyDisabledByConfig ? 0 : perPage;

      const paginatedResult = await memoryStore.listMessages({
        threadId,
        resourceId,
        perPage: effectivePerPage,
        page,
        orderBy: effectiveOrderBy,
        filter,
        ...(vectorResults?.length
          ? {
              include: vectorResults.map(r => ({
                id: r.metadata?.message_id,
                threadId: r.metadata?.thread_id,
                withNextMessages:
                  typeof vectorConfig.messageRange === 'number'
                    ? vectorConfig.messageRange
                    : vectorConfig.messageRange.after,
                withPreviousMessages:
                  typeof vectorConfig.messageRange === 'number'
                    ? vectorConfig.messageRange
                    : vectorConfig.messageRange.before,
              })),
            }
          : {}),
      });
      // Reverse to restore chronological order if we queried DESC to get newest messages
      const rawMessages = shouldGetNewestAndReverse ? paginatedResult.messages.reverse() : paginatedResult.messages;

      const list = new MessageList({ threadId, resourceId }).add(rawMessages, 'memory');

      // Always return mastra-db format (V2)
      const messages = filterSystemReminderMessages(list.get.all.db(), includeSystemReminders);

      const { total, page: resultPage, perPage: resultPerPage, hasMore } = paginatedResult;
      const recallResult = { messages, usage, total, page: resultPage, perPage: resultPerPage, hasMore };

      span?.end({
        output: { success: true },
        attributes: {
          messageCount: messages.length,
          embeddingTokens: usage?.tokens,
          vectorResultCount: vectorResults.length,
        },
      });

      return recallResult;
    } catch (error) {
      span?.error({ error: error as Error, endSpan: true });
      throw error;
    }
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    const memoryStore = await this.getMemoryStore();
    return memoryStore.getThreadById({ threadId });
  }

  async listThreads(args: StorageListThreadsInput): Promise<StorageListThreadsOutput> {
    const memoryStore = await this.getMemoryStore();
    return memoryStore.listThreads(args);
  }

  private async handleWorkingMemoryFromMetadata({
    workingMemory,
    resourceId,
    memoryConfig,
  }: {
    workingMemory: string;
    resourceId: string;
    memoryConfig?: MemoryConfigInternal;
  }): Promise<void> {
    const config = this.getMergedThreadConfig(memoryConfig || {});

    if (config.workingMemory?.enabled) {
      const scope = config.workingMemory.scope || 'resource';

      // For resource scope, update the resource's working memory
      if (scope === 'resource' && resourceId) {
        const memoryStore = await this.getMemoryStore();
        await memoryStore.updateResource({
          resourceId,
          workingMemory,
        });
      }
      // For thread scope, the metadata is already saved with the thread
    }
  }

  async saveThread({
    thread,
    memoryConfig,
  }: {
    thread: StorageThreadType;
    memoryConfig?: MemoryConfigInternal;
  }): Promise<StorageThreadType> {
    const memoryStore = await this.getMemoryStore();
    const savedThread = await memoryStore.saveThread({ thread });

    // Check if metadata contains workingMemory and working memory is enabled
    if (thread.metadata?.workingMemory && typeof thread.metadata.workingMemory === 'string' && thread.resourceId) {
      await this.handleWorkingMemoryFromMetadata({
        workingMemory: thread.metadata.workingMemory,
        resourceId: thread.resourceId,
        memoryConfig,
      });
    }

    return savedThread;
  }

  async updateThread({
    id,
    title,
    metadata,
    memoryConfig,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
    memoryConfig?: MemoryConfigInternal;
  }): Promise<StorageThreadType> {
    const memoryStore = await this.getMemoryStore();
    const updatedThread = await memoryStore.updateThread({
      id,
      title,
      metadata,
    });

    // Check if metadata contains workingMemory and working memory is enabled
    if (metadata?.workingMemory && typeof metadata.workingMemory === 'string' && updatedThread.resourceId) {
      await this.handleWorkingMemoryFromMetadata({
        workingMemory: metadata.workingMemory as string,
        resourceId: updatedThread.resourceId,
        memoryConfig,
      });
    }

    return updatedThread;
  }

  async deleteThread(threadId: string): Promise<void> {
    const memoryStore = await this.getMemoryStore();
    await memoryStore.deleteThread({ threadId });
    if (this.vector) {
      void this.deleteThreadVectors(threadId);
    }
  }

  /**
   * Lists all vector indexes that match the memory messages prefix.
   * Handles separator differences across vector store backends (e.g. '_' vs '-').
   */
  private async getMemoryVectorIndexes(): Promise<string[]> {
    if (!this.vector) return [];
    const separator = this.vector.indexSeparator ?? '_';
    const prefix = `memory${separator}messages`;
    const indexes = await this.vector.listIndexes();
    return indexes.filter(name => name.startsWith(prefix));
  }

  /**
   * Deletes all vector embeddings associated with a thread.
   * This is called internally by deleteThread to clean up orphaned vectors.
   *
   * @param threadId - The ID of the thread whose vectors should be deleted
   */
  private async deleteThreadVectors(threadId: string): Promise<void> {
    try {
      const memoryIndexes = await this.getMemoryVectorIndexes();

      await Promise.all(
        memoryIndexes.map(async (indexName: string) => {
          try {
            await this.vector!.deleteVectors({
              indexName,
              filter: { thread_id: threadId },
            });
          } catch {
            this.logger.debug('Failed to delete vectors for thread, skipping', { threadId, indexName });
          }
        }),
      );
    } catch {
      this.logger.debug('Failed to clean up vectors for thread', { threadId });
    }
  }

  async updateWorkingMemory({
    threadId,
    resourceId,
    workingMemory,
    memoryConfig,
    observabilityContext,
  }: {
    threadId: string;
    resourceId?: string;
    workingMemory: string;
    memoryConfig?: MemoryConfigInternal;
    observabilityContext?: Partial<ObservabilityContext>;
  }): Promise<void> {
    const config = this.getMergedThreadConfig(memoryConfig || {});

    if (!config.workingMemory?.enabled) {
      throw new Error('Working memory is not enabled for this memory instance');
    }

    const span = this.createMemorySpan(
      'update',
      observabilityContext,
      { threadId, resourceId },
      {
        workingMemoryEnabled: true,
      },
    );

    try {
      const scope = config.workingMemory.scope || 'resource';

      // Guard: If resource-scoped working memory is enabled but no resourceId is provided, throw an error
      if (scope === 'resource' && !resourceId) {
        throw new Error(
          `Memory error: Resource-scoped working memory is enabled but no resourceId was provided. ` +
            `Either provide a resourceId or explicitly set workingMemory.scope to 'thread'.`,
        );
      }

      // Use mutex to prevent race conditions when multiple concurrent calls update the same resource/thread
      const mutexKey = scope === 'resource' ? `resource-${resourceId}` : `thread-${threadId}`;
      const mutex = this.updateWorkingMemoryMutexes.has(mutexKey)
        ? this.updateWorkingMemoryMutexes.get(mutexKey)!
        : new Mutex();
      this.updateWorkingMemoryMutexes.set(mutexKey, mutex);
      const release = await mutex.acquire();

      try {
        const memoryStore = await this.getMemoryStore();
        if (scope === 'resource' && resourceId) {
          await memoryStore.updateResource({
            resourceId,
            workingMemory,
          });
        } else {
          const thread = await this.getThreadById({ threadId });
          if (!thread) {
            throw new Error(`Thread ${threadId} not found`);
          }

          await memoryStore.updateThread({
            id: threadId,
            title: thread.title || '',
            metadata: {
              ...thread.metadata,
              workingMemory,
            },
          });
        }
      } finally {
        release();
      }

      span?.end({ output: { success: true } });
    } catch (error) {
      span?.error({ error: error as Error, endSpan: true });
      throw error;
    }
  }

  private updateWorkingMemoryMutexes = new Map<string, Mutex>();
  /**
   * @warning experimental! can be removed or changed at any time
   */
  async __experimental_updateWorkingMemoryVNext({
    threadId,
    resourceId,
    workingMemory,
    searchString,
    memoryConfig,
  }: {
    threadId: string;
    resourceId?: string;
    workingMemory: string;
    searchString?: string;
    memoryConfig?: MemoryConfigInternal;
  }): Promise<{ success: boolean; reason: string }> {
    const config = this.getMergedThreadConfig(memoryConfig || {});

    if (!config.workingMemory?.enabled) {
      throw new Error('Working memory is not enabled for this memory instance');
    }

    // If the agent calls the update working memory tool multiple times simultaneously
    // each call could overwrite the other call
    // so get an in memory mutex to make sure this.getWorkingMemory() returns up to date data each time
    const mutexKey =
      memoryConfig?.workingMemory?.scope === `resource` ? `resource-${resourceId}` : `thread-${threadId}`;
    const mutex = this.updateWorkingMemoryMutexes.has(mutexKey)
      ? this.updateWorkingMemoryMutexes.get(mutexKey)!
      : new Mutex();
    this.updateWorkingMemoryMutexes.set(mutexKey, mutex);
    const release = await mutex.acquire();

    try {
      const existingWorkingMemory = (await this.getWorkingMemory({ threadId, resourceId, memoryConfig })) || '';
      const template = await this.getWorkingMemoryTemplate({ memoryConfig });

      let reason = '';

      const templateContent = typeof template?.content === 'string' ? template.content : null;

      // Normalize content for comparison (handles whitespace variations)
      // This catches template duplicates even when LLM returns slightly different whitespace
      const normalizeForComparison = (str: string) => str.replace(/\s+/g, ' ').trim();
      const normalizedNewMemory = normalizeForComparison(workingMemory);
      const normalizedTemplate = templateContent ? normalizeForComparison(templateContent) : '';

      if (existingWorkingMemory) {
        if (searchString && existingWorkingMemory?.includes(searchString)) {
          workingMemory = existingWorkingMemory.replace(searchString, workingMemory);
          reason = `found and replaced searchString with newMemory`;
        } else if (
          existingWorkingMemory.includes(workingMemory) ||
          templateContent?.trim() === workingMemory.trim() ||
          // Also check normalized versions to catch template variations with different whitespace
          normalizedNewMemory === normalizedTemplate
        ) {
          return {
            success: false,
            reason: `attempted to insert duplicate data into working memory. this entry was skipped`,
          };
        } else {
          // Before appending, check if the new content is essentially the empty template
          // This prevents template duplication when the LLM sends the template again
          if (normalizedNewMemory === normalizedTemplate) {
            return {
              success: false,
              reason: `attempted to append empty template to working memory. this entry was skipped`,
            };
          }

          if (searchString) {
            reason = `attempted to replace working memory string that doesn't exist. Appending to working memory instead.`;
          } else {
            reason = `appended newMemory to end of working memory`;
          }

          workingMemory =
            existingWorkingMemory +
            `
${workingMemory}`;
        }
      } else if (workingMemory === templateContent || normalizedNewMemory === normalizedTemplate) {
        return {
          success: false,
          reason: `try again when you have data to add. newMemory was equal to the working memory template`,
        };
      } else {
        reason = `started new working memory`;
      }

      // Remove empty template insertions which models sometimes duplicate
      // Use both exact and normalized matching to catch variations
      if (templateContent) {
        workingMemory = workingMemory.replaceAll(templateContent, '');
        // Also try to remove template with normalized line endings
        const templateWithUnixLineEndings = templateContent.replace(/\r\n/g, '\n');
        const templateWithWindowsLineEndings = templateContent.replace(/\n/g, '\r\n');
        workingMemory = workingMemory.replaceAll(templateWithUnixLineEndings, '');
        workingMemory = workingMemory.replaceAll(templateWithWindowsLineEndings, '');
      }

      const scope = config.workingMemory.scope || 'resource';

      // Guard: If resource-scoped working memory is enabled but no resourceId is provided, throw an error
      if (scope === 'resource' && !resourceId) {
        throw new Error(
          `Memory error: Resource-scoped working memory is enabled but no resourceId was provided. ` +
            `Either provide a resourceId or explicitly set workingMemory.scope to 'thread'.`,
        );
      }

      const memoryStore = await this.getMemoryStore();
      if (scope === 'resource' && resourceId) {
        // Update working memory in resource table
        await memoryStore.updateResource({
          resourceId,
          workingMemory,
        });

        if (reason) {
          return { success: true, reason };
        }
      } else {
        // Update working memory in thread metadata (existing behavior)
        const thread = await this.getThreadById({ threadId });
        if (!thread) {
          throw new Error(`Thread ${threadId} not found`);
        }

        await memoryStore.updateThread({
          id: threadId,
          title: thread.title || '',
          metadata: {
            ...thread.metadata,
            workingMemory,
          },
        });
      }

      return { success: true, reason };
    } catch (e) {
      this.logger.error(e instanceof Error ? e.stack || e.message : JSON.stringify(e));
      return { success: false, reason: 'Tool error.' };
    } finally {
      release();
    }
  }

  protected chunkText(text: string, tokenSize = 4096) {
    // Convert token size to character size with some buffer
    const charSize = tokenSize * CHARS_PER_TOKEN;
    const chunks: string[] = [];
    let currentChunk = '';

    // Split text into words to avoid breaking words
    const words = text.split(/\s+/);

    for (const word of words) {
      // Add space before word unless it's the first word in the chunk
      const wordWithSpace = currentChunk ? ' ' + word : word;

      // If adding this word would exceed the chunk size, start a new chunk
      if (currentChunk.length + wordWithSpace.length > charSize) {
        chunks.push(currentChunk);
        currentChunk = word;
      } else {
        currentChunk += wordWithSpace;
      }
    }

    // Add the final chunk if not empty
    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  private hasher = xxhash();

  // embedding is computationally expensive so cache content -> embeddings/chunks
  private embeddingCache = new Map<
    number,
    {
      chunks: string[];
      embeddings: Awaited<ReturnType<typeof embedMany>>['embeddings'];
      usage?: { tokens: number };
      dimension: number | undefined;
    }
  >();
  private firstEmbed: Promise<any> | undefined;
  protected async embedMessageContent(content: string) {
    // use fast xxhash for lower memory usage. if we cache by content string we will store all messages in memory for the life of the process
    const key = (await this.hasher).h32(content);
    const cached = this.embeddingCache.get(key);
    if (cached) {
      this.logger.debug('Embedding cache hit', { contentHash: key, chunks: cached.chunks.length });
      return cached;
    }
    const chunks = this.chunkText(content);

    if (typeof this.embedder === `undefined`) {
      throw new Error(`Tried to embed message content but this Memory instance doesn't have an attached embedder.`);
    }
    // for fastembed multiple initial calls to embed will fail if the model hasn't been downloaded yet.
    const isFastEmbed = this.embedder.provider === `fastembed`;
    if (isFastEmbed && this.firstEmbed instanceof Promise) {
      // so wait for the first one
      await this.firstEmbed;
    }

    let embedFn: typeof embedMany | typeof embedManyV5 | typeof embedManyV6;
    const specVersion = this.embedder.specificationVersion;

    switch (specVersion) {
      case 'v3':
        embedFn = embedManyV6;
        break;
      case 'v2':
        embedFn = embedManyV5;
        break;
      default:
        embedFn = embedMany;
        break;
    }

    const promise = embedFn({
      values: chunks,
      maxRetries: 3,
      // @ts-expect-error - embedder type mismatch
      model: this.embedder,
      ...(this.embedderOptions || {}),
    });

    if (isFastEmbed && !this.firstEmbed) this.firstEmbed = promise;
    const { embeddings, usage } = await promise;

    const result = {
      embeddings,
      chunks,
      usage,
      dimension: embeddings[0]?.length,
    };
    this.embeddingCache.set(key, result);
    return result;
  }

  async saveMessages({
    messages,
    memoryConfig,
    observabilityContext,
  }: {
    messages: MastraDBMessage[];
    memoryConfig?: MemoryConfig | undefined;
    observabilityContext?: Partial<ObservabilityContext>;
  }): Promise<{ messages: MastraDBMessage[]; usage?: { tokens: number } }> {
    const span = this.createMemorySpan('save', observabilityContext, undefined, {
      messageCount: messages.length,
    });

    try {
      // Then strip working memory tags from all messages
      const updatedMessages = messages
        .map(m => {
          return this.updateMessageToHideWorkingMemoryV2(m);
        })
        .filter((m): m is MastraDBMessage => Boolean(m));

      const config = this.getMergedThreadConfig(memoryConfig);

      // Convert messages to MastraDBMessage format if needed
      const dbMessages = new MessageList({
        generateMessageId: () => this.generateId(),
      })
        .add(updatedMessages, 'memory')
        .get.all.db();

      const memoryStore = await this.getMemoryStore();
      const result = await memoryStore.saveMessages({
        messages: dbMessages,
      });

      let totalTokens = 0;

      if (this.vector && config.semanticRecall) {
        // Collect all embeddings first (embedding is CPU-bound, doesn't use pool connections)
        const embeddingData: Array<{
          embeddings: number[][];
          metadata: Array<{ message_id: string; thread_id: string | undefined; resource_id: string | undefined }>;
        }> = [];
        let dimension: number | undefined;

        // Process embeddings concurrently - this doesn't use DB connections
        await Promise.all(
          updatedMessages.map(async message => {
            let textForEmbedding: string | null = null;

            if (
              message.content.content &&
              typeof message.content.content === 'string' &&
              message.content.content.trim() !== ''
            ) {
              textForEmbedding = message.content.content;
            } else if (message.content.parts && message.content.parts.length > 0) {
              // Extract text from all text parts, concatenate
              const joined = message.content.parts
                .filter(part => part.type === 'text')
                .map(part => (part as TextPart).text)
                .join(' ')
                .trim();
              if (joined) textForEmbedding = joined;
            }

            if (!textForEmbedding) return;

            const result = await this.embedMessageContent(textForEmbedding);
            dimension = result.dimension;
            if (result.usage?.tokens) {
              totalTokens += result.usage.tokens;
            }

            embeddingData.push({
              embeddings: result.embeddings,
              metadata: result.chunks.map(() => ({
                message_id: message.id,
                thread_id: message.threadId,
                resource_id: message.resourceId,
              })),
            });
          }),
        );

        // Batch all vectors into a single upsert call to avoid pool exhaustion
        if (embeddingData.length > 0 && dimension !== undefined) {
          if (typeof this.vector === `undefined`) {
            throw new Error(`Tried to upsert embeddings but this Memory instance doesn't have an attached vector db.`);
          }

          const { indexName } = await this.createEmbeddingIndex(dimension, config);

          // Flatten all embeddings and metadata into single arrays
          const allVectors: number[][] = [];
          const allMetadata: Array<{
            message_id: string;
            thread_id: string | undefined;
            resource_id: string | undefined;
          }> = [];

          for (const data of embeddingData) {
            allVectors.push(...data.embeddings);
            allMetadata.push(...data.metadata);
          }

          await this.vector.upsert({
            indexName,
            vectors: allVectors,
            metadata: allMetadata,
          });
        }
      }

      const saveResult = { ...result, usage: totalTokens > 0 ? { tokens: totalTokens } : undefined };

      span?.end({
        output: { success: true },
        attributes: {
          messageCount: dbMessages.length,
          embeddingTokens: saveResult.usage?.tokens,
          semanticRecallEnabled: Boolean(config.semanticRecall),
        },
      });

      return saveResult;
    } catch (error) {
      span?.error({ error: error as Error, endSpan: true });
      throw error;
    }
  }

  protected updateMessageToHideWorkingMemoryV2(message: MastraDBMessage): MastraDBMessage | null {
    const newMessage = { ...message };
    // Only spread content if it's a proper V2 object to avoid corrupting non-object content
    if (message.content && typeof message.content === 'object' && !Array.isArray(message.content)) {
      newMessage.content = { ...message.content };
    }

    if (typeof newMessage.content?.content === 'string' && newMessage.content.content.length > 0) {
      newMessage.content.content = removeWorkingMemoryTags(newMessage.content.content).trim();
    }

    if (Array.isArray(newMessage.content?.parts)) {
      newMessage.content.parts = newMessage.content.parts
        .filter(part => {
          if (part?.type === 'tool-invocation') {
            return part.toolInvocation?.toolName !== 'updateWorkingMemory';
          }
          return true;
        })
        .map(part => {
          if (part?.type === 'text') {
            const text = typeof part.text === 'string' ? part.text : '';
            return {
              ...part,
              text: removeWorkingMemoryTags(text).trim(),
            };
          }
          return part;
        });

      // If all parts were filtered out (e.g., only contained updateWorkingMemory tool calls),
      // only skip the message when it also has no text content left.
      if (newMessage.content.parts.length === 0) {
        const hasContentText =
          typeof newMessage.content.content === 'string' && newMessage.content.content.trim().length > 0;

        if (!hasContentText) {
          return null;
        }
      }
    }

    return newMessage;
  }

  protected parseWorkingMemory(text: string): string | null {
    if (!this.threadConfig.workingMemory?.enabled) return null;

    const content = extractWorkingMemoryContent(text);
    return content?.trim() ?? null;
  }

  public async getWorkingMemory({
    threadId,
    resourceId,
    memoryConfig,
  }: {
    threadId: string;
    resourceId?: string;
    memoryConfig?: MemoryConfigInternal;
  }): Promise<string | null> {
    const config = this.getMergedThreadConfig(memoryConfig || {});
    if (!config.workingMemory?.enabled) {
      return null;
    }

    const scope = config.workingMemory.scope || 'resource';
    let workingMemoryData: string | null = null;

    // Guard: If resource-scoped working memory is enabled but no resourceId is provided, throw an error
    if (scope === 'resource' && !resourceId) {
      throw new Error(
        `Memory error: Resource-scoped working memory is enabled but no resourceId was provided. ` +
          `Either provide a resourceId or explicitly set workingMemory.scope to 'thread'.`,
      );
    }

    if (scope === 'resource' && resourceId) {
      // Get working memory from resource table
      const memoryStore = await this.getMemoryStore();
      const resource = await memoryStore.getResourceById({ resourceId });
      workingMemoryData = resource?.workingMemory || null;
    } else {
      // Get working memory from thread metadata (default behavior)
      const thread = await this.getThreadById({ threadId });
      workingMemoryData = thread?.metadata?.workingMemory as string;
    }

    if (!workingMemoryData) {
      return null;
    }

    return workingMemoryData;
  }

  /**
   * Gets the working memory template for the current memory configuration.
   * Supports both ZodObject and JSONSchema7 schemas.
   *
   * @param memoryConfig - The memory configuration containing the working memory settings
   * @returns The working memory template with format and content, or null if working memory is disabled
   */
  public async getWorkingMemoryTemplate({
    memoryConfig,
  }: {
    memoryConfig?: MemoryConfigInternal;
  }): Promise<WorkingMemoryTemplate | null> {
    const config = this.getMergedThreadConfig(memoryConfig);

    if (!config.workingMemory?.enabled) {
      return null;
    }

    // Get thread from storage
    if (config.workingMemory?.schema) {
      try {
        const schema = config.workingMemory.schema;
        let convertedSchema: JSONSchema7;

        // Convert any PublicSchema to StandardSchemaWithJSON, then extract JSON Schema
        if (isStandardSchemaWithJSON(schema)) {
          convertedSchema = schema['~standard'].jsonSchema.output({ target: 'draft-07' }) as JSONSchema7;
        } else {
          // Convert to standard schema first, then get JSON Schema
          const standardSchema = toStandardSchema(schema);
          convertedSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' }) as JSONSchema7;
        }

        return { format: 'json', content: JSON.stringify(convertedSchema) };
      } catch (error) {
        this.logger.error('Error converting schema', error);
        throw error;
      }
    }

    // Return working memory from metadata
    const memory = config.workingMemory.template || this.defaultWorkingMemoryTemplate;
    return { format: 'markdown', content: memory.trim() };
  }

  public async getSystemMessage({
    threadId,
    resourceId,
    memoryConfig,
  }: {
    threadId: string;
    resourceId?: string;
    memoryConfig?: MemoryConfigInternal;
  }): Promise<string | null> {
    const config = this.getMergedThreadConfig(memoryConfig);
    if (!config.workingMemory?.enabled) {
      return null;
    }

    const workingMemoryTemplate = await this.getWorkingMemoryTemplate({ memoryConfig });
    const workingMemoryData = await this.getWorkingMemory({ threadId, resourceId, memoryConfig: config });

    if (!workingMemoryTemplate) {
      return null;
    }

    // In readOnly mode, provide context without tool instructions
    if (config?.readOnly) {
      return this.getReadOnlyWorkingMemoryInstruction({
        template: workingMemoryTemplate,
        data: workingMemoryData,
      });
    }

    return this.isVNextWorkingMemoryConfig(memoryConfig)
      ? this.__experimental_getWorkingMemoryToolInstructionVNext({
          template: workingMemoryTemplate,
          data: workingMemoryData,
        })
      : this.getWorkingMemoryToolInstruction({
          template: workingMemoryTemplate,
          data: workingMemoryData,
        });
  }

  /**
   * Get everything needed for an LLM call in one shot.
   *
   * Assembles the system message (observations + working memory), loads
   * unobserved messages from storage, and returns them ready to use.
   *
   * @example
   * ```ts
   * const ctx = await memory.getContext({ threadId });
   * const result = await generateText({
   *   model: openai('gpt-4o'),
   *   system: ctx.systemMessage,
   *   messages: ctx.messages.map(toAiSdkMessage),
   * });
   * ```
   */
  public async getContext(opts: {
    threadId: string;
    resourceId?: string;
    memoryConfig?: MemoryConfigInternal;
  }): Promise<{
    /** Fully-formed system message (observations + instructions + working memory), or undefined if none. */
    systemMessage: string | undefined;
    /** Messages for the LLM — unobserved messages if OM is active, or recent messages from history. */
    messages: MastraDBMessage[];
    /** Whether observations exist for this thread. */
    hasObservations: boolean;
    /** The OM record, if OM is active. */
    omRecord: ObservationalMemoryRecord | null;
    /** The om-continuation reminder message, if OM has observations. Caller decides where to place it. */
    continuationMessage: MastraDBMessage | undefined;
    /** Formatted context blocks from other threads (resource scope only). */
    otherThreadsContext: string | undefined;
  }> {
    const { threadId, resourceId, memoryConfig } = opts;
    const config = this.getMergedThreadConfig(memoryConfig);
    const memoryStore = await this.getMemoryStore();

    // Build system message parts
    const systemParts: string[] = [];

    // 1. OM observations system message
    let hasObservations = false;
    let omRecord: ObservationalMemoryRecord | null = null;
    let continuationMessage: MastraDBMessage | undefined;
    let otherThreadsContext: string | undefined;

    const omEngine = await this.omEngine;
    if (omEngine) {
      omRecord = await omEngine.getRecord(threadId, resourceId);
      if (omRecord?.activeObservations) {
        hasObservations = true;

        // For resource scope, load other threads' unobserved context
        if (omEngine.scope === 'resource' && resourceId) {
          otherThreadsContext = await omEngine.getOtherThreadsContext(resourceId, threadId);
        }

        const obsSystemMessage = await omEngine.buildContextSystemMessage({
          threadId,
          resourceId,
          record: omRecord,
          unobservedContextBlocks: otherThreadsContext,
        });
        if (obsSystemMessage) {
          systemParts.push(obsSystemMessage);
        }

        // Build the continuation reminder message
        const { OBSERVATION_CONTINUATION_HINT } = await import('./processors/observational-memory/constants');
        continuationMessage = {
          id: 'om-continuation',
          role: 'user' as const,
          createdAt: new Date(0),
          content: {
            format: 2 as const,
            parts: [
              {
                type: 'text' as const,
                text: `<system-reminder>${OBSERVATION_CONTINUATION_HINT}</system-reminder>`,
              },
            ],
          },
          threadId,
          resourceId,
        };
      }
    }

    // 2. Working memory system message
    const workingMemoryMessage = await this.getSystemMessage({ threadId, resourceId, memoryConfig: config });
    if (workingMemoryMessage) {
      systemParts.push(workingMemoryMessage);
    }

    // 3. Load messages — unobserved if OM is active, or recent N
    let messages: MastraDBMessage[];
    if (omEngine && omRecord) {
      // OM is active: load unobserved messages.
      // When lastObservedAt exists, load only messages after the boundary.
      // When lastObservedAt is NULL (no observations yet), load ALL messages
      // so the threshold check can fire on the full context.
      const dateFilter = omRecord.lastObservedAt
        ? { dateRange: { start: new Date(new Date(omRecord.lastObservedAt).getTime() + 1) } }
        : undefined;

      if (omEngine.scope === 'resource' && resourceId) {
        const result = await memoryStore.listMessagesByResourceId({
          resourceId,
          orderBy: { field: 'createdAt', direction: 'ASC' },
          perPage: false,
          filter: dateFilter,
        });
        messages = result.messages;
      } else {
        const result = await memoryStore.listMessages({
          threadId,
          orderBy: { field: 'createdAt', direction: 'ASC' },
          perPage: false,
          filter: dateFilter,
        });
        messages = result.messages;
      }
    } else {
      // No OM: load recent messages
      const lastMessages = config.lastMessages;
      if (lastMessages === false) {
        messages = [];
      } else {
        const result = await memoryStore.listMessages({
          threadId,
          resourceId,
          orderBy: { field: 'createdAt', direction: 'DESC' },
          perPage: typeof lastMessages === 'number' ? lastMessages : undefined,
        });
        messages = result.messages.reverse(); // DESC → chronological order
      }
    }

    return {
      systemMessage: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
      messages,
      hasObservations,
      omRecord,
      continuationMessage,
      otherThreadsContext,
    };
  }

  /**
   * Raw message upsert — persist messages to storage without embedding or working memory processing.
   * Used by the processor to save sealed messages before firing a background buffer operation.
   */
  async persistMessages(messages: MastraDBMessage[]): Promise<void> {
    if (messages.length === 0) return;
    const memoryStore = await this.getMemoryStore();
    await memoryStore.saveMessages({ messages });
  }

  /**
   * One-time initialization of the shared ObservationalMemory engine.
   * Called lazily by the `omEngine` getter on first access.
   */
  private async _initOMEngine(): Promise<ObservationalMemory | null> {
    const omConfig = normalizeObservationalMemoryConfig(this.threadConfig.observationalMemory);
    if (!omConfig) return null;

    const memoryStore = await this.storage.getStore('memory');
    if (!memoryStore || !memoryStore.supportsObservationalMemory) return null;

    const coreSupportsOM = coreFeatures.has('observationalMemory');
    if (!coreSupportsOM) {
      throw new Error(
        'Observational memory is enabled but the installed version of @mastra/core does not support it. ' +
          'Please upgrade @mastra/core to a version that includes observational memory support.',
      );
    }

    if (omConfig.observation?.bufferTokens !== false && !coreFeatures.has('asyncBuffering')) {
      throw new Error(
        'Observational memory async buffering is enabled by default but the installed version of @mastra/core does not support it. ' +
          'Either upgrade @mastra/core, @mastra/memory, and your storage adapter (@mastra/libsql, @mastra/pg, or @mastra/mongodb) to the latest version, ' +
          'or explicitly disable async buffering by setting `observation: { bufferTokens: false }` in your observationalMemory config.',
      );
    }

    if (!coreFeatures.has('request-response-id-rotation')) {
      throw new Error(
        'Observational memory requires @mastra/core support for request-response-id-rotation. Please bump @mastra/core to a newer version.',
      );
    }

    const { ObservationalMemory: OMClass } = await import('./processors/observational-memory');

    const onIndexObservations = this.hasRetrievalSearch(omConfig.retrieval)
      ? async (observation: {
          text: string;
          groupId: string;
          range: string;
          threadId: string;
          resourceId: string;
          observedAt?: Date;
        }) => {
          await this.indexObservation(observation);
        }
      : undefined;

    return new OMClass({
      storage: memoryStore,
      scope: omConfig.scope,
      retrieval: omConfig.retrieval,
      activateAfterIdle: omConfig.activateAfterIdle,
      activateOnProviderChange: omConfig.activateOnProviderChange,
      shareTokenBudget: omConfig.shareTokenBudget,
      model: omConfig.model,
      mastra: this._mastraInstance,
      onIndexObservations,
      observation: omConfig.observation
        ? {
            model: omConfig.observation.model,
            messageTokens: omConfig.observation.messageTokens,
            modelSettings: omConfig.observation.modelSettings,
            maxTokensPerBatch: omConfig.observation.maxTokensPerBatch,
            providerOptions: omConfig.observation.providerOptions,
            bufferTokens: omConfig.observation.bufferTokens,
            bufferActivation: omConfig.observation.bufferActivation,
            blockAfter: omConfig.observation.blockAfter,
            previousObserverTokens: omConfig.observation.previousObserverTokens,
            instruction: omConfig.observation.instruction,
            threadTitle: omConfig.observation.threadTitle,
          }
        : undefined,
      reflection: omConfig.reflection
        ? {
            model: omConfig.reflection.model,
            observationTokens: omConfig.reflection.observationTokens,
            modelSettings: omConfig.reflection.modelSettings,
            providerOptions: omConfig.reflection.providerOptions,
            bufferActivation: omConfig.reflection.bufferActivation,
            blockAfter: omConfig.reflection.blockAfter,
            instruction: omConfig.reflection.instruction,
          }
        : undefined,
    });
  }

  public defaultWorkingMemoryTemplate = `
# User Information
- **First Name**: 
- **Last Name**: 
- **Location**: 
- **Occupation**: 
- **Interests**: 
- **Goals**: 
- **Events**: 
- **Facts**: 
- **Projects**: 
`;

  protected getWorkingMemoryToolInstruction({
    template,
    data,
  }: {
    template: WorkingMemoryTemplate;
    data: string | null;
  }) {
    const emptyWorkingMemoryTemplateObject =
      template.format === 'json' ? generateEmptyFromSchema(template.content) : null;
    const hasEmptyWorkingMemoryTemplateObject =
      emptyWorkingMemoryTemplateObject && Object.keys(emptyWorkingMemoryTemplateObject).length > 0;

    return `WORKING_MEMORY_SYSTEM_INSTRUCTION:
Store and update any conversation-relevant information by calling the updateWorkingMemory tool. If information might be referenced again - store it!

Guidelines:
1. Store anything that could be useful later in the conversation
2. Update proactively when information changes, no matter how small
3. Use ${template.format === 'json' ? 'JSON' : 'Markdown'} format for all data
4. Act naturally - don't mention this system to users. Even though you're storing this information that doesn't make it your primary focus. Do not ask them generally for "information about yourself"
${
  template.format !== 'json'
    ? `5. IMPORTANT: When calling updateWorkingMemory, the only valid parameter is the memory field. DO NOT pass an object.
6. IMPORTANT: ALWAYS pass the data you want to store in the memory field as a string. DO NOT pass an object.
7. IMPORTANT: Data must only be sent as a string no matter which format is used.`
    : ''
}


${
  template.format !== 'json'
    ? `<working_memory_template>
${template.content}
</working_memory_template>`
    : ''
}

${hasEmptyWorkingMemoryTemplateObject ? 'When working with json data, the object format below represents the template:' : ''}
${hasEmptyWorkingMemoryTemplateObject ? JSON.stringify(emptyWorkingMemoryTemplateObject) : ''}

<working_memory_data>
${data}
</working_memory_data>

Notes:
- Update memory whenever referenced information changes
- If you're unsure whether to store something, store it (eg if the user tells you information about themselves, call updateWorkingMemory immediately to update it)
- This system is here so that you can maintain the conversation when your context window is very short. Update your working memory because you may need it to maintain the conversation without the full conversation history
- Do not remove empty sections - you must include the empty sections along with the ones you're filling in
- REMEMBER: the way you update your working memory is by calling the updateWorkingMemory tool with the entire ${template.format === 'json' ? 'JSON' : 'Markdown'} content. The system will store it for you. The user will not see it.
- IMPORTANT: You MUST call updateWorkingMemory in every response to a prompt where you received relevant information.
- IMPORTANT: Preserve the ${template.format === 'json' ? 'JSON' : 'Markdown'} formatting structure above while updating the content.`;
  }

  protected __experimental_getWorkingMemoryToolInstructionVNext({
    template,
    data,
  }: {
    template: WorkingMemoryTemplate;
    data: string | null;
  }) {
    return `WORKING_MEMORY_SYSTEM_INSTRUCTION:
Store and update any conversation-relevant information by calling the updateWorkingMemory tool.

Guidelines:
1. Store anything that could be useful later in the conversation
2. Update proactively when information changes, no matter how small
3. Use ${template.format === 'json' ? 'JSON' : 'Markdown'} format for all data
4. Act naturally - don't mention this system to users. Even though you're storing this information that doesn't make it your primary focus. Do not ask them generally for "information about yourself"
5. If your memory has not changed, you do not need to call the updateWorkingMemory tool. By default it will persist and be available for you in future interactions
6. Information not being relevant to the current conversation is not a valid reason to replace or remove working memory information. Your working memory spans across multiple conversations and may be needed again later, even if it's not currently relevant.

<working_memory_template>
${template.content}
</working_memory_template>

<working_memory_data>
${data}
</working_memory_data>

Notes:
- Update memory whenever referenced information changes
${
  template.content !== this.defaultWorkingMemoryTemplate
    ? `- Only store information if it's in the working memory template, do not store other information unless the user asks you to remember it, as that non-template information may be irrelevant`
    : `- If you're unsure whether to store something, store it (eg if the user tells you information about themselves, call updateWorkingMemory immediately to update it)
`
}
- This system is here so that you can maintain the conversation when your context window is very short. Update your working memory because you may need it to maintain the conversation without the full conversation history
- REMEMBER: the way you update your working memory is by calling the updateWorkingMemory tool with the ${template.format === 'json' ? 'JSON' : 'Markdown'} content. The system will store it for you. The user will not see it.
- IMPORTANT: You MUST call updateWorkingMemory in every response to a prompt where you received relevant information if that information is not already stored.
- IMPORTANT: Preserve the ${template.format === 'json' ? 'JSON' : 'Markdown'} formatting structure above while updating the content.
`;
  }

  /**
   * Generate read-only working memory instructions.
   * This provides the working memory context without any tool update instructions.
   * Used when memory is in readOnly mode.
   */
  protected getReadOnlyWorkingMemoryInstruction({ data }: { template: WorkingMemoryTemplate; data: string | null }) {
    return `WORKING_MEMORY_SYSTEM_INSTRUCTION (READ-ONLY):
The following is your working memory - persistent information about the user and conversation collected over previous interactions. This data is provided for context to help you maintain continuity.

<working_memory_data>
${data || 'No working memory data available.'}
</working_memory_data>

Guidelines:
1. Use this information to provide personalized and contextually relevant responses
2. Act naturally - don't mention this system to users. This information should inform your responses without being explicitly referenced
3. This memory is read-only in the current session - you cannot update it

Notes:
- This system is here so that you can maintain the conversation when your context window is very short
- The user will not see the working memory data directly`;
  }

  private isVNextWorkingMemoryConfig(config?: MemoryConfig): boolean {
    if (!config?.workingMemory) return false;

    const isMDWorkingMemory =
      !(`schema` in config.workingMemory) &&
      (typeof config.workingMemory.template === `string` || config.workingMemory.template) &&
      config.workingMemory;

    return Boolean(isMDWorkingMemory && isMDWorkingMemory.version === `vnext`);
  }

  private getObservationEmbeddingIndexName(dimensions?: number): string {
    const defaultDimensions = 384;
    const usedDimensions = dimensions ?? defaultDimensions;
    const separator = this.vector?.indexSeparator ?? '_';
    return `memory${separator}observations${separator}${usedDimensions}`;
  }

  private async createObservationEmbeddingIndex(dimensions?: number): Promise<{ indexName: string }> {
    const defaultDimensions = 384;
    const usedDimensions = dimensions ?? defaultDimensions;
    const indexName = this.getObservationEmbeddingIndexName(dimensions);

    if (typeof this.vector === `undefined`) {
      throw new Error(
        `Tried to create observation embedding index but no vector db is attached to this Memory instance.`,
      );
    }

    await this.vector.createIndex({
      indexName,
      dimension: usedDimensions,
    } as any);

    return { indexName };
  }

  /**
   * Search observation groups across threads by semantic similarity.
   * Requires a vector store and embedder to be configured.
   */
  public async searchMessages({
    query,
    resourceId,
    topK = 10,
    filter,
  }: {
    query: string;
    resourceId: string;
    topK?: number;
    filter?: {
      threadId?: string;
      observedAfter?: Date;
      observedBefore?: Date;
    };
  }): Promise<{
    results: Array<{
      threadId: string;
      score: number;
      groupId?: string;
      range?: string;
      text?: string;
      observedAt?: Date;
    }>;
  }> {
    if (!this.vector) {
      throw new Error('searchMessages requires a vector store. Configure vector and embedder on your Memory instance.');
    }

    const { embeddings, dimension } = await this.embedMessageContent(query);
    const { indexName } = await this.createObservationEmbeddingIndex(dimension);

    const vectorFilter: VectorFilter = { resource_id: resourceId };
    if (filter?.threadId) {
      vectorFilter.thread_id = filter.threadId;
    }
    if (filter?.observedAfter || filter?.observedBefore) {
      vectorFilter.observed_at = {
        ...(filter.observedAfter ? { $gt: filter.observedAfter.toISOString() } : {}),
        ...(filter.observedBefore ? { $lt: filter.observedBefore.toISOString() } : {}),
      };
    }

    const queryResults: Array<{
      threadId: string;
      score: number;
      groupId?: string;
      range?: string;
      text?: string;
      observedAt?: Date;
    }> = [];

    await Promise.all(
      embeddings.map(async embedding => {
        const results = await this.vector!.query({
          indexName,
          queryVector: embedding,
          topK,
          filter: vectorFilter,
        });
        for (const r of results) {
          if (!r.metadata?.thread_id) {
            continue;
          }

          const groupId = typeof r.metadata.group_id === 'string' ? r.metadata.group_id : undefined;
          if (!groupId) {
            continue;
          }

          queryResults.push({
            threadId: r.metadata.thread_id,
            score: r.score,
            groupId,
            range: typeof r.metadata.range === 'string' ? r.metadata.range : undefined,
            text: typeof r.metadata.text === 'string' ? r.metadata.text : undefined,
            observedAt:
              typeof r.metadata.observed_at === 'string' || r.metadata.observed_at instanceof Date
                ? new Date(r.metadata.observed_at)
                : undefined,
          });
        }
      }),
    );

    const bestByGroup = new Map<string, (typeof queryResults)[0]>();
    for (const result of queryResults) {
      if (!result.groupId) {
        continue;
      }

      const existing = bestByGroup.get(result.groupId);
      if (!existing || result.score > existing.score) {
        bestByGroup.set(result.groupId, result);
      }
    }

    const results = [...bestByGroup.values()].sort((a, b) => b.score - a.score);

    return { results };
  }

  /**
   * Index a single observation group into the observation vector store.
   */
  public async indexObservation({
    text,
    groupId,
    range,
    threadId,
    resourceId,
    observedAt,
  }: {
    text: string;
    groupId: string;
    range: string;
    threadId: string;
    resourceId: string;
    observedAt?: Date;
  }): Promise<void> {
    if (!this.vector || !this.embedder) return;

    const embedResult = await this.embedMessageContent(text);
    if (embedResult.embeddings.length === 0 || embedResult.dimension === undefined) {
      return;
    }

    const { indexName } = await this.createObservationEmbeddingIndex(embedResult.dimension);

    await this.vector.upsert({
      indexName,
      vectors: embedResult.embeddings,
      metadata: embedResult.chunks.map(chunk => ({
        group_id: groupId,
        range,
        thread_id: threadId,
        resource_id: resourceId,
        observed_at: observedAt?.toISOString(),
        text: chunk,
      })),
    });
  }

  /**
   * Update per-record observational memory config overrides for a thread.
   * The provided config is deep-merged, so you only need to specify fields you want to change.
   *
   * @example
   * ```ts
   * await memory.updateObservationalMemoryConfig({
   *   threadId: 'thread-1',
   *   config: {
   *     observation: { messageTokens: 2000 },
   *     reflection: { observationTokens: 8000 },
   *   },
   * });
   * ```
   */
  public async updateObservationalMemoryConfig({
    threadId,
    resourceId,
    config,
  }: {
    threadId: string;
    resourceId?: string;
    config: Record<string, unknown>;
  }): Promise<void> {
    const omEngine = await this.omEngine;
    if (!omEngine) {
      throw new Error('Observational memory is not enabled');
    }
    await omEngine.updateRecordConfig(threadId, resourceId, config);
  }

  /**
   * Index a list of messages directly (without querying storage).
   * Used by observe-time indexing to vectorize newly-observed messages.
   */
  private async indexMessagesList(messages: MastraDBMessage[]): Promise<void> {
    if (!this.vector || !this.embedder) return;

    const embeddingData: Array<{
      embeddings: number[][];
      metadata: Array<{ message_id: string; thread_id: string | undefined; resource_id: string | undefined }>;
    }> = [];
    let dimension: number | undefined;

    await Promise.all(
      messages.map(async message => {
        let textForEmbedding: string | null = null;

        if (
          message.content.content &&
          typeof message.content.content === 'string' &&
          message.content.content.trim() !== ''
        ) {
          textForEmbedding = message.content.content;
        } else if (message.content.parts && message.content.parts.length > 0) {
          const joined = message.content.parts
            .filter((part: any) => part.type === 'text')
            .map((part: any) => part.text)
            .join(' ')
            .trim();
          if (joined) textForEmbedding = joined;
        }

        if (!textForEmbedding) return;

        const embedResult = await this.embedMessageContent(textForEmbedding);
        dimension = embedResult.dimension;

        embeddingData.push({
          embeddings: embedResult.embeddings,
          metadata: embedResult.chunks.map(() => ({
            message_id: message.id,
            thread_id: message.threadId,
            resource_id: message.resourceId,
          })),
        });
      }),
    );

    if (embeddingData.length > 0 && dimension !== undefined) {
      const { indexName } = await this.createEmbeddingIndex(dimension);

      const allVectors: number[][] = [];
      const allMetadata: Array<{
        message_id: string;
        thread_id: string | undefined;
        resource_id: string | undefined;
      }> = [];

      for (const data of embeddingData) {
        allVectors.push(...data.embeddings);
        allMetadata.push(...data.metadata);
      }

      await this.vector.upsert({
        indexName,
        vectors: allVectors,
        metadata: allMetadata,
      });
    }
  }

  /**
   * Check whether retrieval search (vector-based) is enabled.
   * Returns true when `retrieval: { vector: true }` and Memory has vector + embedder configured.
   */
  hasRetrievalSearch(retrieval: ObservationalMemoryOptions['retrieval']): boolean {
    if (!retrieval || retrieval === true) return false;
    return !!retrieval.vector && !!this.vector && !!this.embedder;
  }

  public listTools(config?: MemoryConfigInternal): Record<string, ToolAction<any, any, any>> {
    const mergedConfig = this.getMergedThreadConfig(config);
    const tools: Record<string, ToolAction<any, any, any>> = {};

    if (mergedConfig.workingMemory?.enabled && !mergedConfig.readOnly) {
      tools.updateWorkingMemory = this.isVNextWorkingMemoryConfig(mergedConfig)
        ? __experimental_updateWorkingMemoryToolVNext(mergedConfig)
        : updateWorkingMemoryTool(mergedConfig);
    }

    const omConfig = normalizeObservationalMemoryConfig(mergedConfig.observationalMemory);
    if (omConfig?.retrieval) {
      const retrievalScope =
        typeof omConfig.retrieval === 'object' ? (omConfig.retrieval.scope ?? 'resource') : 'resource';
      tools.recall = recallTool(mergedConfig, { retrievalScope });
    }

    return tools;
  }

  /**
   * Updates a list of messages and syncs the vector database for semantic recall.
   * When message content is updated, the corresponding vector embeddings are also updated
   * to ensure semantic recall stays in sync with the message content.
   *
   * @param messages - The list of messages to update (must include id, can include partial content)
   * @param memoryConfig - Optional memory configuration to determine if semantic recall is enabled
   * @returns The list of updated messages
   */
  public async updateMessages({
    messages,
    memoryConfig,
  }: {
    messages: (Partial<MastraDBMessage> & { id: string })[];
    memoryConfig?: MemoryConfigInternal;
  }): Promise<MastraDBMessage[]> {
    if (messages.length === 0) return [];

    const memoryStore = await this.getMemoryStore();
    const config = this.getMergedThreadConfig(memoryConfig);

    // Update vector database if semantic recall is enabled and any messages have content updates
    if (this.vector && config.semanticRecall) {
      const messagesWithContent = messages.filter(m => m.content !== undefined);

      if (messagesWithContent.length > 0) {
        // Get existing messages to obtain threadId and resourceId for vector metadata
        const existingMessagesResult = await memoryStore.listMessagesById({
          messageIds: messagesWithContent.map(m => m.id),
        });
        const existingMessagesMap = new Map(existingMessagesResult.messages.map(m => [m.id, m]));

        // Collect embeddings for messages with new text content
        const embeddingData: Array<{
          embeddings: number[][];
          metadata: Array<{ message_id: string; thread_id: string | undefined; resource_id: string | undefined }>;
        }> = [];
        let dimension: number | undefined;

        // Track which messages will have new embeddings vs cleared content
        const messageIdsWithNewEmbeddings = new Set<string>();
        const messageIdsWithClearedContent = new Set<string>();

        // Prepare new embeddings and track which messages need vector operations
        await Promise.all(
          messagesWithContent.map(async message => {
            const existingMessage = existingMessagesMap.get(message.id);
            if (!existingMessage) return;

            // Extract text from the new content
            let textForEmbedding: string | null = null;
            const content = message.content;

            if (content) {
              if (
                'content' in content &&
                content.content &&
                typeof content.content === 'string' &&
                content.content.trim() !== ''
              ) {
                textForEmbedding = content.content;
              } else if (
                'parts' in content &&
                content.parts &&
                Array.isArray(content.parts) &&
                content.parts.length > 0
              ) {
                // Extract text from all text parts, concatenate
                const joined = (content.parts as any[])
                  .filter(part => part?.type === 'text')
                  .map(part => (part as TextPart).text)
                  .join(' ')
                  .trim();
                if (joined) textForEmbedding = joined;
              }
            }

            // If there's new text content, embed it
            if (textForEmbedding) {
              const result = await this.embedMessageContent(textForEmbedding);
              dimension = result.dimension;

              embeddingData.push({
                embeddings: result.embeddings,
                metadata: result.chunks.map(() => ({
                  message_id: message.id,
                  thread_id: existingMessage.threadId,
                  resource_id: existingMessage.resourceId,
                })),
              });
              messageIdsWithNewEmbeddings.add(message.id);
            } else {
              // Content is empty or has no text - mark for vector deletion only
              messageIdsWithClearedContent.add(message.id);
            }
          }),
        );

        // Delete old vectors from all existing memory indexes for messages that need it:
        // - Messages with cleared content: vectors must be removed (no new embeddings will replace them)
        // - Messages with new embeddings: old vectors must be removed before upserting (may be in different indexes if embedding model changed)
        const messageIdsNeedingDeletion = new Set([...messageIdsWithClearedContent, ...messageIdsWithNewEmbeddings]);

        if (messageIdsNeedingDeletion.size > 0) {
          try {
            const memoryIndexes = await this.getMemoryVectorIndexes();
            const idsToDelete = [...messageIdsNeedingDeletion];

            await Promise.all(
              memoryIndexes.map(async indexName => {
                for (let i = 0; i < idsToDelete.length; i += VECTOR_DELETE_BATCH_SIZE) {
                  const batch = idsToDelete.slice(i, i + VECTOR_DELETE_BATCH_SIZE);
                  try {
                    await this.vector!.deleteVectors({
                      indexName,
                      filter: { message_id: { $in: batch } },
                    });
                  } catch {
                    this.logger.debug('Failed to delete vector batch, skipping', { indexName, batchOffset: i });
                  }
                }
              }),
            );
          } catch {
            this.logger.debug('Failed to clean up old vectors during message update');
          }
        }

        // Upsert new embeddings if any
        if (embeddingData.length > 0 && dimension !== undefined) {
          const { indexName } = await this.createEmbeddingIndex(dimension, config);

          // Flatten all embeddings and metadata into single arrays
          const allVectors: number[][] = [];
          const allMetadata: Array<{
            message_id: string;
            thread_id: string | undefined;
            resource_id: string | undefined;
          }> = [];

          for (const data of embeddingData) {
            allVectors.push(...data.embeddings);
            allMetadata.push(...data.metadata);
          }

          await this.vector.upsert({
            indexName,
            vectors: allVectors,
            metadata: allMetadata,
          });
        }
      }
    }

    return memoryStore.updateMessages({ messages });
  }

  /**
   * Deletes one or more messages
   * @param input - Must be an array containing either:
   *   - Message ID strings
   *   - Message objects with 'id' properties
   * @returns Promise that resolves when all messages are deleted
   */
  public async deleteMessages(
    input: MessageDeleteInput,
    observabilityContext?: Partial<ObservabilityContext>,
  ): Promise<void> {
    // Normalize input to messageIds before creating span to avoid leaking full message objects into traces
    let messageIds: string[];

    if (!Array.isArray(input)) {
      throw new Error('Invalid input: must be an array of message IDs or message objects');
    }

    if (input.length === 0) {
      return;
    }

    messageIds = input.map(item => {
      if (typeof item === 'string') {
        return item;
      } else if (item && typeof item === 'object' && 'id' in item) {
        return item.id;
      } else {
        throw new Error('Invalid input: array items must be strings or objects with an id property');
      }
    });

    const invalidIds = messageIds.filter(id => !id || typeof id !== 'string');
    if (invalidIds.length > 0) {
      throw new Error('All message IDs must be non-empty strings');
    }

    const span = this.createMemorySpan('delete', observabilityContext, undefined, {
      messageCount: messageIds.length,
    });

    try {
      const memoryStore = await this.getMemoryStore();

      await memoryStore.deleteMessages(messageIds);
      if (this.vector) {
        void this.deleteMessageVectors(messageIds);
      }

      span?.end({ output: { success: true }, attributes: { messageCount: messageIds.length } });
    } catch (error) {
      span?.error({ error: error as Error, endSpan: true });
      throw error;
    }
  }

  /**
   * Deletes vector embeddings for specific messages.
   * This is called internally by deleteMessages to clean up orphaned vectors.
   *
   * @param messageIds - The IDs of the messages whose vectors should be deleted
   */
  private async deleteMessageVectors(messageIds: string[]): Promise<void> {
    try {
      const memoryIndexes = await this.getMemoryVectorIndexes();

      await Promise.all(
        memoryIndexes.map(async (indexName: string) => {
          for (let i = 0; i < messageIds.length; i += VECTOR_DELETE_BATCH_SIZE) {
            const batch = messageIds.slice(i, i + VECTOR_DELETE_BATCH_SIZE);
            try {
              await this.vector!.deleteVectors({
                indexName,
                filter: { message_id: { $in: batch } },
              });
            } catch {
              this.logger.debug('Failed to delete vector batch, skipping', { indexName, batchOffset: i });
            }
          }
        }),
      );
    } catch {
      this.logger.debug('Failed to clean up vectors for deleted messages');
    }
  }

  /**
   * Clone a thread and its messages to create a new independent thread.
   * The cloned thread will have metadata tracking its source.
   *
   * If semantic recall is enabled, the cloned messages will also be embedded
   * and added to the vector store for semantic search.
   *
   * @param args - Clone configuration options
   * @param args.sourceThreadId - ID of the thread to clone
   * @param args.newThreadId - ID for the new cloned thread (if not provided, a random UUID will be generated)
   * @param args.resourceId - Resource ID for the new thread (defaults to source thread's resourceId)
   * @param args.title - Title for the new cloned thread
   * @param args.metadata - Additional metadata to merge with clone metadata
   * @param args.options - Options for filtering which messages to include
   * @param args.options.messageLimit - Maximum number of messages to copy (from most recent)
   * @param args.options.messageFilter - Filter messages by date range or specific IDs
   * @param memoryConfig - Optional memory configuration override
   * @returns The newly created thread and the cloned messages
   *
   * @example
   * ```typescript
   * // Clone entire thread
   * const { thread, clonedMessages } = await memory.cloneThread({
   *   sourceThreadId: 'thread-123',
   * });
   *
   * // Clone with custom ID
   * const { thread, clonedMessages } = await memory.cloneThread({
   *   sourceThreadId: 'thread-123',
   *   newThreadId: 'my-custom-thread-id',
   * });
   *
   * // Clone with message limit
   * const { thread, clonedMessages } = await memory.cloneThread({
   *   sourceThreadId: 'thread-123',
   *   title: 'My cloned conversation',
   *   options: {
   *     messageLimit: 10, // Only clone last 10 messages
   *   },
   * });
   *
   * // Clone with date filter
   * const { thread, clonedMessages } = await memory.cloneThread({
   *   sourceThreadId: 'thread-123',
   *   options: {
   *     messageFilter: {
   *       startDate: new Date('2024-01-01'),
   *       endDate: new Date('2024-06-01'),
   *     },
   *   },
   * });
   * ```
   */
  public async cloneThread(
    args: StorageCloneThreadInput,
    memoryConfig?: MemoryConfigInternal,
  ): Promise<StorageCloneThreadOutput> {
    const memoryStore = await this.getMemoryStore();
    const result = await memoryStore.cloneThread(args);
    const config = this.getMergedThreadConfig(memoryConfig);

    // Fetch source thread once for working memory and OM cloning
    const sourceThread = await this.getThreadById({ threadId: args.sourceThreadId });
    const sourceResourceId = sourceThread?.resourceId;

    // Copy working memory from source thread to cloned thread.
    // Thread-scoped: always copy since each thread has its own working memory.
    // Resource-scoped: only copy when the clone uses a different resourceId (same resourceId shares memory naturally).
    if (config.workingMemory?.enabled) {
      const scope = config.workingMemory.scope || 'resource';
      const shouldCopy =
        scope === 'thread' || (scope === 'resource' && args.resourceId && args.resourceId !== sourceResourceId);

      if (shouldCopy) {
        const sourceWm = await this.getWorkingMemory({
          threadId: args.sourceThreadId,
          resourceId: sourceResourceId,
          memoryConfig,
        });
        if (sourceWm) {
          await this.updateWorkingMemory({
            threadId: result.thread.id,
            resourceId: result.thread.resourceId,
            workingMemory: sourceWm,
            memoryConfig,
          });
        }
      }
    }

    // Clone observational memory if supported.
    // Thread-scoped: always clone since each thread has its own OM.
    // Resource-scoped: only clone when the resourceId changes (same resourceId shares OM naturally).
    if (memoryStore.supportsObservationalMemory && sourceResourceId) {
      try {
        await this.cloneObservationalMemory(memoryStore, args.sourceThreadId, sourceResourceId, result);
      } catch (error) {
        // Rollback the already-persisted clone to avoid orphaned threads
        try {
          await memoryStore.deleteThread({ threadId: result.thread.id });
        } catch (rollbackError) {
          this.logger.error('Failed to rollback cloned thread after OM clone failure', rollbackError);
        }
        throw error;
      }
    }

    // Embed cloned messages only after OM cloning succeeds, so rollback doesn't leave orphan vectors
    if (this.vector && config.semanticRecall && result.clonedMessages.length > 0) {
      await this.embedClonedMessages(result.clonedMessages, config);
    }

    return result;
  }

  /**
   * Clone observational memory records when cloning a thread.
   * Thread-scoped: always cloned to the new thread.
   * Resource-scoped: cloned only when the resourceId changes (same resourceId shares OM naturally).
   * All stored message/thread IDs are remapped to the cloned IDs.
   */
  private async cloneObservationalMemory(
    memoryStore: MemoryStorage,
    sourceThreadId: string,
    sourceResourceId: string,
    result: StorageCloneThreadOutput,
  ): Promise<void> {
    // Look up OM for thread-scoped first (threadId + resourceId), then resource-scoped (null + resourceId)
    let sourceOM = await memoryStore.getObservationalMemory(sourceThreadId, sourceResourceId);
    if (!sourceOM) {
      sourceOM = await memoryStore.getObservationalMemory(null, sourceResourceId);
    }
    if (!sourceOM) return;

    const clonedThreadId = result.thread.id;
    const clonedResourceId = result.thread.resourceId;
    const resourceChanged = clonedResourceId !== sourceResourceId;

    // Resource-scoped OM with same resourceId: shared naturally, no clone needed
    if (sourceOM.scope === 'resource' && !resourceChanged) return;

    // Build source → clone message ID map
    const messageIdMap = result.messageIdMap ?? {};
    const hasher = await this.hasher;

    const cloned = this.remapObservationalMemoryRecord(sourceOM, {
      newThreadId: sourceOM.scope === 'thread' ? clonedThreadId : null,
      newResourceId: clonedResourceId,
      messageIdMap,
      sourceThreadId: resourceChanged ? sourceThreadId : undefined,
      clonedThreadId: resourceChanged ? clonedThreadId : undefined,
      hasher: resourceChanged ? hasher : undefined,
    });
    const now = new Date();
    cloned.id = crypto.randomUUID();
    cloned.createdAt = now;
    cloned.updatedAt = now;
    await memoryStore.insertObservationalMemoryRecord(cloned);
  }

  /**
   * Create a remapped copy of an OM record with new thread/message IDs.
   */
  private remapObservationalMemoryRecord(
    record: ObservationalMemoryRecord,
    opts: {
      newThreadId: string | null;
      newResourceId: string;
      messageIdMap: Record<string, string>;
      sourceThreadId?: string;
      clonedThreadId?: string;
      hasher?: Awaited<ReturnType<typeof xxhash>>;
    },
  ): ObservationalMemoryRecord {
    const { newThreadId, newResourceId, messageIdMap, sourceThreadId, clonedThreadId, hasher } = opts;
    const cloned: ObservationalMemoryRecord = { ...record };

    cloned.threadId = newThreadId;
    cloned.resourceId = newResourceId;

    // Remap observedMessageIds — drop any IDs not present in the clone's message set
    if (Array.isArray(cloned.observedMessageIds)) {
      cloned.observedMessageIds = cloned.observedMessageIds
        .map(id => messageIdMap[id])
        .filter((id): id is string => Boolean(id));
    } else {
      cloned.observedMessageIds = undefined;
    }

    // Remap deprecated bufferedMessageIds
    if (Array.isArray(cloned.bufferedMessageIds)) {
      cloned.bufferedMessageIds = cloned.bufferedMessageIds
        .map(id => messageIdMap[id])
        .filter((id): id is string => Boolean(id));
    } else {
      cloned.bufferedMessageIds = undefined;
    }

    // Remap bufferedObservationChunks
    if (Array.isArray(cloned.bufferedObservationChunks)) {
      cloned.bufferedObservationChunks = cloned.bufferedObservationChunks.map(
        (chunk: BufferedObservationChunk): BufferedObservationChunk => ({
          ...chunk,
          messageIds: Array.isArray(chunk.messageIds)
            ? chunk.messageIds.map((id: string) => messageIdMap[id]).filter((id): id is string => Boolean(id))
            : [],
        }),
      );
    } else {
      cloned.bufferedObservationChunks = undefined;
    }

    // For resource-scoped OM cloned to a new resource, remap thread tags in text fields
    if (sourceThreadId && clonedThreadId && hasher) {
      const sourceObscured = hasher.h32ToString(sourceThreadId);
      const clonedObscured = hasher.h32ToString(clonedThreadId);

      if (sourceObscured !== clonedObscured) {
        const replaceThreadTags = (text: string | undefined): string | undefined => {
          if (!text) return text;
          return text.replaceAll(`<thread id="${sourceObscured}">`, `<thread id="${clonedObscured}">`);
        };

        cloned.activeObservations = replaceThreadTags(cloned.activeObservations) ?? '';
        cloned.bufferedReflection = replaceThreadTags(cloned.bufferedReflection);

        if (cloned.bufferedObservationChunks) {
          cloned.bufferedObservationChunks = cloned.bufferedObservationChunks.map(
            (chunk: BufferedObservationChunk): BufferedObservationChunk => ({
              ...chunk,
              observations: replaceThreadTags(chunk.observations) ?? chunk.observations,
            }),
          );
        }
      }
    }

    // Reset transient state flags
    cloned.isObserving = false;
    cloned.isReflecting = false;
    cloned.isBufferingObservation = false;
    cloned.isBufferingReflection = false;

    return cloned;
  }

  /**
   * Embed cloned messages for semantic recall.
   * This is similar to the embedding logic in saveMessages but operates on already-saved messages.
   */
  private async embedClonedMessages(messages: MastraDBMessage[], config: MemoryConfigInternal): Promise<void> {
    if (!this.vector || !this.embedder) {
      return;
    }

    const embeddingData: Array<{
      embeddings: number[][];
      metadata: Array<{ message_id: string; thread_id: string | undefined; resource_id: string | undefined }>;
    }> = [];
    let dimension: number | undefined;

    // Process embeddings concurrently
    await Promise.all(
      messages.map(async message => {
        let textForEmbedding: string | null = null;

        if (
          message.content?.content &&
          typeof message.content.content === 'string' &&
          message.content.content.trim() !== ''
        ) {
          textForEmbedding = message.content.content;
        } else if (message.content?.parts && message.content.parts.length > 0) {
          // Extract text from all text parts, concatenate
          const joined = message.content.parts
            .filter((part: { type: string }) => part.type === 'text')
            .map((part: { type: string; text?: string }) => (part as { type: string; text: string }).text)
            .join(' ')
            .trim();
          if (joined) textForEmbedding = joined;
        }

        if (!textForEmbedding) return;

        const result = await this.embedMessageContent(textForEmbedding);
        dimension = result.dimension;

        embeddingData.push({
          embeddings: result.embeddings,
          metadata: result.chunks.map(() => ({
            message_id: message.id,
            thread_id: message.threadId,
            resource_id: message.resourceId,
          })),
        });
      }),
    );

    // Batch all vectors into a single upsert call
    if (embeddingData.length > 0 && dimension !== undefined) {
      const { indexName } = await this.createEmbeddingIndex(dimension, config);

      // Flatten all embeddings and metadata into single arrays
      const allVectors: number[][] = [];
      const allMetadata: Array<{
        message_id: string;
        thread_id: string | undefined;
        resource_id: string | undefined;
      }> = [];

      for (const data of embeddingData) {
        allVectors.push(...data.embeddings);
        allMetadata.push(...data.metadata);
      }

      await this.vector.upsert({
        indexName,
        vectors: allVectors,
        metadata: allMetadata,
      });
    }
  }

  /**
   * Get the clone metadata from a thread if it was cloned from another thread.
   *
   * @param thread - The thread to check
   * @returns The clone metadata if the thread is a clone, null otherwise
   *
   * @example
   * ```typescript
   * const thread = await memory.getThreadById({ threadId: 'thread-123' });
   * const cloneInfo = memory.getCloneMetadata(thread);
   * if (cloneInfo) {
   *   console.log(`This thread was cloned from ${cloneInfo.sourceThreadId}`);
   * }
   * ```
   */
  public getCloneMetadata(thread: StorageThreadType | null): ThreadCloneMetadata | null {
    if (!thread?.metadata?.clone) {
      return null;
    }
    return thread.metadata.clone as ThreadCloneMetadata;
  }

  /**
   * Check if a thread is a clone of another thread.
   *
   * @param thread - The thread to check
   * @returns True if the thread is a clone, false otherwise
   *
   * @example
   * ```typescript
   * const thread = await memory.getThreadById({ threadId: 'thread-123' });
   * if (memory.isClone(thread)) {
   *   console.log('This is a cloned thread');
   * }
   * ```
   */
  public isClone(thread: StorageThreadType | null): boolean {
    return this.getCloneMetadata(thread) !== null;
  }

  /**
   * Get the source thread that a cloned thread was created from.
   *
   * @param threadId - ID of the cloned thread
   * @returns The source thread if found, null if the thread is not a clone or source doesn't exist
   *
   * @example
   * ```typescript
   * const sourceThread = await memory.getSourceThread('cloned-thread-123');
   * if (sourceThread) {
   *   console.log(`Original thread: ${sourceThread.title}`);
   * }
   * ```
   */
  public async getSourceThread(threadId: string): Promise<StorageThreadType | null> {
    const thread = await this.getThreadById({ threadId });
    const cloneMetadata = this.getCloneMetadata(thread);

    if (!cloneMetadata) {
      return null;
    }

    return this.getThreadById({ threadId: cloneMetadata.sourceThreadId });
  }

  /**
   * List all threads that were cloned from a specific source thread.
   *
   * @param sourceThreadId - ID of the source thread
   * @param resourceId - Optional resource ID to filter by
   * @returns Array of threads that are clones of the source thread
   *
   * @example
   * ```typescript
   * const clones = await memory.listClones('original-thread-123', 'user-456');
   * console.log(`Found ${clones.length} clones of this thread`);
   * ```
   */
  public async listClones(sourceThreadId: string, resourceId?: string): Promise<StorageThreadType[]> {
    // If resourceId is provided, use it to scope the search
    // Otherwise, get the source thread's resourceId
    let targetResourceId = resourceId;

    if (!targetResourceId) {
      const sourceThread = await this.getThreadById({ threadId: sourceThreadId });
      if (!sourceThread) {
        return [];
      }
      targetResourceId = sourceThread.resourceId;
    }

    // List all threads for the resource and filter for clones
    const { threads } = await this.listThreads({
      filter: { resourceId: targetResourceId },
      perPage: false, // Get all threads
    });

    return threads.filter(thread => {
      const cloneMetadata = this.getCloneMetadata(thread);
      return cloneMetadata?.sourceThreadId === sourceThreadId;
    });
  }

  /**
   * Get the clone history chain for a thread (all ancestors back to the original).
   *
   * @param threadId - ID of the thread to get history for
   * @returns Array of threads from oldest ancestor to the given thread (inclusive)
   *
   * @example
   * ```typescript
   * const history = await memory.getCloneHistory('deeply-cloned-thread');
   * // Returns: [originalThread, firstClone, secondClone, deeplyClonedThread]
   * ```
   */
  public async getCloneHistory(threadId: string): Promise<StorageThreadType[]> {
    const history: StorageThreadType[] = [];
    let currentThreadId: string | null = threadId;

    while (currentThreadId) {
      const thread = await this.getThreadById({ threadId: currentThreadId });
      if (!thread) {
        break;
      }

      history.unshift(thread); // Add to beginning to maintain order from oldest to newest

      const cloneMetadata = this.getCloneMetadata(thread);
      currentThreadId = cloneMetadata?.sourceThreadId ?? null;
    }

    return history;
  }

  /**
   * Get input processors for this memory instance.
   * Extends the base implementation to add ObservationalMemory processor when configured.
   *
   * @param configuredProcessors - Processors already configured by the user (for deduplication)
   * @param context - Request context for runtime configuration
   * @returns Array of input processors configured for this memory instance
   */
  async getInputProcessors(
    configuredProcessors: InputProcessorOrWorkflow[] = [],
    context?: RequestContext,
  ): Promise<InputProcessor[]> {
    // Get base processors from parent class
    const processors = await super.getInputProcessors(configuredProcessors, context);

    const om = await this.createOMProcessor(configuredProcessors, context);
    if (om) {
      processors.push(om);
    }

    return processors;
  }

  /**
   * Extends the base implementation to add ObservationalMemory as an output processor.
   * OM needs processOutputResult to save messages at the end of the agent turn,
   * even when the observation threshold was never reached during the loop.
   */
  async getOutputProcessors(
    configuredProcessors: OutputProcessorOrWorkflow[] = [],
    context?: RequestContext,
  ): Promise<OutputProcessor[]> {
    const processors = await super.getOutputProcessors(configuredProcessors, context);

    const om = await this.createOMProcessor(configuredProcessors, context);
    if (om) {
      processors.push(om as unknown as OutputProcessor);
    }

    return processors;
  }

  /**
   * Creates an ObservationalMemory processor wrapping the shared engine.
   * Returns null if OM is not configured, not supported, or already present
   * in the user's configured processors.
   */
  private async createOMProcessor(
    configuredProcessors: (InputProcessorOrWorkflow | OutputProcessorOrWorkflow)[] = [],
    context?: RequestContext,
  ): Promise<InputProcessor | null> {
    const hasObservationalMemory = configuredProcessors.some(
      p => !('workflow' in p) && p.id === 'observational-memory',
    );
    if (hasObservationalMemory) return null;

    const runtimeMemory = context?.get('MastraMemory') as { memoryConfig?: RuntimeMemoryConfig } | undefined;
    const runtimeObservationalMemory = normalizeObservationalMemoryConfig(
      runtimeMemory?.memoryConfig?.observationalMemory,
    );
    const threadConfig = runtimeObservationalMemory
      ? this.getMergedThreadConfig({
          ...runtimeMemory?.memoryConfig,
          observationalMemory: runtimeObservationalMemory,
        } as MemoryConfigInternal)
      : this.threadConfig;

    const effectiveConfig = normalizeObservationalMemoryConfig(threadConfig.observationalMemory);
    if (!effectiveConfig) return null;

    const engine = await this.omEngine;
    if (!engine) return null;

    const { ObservationalMemoryProcessor } = await import('./processors/observational-memory');
    return new ObservationalMemoryProcessor(engine, this, {
      temporalMarkers: effectiveConfig.temporalMarkers,
    });
  }
}

// Re-export memory processors from @mastra/core for backward compatibility
export { SemanticRecall, WorkingMemory, MessageHistory } from '@mastra/core/processors';

// Re-export clone-related types for convenience
export type { StorageCloneThreadInput, StorageCloneThreadOutput, ThreadCloneMetadata } from '@mastra/core/storage';

// Observational Memory utilities
export { getObservationsAsOf } from './processors/observational-memory';
