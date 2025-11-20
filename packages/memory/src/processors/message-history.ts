import type { MastraDBMessage, MessageList } from '@mastra/core/agent';
import { parseMemoryRuntimeContext } from '@mastra/core/memory';
import type { TracingContext } from '@mastra/core/observability';
import type { Processor } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import type { MemoryStorage } from '@mastra/core/storage';

/**
 * Options for the MessageHistory processor
 */
export interface MessageHistoryOptions {
  storage: MemoryStorage;
  lastMessages?: number;
}

/**
 * Hybrid processor that handles both retrieval and persistence of message history.
 * - On input: Fetches historical messages from storage and prepends them
 * - On output: Persists new messages to storage (excluding system messages)
 *
 * This processor retrieves threadId and resourceId from RequestContext at execution time,
 * making it decoupled from memory-specific context.
 */
export class MessageHistory implements Processor {
  readonly id = 'message-history';
  readonly name = 'MessageHistory';
  private storage: MemoryStorage;
  private lastMessages?: number;

  constructor(options: MessageHistoryOptions) {
    this.storage = options.storage;
    this.lastMessages = options.lastMessages;
  }

  async processInput(args: {
    messages: MastraDBMessage[];
    messageList: MessageList;
    abort: (reason?: string) => never;
    tracingContext?: TracingContext;
    runtimeContext?: RequestContext;
  }): Promise<MessageList | MastraDBMessage[]> {
    const { messages, messageList } = args;

    // Get memory context from RequestContext
    const memoryContext = parseMemoryRuntimeContext(args.runtimeContext);
    const threadId = memoryContext?.thread?.id;

    if (!threadId) {
      return messageList;
    }

    // 1. Fetch historical messages from storage (as DB format)
    const result = await this.storage.listMessages({
      threadId,
      page: 0,
      perPage: this.lastMessages,
      orderBy: { field: 'createdAt', direction: 'DESC' },
    });

    // 2. Filter out system messages (they should never be stored in DB)
    const filteredMessages = result.messages.filter((msg: MastraDBMessage) => {
      return msg.role !== 'system';
    });

    // 3. Merge with incoming messages (avoiding duplicates by ID)
    const messageIds = new Set(messages.map((m: MastraDBMessage) => m.id).filter(Boolean));
    const uniqueHistoricalMessages = filteredMessages.filter((m: MastraDBMessage) => !m.id || !messageIds.has(m.id));

    // Reverse to chronological order (oldest first) since we fetched DESC
    const chronologicalMessages = uniqueHistoricalMessages.reverse();

    if (chronologicalMessages.length === 0) {
      return messageList;
    }

    // Add historical messages with source: 'memory'
    for (const msg of chronologicalMessages) {
      if (msg.role === 'system') {
        continue; // memory should not store system messages
      } else {
        messageList.add(msg, 'memory');
      }
    }

    return messageList;
  }

  async processOutputResult(args: {
    messages: MastraDBMessage[];
    messageList?: MessageList;
    abort: (reason?: string) => never;
    tracingContext?: TracingContext;
    runtimeContext?: RequestContext;
  }): Promise<MastraDBMessage[]> {
    const { messages } = args;

    // Get memory context from RequestContext
    const memoryContext = parseMemoryRuntimeContext(args.runtimeContext);
    const threadId = memoryContext?.thread?.id;

    if (!threadId) {
      console.error(`no thread id`);
      return messages;
    }

    // 1. Only save new user messages and new response messages
    // Filter out system messages, context messages, and memory messages
    const messagesToSave = messages.filter(m => {
      if (m.role === 'system') return false;
      // If messageList is available, only save messages that are in newUserMessages or newResponseMessages
      // if (messageList) {
      //   return messageList.isNewMessage(m);
      // }
      // Fallback: if no messageList, save all non-system messages (backward compatibility)
      return true;
    });

    if (messagesToSave.length === 0) {
      return messages;
    }

    // 3. Save to storage
    try {
      await this.storage.saveMessages({
        messages: messagesToSave,
      });
    } catch (error) {
      console.warn('Failed to save messages:', error);
      return messages;
    }

    // 4. Update thread metadata
    try {
      const thread = await this.storage.getThreadById({ threadId });
      if (thread) {
        await this.storage.updateThread({
          id: threadId,
          title: thread.title || '',
          metadata: {
            ...thread.metadata,
            updatedAt: new Date(),
            lastMessageAt: new Date(),
          },
        });
      }
    } catch (error) {
      console.warn('Failed to update thread metadata:', error);
    }

    return messages;
  }
}
