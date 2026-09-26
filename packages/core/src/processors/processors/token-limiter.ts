import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import type { CoreMessage as CoreMessageV4 } from '@internal/ai-sdk-v4';
import { estimateTokenCount } from 'tokenx';
import type { MastraDBMessage, MastraMessagePart, MessageList } from '../../agent/message-list';
import { parseDataUri, resolveFilePartMediaTypeAndData } from '../../agent/message-list/prompt/image-utils';
import { TripWire } from '../../agent/trip-wire';
import { groupLinkedToolMessages } from '../../memory/load-message-history';
import type { ChunkType } from '../../stream';
import { sliceByTokensSafe } from '../../utils/slice-by-tokens';
import type {
  ProcessInputArgs,
  ProcessInputStepArgs,
  ProcessLLMRequestArgs,
  ProcessLLMRequestResult,
  ProcessOutputStreamArgs,
  ProcessToolResultArgs,
  Processor,
} from '../index';

/**
 * Configuration options for TokenLimiter processor
 */
export interface TokenLimiterOptions {
  /** Maximum number of tokens to allow */
  limit: number;
  /**
   * @deprecated Token counts are now estimated using `tokenx` (no BPE encoder required).
   * This option is accepted for backwards compatibility but is ignored.
   */
  encoding?: unknown;
  /**
   * Strategy when token limit is reached:
   * - 'truncate': Stop emitting chunks (default)
   * - 'abort': Call abort() to stop the stream
   */
  strategy?: 'truncate' | 'abort';
  /**
   * Whether to count tokens from the beginning of the stream or just the current part
   * - 'cumulative': Count all tokens from the start (default)
   * - 'part': Only count tokens in the current part
   */
  countMode?: 'cumulative' | 'part';
  trimMode?: 'best-fit' | 'contiguous' | 'memory-only';
  /** In memory-only mode, free this many tokens below the limit (default 25%). */
  atMaxRemoveTokens?: number;
  /** Share memory's token estimator and per-part estimate cache. */
  tokenCounter?: { countMessage(message: MastraDBMessage): number | Promise<number> };
  /** Persist a memory cursor after trimming. */
  onMemoryTrim?: (messages: MastraDBMessage[], requestContext?: ProcessInputArgs['requestContext']) => Promise<void>;
  /**
   * Cap every tool result to this many tokens before it reaches the model, instead of letting
   * it be trimmed away entirely by ordinary trimming. The stored result is kept intact; the model
   * receives a truncated copy ending in a `[truncated: showing N of M tokens]` marker. A tool's own
   * `toModelOutput` mapping always takes precedence over this cap. Requires the processor to also be
   * registered in `outputProcessors` — that's what runs `processToolResult`. Unset by default (no capping).
   * Works for both durable and non-durable agents.
   *
   * This cap only applies to the run where the tool executes. `processToolResult` runs once, at
   * execution time; MessageHistory strips the truncated `modelOutput` before persisting so it never
   * freezes a stale cap setting into stored history. On later turns the full, uncapped stored result
   * reloads into the prompt — `processToolResult` does not re-run against history. Use `trimMode` /
   * the `processLLMRequest` token budget if you need every turn's prompt bounded, including replayed
   * tool results.
   */
  maxToolResultTokens?: number;
}

/**
 * Processor that limits the number of tokens in messages.
 *
 * Can be used as:
 * - Input processor: Filters historical messages to fit within context window, prioritizing recent messages
 * - Output processor: Limits generated response tokens via streaming (processOutputStream) or non-streaming (processOutputResult)
 */
type TokenLimiterTripWireMetadata = {
  systemTokens: number;
  limit: number;
  remainingBudget?: number;
  messageCount?: number;
};

/**
 * Flat estimate for an image payload. Providers bill images at a near-flat
 * per-image cost, so the encoded size is a poor predictor of the real cost.
 */
const TOKENS_PER_IMAGE = 765;

/** Estimate used when a media payload's decoded size cannot be determined. */
const TOKENS_PER_MEDIA_FALLBACK = 258;

/** Rough bytes-per-token ratio for non-image media, which is usually text-like once decoded. */
const BYTES_PER_TOKEN = 4;

type MediaPayload = { data: string; mediaType?: string; mimeType?: string };

type PromptMessage = LanguageModelV2Prompt[number];

/**
 * Detects the `{ data, mediaType | mimeType }` shape that tools return for images
 * and file attachments, so the payload is estimated rather than tokenized as text.
 */
