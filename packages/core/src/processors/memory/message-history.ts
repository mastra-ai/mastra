import type { OutputResult, Processor, ProcessorSpanPhase } from '..';
import { MessageList, type MastraDBMessage } from '../../agent/message-list';
import { isTransientSignalMessage } from '../../agent/signals';
import { materializeTerminalToolResult } from '../../loop/shared/terminal-tool-result';
import { parseMemoryRequestContext } from '../../memory';
import { removeWorkingMemoryTags } from '../../memory/working-memory-utils';
import { SpanType } from '../../observability';
import type { ObservabilityContext, MemoryOperationAttributes } from '../../observability';
import type { RequestContext } from '../../request-context';
import type { MemoryStorage } from '../../storage';
import type { TerminalToolResult } from '../../tools';
import {
  filterToolCallMessages,
  getSealedMessageBoundary,
  getPreservedModelOutputParts,
  normalizeToolCallFilterExclude,
  preserveSealedMessageBoundary,
} from '../tool-call-filter-utils';
import type { ToolCallFilteringOptions } from '../tool-call-filter-utils';

export const DEFAULT_PERSISTED_MODEL_OUTPUT_BYTES = 16 * 1024;
const MAX_PERSISTED_TERMINAL_TOOL_RESULT_ID_BYTES = 1024;

type PersistedTerminalToolResultPart = {
  type: 'data-terminal-tool-result';
  id: string;
  data: TerminalToolResult;
};

function projectTerminalToolResultPart(part: unknown): PersistedTerminalToolResultPart | undefined {
  if (!part || typeof part !== 'object' || Array.isArray(part)) return undefined;
  const candidate = part as Record<string, unknown>;
  if (
    candidate.type !== 'data-terminal-tool-result' ||
    typeof candidate.id !== 'string' ||
    candidate.id.length === 0 ||
    !candidate.data ||
    typeof candidate.data !== 'object' ||
    Array.isArray(candidate.data)
  ) {
    return undefined;
  }
  if (new TextEncoder().encode(candidate.id).byteLength > MAX_PERSISTED_TERMINAL_TOOL_RESULT_ID_BYTES) return undefined;
  try {
    const data = materializeTerminalToolResult(candidate.data);
    return { type: 'data-terminal-tool-result', id: candidate.id, data };
  } catch {
    return undefined;
  }
}

export type MessageHistoryToolCallFilterOptions = Pick<
  ToolCallFilteringOptions,
  'exclude' | 'preserveModelOutput' | 'preserveModelOutputFor' | 'maxModelOutputBytes'
>;

export type MessageHistoryFinalTurnPersistenceOptions = {
  mode: 'final-turn';
  /** Tool names whose compact model output may be persisted. Omitted or empty retains none. */
  preserveModelOutputFor?: string[];
  /** Maximum UTF-8 bytes retained from each approved compact model output. */
  maxModelOutputBytes?: number;
};

/**
 * Options for the MessageHistory processor
 */
export interface MessageHistoryOptions {
  storage: MemoryStorage;
  lastMessages?: number;
  /**
   * Opt-in filtering applied only to messages written by MessageHistory.
   * Omit this option to preserve the existing persistence behavior.
   * Preserved model output defaults to a 16 KiB UTF-8 byte limit.
   * Messages changed by this policy also drop message-level provider metadata.
   * Can't be combined with `persistence`.
   */
  toolCallFilter?: MessageHistoryToolCallFilterOptions;
  /**
   * Persist one stable user turn, approved compact outcomes, and the final assistant answer.
   * Can't be combined with `toolCallFilter`.
   */
  persistence?: MessageHistoryFinalTurnPersistenceOptions;
}

/**
 * Hybrid processor that handles both retrieval and persistence of message history.
 * - On input: Fetches historical messages from storage and prepends them
 * - On output: Persists new messages to storage (excluding system messages)
 *
 * This processor retrieves threadId and resourceId from RequestContext at execution time,
 * making it decoupled from memory-specific context.
 */
/**
 * Which memory operation each pipeline phase performs. The input phase recalls
 * stored history into the context; the output phase saves the turn.
 */
const MEMORY_PHASE_OPERATION: Partial<Record<ProcessorSpanPhase, 'recall' | 'save'>> = {
  input: 'recall',
  inputStep: 'recall',
  output: 'save',
  outputStep: 'save',
};

