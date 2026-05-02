import type { Processor } from '..';
import type { MastraDBMessage, MessageList } from '../../agent';
import { parseMemoryRequestContext } from '../../memory';
import { removeWorkingMemoryTags } from '../../memory/working-memory-utils';
import { SpanType, EntityType } from '../../observability';
import type { ObservabilityContext, MemoryOperationAttributes } from '../../observability';
import { MASTRA_MEMORY_HISTORY_OVERRIDE_KEY } from '../../request-context';
import type { MastraMemoryHistoryOverride, RequestContext } from '../../request-context';
import type { MemoryStorage } from '../../storage';

/**
 * Options for the MessageHistory processor
 */
export interface MessageHistoryOptions {
  storage: MemoryStorage;
  lastMessages?: number;
  saveMessages?: (args: { messages: MastraDBMessage[] }) => Promise<{ messages: MastraDBMessage[] }>;
  deleteMessages?: (messageIds: string[], observabilityContext?: Partial<ObservabilityContext>) => Promise<void>;
}

type RegenerateState = {
  type: 'regenerate';
  branchMessageIds: string[];
};

type MemoryHistoryOverride = MastraMemoryHistoryOverride;

const INCOMPLETE_RESPONSE_STATUSES = new Set(['partial', 'aborted', 'cancelled', 'canceled']);

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
  private saveMessages?: MessageHistoryOptions['saveMessages'];
  private deleteMessages?: MessageHistoryOptions['deleteMessages'];

  constructor(options: MessageHistoryOptions) {
    this.storage = options.storage;
    this.lastMessages = options.lastMessages;
    this.saveMessages = options.saveMessages;
    this.deleteMessages = options.deleteMessages;
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

  private createMemorySpan(
    operationType: MemoryOperationAttributes['operationType'],
    observabilityContext?: Partial<ObservabilityContext>,
    input?: any,
    attributes?: Partial<MemoryOperationAttributes>,
  ) {
    const currentSpan = observabilityContext?.tracingContext?.currentSpan;
    if (!currentSpan) return undefined;
    return currentSpan.createChildSpan({
      type: SpanType.MEMORY_OPERATION,
      name: `memory: ${operationType}`,
      entityType: EntityType.MEMORY,
      entityName: 'Memory',
      input,
      attributes: { operationType, ...attributes },
    });
  }

  private getMemoryHistoryOverride(requestContext?: RequestContext): MastraMemoryHistoryOverride | null {
    const override = requestContext?.get(MASTRA_MEMORY_HISTORY_OVERRIDE_KEY);
    if (!override || typeof override !== 'object') return null;

    const maybeOverride = override as Partial<MastraMemoryHistoryOverride>;
    if (maybeOverride.type === 'server-history') {
      return maybeOverride as Extract<MemoryHistoryOverride, { type: 'server-history' }>;
    }

    if (maybeOverride.type === 'regenerate' && typeof maybeOverride.targetMessageId === 'string') {
      return maybeOverride as Extract<MemoryHistoryOverride, { type: 'regenerate' }>;
    }

    throw new Error('Invalid memory history override');
  }

  private isIncompleteAssistantMessage(message: MastraDBMessage): boolean {
    if (message.role !== 'assistant') return false;

    const metadata =
      message.content && typeof message.content === 'object' && !Array.isArray(message.content)
        ? ((message.content as { metadata?: Record<string, unknown> }).metadata ?? {})
        : {};
    const mastra = metadata.mastra;
    if (!mastra || typeof mastra !== 'object') return false;

    const responseStatus = (mastra as { responseStatus?: unknown }).responseStatus;
    return typeof responseStatus === 'string' && INCOMPLETE_RESPONSE_STATUSES.has(responseStatus);
  }

  private async cleanupIncompleteAssistantMessages(
    messages: MastraDBMessage[],
    observabilityContext?: Partial<ObservabilityContext>,
  ): Promise<MastraDBMessage[]> {
    const incompleteMessageIds = messages
      .filter(message => this.isIncompleteAssistantMessage(message))
      .map(message => message.id)
      .filter((id): id is string => Boolean(id));

    if (incompleteMessageIds.length > 0) {
      if (this.deleteMessages) {
        await this.deleteMessages(incompleteMessageIds, observabilityContext);
      } else {
        await this.storage.deleteMessages(incompleteMessageIds);
      }
    }

    return messages.filter(message => !this.isIncompleteAssistantMessage(message));
  }

  private async processRegenerateInput(args: {
    messageList: MessageList;
    requestContext?: RequestContext;
    state?: Record<string, unknown>;
    context: { threadId: string; resourceId?: string };
    override: Extract<MastraMemoryHistoryOverride, { type: 'regenerate' }>;
  }): Promise<MessageList> {
    const { messageList, context, override, state } = args;
    const result = await this.storage.listMessages({
      threadId: context.threadId,
      resourceId: context.resourceId,
      page: 0,
      perPage: false,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });

    const storedMessages = result.messages.filter((msg: MastraDBMessage) => msg.role !== 'system');
    const targetIndex = storedMessages.findIndex(message => message.id === override.targetMessageId);
    if (targetIndex === -1) {
      throw new Error(`Cannot regenerate missing message "${override.targetMessageId}"`);
    }

    const targetMessage = storedMessages[targetIndex]!;
    if (targetMessage.role !== 'assistant') {
      throw new Error(`Cannot regenerate non-assistant message "${override.targetMessageId}"`);
    }

    const branchMessages = storedMessages.slice(targetIndex);
    const branchMessageIds = branchMessages.map(message => message.id).filter(Boolean);
    if (state) {
      state.regenerate = {
        type: 'regenerate',
        branchMessageIds,
      } satisfies RegenerateState;
    }

    const recallMessages = await this.cleanupIncompleteAssistantMessages(storedMessages.slice(0, targetIndex));
    const existingMessages = messageList.get.all.db();
    const messageIds = new Set(existingMessages.map((m: MastraDBMessage) => m.id).filter(Boolean));
    for (const msg of recallMessages) {
      if (!msg.id || !messageIds.has(msg.id)) {
        messageList.add(msg, 'memory');
      }
    }

    return messageList;
  }

  async processInput(
    args: {
      messages: MastraDBMessage[];
      messageList: MessageList;
      abort: (reason?: string) => never;
      requestContext?: RequestContext;
      state?: Record<string, unknown>;
    } & Partial<ObservabilityContext>,
  ): Promise<MessageList | MastraDBMessage[]> {
    const { messageList, requestContext, ...observabilityContext } = args;

    // Get memory context from RequestContext or MessageList
    const context = this.getMemoryContext(requestContext, messageList);

    if (!context) {
      return messageList;
    }

    const { threadId, resourceId } = context;
    const override = this.getMemoryHistoryOverride(requestContext);

    const span = this.createMemorySpan(
      'recall',
      observabilityContext,
      { threadId, resourceId },
      {
        lastMessages: this.lastMessages,
      },
    );

    try {
      if (override?.type === 'regenerate') {
        const regeneratedMessageList = await this.processRegenerateInput({
          messageList,
          requestContext,
          state: args.state,
          context,
          override,
        });

        span?.end({
          output: { success: true },
          attributes: { messageCount: regeneratedMessageList.get.all.db().length },
        });

        return regeneratedMessageList;
      }

      // 1. Fetch historical messages from storage (as DB format)
      const result = await this.storage.listMessages({
        threadId,
        resourceId,
        page: 0,
        perPage: override?.type === 'server-history' ? false : this.lastMessages,
        orderBy: { field: 'createdAt', direction: 'DESC' },
      });

      // 2. Filter out system messages (they should never be stored in DB)
      let filteredMessages = result.messages.filter((msg: MastraDBMessage) => {
        return msg.role !== 'system';
      });
      if (override?.type === 'server-history') {
        filteredMessages = await this.cleanupIncompleteAssistantMessages(filteredMessages, observabilityContext);
        if (typeof this.lastMessages === 'number' && this.lastMessages > 0) {
          filteredMessages = filteredMessages.slice(0, this.lastMessages);
        }
      }

      // 3. Merge with incoming messages and messages already in MessageList (avoiding duplicates by ID)
      // This includes messages added by previous processors like SemanticRecall
      const existingMessages = messageList.get.all.db();
      const messageIds = new Set(existingMessages.map((m: MastraDBMessage) => m.id).filter(Boolean));
      const uniqueHistoricalMessages = filteredMessages.filter((m: MastraDBMessage) => !m.id || !messageIds.has(m.id));

      // Reverse to chronological order (oldest first) since we fetched DESC
      const chronologicalMessages = uniqueHistoricalMessages.reverse();

      if (chronologicalMessages.length === 0) {
        span?.end({
          output: { success: true },
          attributes: { messageCount: 0 },
        });
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

      span?.end({
        output: { success: true },
        attributes: { messageCount: chronologicalMessages.length },
      });

      return messageList;
    } catch (error) {
      span?.error({ error: error as Error, endSpan: true });
      throw error;
    }
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
  private filterMessagesForPersistence(
    messages: MastraDBMessage[],
    { includeIncompleteAssistantMessages = false }: { includeIncompleteAssistantMessages?: boolean } = {},
  ): MastraDBMessage[] {
    return messages
      .map(m => {
        if (!includeIncompleteAssistantMessages && this.isIncompleteAssistantMessage(m)) {
          return null;
        }

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
      state?: Record<string, unknown>;
    } & Partial<ObservabilityContext>,
  ): Promise<MessageList> {
    const { messageList, requestContext, ...observabilityContext } = args;

    // Get memory context from RequestContext or MessageList
    const context = this.getMemoryContext(requestContext, messageList);

    // Check if readOnly from memoryConfig
    const memoryContext = parseMemoryRequestContext(requestContext);
    const readOnly = memoryContext?.memoryConfig?.readOnly;

    if (!context || readOnly) {
      return messageList;
    }

    const { threadId, resourceId } = context;

    const override = this.getMemoryHistoryOverride(requestContext);
    const newInput = messageList.get.input.db();
    const newOutput = messageList.get.response.db();
    const messagesToSave = [...newInput, ...newOutput];

    if (messagesToSave.length === 0) {
      return messageList;
    }

    const span = this.createMemorySpan('save', observabilityContext, undefined, {
      messageCount: messagesToSave.length,
    });

    try {
      const persistedMessages = await this.persistMessages({
        messages: messagesToSave,
        threadId,
        resourceId,
        includeIncompleteAssistantMessages: override?.type === 'server-history',
      });

      const regenerateState = args.state?.regenerate as RegenerateState | undefined;
      const persistedReplacementOutput =
        newOutput.length > 0 && persistedMessages.some(message => message.role === 'assistant');
      if (regenerateState?.type === 'regenerate' && persistedReplacementOutput) {
        const savedMessageIds = new Set(messagesToSave.map(message => message.id).filter(Boolean));
        const messageIdsToDelete = regenerateState.branchMessageIds.filter(
          messageId => !savedMessageIds.has(messageId),
        );
        if (messageIdsToDelete.length > 0) {
          if (this.deleteMessages) {
            await this.deleteMessages(messageIdsToDelete, observabilityContext);
          } else {
            await this.storage.deleteMessages(messageIdsToDelete);
          }
        }
      }

      // add extra 1ms latency to make sure the next generate has not the same input
      await new Promise(resolve => setTimeout(resolve, 10));

      span?.end({
        output: { success: true },
      });

      return messageList;
    } catch (error) {
      span?.error({ error: error as Error, endSpan: true });
      throw error;
    }
  }

  /**
   * Persist messages to storage, filtering out partial tool calls and working memory tags.
   * Also ensures the thread exists (creates if needed).
   *
   * This method can be called externally by other processors (e.g., ObservationalMemory)
   * that need to save messages incrementally.
   */
  async persistMessages(args: {
    messages: MastraDBMessage[];
    threadId: string;
    resourceId?: string;
    includeIncompleteAssistantMessages?: boolean;
  }): Promise<MastraDBMessage[]> {
    const { messages, threadId, resourceId, includeIncompleteAssistantMessages } = args;

    if (messages.length === 0) {
      return [];
    }

    const filtered = this.filterMessagesForPersistence(messages, { includeIncompleteAssistantMessages });

    if (filtered.length === 0) {
      return [];
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
    if (this.saveMessages) {
      const result = await this.saveMessages({ messages: filtered });
      return result?.messages ?? filtered;
    }

    const result = await this.storage.saveMessages({ messages: filtered });
    return result?.messages ?? filtered;
  }
}