function isMediaPayload(value: unknown): value is MediaPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.data !== 'string') return false;
  return typeof candidate.mediaType === 'string' || typeof candidate.mimeType === 'string';
}

/**
 * Estimate the token cost of a media payload without tokenizing its encoded bytes.
 * A base64 image is tens of thousands of characters but costs a small, near-flat
 * number of tokens, so stringifying it would inflate the count by an order of magnitude.
 */
function estimateMediaTokens(data: unknown, mediaType?: string): number {
  if (mediaType?.startsWith('image/')) return TOKENS_PER_IMAGE;

  let byteLength: number | undefined;

  if (typeof data === 'string') {
    const { isDataUri, base64Content } = parseDataUri(data);
    // Remote URLs and provider file ids carry no locally knowable size.
    if (isDataUri || !/^[a-z][a-z0-9+.-]*:/i.test(data)) {
      byteLength = Math.floor((base64Content.length * 3) / 4);
    }
  } else if (data instanceof Uint8Array) {
    byteLength = data.byteLength;
  }

  if (byteLength === undefined) return TOKENS_PER_MEDIA_FALLBACK;

  return Math.max(1, Math.floor(byteLength / BYTES_PER_TOKEN));
}

export class TokenLimiterProcessor implements Processor<'token-limiter', TokenLimiterTripWireMetadata> {
  public readonly id = 'token-limiter';
  public readonly name = 'Token Limiter';
  private maxTokens: number;
  private strategy: 'truncate' | 'abort';
  private countMode: 'cumulative' | 'part';
  private trimMode: 'best-fit' | 'contiguous' | 'memory-only';
  private atMaxRemoveTokens = 0;
  private tokenCounter?: TokenLimiterOptions['tokenCounter'];
  private onMemoryTrim?: TokenLimiterOptions['onMemoryTrim'];
  private maxToolResultTokens?: number;

  /**
   * Only present when `maxToolResultTokens` is set. The agentic loop checks
   * `'processToolResult' in processor` to decide whether a provider-executed
   * tool result must be routed through the output-processor pipeline before
   * eager dispatch of the next tool call; an always-present method here would
   * force that slower path even when this processor has nothing to cap.
   */
  declare public processToolResult?: (args: ProcessToolResultArgs) => Promise<void>;

  // Token counting constants for input processing
  private static readonly TOKENS_PER_MESSAGE = 3.8;
  private static readonly TOKENS_PER_CONVERSATION = 24;

  /**
   * Chunk types carrying generated output visible to the caller. Only these are
   * counted against the limit, and only these are withheld once it is reached.
   * Lifecycle chunks (`step-start`, response metadata), reasoning deltas and
   * tool traffic are neither counted nor withheld.
   */
  private static readonly OUTPUT_CHUNK_TYPES = new Set<ChunkType['type']>(['text-delta', 'object']);

  constructor(options: number | TokenLimiterOptions) {
    if (typeof options === 'number') {
      // Simple number format - just the token limit with default settings
      this.maxTokens = options;
      this.strategy = 'truncate';
      this.countMode = 'cumulative';
      this.trimMode = 'best-fit';
    } else {
      // Object format with all options
      this.maxTokens = options.limit;
      this.strategy = options.strategy || 'truncate';
      this.countMode = options.countMode || 'cumulative';
      this.trimMode = options.trimMode || 'best-fit';
      this.atMaxRemoveTokens = options.atMaxRemoveTokens ?? this.maxTokens * 0.25;
      this.tokenCounter = options.tokenCounter;
      this.onMemoryTrim = options.onMemoryTrim;
      this.maxToolResultTokens = options.maxToolResultTokens;
      if (
        this.maxToolResultTokens !== undefined &&
        (!Number.isFinite(this.maxToolResultTokens) || this.maxToolResultTokens <= 0)
      ) {
        throw new Error('maxToolResultTokens must be a finite, positive number');
      }
      if (this.maxToolResultTokens !== undefined) {
        this.processToolResult = this.capOversizedToolResult.bind(this);
      }
      if (
        this.trimMode === 'memory-only' &&
        (!Number.isFinite(this.maxTokens) ||
          this.maxTokens < 0 ||
          !Number.isFinite(this.atMaxRemoveTokens) ||
          this.atMaxRemoveTokens < 0 ||
          this.atMaxRemoveTokens > this.maxTokens)
      ) {
        throw new Error('Memory token limits must be finite, non-negative, and atMaxRemoveTokens cannot exceed limit');
      }
    }
  }

