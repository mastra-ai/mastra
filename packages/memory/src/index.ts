import { generateEmptyFromSchema } from '@mastra/core';
import type { CoreTool, MastraMessageV1 } from '@mastra/core';
import { MessageList } from '@mastra/core/agent';
import type { MastraMessageV2, UIMessageWithMetadata } from '@mastra/core/agent';
import { MastraMemory } from '@mastra/core/memory';
import type { MemoryConfig, SharedMemoryConfig, StorageThreadType, WorkingMemoryTemplate } from '@mastra/core/memory';
import type { StorageGetMessagesArg, ThreadSortOptions, PaginationInfo } from '@mastra/core/storage';
import { embedMany } from 'ai';
import type { CoreMessage, TextPart } from 'ai';
import { Mutex } from 'async-mutex';
import type { JSONSchema7 } from 'json-schema';

import xxhash from 'xxhash-wasm';
import { ZodObject } from 'zod';
import type { ZodTypeAny } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import { updateWorkingMemoryTool, __experimental_updateWorkingMemoryToolVNext } from './tools/working-memory';

// Type for flexible message deletion input
export type MessageDeleteInput = string[] | { id: string }[];

// Average characters per token based on OpenAI's tokenization
const CHARS_PER_TOKEN = 4;

const DEFAULT_MESSAGE_RANGE = { before: 2, after: 2 } as const;
const DEFAULT_TOP_K = 2;

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

  protected async validateThreadIsOwnedByResource(threadId: string, resourceId: string) {
    const thread = await this.storage.getThreadById({ threadId });
    if (!thread) {
      throw new Error(`No thread found with id ${threadId}`);
    }
    if (thread.resourceId !== resourceId) {
      throw new Error(
        `Thread with id ${threadId} is for resource with id ${thread.resourceId} but resource ${resourceId} was queried.`,
      );
    }
  }

  protected checkStorageFeatureSupport(config: MemoryConfig) {
    if (
      typeof config.semanticRecall === `object` &&
      config.semanticRecall.scope === `resource` &&
      !this.storage.supports.selectByIncludeResourceScope
    ) {
      throw new Error(
        `Memory error: Attached storage adapter "${this.storage.name || 'unknown'}" doesn't support semanticRecall: { scope: "resource" } yet and currently only supports per-thread semantic recall.`,
      );
    }

    if (
      config.workingMemory?.enabled &&
      config.workingMemory.scope === `resource` &&
      !this.storage.supports.resourceWorkingMemory
    ) {
      throw new Error(
        `Memory error: Attached storage adapter "${this.storage.name || 'unknown'}" doesn't support workingMemory: { scope: "resource" } yet and currently only supports per-thread working memory. Supported adapters: LibSQL, PostgreSQL, Upstash.`,
      );
    }
  }

  async query({
    threadId,
    resourceId,
    selectBy,
    threadConfig,
  }: StorageGetMessagesArg & {
    threadConfig?: MemoryConfig;
  }): Promise<{ messages: CoreMessage[]; uiMessages: UIMessageWithMetadata[]; messagesV2: MastraMessageV2[] }> {
    if (resourceId) await this.validateThreadIsOwnedByResource(threadId, resourceId);

    const vectorResults: {
      id: string;
      score: number;
      metadata?: Record<string, any>;
      vector?: number[];
    }[] = [];

    this.logger.debug(`Memory query() with:`, {
      threadId,
      selectBy,
      threadConfig,
    });

    const config = this.getMergedThreadConfig(threadConfig || {});

    this.checkStorageFeatureSupport(config);

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

    const resourceScope = typeof config?.semanticRecall === 'object' && config?.semanticRecall?.scope === `resource`;

    if (config?.semanticRecall && selectBy?.vectorSearchString && this.vector) {
      const { embeddings, dimension } = await this.embedMessageContent(selectBy.vectorSearchString!);
      const { indexName } = await this.createEmbeddingIndex(dimension);

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
    const rawMessages = await this.storage.getMessages({
      threadId,
      resourceId,
      format: 'v2',
      selectBy: {
        ...selectBy,
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
      },
      threadConfig: config,
    });

    const list = new MessageList({ threadId, resourceId }).add(rawMessages, 'memory');
    return {
      get messages() {
        // returning v1 messages for backwards compat! v1 messages were CoreMessages stored in the db.
        // returning .v1() takes stored messages which may be in v2 or v1 format and converts them to v1 shape, which is a CoreMessage + id + threadId + resourceId, etc
        // Perhaps this should be called coreRecord or something ? - for now keeping v1 since it reflects that this used to be our db storage record shape
        const v1Messages = list.get.all.v1();
        // the conversion from V2/UIMessage -> V1/CoreMessage can sometimes split the messages up into more messages than before
        // so slice off the earlier messages if it'll exceed the lastMessages setting
        if (selectBy?.last && v1Messages.length > selectBy.last) {
          // ex: 23 (v1 messages) minus 20 (selectBy.last messages)
          // means we will start from index 3 and keep all the later newer messages from index 3 til the end of the array
          return v1Messages.slice(v1Messages.length - selectBy.last) as CoreMessage[];
        }
        // TODO: this is absolutely wrong but became apparent that this is what we were doing before adding MessageList. Our public types said CoreMessage but we were returning MessageType which is equivalent to MastraMessageV1
        // In a breaking change we should make this the type it actually is.
        return v1Messages as CoreMessage[];
      },
      get uiMessages() {
        return list.get.all.ui();
      },
      get messagesV2() {
        return list.get.all.v2();
      },
    };
  }

  async rememberMessages({
    threadId,
    resourceId,
    vectorMessageSearch,
    config,
  }: {
    threadId: string;
    resourceId?: string;
    vectorMessageSearch?: string;
    config?: MemoryConfig;
  }): Promise<{ messages: MastraMessageV1[]; messagesV2: MastraMessageV2[] }> {
    if (resourceId) await this.validateThreadIsOwnedByResource(threadId, resourceId);
    const threadConfig = this.getMergedThreadConfig(config || {});

    if (!threadConfig.lastMessages && !threadConfig.semanticRecall) {
      return {
        messages: [],
        messagesV2: [],
      };
    }

    const messagesResult = await this.query({
      resourceId,
      threadId,
      selectBy: {
        last: threadConfig.lastMessages,
        vectorSearchString: threadConfig.semanticRecall && vectorMessageSearch ? vectorMessageSearch : undefined,
      },
      threadConfig: config,
      format: 'v2',
    });
    // Using MessageList here just to convert mixed input messages to single type output messages
    const list = new MessageList({ threadId, resourceId }).add(messagesResult.messagesV2, 'memory');

    this.logger.debug(`Remembered message history includes ${messagesResult.messages.length} messages.`);
    return { messages: list.get.all.v1(), messagesV2: list.get.all.v2() };
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    return this.storage.getThreadById({ threadId });
  }

  async getThreadsByResourceId({
    resourceId,
    orderBy,
    sortDirection,
  }: { resourceId: string } & ThreadSortOptions): Promise<StorageThreadType[]> {
    return this.storage.getThreadsByResourceId({ resourceId, orderBy, sortDirection });
  }

  async getThreadsByResourceIdPaginated({
    resourceId,
    page,
    perPage,
    orderBy,
    sortDirection,
  }: {
    resourceId: string;
    page: number;
    perPage: number;
  } & ThreadSortOptions): Promise<
    PaginationInfo & {
      threads: StorageThreadType[];
    }
  > {
    return this.storage.getThreadsByResourceIdPaginated({
      resourceId,
      page,
      perPage,
      orderBy,
      sortDirection,
    });
  }

  async saveThread({ thread }: { thread: StorageThreadType; memoryConfig?: MemoryConfig }): Promise<StorageThreadType> {
    return this.storage.saveThread({ thread });
  }

  async updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    return this.storage.updateThread({
      id,
      title,
      metadata,
    });
  }

  async deleteThread(threadId: string): Promise<void> {
    await this.storage.deleteThread({ threadId });
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

    this.checkStorageFeatureSupport(config);

    const scope = config.workingMemory.scope || 'thread';

    if (scope === 'resource' && resourceId) {
      // Update working memory in resource table
      await this.storage.updateResource({
        resourceId,
        workingMemory,
      });
    } else {
      // Update working memory in thread metadata (existing behavior)
      const thread = await this.storage.getThreadById({ threadId });
      if (!thread) {
        throw new Error(`Thread ${threadId} not found`);
      }

      await this.storage.updateThread({
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

    this.checkStorageFeatureSupport(config);

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

          workingMemory = existingWorkingMemory + `\n${workingMemory}`;
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

      const scope = config.workingMemory.scope || 'thread';

      if (scope === 'resource' && resourceId) {
        // Update working memory in resource table
        await this.storage.updateResource({
          resourceId,
          workingMemory,
        });

        if (reason) {
          return { success: true, reason };
        }
      } else {
        // Update working memory in thread metadata (existing behavior)
        const thread = await this.storage.getThreadById({ threadId });
        if (!thread) {
          throw new Error(`Thread ${threadId} not found`);
        }

        await this.storage.updateThread({
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

    const promise = embedMany({
      values: chunks,
      model: this.embedder,
      maxRetries: 3,
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

  async saveMessages(args: {
    messages: (MastraMessageV1 | MastraMessageV2)[] | MastraMessageV1[] | MastraMessageV2[];
    memoryConfig?: MemoryConfig | undefined;
    format?: 'v1';
  }): Promise<MastraMessageV1[]>;
  async saveMessages(args: {
    messages: (MastraMessageV1 | MastraMessageV2)[] | MastraMessageV1[] | MastraMessageV2[];
    memoryConfig?: MemoryConfig | undefined;
    format: 'v2';
  }): Promise<MastraMessageV2[]>;
  async saveMessages({
    messages,
    memoryConfig,
    format = `v1`,
  }: {
    messages: (MastraMessageV1 | MastraMessageV2)[];
    memoryConfig?: MemoryConfig | undefined;
    format?: 'v1' | 'v2';
  }): Promise<MastraMessageV2[] | MastraMessageV1[]> {
    // Then strip working memory tags from all messages
    const updatedMessages = messages
      .map(m => {
        if (MessageList.isMastraMessageV1(m)) {
          return this.updateMessageToHideWorkingMemory(m);
        }
        // add this to prevent "error saving undefined in the db" if a project is on an earlier storage version but new memory/storage
        if (!m.type) m.type = `v2`;
        return this.updateMessageToHideWorkingMemoryV2(m);
      })
      .filter((m): m is MastraMessageV1 | MastraMessageV2 => Boolean(m));

    const config = this.getMergedThreadConfig(memoryConfig);

    const result = this.storage.saveMessages({
      messages: new MessageList().add(updatedMessages, 'memory').get.all.v2(),
      format: 'v2',
    });

    if (this.vector && config.semanticRecall) {
      let indexName: Promise<string>;
      await Promise.all(
        updatedMessages.map(async message => {
          let textForEmbedding: string | null = null;

          if (MessageList.isMastraMessageV2(message)) {
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
          } else if (MessageList.isMastraMessageV1(message)) {
            if (message.content && typeof message.content === 'string' && message.content.trim() !== '') {
              textForEmbedding = message.content;
            } else if (message.content && Array.isArray(message.content) && message.content.length > 0) {
              // Extract text from all text parts, concatenate
              const joined = message.content
                .filter(part => part.type === 'text')
                .map(part => part.text)
                .join(' ')
                .trim();
              if (joined) textForEmbedding = joined;
            }
          }

          if (!textForEmbedding) return;

          const { embeddings, chunks, dimension } = await this.embedMessageContent(textForEmbedding);

          if (typeof indexName === `undefined`) {
            indexName = this.createEmbeddingIndex(dimension).then(result => result.indexName);
          }

          if (typeof this.vector === `undefined`) {
            throw new Error(
              `Tried to upsert embeddings to index ${indexName} but this Memory instance doesn't have an attached vector db.`,
            );
          }

          await this.vector.upsert({
            indexName: await indexName,
            vectors: embeddings,
            metadata: chunks.map(() => ({
              message_id: message.id,
              thread_id: message.threadId,
              resource_id: message.resourceId,
            })),
          });
        }),
      );
    }

    if (format === `v1`) return new MessageList().add(await result, 'memory').get.all.v1(); // for backwards compat convert to v1 message format
    return result;
  }
  protected updateMessageToHideWorkingMemory(message: MastraMessageV1): MastraMessageV1 | null {
    const workingMemoryRegex = /<working_memory>([^]*?)<\/working_memory>/g;

    if (typeof message?.content === `string`) {
      return {
        ...message,
        content: message.content.replace(workingMemoryRegex, ``).trim(),
      };
    } else if (Array.isArray(message?.content)) {
      // Filter out updateWorkingMemory tool-call/result content items
      const filteredContent = message.content.filter(
        content =>
          (content.type !== 'tool-call' && content.type !== 'tool-result') ||
          content.toolName !== 'updateWorkingMemory',
      );
      const newContent = filteredContent.map(content => {
        if (content.type === 'text') {
          return {
            ...content,
            text: content.text.replace(workingMemoryRegex, '').trim(),
          };
        }
        return { ...content };
      }) as MastraMessageV1['content'];
      if (!newContent.length) return null;
      return { ...message, content: newContent };
    } else {
      return { ...message };
    }
  }
  protected updateMessageToHideWorkingMemoryV2(message: MastraMessageV2): MastraMessageV2 | null {
    const workingMemoryRegex = /<working_memory>([^]*?)<\/working_memory>/g;

    const newMessage = { ...message, content: { ...message.content } }; // Deep copy message and content

    if (newMessage.content.content && typeof newMessage.content.content === 'string') {
      newMessage.content.content = newMessage.content.content.replace(workingMemoryRegex, '').trim();
    }

    if (newMessage.content.parts) {
      newMessage.content.parts = newMessage.content.parts
        .filter(part => {
          if (part.type === 'tool-invocation') {
            return part.toolInvocation.toolName !== 'updateWorkingMemory';
          }
          return true;
        })
        .map(part => {
          if (part.type === 'text') {
            return {
              ...part,
              text: part.text.replace(workingMemoryRegex, '').trim(),
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

    const workingMemoryRegex = /<working_memory>([^]*?)<\/working_memory>/g;
    const matches = text.match(workingMemoryRegex);
    const match = matches?.[0];

    if (match) {
      return match.replace(/<\/?working_memory>/g, '').trim();
    }

    return null;
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

    this.checkStorageFeatureSupport(config);

    const scope = config.workingMemory.scope || 'thread';
    let workingMemoryData: string | null = null;

    if (scope === 'resource' && resourceId) {
      // Get working memory from resource table
      const resource = await this.storage.getResourceById({ resourceId });
      workingMemoryData = resource?.workingMemory || null;
    } else {
      // Get working memory from thread metadata (default behavior)
      const thread = await this.storage.getThreadById({ threadId });
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
    const config = this.getMergedThreadConfig(memoryConfig || {});

    if (!config.workingMemory?.enabled) {
      return null;
    }

    // Get thread from storage
    if (config.workingMemory?.schema) {
      try {
        const schema = config.workingMemory.schema;
        let convertedSchema: JSONSchema7;

        if (isZodObject(schema as ZodTypeAny)) {
          // Convert ZodObject to JSON Schema
          convertedSchema = zodToJsonSchema(schema as ZodTypeAny, {
            $refStrategy: 'none',
          }) as JSONSchema7;
        } else {
          // Already a JSON Schema
          convertedSchema = schema as any as JSONSchema7;
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

    const workingMemoryTemplate = await this.getWorkingMemoryTemplate({ memoryConfig: config });
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
5. IMPORTANT: When calling updateWorkingMemory, the only valid parameter is the memory field. 
6. IMPORTANT: ALWAYS pass the data you want to store in the memory field as a string. DO NOT pass an object.
7. IMPORTANT: Data must only be sent as a string no matter which format is used.

<working_memory_template>
${template.content}
</working_memory_template>

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

  public getTools(config?: MemoryConfig): Record<string, CoreTool> {
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
    messages: Partial<MastraMessageV2> & { id: string }[];
  }): Promise<MastraMessageV2[]> {
    if (messages.length === 0) return [];

    // TODO: Possibly handle updating the vector db here when a message is updated.

    return this.storage.updateMessages({ messages });
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
    await this.storage.deleteMessages(messageIds);

    // TODO: Delete from vector store if semantic recall is enabled
    // This would require getting the messages first to know their threadId/resourceId
    // and then querying the vector store to delete associated embeddings
  }
}
