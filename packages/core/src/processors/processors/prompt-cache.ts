import type { LanguageModelV2Message, LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import type { ProcessLLMRequestArgs, ProcessLLMRequestResult, Processor } from '../index';

/** Anthropic and Bedrock accept at most four cache breakpoints per request. */
const MAX_BREAKPOINTS = 4;

export interface PromptCacheProcessorOptions {
  /**
   * Lifetime of the Anthropic cache entries this processor writes. Anthropic's default is `'5m'`.
   * Bedrock has no per-breakpoint TTL, so this applies to Anthropic only.
   */
  ttl?: '5m' | '1h';
}

type CacheProvider = 'anthropic' | 'bedrock';

/**
 * Adds explicit prompt-cache breakpoints for Anthropic and Amazon Bedrock models.
 *
 * Marks the last system message, so the instructions and system context are cached on their own,
 * and the last message, so the whole conversation is cached for the next call. Each mark goes on the
 * message's `providerOptions`, which both providers apply to the end of that message.
 *
 * Breakpoints you set yourself are kept: a message you already marked is left alone, and your marks
 * count towards the provider's limit of four, which this processor never exceeds. Marks on tool
 * definitions are not visible here, so leave room for them. Other providers are untouched.
 *
 * ```ts
 * new Agent({
 *   model: 'anthropic/claude-sonnet-4-5',
 *   inputProcessors: [new PromptCacheProcessor({ ttl: '1h' })],
 * });
 * ```
 */
export class PromptCacheProcessor implements Processor<'prompt-cache'> {
  readonly id = 'prompt-cache' as const;
  readonly name = 'Prompt Cache';

  private readonly ttl?: '5m' | '1h';

  constructor(options: PromptCacheProcessorOptions = {}) {
    this.ttl = options.ttl;
  }

  processLLMRequest({ prompt, model, apiProviderId }: ProcessLLMRequestArgs): ProcessLLMRequestResult {
    const provider = cacheProviderOf(apiProviderId ?? (model as { provider?: unknown }).provider);
    if (!provider) return;

    let free = MAX_BREAKPOINTS - prompt.reduce((count, message) => count + countMarks(message), 0);
    // The last message first: its breakpoint caches everything before it, the system prompt included.
    const targets = [lastIndex(prompt, m => m.role !== 'system'), lastIndex(prompt, m => m.role === 'system')];

    let next: LanguageModelV2Prompt | undefined;
    for (const index of targets) {
      if (free <= 0 || index < 0) continue;
      const message = prompt[index]!;
      if (countMarks(message) > 0) continue;
      next ??= [...prompt];
      next[index] = this.mark(message, provider);
      free--;
    }
    return next ? { prompt: next } : undefined;
  }

  private mark(message: LanguageModelV2Message, provider: CacheProvider): LanguageModelV2Message {
    const mark =
      provider === 'anthropic'
        ? { cacheControl: { type: 'ephemeral', ...(this.ttl ? { ttl: this.ttl } : {}) } }
        : { cachePoint: { type: 'default' } };
    return {
      ...message,
      providerOptions: {
        ...message.providerOptions,
        [provider]: { ...message.providerOptions?.[provider], ...mark },
      },
    } as LanguageModelV2Message;
  }
}

function cacheProviderOf(providerId: unknown): CacheProvider | undefined {
  if (typeof providerId !== 'string') return undefined;
  if (providerId.includes('bedrock')) return 'bedrock';
  if (providerId.includes('anthropic')) return 'anthropic';
  return undefined;
}

function lastIndex(prompt: LanguageModelV2Prompt, match: (message: LanguageModelV2Message) => boolean): number {
  for (let i = prompt.length - 1; i >= 0; i--) {
    const message = prompt[i]!;
    if (match(message) && (typeof message.content === 'string' || message.content.length > 0)) return i;
  }
  return -1;
}

type ProviderOptions = Record<string, Record<string, unknown> | undefined> | undefined;

function hasMark(options: ProviderOptions): boolean {
  return options?.anthropic?.cacheControl != null || options?.bedrock?.cachePoint != null;
}

function countMarks(message: LanguageModelV2Message): number {
  let count = hasMark(message.providerOptions) ? 1 : 0;
  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (hasMark((part as { providerOptions?: ProviderOptions }).providerOptions)) count++;
    }
  }
  return count;
}
