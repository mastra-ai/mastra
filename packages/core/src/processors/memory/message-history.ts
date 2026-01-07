import type { Processor } from '..';
import type { MastraDBMessage, MessageList } from '../../agent';
import { parseMemoryRuntimeContext } from '../../memory';
import type { TracingContext } from '../../observability';
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
    const memoryContext = parseMemoryRuntimeContext(requestContext);
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

  async processInput(args: {
    messages: MastraDBMessage[];
    messageList: MessageList;
    abort: (reason?: string) => never;
    tracingContext?: TracingContext;
    requestContext?: RequestContext;
  }): Promise<MessageList | MastraDBMessage[]> {
    const { messageList, requestContext } = args;

    // Get memory context from RequestContext or MessageList
    const context = this.getMemoryContext(requestContext, messageList);

    console.log(`[MessageHistory processInput] Context: ${JSON.stringify(context)}`);

    if (!context) {
      return messageList;
    }

    const { threadId } = context;

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

  private filterIncompleteToolCalls(messages: MastraDBMessage[]): MastraDBMessage[] {
    return messages
      .map(m => {
        if (m.role === `assistant`) {
          const assistant = {
            ...m,
            content: {
              ...m.content,
              parts: m.content.parts
                .map(p => {
                  if (
                    p.type === `tool-invocation` &&
                    (p.toolInvocation.state === `call` || p.toolInvocation.state === `partial-call`)
                  ) {
                    return null;
                  }
                  return p;
                })
                .filter((p): p is NonNullable<typeof p> => Boolean(p)),
            },
          };

          if (assistant.content.parts.length === 0) return null;
          return assistant;
        }
        return m;
      })
      .filter((m): m is NonNullable<typeof m> => Boolean(m));
  }

  async processOutputResult(args: {
    messages: MastraDBMessage[];
    messageList: MessageList;
    abort: (reason?: string) => never;
    tracingContext?: TracingContext;
    requestContext?: RequestContext;
  }): Promise<MessageList> {
    const { messageList, requestContext } = args;

    // Get memory context from RequestContext or MessageList
    const context = this.getMemoryContext(requestContext, messageList);

    // Check if readOnly from memoryConfig
    const memoryContext = parseMemoryRuntimeContext(requestContext);
    const readOnly = memoryContext?.memoryConfig?.readOnly;

    if (!context || readOnly) {
      return messageList;
    }

    const { threadId } = context;

    const newInput = messageList.get.input.db();
    const newOutput = messageList.get.response.db();
    const messagesToSave = [...newInput, ...newOutput];

    if (messagesToSave.length === 0) {
      return messageList;
    }

    const filtered = this.filterIncompleteToolCalls(messagesToSave);

    // Persist messages directly to storage
    await this.storage.saveMessages({ messages: filtered });

    // Ensure thread exists (create if needed) and update its timestamp
    const thread = await this.storage.getThreadById({ threadId });
    if (thread) {
      await this.storage.updateThread({
        id: threadId,
        title: thread.title || '',
        metadata: thread.metadata || {},
      });
    } else {
      // Auto-create thread if it doesn't exist
      const resourceId = context.resourceId;
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

    return messageList;
  }
}
