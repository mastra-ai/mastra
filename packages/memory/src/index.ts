import { embedMany } from '@internal/ai-sdk-v4';
import type { TextPart } from '@internal/ai-sdk-v4';
import { embedMany as embedManyV5 } from '@internal/ai-sdk-v5';
import { embedMany as embedManyV6 } from '@internal/ai-v6';
import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';

import type {
  MemoryConfig,
  SharedMemoryConfig,
  StorageThreadType,
  WorkingMemoryTemplate,
  MessageDeleteInput,
} from '@mastra/core/memory';
import { MastraMemory, extractWorkingMemoryContent, removeWorkingMemoryTags } from '@mastra/core/memory';
import { getGlobalMetricsCollector } from '@mastra/core/observability';
import type {
  StorageListThreadsByResourceIdOutput,
  StorageListThreadsByResourceIdInput,
  StorageListMessagesInput,
  MemoryStorage,
  StorageCloneThreadInput,
  StorageCloneThreadOutput,
  ThreadCloneMetadata,
} from '@mastra/core/storage';
import type { ToolAction } from '@mastra/core/tools';
import { generateEmptyFromSchema } from '@mastra/core/utils';
import { zodToJsonSchema } from '@mastra/schema-compat/zod-to-json';
import { Mutex } from 'async-mutex';
import type { JSONSchema7 } from 'json-schema';
import xxhash from 'xxhash-wasm';
import { ZodObject } from 'zod';
import type { ZodTypeAny } from 'zod';
import {
  updateWorkingMemoryTool,
  __experimental_updateWorkingMemoryToolVNext,
  deepMergeWorkingMemory,
} from './tools/working-memory';

// Re-export for testing purposes
export { deepMergeWorkingMemory };
export { extractWorkingMemoryTags, extractWorkingMemoryContent, removeWorkingMemoryTags } from '@mastra/core/memory';

// Average characters per token based on OpenAI's tokenization
const CHARS_PER_TOKEN = 4;

const DEFAULT_MESSAGE_RANGE = { before: 1, after: 1 } as const;
const DEFAULT_TOP_K = 4;

const isZodObject = (v: ZodTypeAny): v is ZodObject<any, any, any> => v instanceof ZodObject;

/**
 * Concrete implementation of MastraMemory that adds support for thread configuration
 * and message injection.
 */