  async processInput(args: ProcessInputArgs) {
    if (this.trimMode === 'memory-only') await this.trimMemory(args.messageList, args.requestContext);
    return args.messageList;
  }

  private async trimMemory(
    messageList: ProcessInputStepArgs['messageList'],
    requestContext?: ProcessInputArgs['requestContext'],
  ): Promise<void> {
    if (!messageList) return;
    const sources = messageList.makeMessageSourceChecker();
    const removableIds = new Set(
      messageList.get.remembered
        .db()
        .filter(
          message =>
            message.role !== 'system' &&
            !sources.input.has(message.id) &&
            !sources.output.has(message.id) &&
            !sources.context.has(message.id),
        )
        .map(message => message.id),
    );
    const candidateGroups = groupLinkedToolMessages(
      messageList.get.all.db().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    ).filter(group => group.every(message => removableIds.has(message.id)));
    const counts = new Map<string, number>();
    let total = TokenLimiterProcessor.TOKENS_PER_CONVERSATION;
    for (const message of messageList.getAllSystemMessages()) total += await this.countCoreSystemMessageTokens(message);
    for (const message of messageList.get.all.db()) {
      const tokens = await this.countMessage(message);
      counts.set(message.id, tokens);
      total += tokens;
    }
    if (total <= this.maxTokens) return;
    const removed: MastraDBMessage[] = [];
    const target = this.maxTokens - this.atMaxRemoveTokens;
    for (const group of candidateGroups) {
      if (total <= target) break;
      removed.push(...group);
      for (const message of group) total -= counts.get(message.id) ?? 0;
    }
    if (!removed.length) return;
    await this.onMemoryTrim?.(removed, requestContext);
    messageList.removeByIds(removed.map(message => message.id));
  }

  private countTokens(text: string): number {
    return estimateTokenCount(text);
  }

  /**
   * Input-stage hook. `memory-only` mode always trims stored history here, because
   * that mode's job is to shrink what memory keeps, not what a single request sends.
   *
   * The standard trim modes (`best-fit`, `contiguous`) budget the request at
   * {@link TokenLimiterProcessor.processLLMRequest} when the caller will run it
   * (`llmRequestStage`): the prompt is the payload the model actually receives,
   * after every earlier prompt processor has run, and trimming there never deletes
   * stored messages. Trimming stored messages here would count history that a
   * later prompt processor (for example `ToolCallFilter`) is about to remove.
   *
   * Callers that never run `processLLMRequest` for this processor (legacy
   * generate/stream, processor workflows) get stored-message trimming here instead.
   */
  async processInputStep(args: ProcessInputStepArgs): Promise<void> {
    const { messageList } = args;

    if (this.trimMode === 'memory-only') {
      await this.trimMemory(args.messageList, args.requestContext);
      return;
    }

    if (args.llmRequestStage) return;

    if (!messageList) return;

    const messages = messageList.get.all.db();

    // If no messages or empty array, throw TripWire - can't send LLM a request with no messages
    if (!messages || messages.length === 0) {
      throw new TripWire('TokenLimiterProcessor: No messages to process. Cannot send LLM a request with no messages.', {
        retry: false,
      });
    }

    // Budget against the full system message set that will reach the model
    const allSystemMessages = messageList.getAllSystemMessages();
    let systemTokens = 0;
    for (const msg of allSystemMessages) {
      systemTokens += await this.countCoreSystemMessageTokens(msg);
    }

    const limit = this.maxTokens;

    // If system messages alone exceed the token limit (accounting for conversation overhead),
    // throw TripWire - can't send LLM a request with only system messages
    if (systemTokens + TokenLimiterProcessor.TOKENS_PER_CONVERSATION >= limit) {
      throw new TripWire(
        'TokenLimiterProcessor: System messages alone exceed token limit. Requests cannot be completed by removing system messages.',
        { retry: false, metadata: { systemTokens, limit } },
      );
    }

    // Calculate remaining budget for non-system messages (accounting for conversation overhead)
    const remainingBudget = limit - systemTokens - TokenLimiterProcessor.TOKENS_PER_CONVERSATION;

    // Process messages newest first within budget
    const messagesToKeep: MastraDBMessage[] = [];
    let currentTokens = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (!message) continue;

      const messageTokens = await this.countInputMessageTokens(message);

      if (currentTokens + messageTokens <= remainingBudget) {
        messagesToKeep.push(message);
        currentTokens += messageTokens;
      } else if (this.trimMode === 'contiguous') {
        break;
      }
    }

