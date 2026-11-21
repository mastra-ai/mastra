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
 * count towards the provider's limit of four, which this processor never exceeds. Anthropic needs
 * longer-TTL breakpoints before shorter ones, so a mark that would break that order with yours is
 * shortened to `'5m'`, or left out when it would have to be longer than the `ttl` you set. Marks on tool
 * definitions are not visible here, so leave room for them. Other providers are untouched.
 *
 * Prompt rewriters run in registration order, so register this after any other processor that rewrites the
 * prompt in `processLLMRequest`.
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

  private readonly ttl?: Ttl;

  constructor(options: PromptCacheProcessorOptions = {}) {
    this.ttl = options.ttl;
  }

  processLLMRequest({ prompt, model, apiProviderId }: ProcessLLMRequestArgs): ProcessLLMRequestResult {
    const provider = cacheProviderOf(apiProviderId ?? (model as { provider?: unknown }).provider);
    if (!provider) return;

    let free = MAX_BREAKPOINTS - prompt.reduce((count, message) => count + countMarks(message, provider), 0);
    // The last message first: its breakpoint caches everything before it, the system prompt included.
    const targets = [lastIndex(prompt, m => m.role !== 'system'), lastIndex(prompt, m => m.role === 'system')];

    let next: LanguageModelV2Prompt | undefined;
    for (const index of targets) {
      if (free <= 0 || index < 0) continue;
      const message = prompt[index]!;
      if (countMarks(message, provider) > 0) continue;
      let ttl = this.ttl;
      if (provider === 'anthropic') {
        const allowed = allowedTtl(next ?? prompt, index, ttl);
        if (allowed === null) continue;
        ttl = allowed;
      }
      next ??= [...prompt];
      next[index] = this.mark(message, provider, ttl);
      free--;
    }
    return next ? { prompt: next } : undefined;
  }

  private mark(message: LanguageModelV2Message, provider: CacheProvider, ttl?: Ttl): LanguageModelV2Message {
    const mark =
      provider === 'anthropic'
        ? { cacheControl: { type: 'ephemeral', ...(ttl ? { ttl } : {}) } }
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

type Ttl = '5m' | '1h';

/**
 * The TTL a new Anthropic mark at `index` can use without putting a shorter TTL before a longer one in the
 * request Anthropic receives: `wanted` when it fits, `'5m'` when only that fits, `null` when neither does.
 *
 * Anthropic usually sends the first run of system messages as the top-level system prompt, ahead of every
 * message, but leaves it in place when it carries options such as `clearAt`. When that run isn't at the start
 * of the prompt, the mark has to fit both orders.
 */
function allowedTtl(prompt: LanguageModelV2Prompt, index: number, wanted: Ttl | undefined): Ttl | undefined | null {
  const orders = [prompt.map((_, i) => i), promotedOrder(prompt)];
  for (const ttl of wanted === '1h' ? (['1h', '5m'] as const) : [wanted]) {
    if (orders.every(order => fitsOrder(prompt, order, index, ttl))) return ttl;
  }
  return null;
}

function fitsOrder(prompt: LanguageModelV2Prompt, order: number[], index: number, ttl: Ttl | undefined): boolean {
  const seconds = ttlSeconds(ttl);
  return prompt.every((message, i) => {
    if (i === index) return true;
    return anthropicTtls(message).every(other =>
      order[i]! < order[index]! ? ttlSeconds(other) >= seconds : ttlSeconds(other) <= seconds,
    );
  });
}

/** Each message's position when the first run of system messages is moved to the front. */
function promotedOrder(prompt: LanguageModelV2Prompt): number[] {
  const start = prompt.findIndex(message => message.role === 'system');
  if (start < 0) return prompt.map((_, i) => i);
  let end = start;
  while (prompt[end + 1]?.role === 'system') end++;
  const runLength = end - start + 1;
  return prompt.map((_, i) => {
    if (i >= start && i <= end) return i - start;
    return i < start ? i + runLength : i;
  });
}

function ttlSeconds(ttl: unknown): number {
  return ttl === '1h' ? 3600 : 300;
}

/** TTLs of the Anthropic cache marks on a message and its parts, in order. */
function anthropicTtls(message: LanguageModelV2Message): unknown[] {
  const options = [
    message.providerOptions,
    ...(Array.isArray(message.content)
      ? message.content.map(part => (part as { providerOptions?: ProviderOptions }).providerOptions)
      : []),
  ];
  return options.flatMap(o => {
    const cacheControl = o?.anthropic?.cacheControl as { ttl?: unknown } | undefined;
    return cacheControl ? [cacheControl.ttl] : [];
  });
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

// Only the namespace of the provider being called reaches the request; the other is dropped.
function hasMark(options: ProviderOptions, provider: CacheProvider): boolean {
  return provider === 'anthropic' ? options?.anthropic?.cacheControl != null : options?.bedrock?.cachePoint != null;
}

function countMarks(message: LanguageModelV2Message, provider: CacheProvider): number {
  let count = hasMark(message.providerOptions, provider) ? 1 : 0;
  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (hasMark((part as { providerOptions?: ProviderOptions }).providerOptions, provider)) count++;
    }
  }
  return count;
}
