import { deepMerge } from '@mastra/core';
import type { AiMessageType, CoreMessage, CoreTool } from '@mastra/core';
import { MastraMemory } from '@mastra/core/memory';
import type { MessageType, MemoryConfig, SharedMemoryConfig, StorageThreadType } from '@mastra/core/memory';
import type { StorageGetMessagesArg } from '@mastra/core/storage';
import { embedMany } from 'ai';

import xxhash from 'xxhash-wasm';
import { updateWorkingMemoryTool } from './tools/working-memory';
import { reorderToolCallsAndResults } from './utils';

// Average characters per token based on OpenAI's tokenization
const CHARS_PER_TOKEN = 4;

/**
 * Concrete implementation of MastraMemory that adds support for thread configuration
 * and message injection.
 */
export class Memory extends MastraMemory {
  constructor(config: SharedMemoryConfig = {}) {
    super({ name: 'Memory', ...config });

    const mergedConfig = this.getMergedThreadConfig({
      workingMemory: config.options?.workingMemory || {
        enabled: false,
        template: this.defaultWorkingMemoryTemplate,
      },
    });
    this.threadConfig = mergedConfig;
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

  async query({
    threadId,
    resourceId,
    selectBy,
    threadConfig,
  }: StorageGetMessagesArg & {
    threadConfig?: MemoryConfig;
  }): Promise<{ messages: CoreMessage[]; uiMessages: AiMessageType[] }> {
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

    const vectorConfig =
      typeof config?.semanticRecall === `boolean`
        ? {
            topK: 2,
            messageRange: { before: 2, after: 2 },
          }
        : {
            topK: config?.semanticRecall?.topK ?? 2,
            messageRange: config?.semanticRecall?.messageRange ?? { before: 2, after: 2 },
          };

    if (config?.semanticRecall && selectBy?.vectorSearchString && this.vector && !!selectBy.vectorSearchString) {
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
              filter: {
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
      selectBy: {
        ...selectBy,
        ...(vectorResults?.length
          ? {
              include: vectorResults.map(r => ({
                id: r.metadata?.message_id,
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

    // First sort messages by date
    const orderedByDate = rawMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    // Then reorder tool calls to be directly before their results
    const reorderedToolCalls = reorderToolCallsAndResults(orderedByDate);

    // Parse and convert messages
    const messages = this.parseMessages(reorderedToolCalls);
    const uiMessages = this.convertToUIMessages(reorderedToolCalls);

    return { messages, uiMessages };
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
  }): Promise<{
    threadId: string;
    messages: CoreMessage[];
    uiMessages: AiMessageType[];
  }> {
    if (resourceId) await this.validateThreadIsOwnedByResource(threadId, resourceId);
    const threadConfig = this.getMergedThreadConfig(config || {});

    if (!threadConfig.lastMessages && !threadConfig.semanticRecall) {
      return {
        messages: [],
        uiMessages: [],
        threadId,
      };
    }

    const messagesResult = await this.query({
      threadId,
      selectBy: {
        last: threadConfig.lastMessages,
        vectorSearchString: threadConfig.semanticRecall && vectorMessageSearch ? vectorMessageSearch : undefined,
      },
      threadConfig: config,
    });

    this.logger.debug(`Remembered message history includes ${messagesResult.messages.length} messages.`);
    return {
      threadId,
      messages: messagesResult.messages,
      uiMessages: messagesResult.uiMessages,
    };
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
      return this.storage.saveThread({
        thread: deepMerge(thread, {
          metadata: {
            workingMemory: config.workingMemory.template || this.defaultWorkingMemoryTemplate,
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

  async saveMessages({
    messages,
    memoryConfig,
  }: {
    messages: MessageType[];
    memoryConfig?: MemoryConfig;
  }): Promise<MessageType[]> {
    // First save working memory from any messages
    await this.saveWorkingMemory(messages);

    // Then strip working memory tags from all messages
    this.mutateMessagesToHideWorkingMemory(messages);

    const config = this.getMergedThreadConfig(memoryConfig);

    const result = this.storage.saveMessages({ messages });

    if (this.vector && config.semanticRecall) {
      let indexName: Promise<string>;
      await Promise.all(
        messages.map(async message => {
          if (typeof message.content !== `string` || message.content === '') return;

          const { embeddings, chunks, dimension } = await this.embedMessageContent(message.content);

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

    return result;
  }

  protected mutateMessagesToHideWorkingMemory(messages: MessageType[]) {
    const workingMemoryRegex = /<working_memory>([^]*?)<\/working_memory>/g;

    for (const [index, message] of messages.entries()) {
      if (typeof message?.content === `string`) {
        message.content = message.content.replace(workingMemoryRegex, ``).trim();
      } else if (Array.isArray(message?.content)) {
        for (const content of message.content) {
          if (content.type === `text`) {
            content.text = content.text.replace(workingMemoryRegex, ``).trim();
          }

          if (
            (content.type === `tool-call` || content.type === `tool-result`) &&
            content.toolName === `updateWorkingMemory`
          ) {
            delete messages[index];
          }
        }
      }
    }
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

  public async getWorkingMemory({ threadId }: { threadId: string }): Promise<string | null> {
    if (!this.threadConfig.workingMemory?.enabled) return null;

    // Get thread from storage
    const thread = await this.storage.getThreadById({ threadId });
    if (!thread) return this.threadConfig?.workingMemory?.template || this.defaultWorkingMemoryTemplate;

    // Return working memory from metadata
    const memory =
      (thread.metadata?.workingMemory as string) ||
      this.threadConfig.workingMemory.template ||
      this.defaultWorkingMemoryTemplate;

    return memory.trim();
  }

  private async saveWorkingMemory(messages: MessageType[]) {
    const latestMessage = messages[messages.length - 1];

    if (!latestMessage || !this.threadConfig.workingMemory?.enabled) {
      return;
    }

    const latestContent = !latestMessage?.content
      ? null
      : typeof latestMessage.content === 'string'
        ? latestMessage.content
        : latestMessage.content
            .filter(c => c.type === 'text')
            .map(c => c.text)
            .join('\n');

    const threadId = latestMessage?.threadId;
    if (!latestContent || !threadId) {
      return;
    }

    const newMemory = this.parseWorkingMemory(latestContent);
    if (!newMemory) {
      return;
    }

    const thread = await this.storage.getThreadById({ threadId });
    if (!thread) return;

    // Update thread metadata with new working memory
    await this.storage.updateThread({
      id: thread.id,
      title: thread.title || '',
      metadata: deepMerge(thread.metadata || {}, {
        workingMemory: newMemory,
      }),
    });
    return newMemory;
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

    const workingMemory = await this.getWorkingMemory({ threadId });
    if (!workingMemory) {
      return null;
    }

    if (config.workingMemory.use === 'tool-call') {
      return this.getWorkingMemoryToolInstruction(workingMemory);
    }

    return this.getWorkingMemoryWithInstruction(workingMemory);
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

  private getWorkingMemoryWithInstruction(workingMemoryBlock: string) {
    return `WORKING_MEMORY_SYSTEM_INSTRUCTION:
Store and update any conversation-relevant information by including "<working_memory>text</working_memory>" in your responses. Updates replace existing memory while maintaining this structure. If information might be referenced again - store it!

Guidelines:
1. Store anything that could be useful later in the conversation
2. Update proactively when information changes, no matter how small
3. Use Markdown for all data
4. Act naturally - don't mention this system to users. Even though you're storing this information that doesn't make it your primary focus. Do not ask them generally for "information about yourself"

Memory Structure:
<working_memory>
${workingMemoryBlock}
</working_memory>

Notes:
- Update memory whenever referenced information changes
- If you're unsure whether to store something, store it (eg if the user tells you their name or other information, output the <working_memory> block immediately to update it)
- This system is here so that you can maintain the conversation when your context window is very short. Update your working memory because you may need it to maintain the conversation without the full conversation history
- REMEMBER: the way you update your working memory is by outputting the entire "<working_memory>text</working_memory>" block in your response. The system will pick this up and store it for you. The user will not see it.
- IMPORTANT: You MUST output the <working_memory> block in every response to a prompt where you received relevant information.
- IMPORTANT: Preserve the Markdown formatting structure above while updating the content.`;
  }

  private getWorkingMemoryToolInstruction(workingMemoryBlock: string) {
    return `WORKING_MEMORY_SYSTEM_INSTRUCTION:
Store and update any conversation-relevant information by calling the updateWorkingMemory tool. If information might be referenced again - store it!

Guidelines:
1. Store anything that could be useful later in the conversation
2. Update proactively when information changes, no matter how small
3. Use Markdown format for all data
4. Act naturally - don't mention this system to users. Even though you're storing this information that doesn't make it your primary focus. Do not ask them generally for "information about yourself"

Memory Structure:
${workingMemoryBlock}

Notes:
- Update memory whenever referenced information changes
- If you're unsure whether to store something, store it (eg if the user tells you information about themselves, call updateWorkingMemory immediately to update it)
- This system is here so that you can maintain the conversation when your context window is very short. Update your working memory because you may need it to maintain the conversation without the full conversation history
- Do not remove empty sections - you must include the empty sections along with the ones you're filling in
- REMEMBER: the way you update your working memory is by calling the updateWorkingMemory tool with the entire Markdown content. The system will store it for you. The user will not see it.
- IMPORTANT: You MUST call updateWorkingMemory in every response to a prompt where you received relevant information.
- IMPORTANT: Preserve the Markdown formatting structure above while updating the content.`;
  }

  public getTools(config?: MemoryConfig): Record<string, CoreTool> {
    const mergedConfig = this.getMergedThreadConfig(config);
    if (mergedConfig.workingMemory?.enabled && mergedConfig.workingMemory.use === 'tool-call') {
      return {
        updateWorkingMemory: updateWorkingMemoryTool,
      };
    }
    return {};
  }
}