    if (messagesToKeep.length === 0) {
      throw new TripWire(
        'TokenLimiterProcessor: No messages fit within the remaining token budget. Cannot send LLM a request with no messages.',
        {
          retry: false,
          metadata: { systemTokens, limit, remainingBudget, messageCount: messages.length },
        },
      );
    }

    // Remove older messages that don't fit within the token budget
    const keepIds = new Set(messagesToKeep.map(m => m.id));
    const idsToRemove = messages.filter(m => !keepIds.has(m.id)).map(m => m.id);
    if (idsToRemove.length > 0) {
      messageList.removeByIds(idsToRemove);
    }
  }

  /**
   * Truncate text to a token budget, always appending a truncation marker that
   * reports the exact number of tokens actually shown. Shrinks the visible
   * slice as needed to keep the marker itself inside `maxTokens`; if `maxTokens`
   * is too small to fit any content, the result is the marker alone (reporting
   * 0 tokens shown). If `maxTokens` is too small even for the bare marker, the
   * result is an empty string -- the cap is honored strictly rather than
   * emitting a marker whose own size exceeds the configured budget.
   */
  private capText(text: string, maxTokens: number): string | undefined {
    const total = this.countTokens(text);
    if (total <= maxTokens) return undefined;

    let shown = Math.max(0, maxTokens);
    while (shown > 0) {
      const slice = sliceByTokensSafe(text, 0, shown);
      const marker = `\n[truncated: showing ${shown.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} tokens]`;
      if (this.countTokens(slice) + this.countTokens(marker) <= maxTokens) {
        return `${slice}${marker}`;
      }
      shown -= 1;
    }
    const bareMarker = `[truncated: showing 0 of ${total.toLocaleString('en-US')} tokens]`;
    if (this.countTokens(bareMarker) <= maxTokens) return bareMarker;
    // maxTokens is too small to fit even the marker alone: honor the cap
    // strictly rather than emit a marker whose own size exceeds the budget.
    return '';
  }

  /**
   * Give an oversized tool result a truncated model-only copy
   * (`providerMetadata.mastra.modelOutput`). The stored result stays intact;
   * results already mapped by `toModelOutput` and media payloads are left alone.
   */
  private capToolResult(result: unknown, maxTokens: number): string | undefined {
    const isMediaArray = Array.isArray(result) && result.length > 0 && result.every(isMediaPayload);
    if (result === undefined || isMediaPayload(result) || isMediaArray) return undefined;
    let text: string;
    if (typeof result === 'string') {
      text = result;
    } else {
      try {
        text = JSON.stringify(result, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));
      } catch {
        // Circular references (or other values JSON.stringify can't handle)
        // shouldn't crash the run; leave the result uncapped.
        return undefined;
      }
      if (text === undefined) return undefined;
    }
    return this.capText(text, maxTokens);
  }

  /**
   * Cap an oversized tool result before it is persisted to the message list or
   * sent to the model. Runs unconditionally (regardless of `trimMode`) for every
   * output processor invocation, so register this processor in `outputProcessors`
   * for capping to take effect (`inputProcessors` alone only trims history).
   *
   * This writes `providerMetadata` only — it never sets `toolInvocation.state`
   * or `.result`. Committing `state: 'result'` here would promote the part to
   * "done" before the rest of the output-processor chain (and its TripWire
   * safety checkpoint) has run; a later processor that aborts via TripWire
   * would then leave this uncapped-but-promoted part behind with no rollback.
   * Leaving state/result untouched means whichever later step is responsible
   * for the real commit (redaction hooks, `commitToolResult`, etc.) still owns
   * that transition, and this hook only ever adds the model-facing cap.
   *
   * If the tool has its own `toModelOutput` mapping, that mapping is computed
   * and committed to the message list *after* this hook runs, and its write
   * always wins on the `modelOutput` key — this cap never overrides a genuine
   * tool-level mapping. (See `computeModelOutputProviderMetadata`, which also
   * clears a stale `modelOutputCapped` flag left behind by this hook in that
   * case, so the mapper's permanent output doesn't get mistaken for our
   * transient truncation and stripped before persistence.)
   *
   */
  private async capOversizedToolResult(args: ProcessToolResultArgs): Promise<void> {
    if (this.maxToolResultTokens === undefined) return;
    const { result, toolCallId, toolName, args: toolArgs, messageList } = args;
    if (!messageList) return;

    const existing = findToolInvocationPart(messageList, toolCallId);
    if (!existing) return;

    const value = this.capToolResult(result, this.maxToolResultTokens);
    if (value === undefined) return;

    messageList.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: { ...existing, toolCallId, toolName, args: toolArgs },
      providerMetadata: { mastra: { modelOutput: { type: 'text', value }, modelOutputCapped: true } },
    });
  }

  /**
   * Enforce the input token budget on the provider prompt, directly before the
   * model call.
   *
   * Running at the prompt stage rather than at the message-list stage is what
   * makes composition with prompt-shrinking processors work: a processor placed
   * earlier in the list (for example `ToolCallFilter`) has already rewritten the
   * prompt, so this limiter counts and trims exactly what the model receives.
   * Mutations are transient for the same reason the filtering is — stored
   * messages, memory and UI history keep everything.
   *
   * Oversized tool results are capped separately in `processToolResult`
   * (before the result is even added to the message list), so trimming here
   * never needs to special-case the current run: every group is an equal
   * candidate for removal, newest-first for `contiguous`, best-effort for
   * `best-fit` (#24110).
   */
  async processLLMRequest({ prompt }: ProcessLLMRequestArgs): Promise<ProcessLLMRequestResult> {
    if (this.trimMode === 'memory-only') return undefined;

    const groups = this.groupPromptMessages(prompt);
    const messageCount = groups
      .filter(group => group[0]?.role !== 'system')
      .reduce((total, group) => total + group.length, 0);

    // If no messages or empty array, throw TripWire - can't send LLM a request with no messages
    if (messageCount === 0) {
      throw new TripWire('TokenLimiterProcessor: No messages to process. Cannot send LLM a request with no messages.', {
        retry: false,
      });
    }

    // Budget against the system messages that will reach the model, including
    // tagged buckets such as observational memory.
    const limit = this.maxTokens;
    let systemTokens = 0;
    for (const group of groups) {
      if (group[0]?.role !== 'system') continue;
      for (const message of group) systemTokens += this.countPromptMessageTokens(message);
    }

    // If system messages alone exceed the token limit (accounting for conversation overhead),
    // throw TripWire - can't send LLM a request with only system messages
    if (systemTokens + TokenLimiterProcessor.TOKENS_PER_CONVERSATION >= limit) {
      throw new TripWire(
        'TokenLimiterProcessor: System messages alone exceed token limit. Requests cannot be completed by removing system messages.',
        { retry: false, metadata: { systemTokens, limit } },
      );
    }

    // Calculate remaining budget for non-system messages (accounting for conversation overhead)
    const remainingBudget = limit - systemTokens - TokenLimiterProcessor.TOKENS_PER_CONVERSATION;

    // Trim non-system message groups in reverse order (newest first). No group
    // is exempt — the current run's tool results were already capped in
    // `processToolResult`, so an oversized run can no longer exhaust the
    // budget on its own the way it could when this stage tried to protect it.
    const keptGroups = new Set<PromptMessage[]>();
    let currentTokens = 0;

    for (let i = groups.length - 1; i >= 0; i--) {
      const group = groups[i];
      if (!group || group[0]?.role === 'system') continue;

      let groupTokens = 0;
      for (const message of group) groupTokens += this.countPromptMessageTokens(message);

      if (currentTokens + groupTokens <= remainingBudget) {
        keptGroups.add(group);
        currentTokens += groupTokens;
      } else if (this.trimMode === 'contiguous') {
        break;
      }
      // best-fit → continue (existing behavior)
    }

    if (keptGroups.size === 0) {
      throw new TripWire(
        'TokenLimiterProcessor: No messages fit within the remaining token budget. Cannot send LLM a request with no messages.',
        {
          retry: false,
          metadata: { systemTokens, limit, remainingBudget, messageCount },
        },
      );
    }

    const trimmedPrompt = groups.filter(group => group[0]?.role === 'system' || keptGroups.has(group)).flat();
    if (trimmedPrompt.length === prompt.length) return undefined;

    return { prompt: trimmedPrompt };
  }

  /**
   * Group prompt messages so a tool call and the results it produced are always
   * kept or dropped together. Providers reject a request with a tool call that
   * has no matching result (and vice versa), so trimming must never split them.
   * Everything else is a single-message group.
   */
  private groupPromptMessages(prompt: LanguageModelV2Prompt): PromptMessage[][] {
    const groups: PromptMessage[][] = [];

    for (let index = 0; index < prompt.length; index++) {
      const message = prompt[index];
      if (!message) continue;
      const group = [message];

      const toolCallIds = new Set<string>();
      if (message.role === 'assistant') {
        for (const part of message.content) {
          if (part.type === 'tool-call') toolCallIds.add(part.toolCallId);
        }
      }

      while (toolCallIds.size > 0 && index + 1 < prompt.length) {
        const next = prompt[index + 1];
        if (!next || next.role !== 'tool') break;
        const hasMatchingResult = next.content.some(
          part => part.type === 'tool-result' && toolCallIds.has(part.toolCallId),
        );
        if (!hasMatchingResult) break;
        group.push(next);
        index++;
      }

      groups.push(group);
    }

    return groups;
  }

  /**
   * Count a message of the provider prompt. Mirrors {@link countInputMessageTokens}
   * so counts stay comparable, but reads the prompt shapes the model actually
   * receives: `input` for tool call arguments, and tool result outputs with their
   * text/json/content variants.
   */
  private countPromptMessageTokens(message: PromptMessage): number {
    if (message.role === 'system') {
      return this.countTokens(message.role + message.content) + TokenLimiterProcessor.TOKENS_PER_MESSAGE;
    }

    let tokenString: string = message.role;
    let overhead = 0;
    // Media is estimated rather than tokenized, so it is accumulated separately.
    let mediaTokens = 0;

    for (const part of message.content) {
      if (part.type === 'text' || part.type === 'reasoning') {
        tokenString += part.text;
      } else if (part.type === 'tool-call') {
        tokenString += part.toolName;
        if (part.input !== undefined) {
          if (typeof part.input === 'string') {
            tokenString += part.input;
          } else {
            tokenString += JSON.stringify(part.input);
            overhead -= 12;
          }
        }
      } else if (part.type === 'tool-result') {
        if (part.output.type === 'text' || part.output.type === 'error-text') {
          tokenString += part.output.value;
        } else if (part.output.type === 'json' || part.output.type === 'error-json') {
          tokenString += JSON.stringify(part.output.value);
          overhead -= 12;
        } else {
          for (const entry of part.output.value) {
            if (entry.type === 'text') {
              tokenString += entry.text;
            } else {
              const { data, ...rest } = entry;
              mediaTokens += estimateMediaTokens(data, entry.mediaType);
              tokenString += JSON.stringify(rest);
            }
          }
          overhead -= 12;
        }
      } else if (part.type === 'file') {
        mediaTokens += estimateMediaTokens(part.data, part.mediaType);
      }
    }

    // Each provider-prompt entry is already one message. Unlike persisted
    // MastraDBMessage parts, a tool result does not need extra overhead here:
    // conversion has already emitted it as its own `role: 'tool'` message.
    overhead += TokenLimiterProcessor.TOKENS_PER_MESSAGE;

    return this.countTokens(tokenString) + overhead + mediaTokens;
  }

  /**
   * Count tokens for a system message. Accepts both untagged and tagged system messages
   * read from `messageList.getAllSystemMessages()`. Only string content is supported.
   */
  private async countCoreSystemMessageTokens(message: CoreMessageV4): Promise<number> {
    if (message.role !== 'system') {
      throw new Error(
        `countCoreSystemMessageTokens can only be used with system messages, received role: ${message.role}`,
      );
    }

    if (typeof message.content !== 'string') {
      throw new Error('countCoreSystemMessageTokens: System message content must be a string');
    }

    const tokenString = message.role + message.content;

    return this.countTokens(tokenString) + TokenLimiterProcessor.TOKENS_PER_MESSAGE;
  }

  /** Count one persisted message with the same estimator used by input limiting. */
  public async countMessage(message: MastraDBMessage): Promise<number> {
    return this.tokenCounter ? this.tokenCounter.countMessage(message) : this.countInputMessageTokens(message);
  }

  /**
   * Count tokens for an input message, including overhead for message structure
   */
  private async countInputMessageTokens(message: MastraDBMessage): Promise<number> {
    let tokenString = message.role;
    let overhead = 0;
    // Media is estimated rather than tokenized, so it is accumulated separately.
    let mediaTokens = 0;

    // Handle content based on MastraMessageV2 structure
    let toolResultCount = 0; // Track tool results that will become separate messages

    if (typeof message.content === 'string') {
      // Simple string content
      tokenString += message.content;
    } else if (message.content && typeof message.content === 'object') {
      // Object content with parts
      // Use content.content as the primary text, or fall back to parts
      if (message.content.content && !Array.isArray(message.content.parts)) {
        tokenString += message.content.content;
      } else if (Array.isArray(message.content.parts)) {
        // Calculate tokens for each content part
        for (const part of message.content.parts) {
          if (part.type === 'text') {
            tokenString += part.text;
          } else if (part.type === 'tool-invocation') {
            // Handle tool invocations (both calls and results)
            const invocation = part.toolInvocation;
            if (invocation.state === 'call' || invocation.state === 'partial-call') {
              // Tool call
              if (invocation.toolName) {
                tokenString += invocation.toolName;
              }
              if (invocation.args) {
                if (typeof invocation.args === 'string') {
                  tokenString += invocation.args;
                } else {
                  tokenString += JSON.stringify(invocation.args);
                  overhead -= 12;
                }
              }
            } else if (invocation.state === 'result') {
              // Tool result - this will become a separate CoreMessage
              toolResultCount++;
              const modelOutput = (part.providerMetadata?.mastra as Record<string, unknown> | undefined)?.modelOutput;
              if (modelOutput != null) {
                // The model receives the mapped/capped copy, not the stored result
                const mapped = modelOutput as { type?: string; value?: unknown };
                if (typeof mapped.value === 'string') {
                  tokenString += mapped.value;
                } else if (mapped.type === 'content' && Array.isArray(mapped.value)) {
                  for (const item of mapped.value) {
                    if (item && typeof item === 'object' && (item as { type?: string }).type === 'text') {
                      const text = (item as { text?: unknown }).text;
                      tokenString += typeof text === 'string' ? text : JSON.stringify(item);
                    } else if (isMediaPayload(item)) {
                      const { data, ...rest } = item;
                      mediaTokens += estimateMediaTokens(data, item.mediaType ?? item.mimeType);
                      tokenString += JSON.stringify(rest);
                      overhead -= 12;
                    } else {
                      tokenString += JSON.stringify(item);
                    }
                  }
                } else {
                  tokenString += JSON.stringify(modelOutput);
                }
              } else if (invocation.result !== undefined) {
                if (typeof invocation.result === 'string') {
                  tokenString += invocation.result;
                } else if (isMediaPayload(invocation.result)) {
                  const { data, ...rest } = invocation.result;
                  mediaTokens += estimateMediaTokens(data, invocation.result.mediaType ?? invocation.result.mimeType);
                  tokenString += JSON.stringify(rest);
                  overhead -= 12;
                } else if (
                  Array.isArray(invocation.result) &&
                  invocation.result.length > 0 &&
                  invocation.result.every(isMediaPayload)
                ) {
                  for (const entry of invocation.result as MediaPayload[]) {
                    const { data, ...rest } = entry;
                    mediaTokens += estimateMediaTokens(data, entry.mediaType ?? entry.mimeType);
                    tokenString += JSON.stringify(rest);
                  }
                  overhead -= 12;
                } else {
                  tokenString += JSON.stringify(invocation.result);
                  overhead -= 12;
                }
              }
            }
          } else if (part.type === 'file') {
            const { data, mediaType } = resolveFilePartMediaTypeAndData(part);
            mediaTokens += estimateMediaTokens(data, mediaType);
          } else {
            tokenString += JSON.stringify(part);
          }
        }
      }
    }

    // Add message formatting overhead
    // Each MastraDBMessage becomes at least 1 CoreMessage, plus 1 additional CoreMessage per tool-invocation (state: 'result')
    // Base overhead for the message itself
    overhead += TokenLimiterProcessor.TOKENS_PER_MESSAGE;
    // Additional overhead for each tool result (which adds an extra CoreMessage)
    if (toolResultCount > 0) {
      overhead += toolResultCount * TokenLimiterProcessor.TOKENS_PER_MESSAGE;
    }

    const tokenCount = this.countTokens(tokenString);
    const total = tokenCount + overhead + mediaTokens;
    return total;
  }

  async processOutputStream(args: ProcessOutputStreamArgs<TokenLimiterTripWireMetadata>): Promise<ChunkType | null> {
    const { part, state, abort, writer } = args;
    if (this.trimMode === 'memory-only') return part;
    const limit = this.maxTokens;

    // Chunks that don't carry generated output pass through untouched: counting
    // them would spend the budget on payloads the caller never sees (a single
    // `step-start` embeds the whole request body), and withholding them breaks
    // the run (a withheld `tool-call` is never executed by the agentic loop).
    if (!TokenLimiterProcessor.OUTPUT_CHUNK_TYPES.has(part.type)) {
      return part;
    }

    // Count tokens in the current part
    const chunkTokens = await this.countTokensInChunk(part);
    const previousTokens = typeof state.currentTokens === 'number' ? state.currentTokens : 0;
    const currentTokens = this.countMode === 'cumulative' ? previousTokens + chunkTokens : chunkTokens;
    state.currentTokens = currentTokens;

    // Check if we've exceeded the limit
    if (currentTokens > limit) {
      if (this.strategy === 'abort') {
        abort(`Token limit of ${limit} exceeded (current: ${currentTokens})`);
      } else {
        // truncate strategy - don't emit this part, but tell the caller once that
        // output is being withheld so truncation isn't silent
        if (!state.limitReachedNotified) {
          state.limitReachedNotified = true;
          try {
            await writer?.custom({
              type: 'data-token-limit-reached',
              data: { processorId: this.id, limit, tokens: currentTokens },
              transient: true,
            });
          } catch {
            // never let the notification break the stream
          }
        }
        // If we're in part mode, reset the count for next part
        if (this.countMode === 'part') {
          state.currentTokens = 0;
        }
        return null;
      }
    }

    // Emit the part
    const result = part;

    // If we're in part mode, reset the count for next part
    if (this.countMode === 'part') {
      state.currentTokens = 0;
    }

    return result;
  }

  private async countTokensInChunk(part: ChunkType): Promise<number> {
    if (part.type === 'text-delta') {
      // For text chunks, count the text content directly
      return this.countTokens(part.payload.text);
    } else if (part.type === 'object') {
      // For object chunks, count the JSON representation
      // This is similar to how the memory processor handles object content
      const objectString = JSON.stringify(part.object);
      return this.countTokens(objectString);
    }

    // Anything else carries no generated output and is not counted
    return 0;
  }

  /**
   * Process the final result (non-streaming)
   * Truncates the text content if it exceeds the token limit
   */
  async processOutputResult(args: {
    messages: MastraDBMessage[];
    abort: (reason?: string) => never;
  }): Promise<MastraDBMessage[]> {
    if (this.trimMode === 'memory-only') return args.messages;
    const { messages, abort } = args;
    const limit = this.maxTokens;

    // Use a local variable to track tokens within this single result processing
    let cumulativeTokens = 0;

    const processedMessages = messages.map(message => {
      if (message.role !== 'assistant' || !message.content?.parts) {
        return message;
      }

      const processedParts = message.content.parts.map(part => {
        if (part.type === 'text') {
          const textContent = part.text;
          const tokens = this.countTokens(textContent);

          // Check if adding this part's tokens would exceed the cumulative limit
          if (cumulativeTokens + tokens <= limit) {
            cumulativeTokens += tokens;
            return part;
          } else {
            if (this.strategy === 'abort') {
              abort(`Token limit of ${limit} exceeded (current: ${cumulativeTokens + tokens})`);
            } else {
              // Truncate the text to fit within the remaining token limit
              const remainingTokens = Math.max(0, limit - cumulativeTokens);
              const truncatedText = remainingTokens > 0 ? sliceByTokensSafe(textContent, 0, remainingTokens) : '';
              cumulativeTokens += this.countTokens(truncatedText);

              return {
                ...part,
                text: truncatedText,
              };
            }
          }
        }

        // For non-text parts, just return them as-is
        return part;
      });

      return {
        ...message,
        content: {
          ...message.content,
          parts: processedParts,
        },
      };
    });

    return processedMessages;
  }

  /**
   * Get the maximum token limit
   */
  getMaxTokens(): number {
    return this.maxTokens;
  }
}

/**
 * Walk messageList backwards looking for a tool-invocation part with the given
 * toolCallId, in *any* state (unlike `readToolResultFromMessageList`, which
 * only matches `state: 'result'`). Used by `capOversizedToolResult` to carry
 * the part's current state/result through unchanged so the cap's
 * `updateToolInvocation` call only ever adds `providerMetadata`.
 */
function findToolInvocationPart(
  messageList: MessageList,
  toolCallId: string,
): Extract<MastraMessagePart, { type: 'tool-invocation' }>['toolInvocation'] | undefined {
  const messages: MastraDBMessage[] = messageList.get.all.db();
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || msg.role !== 'assistant' || !msg.content?.parts) continue;
    for (const part of msg.content.parts) {
      if (part?.type === 'tool-invocation' && part.toolInvocation?.toolCallId === toolCallId) {
        return part.toolInvocation;
      }
    }
  }
  return undefined;
}
