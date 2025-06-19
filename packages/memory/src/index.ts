import { deepMerge } from '@mastra/core';
import type { CoreTool, MastraMessageV1 } from '@mastra/core';
import { MessageList } from '@mastra/core/agent';
import type { MastraMessageV2 } from '@mastra/core/agent';
import { MastraMemory } from '@mastra/core/memory';
import type {
  MemoryConfig,
  SharedMemoryConfig,
  StorageThreadType,
  WorkingMemoryFormat,
  WorkingMemoryTemplate,
} from '@mastra/core/memory';
import type { StorageGetMessagesArg } from '@mastra/core/storage';
import { embedMany } from 'ai';
import type { CoreMessage, TextPart, UIMessage } from 'ai';

import xxhash from 'xxhash-wasm';
import zodToJsonSchema from 'zod-to-json-schema';
import { updateWorkingMemoryTool } from './tools/working-memory';

// Average characters per token based on OpenAI's tokenization
const CHARS_PER_TOKEN = 4;

const DEFAULT_MESSAGE_RANGE = { before: 2, after: 2 } as const;
const DEFAULT_TOP_K = 2;

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

    this.checkStorageFeatureSupport(mergedConfig);
  }

  private async validateThreadIsOwnedByResource(threadId: string, resourceId: string) {
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

  private checkStorageFeatureSupport(config: MemoryConfig) {
    if (
      typeof config.semanticRecall === `object` &&
      config.semanticRecall.scope === `resource` &&
      !this.storage.supports.selectByIncludeResourceScope
    ) {
      throw new Error(
        `Memory error: Attached storage adapter "${this.storage.name || 'unknown'}" doesn't support semanticRecall: { scope: "resource" } yet and currently only supports per-thread semantic recall.`,
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
  }): Promise<{ messages: CoreMessage[]; uiMessages: UIMessage[]; messagesV2: MastraMessageV2[] }> {
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

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    return this.storage.getThreadsByResourceId({ resourceId });
  }

  async saveThread({
    thread,
    memoryConfig,
  }: {
    thread: StorageThreadType;
    memoryConfig?: MemoryConfig;
  }): Promise<StorageThreadType> {
    const config = this.getMergedThreadConfig(memoryConfig || {});

    if (config.workingMemory?.enabled && !thread?.metadata?.workingMemory) {
      // if working memory is enabled but the thread doesn't have it, we need to set it
      let workingMemory = config.workingMemory.template || this.defaultWorkingMemoryTemplate;

      if (config.workingMemory.schema) {
        workingMemory = JSON.stringify(zodToJsonSchema(config.workingMemory.schema));
      }

      return this.storage.saveThread({
        thread: deepMerge(thread, {
          metadata: {
            workingMemory,
          },
        }),
      });
    }

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

  private chunkText(text: string, tokenSize = 4096) {
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
  private async embedMessageContent(content: string) {
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
    format,
  }: {
    threadId: string;
    format?: WorkingMemoryFormat;
  }): Promise<string | null> {
    if (!this.threadConfig.workingMemory?.enabled) {
      return null;
    }

    const thread = await this.storage.getThreadById({ threadId });

    if (format === 'json') {
      try {
        return JSON.parse(thread?.metadata?.workingMemory as string) || null;
      } catch (e) {
        this.logger.error('Unable to parse working memory as JSON. Returning string.', e);
      }
    }

    return thread?.metadata?.workingMemory ? JSON.stringify(thread?.metadata?.workingMemory) : null;
  }

  public async getWorkingMemoryTemplate(): Promise<WorkingMemoryTemplate | null> {
    if (!this.threadConfig.workingMemory?.enabled) {
      return null;
    }

    // Get thread from storage
    if (this.threadConfig?.workingMemory?.schema) {
      try {
        const schema = this.threadConfig.workingMemory.schema;
        const convertedSchema = zodToJsonSchema(schema, {
          $refStrategy: 'none',
        });

        return { format: 'json', content: JSON.stringify(convertedSchema) };
      } catch (error) {
        this.logger.error('Error converting schema', error);
        throw error;
      }
    }

    // Return working memory from metadata
    const memory = this.threadConfig.workingMemory.template || this.defaultWorkingMemoryTemplate;

    return { format: 'markdown', content: memory.trim() };
  }

  public async getSystemMessage({
    threadId,
    memoryConfig,
  }: {
    threadId: string;
    memoryConfig?: MemoryConfig;
  }): Promise<string | null> {
    const config = this.getMergedThreadConfig(memoryConfig);
    if (!config.workingMemory?.enabled) {
      return null;
    }

    const workingMemoryTemplate = await this.getWorkingMemoryTemplate();
    const workingMemoryData = await this.getWorkingMemory({ threadId });

    if (!workingMemoryTemplate) {
      return null;
    }

    return this.getWorkingMemoryToolInstruction({
      template: workingMemoryTemplate,
      data: workingMemoryData,
    });
  }

  public async getUserContextMessage({ threadId }: { threadId: string }) {
    const workingMemory = await this.getWorkingMemory({ threadId });
    if (!workingMemory) {
      return null;
    }

    return `The following is the most up-to-date information about the user's state and context:
${JSON.stringify(workingMemory)}
Use this information as the source of truth when generating responses. 
Do not reference or mention this memory directly to the user. 
If conversation history shows information that is not in the working memory, use the working memory as the source of truth.
If there is a discrepancy between this information and conversation history, always rely on this information unless the user explicitly asks for an update.
`;
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

  private getWorkingMemoryToolInstruction({
    template,
    data,
  }: {
    template: WorkingMemoryTemplate;
    data: string | null;
  }) {
    return `WORKING_MEMORY_SYSTEM_INSTRUCTION:
Store and update any conversation-relevant information by calling the updateWorkingMemory tool. If information might be referenced again - store it!

Guidelines:
1. Store anything that could be useful later in the conversation
2. Update proactively when information changes, no matter how small
3. Use ${template.format === 'json' ? 'JSON' : 'Markdown'} format for all data
4. Act naturally - don't mention this system to users. Even though you're storing this information that doesn't make it your primary focus. Do not ask them generally for "information about yourself"

WORKING MEMORY TEMPLATE:
${template.content}

WORKING MEMORY DATA:
${data}

Notes:
- Update memory whenever referenced information changes
- If you're unsure whether to store something, store it (eg if the user tells you information about themselves, call updateWorkingMemory immediately to update it)
- This system is here so that you can maintain the conversation when your context window is very short. Update your working memory because you may need it to maintain the conversation without the full conversation history
- Do not remove empty sections - you must include the empty sections along with the ones you're filling in
- REMEMBER: the way you update your working memory is by calling the updateWorkingMemory tool with the entire ${template.format === 'json' ? 'JSON' : 'Markdown'} content. The system will store it for you. The user will not see it.
- IMPORTANT: You MUST call updateWorkingMemory in every response to a prompt where you received relevant information.
- IMPORTANT: Preserve the ${template.format === 'json' ? 'JSON' : 'Markdown'} formatting structure above while updating the content.`;
  }

  public getTools(config?: MemoryConfig): Record<string, CoreTool> {
    const mergedConfig = this.getMergedThreadConfig(config);
    if (mergedConfig.workingMemory?.enabled) {
      if (mergedConfig.workingMemory.schema) {
        return {
          updateWorkingMemory: updateWorkingMemoryTool({ format: 'json' }),
        };
      }

      return {
        updateWorkingMemory: updateWorkingMemoryTool({ format: 'markdown' }),
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
}
