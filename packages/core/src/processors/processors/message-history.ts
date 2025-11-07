import type { MastraDBMessage } from '../../agent/index.js';
import { parseMemoryRuntimeContext } from '../../memory/types.js';
import type { TracingContext } from '../../observability';
import type { RequestContext } from '../../request-context/index.js';
import type { MemoryStorage } from '../../storage/domains/memory/base.js';
import type { Processor } from '../index.js';

/**
 * Options for the MessageHistory processor
 */
export interface MessageHistoryOptions {
  storage: MemoryStorage;
  lastMessages?: number;
  includeSystemMessages?: boolean;
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
  private includeSystemMessages: boolean;

  constructor(options: MessageHistoryOptions) {
    this.storage = options.storage;
    this.lastMessages = options.lastMessages;
    this.includeSystemMessages = options.includeSystemMessages ?? false;
  }

  async processInput(args: {
    messages: MastraDBMessage[];
    abort: (reason?: string) => never;
    tracingContext?: TracingContext;
    runtimeContext?: RequestContext;
  }): Promise<MastraDBMessage[]> {
    const { messages } = args;

    // Get memory context from RequestContext
    const memoryContext = parseMemoryRuntimeContext(args.runtimeContext);
    const threadId = memoryContext?.thread?.id;

    if (!threadId) {
      return messages;
    }

    try {
      // 1. Fetch historical messages from storage (as DB format)
      const result = await this.storage.listMessages({
        threadId,
        page: 1,
        perPage: this.lastMessages,
      });

      // 2. Filter based on includeSystemMessages option
      const filteredMessages = result.messages.filter(
        (msg: MastraDBMessage) => this.includeSystemMessages || msg.role !== 'system',
      );

      // 3. Merge with incoming messages (avoiding duplicates by ID)
      const messageIds = new Set(messages.map((m: MastraDBMessage) => m.id).filter(Boolean));
      const uniqueHistoricalMessages = filteredMessages.filter((m: MastraDBMessage) => !m.id || !messageIds.has(m.id));

      const mergedMessages = [...uniqueHistoricalMessages, ...messages];
      return mergedMessages;
    } catch {
      // Fail open - return original messages if history fetch fails
      return messages;
    }
  }

  async processOutputResult(args: {
    messages: MastraDBMessage[];
    abort: (reason?: string) => never;
    tracingContext?: TracingContext;
    runtimeContext?: RequestContext;
  }): Promise<MastraDBMessage[]> {
    const { messages } = args;

    // Get memory context from RequestContext
    const memoryContext = parseMemoryRuntimeContext(args.runtimeContext);
    const threadId = memoryContext?.thread?.id;

    if (!threadId) {
      return messages;
    }

    try {
      // 1. Filter out ONLY system messages - keep everything else
      const messagesToSave = messages.filter(m => m.role !== 'system');

      if (messagesToSave.length === 0) {
        return messages;
      }

      // 2. Add IDs to messages that don't have them
      const messagesWithIds = messagesToSave.map(msg => ({
        ...msg,
        id: msg.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      }));

      // 3. Save to storage
      await this.storage.saveMessages({
        messages: messagesWithIds,
      });

      // 4. Update thread metadata
      try {
        const thread = await this.storage.getThreadById({ threadId });
        if (thread) {
          const result = await this.storage.listMessages({
            threadId,
            page: 1,
            perPage: 1000,
          });

          await this.storage.updateThread({
            id: threadId,
            title: thread.title || '',
            metadata: {
              ...thread.metadata,
              updatedAt: new Date(),
              lastMessageAt: new Date(),
              messageCount: result.messages.length || 0,
            },
          });
        }
      } catch (updateError) {
        console.warn('Failed to update thread metadata:', updateError);
        // Continue even if thread update fails
      }

      return messages;
    } catch (error) {
      console.warn('Failed to save messages:', error);
      // Return original messages if storage fails
      return messages;
    }
  }
}
