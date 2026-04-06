import type { Processor } from '..';
import type { MastraDBMessage, MessageList } from '../../agent';
import { parseMemoryRequestContext } from '../../memory';
import { removeWorkingMemoryTags } from '../../memory/working-memory-utils';
import type { ObservabilityContext } from '../../observability';
import type { RequestContext } from '../../request-context';
import type { MemoryStorage } from '../../storage';

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

  /**
   * Get threadId and resourceId from either RequestContext or MessageList's memoryInfo
   */
  private getMemoryContext(
    requestContext: RequestContext | undefined,
    messageList: MessageList,
  ): { threadId: string; resourceId?: string } | null {
    // First try RequestContext (set by Memory class)
    const memoryContext = parseMemoryRequestContext(requestContext);
    if (memoryContext?.thread?.id) {
      return {
        threadId: memoryContext.thread.id,
        resourceId: memoryContext.resourceId,
      };
    }

    // Fallback to MessageList's memoryInfo (set when MessageList is created with threadId)
    const serialized = messageList.serialize();
    if (serialized.memoryInfo?.threadId) {
      return {
        threadId: serialized.memoryInfo.threadId,
        resourceId: serialized.memoryInfo.resourceId,
      };
    }

    return null;
  }

  async processInput(
    args: {
      messages: MastraDBMessage[];
      messageList: MessageList;
      abort: (reason?: string) => never;
      requestContext?: RequestContext;
    } & Partial<ObservabilityContext>,
  ): Promise<MessageList | MastraDBMessage[]> {
    const { messageList, requestContext } = args;

    // Get memory context from RequestContext or MessageList
    const context = this.getMemoryContext(requestContext, messageList);

    if (!context) {
      return messageList;
    }

    const { threadId, resourceId } = context;

    // 1. Fetch historical messages from storage (as DB format)
    const result = await this.storage.listMessages({
      threadId,
      resourceId,
      page: 0,
      perPage: this.lastMessages,
      orderBy: { field: 'createdAt', direction: 'DESC' },
    });

    // 2. Filter out system messages (they should never be stored in DB)
    const filteredMessages = result.messages.filter((msg: MastraDBMessage) => {
      return msg.role !== 'system';
    });

    // 3. Merge with incoming messages and messages already in MessageList (avoiding duplicates by ID)
    // This includes messages added by previous processors like SemanticRecall
    const existingMessages = messageList.get.all.db();
    const messageIds = new Set(existingMessages.map((m: MastraDBMessage) => m.id).filter(Boolean));
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

  /**
   * Filters messages before persisting to storage:
   * 1. Removes streaming tool calls (state === 'partial-call') - these are intermediate states
   * 2. Removes updateWorkingMemory tool invocations (hide args from message history)
   * 3. Strips <working_memory> tags from text content
   *
   * Note: We preserve 'call' state tool invocations because:
   * - For server-side tools, 'call' should have been converted to 'result' by the time OUTPUT is processed
   * - For client-side tools (no execute function), 'call' is the final state from the server's perspective
   */
  private filterMessagesForPersistence(messages: MastraDBMessage[]): MastraDBMessage[] {
    return messages
      .map(m => {
        const newMessage = { ...m };
        // Only spread content if it's a proper V2 object
        if (m.content && typeof m.content === 'object' && !Array.isArray(m.content)) {
          newMessage.content = { ...m.content };
        }

        // Strip working memory tags from string content
        if (typeof newMessage.content?.content === 'string' && newMessage.content.content.length > 0) {
          newMessage.content.content = removeWorkingMemoryTags(newMessage.content.content).trim();
        }

        if (Array.isArray(newMessage.content?.parts)) {
          newMessage.content.parts = newMessage.content.parts
            .map(p => {
              // Filter out streaming tool calls (partial-call is an intermediate state during streaming)
              if (p.type === `tool-invocation` && p.toolInvocation.state === `partial-call`) {
                return null;
              }
              // Filter out updateWorkingMemory tool invocations (hide args from message history)
              if (p.type === `tool-invocation` && p.toolInvocation.toolName === `updateWorkingMemory`) {
                return null;
              }
              // Strip working memory tags from text parts
              if (p.type === `text`) {
                const text = typeof p.text === 'string' ? p.text : '';
                return {
                  ...p,
                  text: removeWorkingMemoryTags(text).trim(),
                };
              }
              return p;
            })
            .filter((p): p is NonNullable<typeof p> => Boolean(p));

          // If all parts were filtered out, skip the whole message
          if (newMessage.content.parts.length === 0) {
            return null;
          }
        }

        return newMessage;
      })
      .filter((m): m is NonNullable<typeof m> => Boolean(m));
  }

  async processOutputResult(
    args: {
      messages: MastraDBMessage[];
      messageList: MessageList;
      abort: (reason?: string) => never;
      requestContext?: RequestContext;
    } & Partial<ObservabilityContext>,
  ): Promise<MessageList> {
    const { messageList, requestContext } = args;

    // Get memory context from RequestContext or MessageList
    const context = this.getMemoryContext(requestContext, messageList);

    // Check if readOnly from memoryConfig
    const memoryContext = parseMemoryRequestContext(requestContext);
    const readOnly = memoryContext?.memoryConfig?.readOnly;

    if (!context || readOnly) {
      return messageList;
    }

    const { threadId, resourceId } = context;

    const newInput = messageList.get.input.db();
    const newOutput = messageList.get.response.db();
    const messagesToSave = [...newInput, ...newOutput];

    if (messagesToSave.length === 0) {
      return messageList;
    }

    await this.persistMessages({ messages: messagesToSave, threadId, resourceId });
    // add extra 1ms latency to make sure the next generate has not the same input
    await new Promise(resolve => setTimeout(resolve, 10));

    return messageList;
  }

  /**
   * Persist messages to storage, filtering out partial tool calls and working memory tags.
   * Also ensures the thread exists (creates if needed).
   *
   * This method can be called externally by other processors (e.g., ObservationalMemory)
   * that need to save messages incrementally.
   */
  async persistMessages(args: { messages: MastraDBMessage[]; threadId: string; resourceId?: string }): Promise<void> {
    const { messages, threadId, resourceId } = args;

    if (messages.length === 0) {
      return;
    }

    const filtered = this.filterMessagesForPersistence(messages);

    if (filtered.length === 0) {
      return;
    }

    // Ensure thread exists (create if needed) before saving messages
    const thread = await this.storage.getThreadById({ threadId });
    if (thread) {
      await this.storage.updateThread({
        id: threadId,
        title: thread.title || '',
        metadata: thread.metadata || {},
      });
    } else {
      // Auto-create thread if it doesn't exist
      await this.storage.saveThread({
        thread: {
          id: threadId,
          resourceId: resourceId || threadId,
          title: '',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    // Persist messages after thread is guaranteed to exist
    await this.storage.saveMessages({ messages: filtered });
  }
}
