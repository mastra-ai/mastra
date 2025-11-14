import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { MastraMemory } from '@mastra/core/memory';
import type {
  MastraMessageV1,
  MemoryConfig,
  SharedMemoryConfig,
  StorageThreadType,
  WorkingMemoryTemplate,
  MessageDeleteInput,
} from '@mastra/core/memory';
import type {
  StorageListThreadsByResourceIdOutput,
  StorageListThreadsByResourceIdInput,
  StorageListMessagesInput,
} from '@mastra/core/storage';
import type { ToolAction } from '@mastra/core/tools';
import { generateEmptyFromSchema } from '@mastra/core/utils';
import { zodToJsonSchema } from '@mastra/schema-compat/zod-to-json';
import { embedMany } from 'ai';
import type { TextPart } from 'ai';
import { embedMany as embedManyV5 } from 'ai-v5';
import { Mutex } from 'async-mutex';
import type { JSONSchema7 } from 'json-schema';
import xxhash from 'xxhash-wasm';
import { ZodObject } from 'zod';
import type { ZodTypeAny } from 'zod';
import { updateWorkingMemoryTool, __experimental_updateWorkingMemoryToolVNext } from './tools/working-memory';

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

  protected async validateThreadIsOwnedByResource(threadId: string, resourceId: string, config: MemoryConfig) {
    const resourceScope =
      (typeof config?.semanticRecall === 'object' && config?.semanticRecall?.scope !== `thread`) ||
      config.semanticRecall === true;

    const thread = await this.storage.getThreadById({ threadId });

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

  protected checkStorageFeatureSupport(config: MemoryConfig) {
    const resourceScope =
      (typeof config.semanticRecall === 'object' && config.semanticRecall.scope !== 'thread') ||
      // resource scope is now default
      config.semanticRecall === true;

    if (resourceScope && !this.storage.supports.selectByIncludeResourceScope) {
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

  async recall(
    args: StorageListMessagesInput & {
      threadConfig?: MemoryConfig;
      vectorSearchString?: string;
    },
  ): Promise<{ messages: MastraDBMessage[] }> {
    const { threadId, resourceId, perPage: perPageArg, page, orderBy, threadConfig, vectorSearchString, filter } = args;
    const config = this.getMergedThreadConfig(threadConfig || {});
    if (resourceId) await this.validateThreadIsOwnedByResource(threadId, resourceId, config);

    // Use perPage from args if provided, otherwise use threadConfig.lastMessages
    const perPage = perPageArg !== undefined ? perPageArg : config.lastMessages;

    const vectorResults: {
      id: string;
      score: number;
      metadata?: Record<string, any>;
      vector?: number[];
    }[] = [];

    this.logger.debug(`Memory recall() with:`, {
      threadId,
      perPage,
      page,
      orderBy,
      threadConfig,
    });

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
      const { embeddings, dimension } = await this.embedMessageContent(vectorSearchString!);
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
    const paginatedResult = await this.storage.listMessages({
      threadId,
      resourceId,
      perPage,
      page,
      orderBy,
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
    const rawMessages = paginatedResult.messages;

    const list = new MessageList({ threadId, resourceId }).add(rawMessages, 'memory');

    // Always return mastra-db format (V2)
    const messages = list.get.all.db();

    return { messages };
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    return this.storage.getThreadById({ threadId });
  }

  async listThreadsByResourceId(
    args: StorageListThreadsByResourceIdInput,
  ): Promise<StorageListThreadsByResourceIdOutput> {
    return this.storage.listThreadsByResourceId(args);
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
      this.checkStorageFeatureSupport(config);

      const scope = config.workingMemory.scope || 'resource';

      // For resource scope, update the resource's working memory
      if (scope === 'resource' && resourceId) {
        await this.storage.updateResource({
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
    const savedThread = await this.storage.saveThread({ thread });

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
    const updatedThread = await this.storage.updateThread({
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

    const scope = config.workingMemory.scope || 'resource';

    // Guard: If resource-scoped working memory is enabled but no resourceId is provided, throw an error
    if (scope === 'resource' && !resourceId) {
      throw new Error(
        `Memory error: Resource-scoped working memory is enabled but no resourceId was provided. ` +
          `Either provide a resourceId or explicitly set workingMemory.scope to 'thread'.`,
      );
    }

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

    const promise = (this.embedder.specificationVersion === `v2` ? embedManyV5 : embedMany)({
      values: chunks,
      maxRetries: 3,
      // @ts-ignore
      model: this.embedder,
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

    const result = await this.storage.saveMessages({
      messages: dbMessages,
    });

    if (this.vector && config.semanticRecall) {
      let indexName: Promise<string>;
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

          const { embeddings, chunks, dimension } = await this.embedMessageContent(textForEmbedding);

          if (typeof indexName === `undefined`) {
            indexName = this.createEmbeddingIndex(dimension, config).then(result => result.indexName);
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
  protected updateMessageToHideWorkingMemoryV2(message: MastraDBMessage): MastraDBMessage | null {
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
          convertedSchema = zodToJsonSchema(schema as ZodTypeAny) as JSONSchema7;
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
