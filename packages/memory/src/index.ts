import { CoreMessage } from '@mastra/core';
import { MastraMemory, MessageType, MemoryConfig, SharedMemoryConfig, StorageThreadType } from '@mastra/core/memory';
import { StorageGetMessagesArg } from '@mastra/core/storage';
import { Message as AiMessage } from 'ai';

/**
 * Concrete implementation of MastraMemory that adds support for thread configuration
 * and message injection.
 */
export class Memory extends MastraMemory {
  constructor(config: SharedMemoryConfig) {
    super({ name: 'Memory', ...config });
  }

  async getMessages({
    threadId,
    selectBy,
    threadConfig,
  }: StorageGetMessagesArg): Promise<{ messages: CoreMessage[]; uiMessages: AiMessage[] }> {
    let vectorResults:
      | null
      | {
          id: string;
          score: number;
          metadata?: Record<string, any>;
          vector?: number[];
        }[] = null;

    this.logger.info(`Memory getMessages() with:`, {
      threadId,
      selectBy,
      threadConfig,
    });

    const config = this.getMergedThreadConfig(threadConfig || {});

    const vectorConfig =
      typeof config?.injectVectorHistorySearch === `boolean`
        ? {
            includeResults: 2,
            includePrevious: 2,
            includeNext: 2,
          }
        : {
            includeResults: config?.injectVectorHistorySearch?.includeResults || 2,
            includePrevious: config?.injectVectorHistorySearch?.includePrevious || 2,
            includeNext: config?.injectVectorHistorySearch?.includeNext || 2,
          };

    if (selectBy?.vectorSearchString && this.vector) {
      const { embeddings } = await this.vector.embed(selectBy.vectorSearchString, this.parseEmbeddingOptions());

      await this.vector.createIndex('memory_messages', 1536);
      vectorResults = await this.vector.query('memory_messages', embeddings[0]!, vectorConfig.includeResults, {
        thread_id: threadId,
      });
    }

    // Get raw messages from storage
    const rawMessages = await this.storage.__getMessages({
      threadId,
      selectBy: {
        ...selectBy,
        ...(vectorResults?.length
          ? {
              include: vectorResults.map(r => ({
                id: r.metadata?.message_id,
                withNextMessages: vectorConfig.includeNext,
                withPreviousMessages: vectorConfig.includePrevious,
              })),
            }
          : {}),
      },
      threadConfig: config,
    });

    // Parse and convert messages
    const messages = this.parseMessages(rawMessages);
    const uiMessages = this.convertToUIMessages(rawMessages);

    return { messages, uiMessages };
  }

  async rememberMessages({
    threadId,
    vectorMessageSearch,
    config,
  }: {
    threadId: string;
    vectorMessageSearch?: string;
    config?: MemoryConfig;
  }) {
    const threadConfig = this.getMergedThreadConfig(config || {});

    if (!threadConfig.injectRecentMessages && !threadConfig.injectVectorHistorySearch) {
      return {
        messages: [],
        uiMessages: [],
      } satisfies Awaited<ReturnType<typeof this.getMessages>>;
    }

    const messages = await this.getMessages({
      threadId,
      selectBy: {
        last: threadConfig.injectRecentMessages,
        vectorSearchString:
          threadConfig.injectVectorHistorySearch && vectorMessageSearch ? vectorMessageSearch : undefined,
      },
      threadConfig: config,
    });

    this.logger.info(`Remembered message history includes ${messages.messages.length} messages.`);
    return messages;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    return this.storage.__getThreadById({ threadId });
  }

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    return this.storage.__getThreadsByResourceId({ resourceId });
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    return this.storage.__saveThread({ thread });
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
    return this.storage.__updateThread({
      id,
      title,
      metadata,
    });
  }

  async saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    if (this.vector) {
      await this.vector.createIndex('memory_messages', 1536);
      for (const message of messages) {
        if (typeof message.content !== `string`) continue;
        const { embeddings } = await this.vector.embed(message.content, this.parseEmbeddingOptions());
        await this.vector.upsert('memory_messages', embeddings, [
          {
            text: message.content,
            message_id: message.id,
            thread_id: message.threadId,
          },
        ]);
      }
    }
    return this.storage.__saveMessages({ messages });
  }

  async deleteThread(threadId: string): Promise<void> {
    await this.storage.__deleteThread({ threadId });

    // TODO: Also clean up vector storage if it exists
    // if (this.vector) {
    //   await this.vector.deleteThread(threadId); ?? filter by thread attributes and delete all returned messages?
    // }
  }
}