export class Memory extends MastraMemory {
  constructor(config: SharedMemoryConfig = {}) {
    super({ name: 'Memory', ...config });

    const mergedConfig = this.getMergedThreadConfig({
      workingMemory: config.options?.workingMemory || {
        // these defaults are now set inside @mastra/core/memory in getMergedThreadConfig.
        // In a future release we can remove it from this block - for now if we remove it
        // and someone bumps @mastra/memory without bumping @mastra/core the defaults wouldn't exist yet
        enabled: false,
        template: this.defaultWorkingMemoryTemplate,
      },
    });
    this.threadConfig = mergedConfig;
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

  protected async validateThreadIsOwnedByResource(threadId: string, resourceId: string, config: MemoryConfig) {
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

  async recall(
    args: StorageListMessagesInput & {
      threadConfig?: MemoryConfig;
      vectorSearchString?: string;
      threadId: string;
    },
  ): Promise<{ messages: MastraDBMessage[] }> {
    const startTime = Date.now();
    let embedDurationMs: number | undefined;
    let vectorSearchDurationMs: number | undefined;
    let semanticSearchUsed = false;
    let resultCount = 0;
    let success = false;
    let errorType: string | undefined;

    const { threadId, resourceId, perPage: perPageArg, page, orderBy, threadConfig, vectorSearchString, filter } = args;

    try {
      const config = this.getMergedThreadConfig(threadConfig || {});
      if (resourceId) await this.validateThreadIsOwnedByResource(threadId, resourceId, config);

      // Use perPage from args if provided, otherwise use threadConfig.lastMessages
      const perPage = perPageArg !== undefined ? perPageArg : config.lastMessages;

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
      this.logger.debug(`Memory recall() with:`, {
        threadId,
        perPage,
        page,
        orderBy: effectiveOrderBy,
        hasWorkingMemorySchema: Boolean(config.workingMemory?.schema),
        workingMemoryEnabled: config.workingMemory?.enabled,
        semanticRecallEnabled: Boolean(config.semanticRecall),
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

      if (config?.semanticRecall && vectorSearchString && this.vector) {
        semanticSearchUsed = true;

        // Track embedding time
        const embedStart = Date.now();
        const { embeddings, dimension } = await this.embedMessageContent(vectorSearchString!);
        embedDurationMs = Date.now() - embedStart;

        const { indexName } = await this.createEmbeddingIndex(dimension, config);

        // Track vector search time
        const vectorSearchStart = Date.now();
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
        vectorSearchDurationMs = Date.now() - vectorSearchStart;
      }

      // Get raw messages from storage
      const memoryStore = await this.getMemoryStore();
      const paginatedResult = await memoryStore.listMessages({
        threadId,
        resourceId,
        perPage,
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
      const messages = list.get.all.db();
      resultCount = messages.length;
      success = true;

      return { messages };
    } catch (error) {
      errorType = error instanceof Error ? error.name : 'UnknownError';
      throw error;
    } finally {
      // Record metrics
      const durationMs = Date.now() - startTime;
      const metrics = getGlobalMetricsCollector();
      metrics.recordMemoryRecall({
        threadId,
        resourceId,
        resultCount,
        durationMs,
        embedDurationMs,
        vectorSearchDurationMs,
        semanticSearch: semanticSearchUsed,
        success,
        errorType,
      });
    }
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    const memoryStore = await this.getMemoryStore();
    return memoryStore.getThreadById({ threadId });
  }

  async listThreadsByResourceId(
    args: StorageListThreadsByResourceIdInput,
  ): Promise<StorageListThreadsByResourceIdOutput> {
    const memoryStore = await this.getMemoryStore();
    return memoryStore.listThreadsByResourceId(args);
  }

  private async handleWorkingMemoryFromMetadata({
    workingMemory,
    resourceId,
    memoryConfig,
  }: {
    workingMemory: string;
    resourceId: string;
    memoryConfig?: MemoryConfig;
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
    memoryConfig?: MemoryConfig;
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
    memoryConfig?: MemoryConfig;
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
    memoryConfig?: MemoryConfig;
  }): Promise<void> {
    const config = this.getMergedThreadConfig(memoryConfig || {});

    if (!config.workingMemory?.enabled) {
      throw new Error('Working memory is not enabled for this memory instance');
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
    } else {
      // Update working memory in thread metadata (existing behavior)
      const thread = await this.getThreadById({ threadId });
      if (!thread) {
        throw new Error(`Thread ${threadId} not found`);
      }

      await memoryStore.updateThread({
        id: threadId,
        title: thread.title || 'Untitled Thread',
        metadata: {
          ...thread.metadata,
          workingMemory,
        },
      });
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
    memoryConfig?: MemoryConfig;
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
      if (existingWorkingMemory) {
        if (searchString && existingWorkingMemory?.includes(searchString)) {
          workingMemory = existingWorkingMemory.replace(searchString, workingMemory);
          reason = `found and replaced searchString with newMemory`;
        } else if (
          existingWorkingMemory.includes(workingMemory) ||
          template?.content?.trim() === workingMemory.trim()
        ) {
          return {
            success: false,
            reason: `attempted to insert duplicate data into working memory. this entry was skipped`,
          };
        } else {
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
      } else if (workingMemory === template?.content) {
        return {
          success: false,
          reason: `try again when you have data to add. newMemory was equal to the working memory template`,
        };
      } else {
        reason = `started new working memory`;
      }

      // remove empty template insertions which models sometimes duplicate
      workingMemory = template?.content ? workingMemory.replaceAll(template?.content, '') : workingMemory;

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
          title: thread.title || 'Untitled Thread',
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
      dimension: number | undefined;
    }
  >();
  private firstEmbed: Promise<any> | undefined;
  protected async embedMessageContent(content: string) {
    // use fast xxhash for lower memory usage. if we cache by content string we will store all messages in memory for the life of the process
    const key = (await this.hasher).h32(content);
    const cached = this.embeddingCache.get(key);
    if (cached) return cached;
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
      // @ts-ignore
      model: this.embedder,
      ...(this.embedderOptions || {}),
    });

    if (isFastEmbed && !this.firstEmbed) this.firstEmbed = promise;
    const { embeddings } = await promise;

    const result = {
      embeddings,
      chunks,
      dimension: embeddings[0]?.length,
    };
    this.embeddingCache.set(key, result);
    return result;
  }

  async saveMessages({
    messages,
    memoryConfig,
  }: {
    messages: MastraDBMessage[];
    memoryConfig?: MemoryConfig | undefined;
  }): Promise<{ messages: MastraDBMessage[] }> {
    const startTime = Date.now();
    let embedDurationMs: number | undefined;
    let vectorizationDurationMs: number | undefined;
    let vectorized = false;
    let success = false;
    let errorType: string | undefined;
    const messageCount = messages.length;
    let threadId: string | undefined;

    try {
      // Then strip working memory tags from all messages
      const updatedMessages = messages
        .map(m => {
          return this.updateMessageToHideWorkingMemoryV2(m);
        })
        .filter((m): m is MastraDBMessage => Boolean(m));

      // Capture threadId from first message if available
      threadId = updatedMessages[0]?.threadId;

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

      if (this.vector && config.semanticRecall) {
        vectorized = true;
        const embedStart = Date.now();

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
        embedDurationMs = Date.now() - embedStart;

        // Batch all vectors into a single upsert call to avoid pool exhaustion
        if (embeddingData.length > 0 && dimension !== undefined) {
          if (typeof this.vector === `undefined`) {
            throw new Error(`Tried to upsert embeddings but this Memory instance doesn't have an attached vector db.`);
          }

          const vectorizationStart = Date.now();
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
          vectorizationDurationMs = Date.now() - vectorizationStart;
        }
      }

      success = true;
      return result;
    } catch (error) {
      errorType = error instanceof Error ? error.name : 'UnknownError';
      throw error;
    } finally {
      // Record metrics
      const durationMs = Date.now() - startTime;
      const metrics = getGlobalMetricsCollector();
      metrics.recordMemorySave({
        threadId,
        messageCount,
        durationMs,
        embedDurationMs,
        vectorizationDurationMs,
        vectorized,
        success,
        errorType,
      });
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

      // If all parts were filtered out (e.g., only contained updateWorkingMemory tool calls) we need to skip the whole message, it was only working memory tool calls/results
      if (newMessage.content.parts.length === 0) {
        return null;
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
    memoryConfig?: MemoryConfig;
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
    memoryConfig?: MemoryConfig;
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

        if (isZodObject(schema as ZodTypeAny)) {
          convertedSchema = zodToJsonSchema(schema as ZodTypeAny);
        } else {
          convertedSchema = schema as JSONSchema7;
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
    memoryConfig?: MemoryConfig;
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

  private isVNextWorkingMemoryConfig(config?: MemoryConfig): boolean {
    if (!config?.workingMemory) return false;

    const isMDWorkingMemory =
      !(`schema` in config.workingMemory) &&
      (typeof config.workingMemory.template === `string` || config.workingMemory.template) &&
      config.workingMemory;

    return Boolean(isMDWorkingMemory && isMDWorkingMemory.version === `vnext`);
  }

  public listTools(config?: MemoryConfig): Record<string, ToolAction<any, any, any>> {
    const mergedConfig = this.getMergedThreadConfig(config);
    if (mergedConfig.workingMemory?.enabled) {
      return {
        updateWorkingMemory: this.isVNextWorkingMemoryConfig(mergedConfig)
          ? // use the new experimental tool
            __experimental_updateWorkingMemoryToolVNext(mergedConfig)
          : updateWorkingMemoryTool(mergedConfig),
      };
    }
    return {};
  }

  /**
   * Updates the metadata of a list of messages
   * @param messages - The list of messages to update
   * @returns The list of updated messages
   */
  public async updateMessages({
    messages,
  }: {
    messages: Partial<MastraDBMessage> & { id: string }[];
  }): Promise<MastraDBMessage[]> {
    if (messages.length === 0) return [];

    // TODO: Possibly handle updating the vector db here when a message is updated.

    const memoryStore = await this.getMemoryStore();
    return memoryStore.updateMessages({ messages });
  }

  /**
   * Deletes one or more messages
   * @param input - Must be an array containing either:
   *   - Message ID strings
   *   - Message objects with 'id' properties
   * @returns Promise that resolves when all messages are deleted
   */
  public async deleteMessages(input: MessageDeleteInput): Promise<void> {
    // Normalize input to array of IDs
    let messageIds: string[];

    if (!Array.isArray(input)) {
      throw new Error('Invalid input: must be an array of message IDs or message objects');
    }

    if (input.length === 0) {
      return; // No-op for empty array
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

    // Validate all IDs are non-empty strings
    const invalidIds = messageIds.filter(id => !id || typeof id !== 'string');
    if (invalidIds.length > 0) {
      throw new Error('All message IDs must be non-empty strings');
    }

    // Delete from storage
    const memoryStore = await this.getMemoryStore();
    await memoryStore.deleteMessages(messageIds);

    // TODO: Delete from vector store if semantic recall is enabled
    // This would require getting the messages first to know their threadId/resourceId
    // and then querying the vector store to delete associated embeddings
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
    memoryConfig?: MemoryConfig,
  ): Promise<StorageCloneThreadOutput> {
    const memoryStore = await this.getMemoryStore();
    const result = await memoryStore.cloneThread(args);

    // If semantic recall is enabled, embed the cloned messages
    const config = this.getMergedThreadConfig(memoryConfig);
    if (this.vector && config.semanticRecall && result.clonedMessages.length > 0) {
      await this.embedClonedMessages(result.clonedMessages, config);
    }

    return result;
  }

  /**
   * Embed cloned messages for semantic recall.
   * This is similar to the embedding logic in saveMessages but operates on already-saved messages.
   */
  private async embedClonedMessages(messages: MastraDBMessage[], config: MemoryConfig): Promise<void> {
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
    const { threads } = await this.listThreadsByResourceId({
      resourceId: targetResourceId,
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
}

// Re-export memory processors from @mastra/core for backward compatibility
export { SemanticRecall, WorkingMemory, MessageHistory } from '@mastra/core/processors';

// Re-export clone-related types for convenience
export type { StorageCloneThreadInput, StorageCloneThreadOutput, ThreadCloneMetadata } from '@mastra/core/storage';
