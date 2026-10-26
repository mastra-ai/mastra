import type { OutputResult, Processor, ProcessorSpanPhase } from '..';
import type { MastraDBMessage, MessageList } from '../../agent';
import { filterMessagesForPersistence } from '../../agent/filter-messages-for-persistence';
import { noteThreadMessagesSaved } from '../../agent/thread-saves';
import { loadMessageHistory, parseMemoryRequestContext } from '../../memory';
import { getMemoryTokenBoundary, isAfterMemoryTokenBoundary } from '../../memory/message-history-config';
import { SpanType } from '../../observability';
import type { ObservabilityContext, MemoryOperationAttributes } from '../../observability';
import { MASTRA_CONTINUATION_TOOL_CALL_IDS_KEY } from '../../request-context';
import type { RequestContext } from '../../request-context';
import type { MemoryStorage } from '../../storage';

// Bounds the newest-first scan for continuation tool-call messages that fall outside the history window.
const CONTINUATION_SCAN_PAGE_SIZE = 100;
const CONTINUATION_SCAN_MAX_PAGES = 10;

/**
 * Options for the MessageHistory processor
 */
export interface MessageHistoryOptions {
  storage: MemoryStorage;
  lastMessages?: number | false;
  tokenLimit?: { maxTokens: number; atMaxRemoveTokens: number };
  tokenCounter?: { countMessage(message: MastraDBMessage): number | Promise<number> };
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
  private lastMessages?: number | false;
  private tokenLimit?: MessageHistoryOptions['tokenLimit'];
  private tokenCounter?: MessageHistoryOptions['tokenCounter'];