export class MessageHistory implements Processor {
  readonly id = 'message-history';
  readonly name = 'MessageHistory';
  readonly terminalToolResultPolicy = 'pass-through' as const;
  readonly terminalToolResultPersistence = 'owner' as const;

  /**
   * Trace as a memory operation rather than an anonymous processor run: a user
   * configures `memory`, not a processor. The two phases are different memory
   * operations — the input phase recalls stored history, the output phase saves
   * the turn — so each is named for what it does.
   *
   * This replaces a MEMORY_OPERATION span the processor used to create *inside*
   * its own processor span, which meant two spans per phase describing one
   * operation.
   */
  readonly spanType = SpanType.MEMORY_OPERATION;
  readonly spanName = (phase: ProcessorSpanPhase): string => `memory: ${MEMORY_PHASE_OPERATION[phase] ?? 'recall'}`;
  readonly spanAttributes = (phase: ProcessorSpanPhase): Partial<MemoryOperationAttributes> => ({
    operationType: MEMORY_PHASE_OPERATION[phase] ?? 'recall',
  });
  private storage: MemoryStorage;
  private lastMessages?: number;
  private toolCallFilter?: MessageHistoryToolCallFilterOptions;
  private persistence?: MessageHistoryFinalTurnPersistenceOptions;

  constructor(options: MessageHistoryOptions) {
    if (options.persistence !== undefined && options.toolCallFilter !== undefined) {
      throw new TypeError('MessageHistory options.persistence cannot be combined with options.toolCallFilter');
    }
    this.storage = options.storage;
    this.lastMessages = options.lastMessages;
    this.toolCallFilter = options.toolCallFilter;
    this.persistence = options.persistence;
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

  /**
   * This processor's own span, which the runner already typed as the memory
   * operation. Recording onto it rather than creating a child keeps one span
   * per memory operation. The runner owns its lifecycle, so this only ever
   * updates — it never ends or errors the span.
   */
  private memorySpan(observabilityContext?: Partial<ObservabilityContext>) {
    return observabilityContext?.tracingContext?.currentSpan;
  }

  async processInput(
    args: {
      messages: MastraDBMessage[];
      messageList: MessageList;
      abort: (reason?: string) => never;
      requestContext?: RequestContext;
    } & Partial<ObservabilityContext>,
  ): Promise<MessageList | MastraDBMessage[]> {
    const { messageList, requestContext, ...observabilityContext } = args;

    // Get memory context from RequestContext or MessageList
    const context = this.getMemoryContext(requestContext, messageList);

    if (!context) {
      return messageList;
    }

    const { threadId, resourceId } = context;
    const memoryRunState = parseMemoryRequestContext(requestContext)?.runState?.();

    const span = this.memorySpan(observabilityContext);
    span?.update({ attributes: { lastMessages: this.lastMessages } });

    try {
      // 1. Fetch historical messages from storage (as DB format)
      const cacheKey = `history:${threadId}:${resourceId ?? ''}:${this.lastMessages ?? 'all'}`;
      const loadMessages = async () => {
        const result = await this.storage.listMessages({
          threadId,
          resourceId,
          page: 0,
          perPage: this.lastMessages,
          orderBy: { field: 'createdAt', direction: 'DESC' },
          // Last-N history read only consumes `messages`; skip the COUNT(*) work.
          includeTotal: false,
        });
        return result.messages;
      };
      const messages = memoryRunState ? await memoryRunState.load(cacheKey, loadMessages) : await loadMessages();

      // 2. Filter out system messages (they should never be stored in DB)
      const filteredMessages = messages.filter((msg: MastraDBMessage) => {
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
        span?.update({ attributes: { messageCount: 0 } });
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

      span?.update({ attributes: { messageCount: chronologicalMessages.length } });

      return messageList;
    } catch (error) {
      // The runner records the failure on this span and ends it.
      throw error;
    }
  }

  /**
   * Filters messages before persisting to storage:
   * 1. Removes system messages - these are runtime instructions and should never be stored
   * 2. Removes transient signals (`transient: true`) - delivery-only, must never be retained
   * 3. Removes streaming tool calls (state === 'partial-call') - these are intermediate states
   * 4. Removes updateWorkingMemory tool invocations (hide args from message history)
   * 5. Strips <working_memory> tags from text content
   *
   * Note: We preserve 'call' state tool invocations because:
   * - For server-side tools, 'call' should have been converted to 'result' by the time OUTPUT is processed
   * - For client-side tools (no execute function), 'call' is the final state from the server's perspective
   */
  private filterMessagesForPersistence(messages: MastraDBMessage[]): MastraDBMessage[] {
    const normalizedToolCallFilterExclude =
      this.toolCallFilter === undefined
        ? undefined
        : normalizeToolCallFilterExclude((this.toolCallFilter as { exclude?: unknown }).exclude);
    const policyFiltersTool = (toolName: string): boolean =>
      normalizedToolCallFilterExclude === 'all' || normalizedToolCallFilterExclude?.includes(toolName) === true;

    const filteredMessages = messages
      .filter(m => m.role !== 'system' && !isTransientSignalMessage(m))
      .map(m => {
        const newMessage = { ...m };
        let removedToolInvocationCoveredByPolicy = false;
        // Only spread content if it's a proper V2 object
        if (m.content && typeof m.content === 'object' && !Array.isArray(m.content)) {
          newMessage.content = { ...m.content };
        }

        // Strip working memory tags from string content
        if (typeof newMessage.content?.content === 'string' && newMessage.content.content.length > 0) {
          const cleanedContent = removeWorkingMemoryTags(newMessage.content.content);
          newMessage.content.content =
            cleanedContent !== newMessage.content.content ? cleanedContent.trim() : newMessage.content.content;
        }

        if (Array.isArray(newMessage.content?.parts)) {
          const sealedBoundaryPart = getSealedMessageBoundary(m)?.part;
          let retainedBoundaryPart: typeof sealedBoundaryPart;
          const persistedParts: typeof newMessage.content.parts = [];
          for (const part of newMessage.content.parts) {
            if (part.type === `tool-invocation`) {
              const shouldRemove =
                part.toolInvocation.state === `partial-call` || part.toolInvocation.toolName === `updateWorkingMemory`;
              if (shouldRemove) {
                removedToolInvocationCoveredByPolicy ||= policyFiltersTool(part.toolInvocation.toolName);
                if (part === sealedBoundaryPart) retainedBoundaryPart = persistedParts.at(-1);
                continue;
              }
            }

            // Strip working memory tags from text parts
            let persistedPart = part;
            if (part.type === `text`) {
              const text = typeof part.text === 'string' ? part.text : '';
              const cleaned = removeWorkingMemoryTags(text);
              persistedPart = { ...part, text: cleaned !== text ? cleaned.trim() : text };
            }
            persistedParts.push(persistedPart);
            if (part === sealedBoundaryPart) retainedBoundaryPart = persistedPart;
          }
          newMessage.content.parts = persistedParts;

          if (this.toolCallFilter !== undefined) {
            newMessage.content.parts = preserveSealedMessageBoundary(m, newMessage.content.parts, retainedBoundaryPart);
          }

          if (removedToolInvocationCoveredByPolicy) {
            delete newMessage.content.providerMetadata;
          }

          // If all parts were filtered out, skip the whole message
          if (newMessage.content.parts.length === 0) {
            return null;
          }
        }

        return newMessage;
      })
      .filter((m): m is NonNullable<typeof m> => Boolean(m));

    const persistedMessages =
      this.persistence?.mode === 'final-turn'
        ? this.projectFinalTurnForPersistence(filteredMessages, this.persistence)
        : this.toolCallFilter === undefined
          ? filteredMessages
          : filterToolCallMessages(
              filteredMessages,
              {
                ...this.toolCallFilter,
                maxModelOutputBytes: this.toolCallFilter.maxModelOutputBytes ?? DEFAULT_PERSISTED_MODEL_OUTPUT_BYTES,
              },
              new Set(),
              { stripMessageProviderMetadata: true },
            );

    return persistedMessages.map(MessageList.transformMessageForTranscript);
  }

  private projectFinalTurnForPersistence(
    messages: MastraDBMessage[],
    options: MessageHistoryFinalTurnPersistenceOptions,
  ): MastraDBMessage[] {
    const stableUserIndex = messages.findLastIndex(message => message.role === 'user');
    const stableUser = stableUserIndex === -1 ? undefined : messages[stableUserIndex];
    const finalTurnMessages = stableUserIndex === -1 ? messages : messages.slice(stableUserIndex);
    const finalAssistant = [...finalTurnMessages].reverse().find(message => message.role === 'assistant');
    const projected: MastraDBMessage[] = [];

    if (stableUser) {
      const {
        providerMetadata: _providerMetadata,
        metadata: _metadata,
        reasoning: _reasoning,
        toolInvocations: _toolInvocations,
        ...stableUserContent
      } = stableUser.content;
      const stableUserParts = stableUser.content.parts
        .filter(part => part.type !== 'tool-invocation' && part.type !== 'step-start' && part.type !== 'reasoning')
        .map(part => {
          const { providerMetadata: _partProviderMetadata, ...stablePart } = part;
          return stablePart;
        });
      const hasStableUserContent =
        (typeof stableUserContent.content === 'string' && stableUserContent.content.length > 0) ||
        stableUserParts.length > 0 ||
        (Array.isArray(stableUserContent.experimental_attachments) &&
          stableUserContent.experimental_attachments.length > 0);

      if (hasStableUserContent) {
        projected.push({
          ...stableUser,
          content: {
            ...stableUserContent,
            parts: stableUserParts,
          },
        });
      }
    }

    if (!finalAssistant) return projected;

    const approvedOutcomes = getPreservedModelOutputParts(finalTurnMessages, {
      preserveModelOutputFor: options.preserveModelOutputFor ?? [],
      maxModelOutputBytes: options.maxModelOutputBytes ?? DEFAULT_PERSISTED_MODEL_OUTPUT_BYTES,
    });
    const lastStepStartIndex = finalAssistant.content.parts.findLastIndex(part => part.type === 'step-start');
    const lastToolIndex = finalAssistant.content.parts.findLastIndex(part => part.type === 'tool-invocation');
    const finalAnswerBoundary = Math.max(lastStepStartIndex, lastToolIndex);
    const finalAnswer = finalAssistant.content.parts
      .slice(finalAnswerBoundary + 1)
      .filter((part): part is Extract<typeof part, { type: 'text' }> => part.type === 'text')
      .map(part => ({ type: 'text' as const, text: part.text }))
      .filter(part => part.text.length > 0);
    const terminalResults = finalAssistant.content.parts
      .slice(finalAnswerBoundary + 1)
      .map(projectTerminalToolResultPart)
      .filter((part): part is PersistedTerminalToolResultPart => part !== undefined);
    const assistantParts = [...approvedOutcomes, ...terminalResults, ...finalAnswer];

    if (assistantParts.length > 0) {
      projected.push({
        id: finalAssistant.id,
        role: 'assistant',
        createdAt: finalAssistant.createdAt,
        ...(finalAssistant.threadId === undefined ? {} : { threadId: finalAssistant.threadId }),
        ...(finalAssistant.resourceId === undefined ? {} : { resourceId: finalAssistant.resourceId }),
        ...(finalAssistant.type === undefined ? {} : { type: finalAssistant.type }),
        content: {
          format: 2,
          parts: assistantParts,
        },
      });
    }

    return projected;
  }

  async processOutputResult(
    args: {
      messages: MastraDBMessage[];
      messageList: MessageList;
      abort: (reason?: string) => never;
      requestContext?: RequestContext;
      result?: OutputResult;
    } & Partial<ObservabilityContext>,
  ): Promise<MessageList> {
    const { messageList, requestContext, result, ...observabilityContext } = args;

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

    // Failed and aborted turns are not committed to durable conversation
    // history. The messages remain available to every output processor in this
    // request, but MessageHistory (the persistence owner) declines the write.
    if (result?.finishReason === 'error' || result?.finishReason === 'aborted') {
      return messageList;
    }

    const span = this.memorySpan(observabilityContext);
    span?.update({ attributes: { messageCount: messagesToSave.length } });

    try {
      await this.persistMessages({ messages: messagesToSave, threadId, resourceId });
      // add extra 1ms latency to make sure the next generate has not the same input
      await new Promise(resolve => setTimeout(resolve, 10));

      return messageList;
    } catch (error) {
      // The runner records the failure on this span and ends it.
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
  async persistMessages(args: { messages: MastraDBMessage[]; threadId: string; resourceId?: string }): Promise<void> {
    const { messages, threadId, resourceId } = args;

    if (messages.length === 0) {
      return;
    }

    const filtered = this.filterMessagesForPersistence(messages);

    if (filtered.length === 0) {
      return;
    }

    // Ensure thread exists (create if needed) before saving messages.
    // Nothing to write when it already exists: re-writing the row we just read
    // would clobber a title generated concurrently with this save.
    const thread = await this.storage.getThreadById({ threadId });
    if (!thread) {
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
