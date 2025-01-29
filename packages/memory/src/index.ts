import {
  MastraMemory,
  MastraStorage,
  MastraVector,
  MessageType,
  StorageGetMessagesArg,
  MemoryConfig,
  ThreadType,
  embed,
} from '@mastra/core';
import { Message as AiMessage } from 'ai';

export * from './postgres';
export * from './kv/upstash';

/**
 * Concrete implementation of MastraMemory that adds support for thread configuration
 * and message injection.
 */
export class Memory extends MastraMemory {
  constructor(
    config: {
      threads?: MemoryConfig;
    } & ({ storage: MastraStorage; vector?: MastraVector } | { storage: MastraStorage; vector: MastraVector }),
  ) {
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
      // @ts-ignore
      const { embedding } = await embed(selectBy.vectorSearchString, {
        provider: 'OPEN_AI',
        model: 'text-embedding-ada-002',
        maxRetries: 3,
      });

      vectorResults = await this.vector.query('memory_messages', embedding, vectorConfig.includeResults, {
        thread_id: threadId,
      });
    }

    // Get raw messages from storage
    const rawMessages = await this.storage.getMessages<MessageType[]>({
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

  async getThreadById({ threadId }: { threadId: string }): Promise<ThreadType | null> {
    return this.storage.getThreadById({ threadId });
  }

  async getThreadsByResourceId({ resourceid }: { resourceid: string }): Promise<ThreadType[]> {
    return this.storage.getThreadsByResourceId({ resourceid });
  }

  async saveThread({ thread }: { thread: ThreadType }): Promise<ThreadType> {
    return this.storage.saveThread({ thread });
  }

  async saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    if (this.vector) {
      for (const message of messages) {
        if (typeof message.content !== `string`) continue; // TODO: is this ok?
        // @ts-ignore
        const { embeddings } = await embed([message.content], {
          provider: 'OPEN_AI', // TODO: wouldn't work of course - not everyone is using open ai (POC)
          model: 'text-embedding-ada-002',
          maxRetries: 3,
        });
        await this.vector.createIndex('memory_messages', 1536);
        await this.vector.upsert(
          'memory_messages',
          embeddings,
          embeddings.map((_: any) => ({
            text: message.content,
            message_id: message.id,
            thread_id: message.threadId,
          })),
        );
      }
    }
    return this.storage.saveMessages({ messages });
  }

  async deleteThread(threadId: string): Promise<void> {
    await this.storage.deleteThread(threadId);

    // TODO: Also clean up vector storage if it exists
    // if (this.vector) {
    //   await this.vector.deleteThread(threadId); ?? filter by thread attributes and delete all returned messages?
    // }
  }
}