  constructor(options: MessageHistoryOptions) {
    this.storage = options.storage;
    this.lastMessages = options.lastMessages;
    this.tokenLimit = options.tokenLimit;
    this.tokenCounter = options.tokenCounter;
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

  private async loadContinuationToolCallMessages(
    requestContext: RequestContext | undefined,
    threadId: string,
    resourceId: string | undefined,
    loaded: MastraDBMessage[],
  ): Promise<MastraDBMessage[]> {
    const ids = requestContext?.get(MASTRA_CONTINUATION_TOOL_CALL_IDS_KEY);
    if (!Array.isArray(ids) || ids.length === 0) return [];

    const missing = new Set<string>(ids.filter((id): id is string => typeof id === 'string'));
    for (const msg of loaded) {
      for (const id of toolCallIdsOf(msg)) missing.delete(id);
    }
    if (missing.size === 0) return [];

    // Scan newest-first in bounded pages so a long thread is never read in full.
    const loadedIds = new Set(loaded.map(msg => msg.id));
    const found: MastraDBMessage[] = [];
    for (let page = 0; page < CONTINUATION_SCAN_MAX_PAGES && missing.size > 0; page++) {
      const { messages, hasMore } = await this.storage.listMessages({
        threadId,
        resourceId,
        page,
        perPage: CONTINUATION_SCAN_PAGE_SIZE,
        orderBy: { field: 'createdAt', direction: 'DESC' },
        includeTotal: false,
      });
      for (const msg of messages) {
        if (msg.role === 'system' || loadedIds.has(msg.id)) continue;
        const ids = toolCallIdsOf(msg).filter(id => missing.has(id));
        if (!ids.length) continue;
        found.push(msg);
        loadedIds.add(msg.id);
        for (const id of ids) missing.delete(id);
      }
      if (!hasMore || messages.length < CONTINUATION_SCAN_PAGE_SIZE) break;
    }
    return found;
  }

  /**
   * Keep pinned messages inside the token budget: drop the oldest unpinned history first,
   * and skip any pinned message that cannot fit on its own.
   */
  private async fitPinnedMessages(
    history: MastraDBMessage[],
    pinned: MastraDBMessage[],
  ): Promise<{ history: MastraDBMessage[]; pinned: MastraDBMessage[] }> {
    if (!this.tokenLimit || !this.tokenCounter || !pinned.length) return { history, pinned };
    const maxTokens = this.tokenLimit.maxTokens - this.tokenLimit.atMaxRemoveTokens;
    // Keep each pinned result that fits on its own, then give the rest of the budget to history.
    const fittedPinned: MastraDBMessage[] = [];
    let pinnedTokens = 0;
    for (const msg of pinned) {
      const tokens = await this.tokenCounter.countMessage(msg);
      if (pinnedTokens + tokens > maxTokens) continue;
      pinnedTokens += tokens;
      fittedPinned.push(msg);
    }
    if (!fittedPinned.length) return { history, pinned: [] };
    // history is newest-first; keep the newest messages that still fit next to the pinned ones.
    const kept: MastraDBMessage[] = [];
    let total = pinnedTokens;
    for (const msg of history) {
      const tokens = await this.tokenCounter.countMessage(msg);
      if (total + tokens > maxTokens) break;
      total += tokens;
      kept.push(msg);
    }
    return { history: kept, pinned: fittedPinned };
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

    // The runner records failures on this span and ends it.
    const span = this.memorySpan(observabilityContext);
    span?.update({ attributes: { lastMessages: this.lastMessages } });

    // 1. Fetch historical messages from storage (as DB format)
    const storedBoundary = getMemoryTokenBoundary(parseMemoryRequestContext(requestContext)?.thread);
    const boundary =
      this.tokenLimit &&
      storedBoundary?.maxTokens === this.tokenLimit.maxTokens &&
      storedBoundary.atMaxRemoveTokens === this.tokenLimit.atMaxRemoveTokens
        ? storedBoundary
        : undefined;
    const cacheKey = `history:${threadId}:${resourceId ?? ''}:${this.lastMessages ?? 'all'}:${JSON.stringify(boundary)}`;
    const loadMessages = async () => {
      if (this.tokenLimit) {
        const result = await loadMessageHistory({
          storage: this.storage,
          threadId,
          resourceId,
          boundary,
          maxMessages: typeof this.lastMessages === 'number' ? this.lastMessages : undefined,
          maxTokens: this.tokenLimit.maxTokens,
          atMaxRemoveTokens: this.tokenLimit.atMaxRemoveTokens,
          tokenCounter: this.tokenCounter,
          includeOverflow: true,
        });
        return [...result.overflow, ...result.messages].reverse();
      }

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
      return msg.role !== 'system' && (!boundary || isAfterMemoryTokenBoundary(msg, boundary));
    });

    // A background task's result is written into its original tool-call message, which keeps
    // its dispatch-time createdAt. The continuation turn that reports the result must still see
    // it, so load those messages even when they fall outside the history window.
    const pinnedMessages = await this.loadContinuationToolCallMessages(
      requestContext,
      threadId,
      resourceId,
      filteredMessages,
    );
    if (pinnedMessages.length) {
      const fitted = await this.fitPinnedMessages(filteredMessages, pinnedMessages);
      filteredMessages.splice(0, filteredMessages.length, ...fitted.history, ...fitted.pinned);
      filteredMessages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    // 3. Add stored history in chronological order. MessageList layers any matching
    // input copy onto the stored message so memory remains the authoritative base.
    const chronologicalMessages = filteredMessages.reverse();

    for (const msg of chronologicalMessages) {
      messageList.add(msg, 'memory');
    }

    span?.update({ attributes: { messageCount: chronologicalMessages.length } });

    return messageList;
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

    const persistenceMessageList = messageList.cloneForPersistence();
    const newInput = persistenceMessageList.get.input.db();
    const newOutput = persistenceMessageList.get.response.db();
    // Apply transcript redaction before persisting: this path bypasses
    // drainUnsavedMessages(), and a background tool result may sit in the
    // list as a raw payload whose transcript transform lives only in
    // providerMetadata. Persisting it untransformed would leak the raw
    // payload to storage whenever this save lands after the redacting
    // save-queue flush (last-writer-wins on the message id).
    const messagesToSave = persistenceMessageList.transformMessagesForTranscript([...newInput, ...newOutput]);

    if (messagesToSave.length === 0) {
      return messageList;
    }

    // Don't persist an input-only failed turn: if the provider errored before
    // producing any output, saving the user message would orphan it in history.
    if (result?.finishReason === 'error' && newOutput.length === 0) {
      return messageList;
    }

    // The runner records failures on this span and ends it.
    const span = this.memorySpan(observabilityContext);
    span?.update({ attributes: { messageCount: messagesToSave.length } });

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

    const filtered = filterMessagesForPersistence(messages);

    if (filtered.length === 0) {
      return;
    }

    const savedAt = Date.now();

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
    noteThreadMessagesSaved({ threadId, resourceId, savedAt });
  }
}

function toolCallIdsOf(msg: MastraDBMessage): string[] {
  const parts = msg.content?.parts ?? [];
  const ids: string[] = [];
  for (const part of parts) {
    if (part.type === 'tool-invocation') ids.push(part.toolInvocation.toolCallId);
  }
  return ids;
}
