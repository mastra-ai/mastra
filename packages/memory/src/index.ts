import {
  MastraMemory,
  MessageType,
  StorageGetMessagesArg,
  MemoryConfig,
  ThreadType,
  SharedMemoryConfig,
} from '@mastra/core';
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
  }: StorageGetMessagesArg): Promise<{ messages: MessageType[]; uiMessages: AiMessage[] }> {
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

    const vectorConfig =
      typeof threadConfig?.injectVectorHistorySearch === `boolean`
        ? {
            includeResults: 2,
            includePrevious: 2,
            includeNext: 2,
          }
        : {
            includeResults: threadConfig?.injectVectorHistorySearch?.includeResults || 2,
            includePrevious: threadConfig?.injectVectorHistorySearch?.includePrevious || 2,
            includeNext: threadConfig?.injectVectorHistorySearch?.includeNext || 2,
          };

    if (selectBy?.vectorSearchString && this.vector) {
      const { embeddings } = await this.vector.embed(selectBy.vectorSearchString, this.parseEmbeddingOptions());

      vectorResults = await this.vector.query('memory_messages', embeddings[0]!, vectorConfig.includeResults, {
        thread_id: threadId,
      });
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
                withNextMessages: vectorConfig.includeNext,
                withPreviousMessages: vectorConfig.includePrevious,
              })),
            }
          : {}),
      },
      threadConfig,
    });

    // Parse and convert messages
    const messages = this.parseMessages(rawMessages);
    const uiMessages = this.convertToUIMessages(messages);

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
    return messages.messages.length > 0
      ? {
          messages: [
            {
              id: `system-remember-start-${Date.now()}`,
              role: 'system',
              content:
                "all messages after this one are messages you've remembered until you see a system message telling you otherwise.",
              type: 'text',
              threadId,
              created_at: new Date(),
            } satisfies MessageType,
            ...messages.messages,
            {
              id: `system-remember-end-${Date.now()}`,
              role: 'system',
              content:
                "messages prior to this are messages you've remembered. Any messages after this are new. Pay attention to dates as you may remember very old or very recent messages.",
              type: 'text',
              threadId,
              created_at: new Date(),
            } satisfies MessageType,
          ],
          uiMessages: messages.uiMessages,
        }
      : messages;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<ThreadType | null> {
    return this.storage.getThreadById({ threadId });
  }

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<ThreadType[]> {
    return this.storage.getThreadsByResourceId({ resource_id: resourceId });
  }

  async saveThread({ thread }: { thread: ThreadType }): Promise<ThreadType> {
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
  }): Promise<ThreadType> {
    return this.storage.updateThread({
      id,
      title,
      metadata,
    });
  }

  async saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    if (this.vector) {
      for (const message of messages) {
        if (typeof message.content !== `string`) continue;
        const { embeddings } = await this.vector.embed(message.content, this.parseEmbeddingOptions());
        await this.vector.createIndex('memory_messages', 1536);
        await this.vector.upsert('memory_messages', embeddings, [
          {
            text: message.content,
            message_id: message.id,
            thread_id: message.threadId,
          },
        ]);
      }
    }
    return this.storage.saveMessages({ messages });
  }

  async deleteThread(id: string): Promise<void> {
    await this.storage.deleteThread({ id });

    // TODO: Also clean up vector storage if it exists
    // if (this.vector) {
    //   await this.vector.deleteThread(threadId); ?? filter by thread attributes and delete all returned messages?
    // }
  }
}
