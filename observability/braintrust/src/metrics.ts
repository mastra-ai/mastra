export function normalizeUsageMetrics(
  usage: unknown,
  provider?: string,
  providerMetadata?: Record<string, unknown>,
): Record<string, number> {
  const metrics: Record<string, number> = {};

  // Standard AI SDK usage fields
  const inputTokens =
    getNumberProperty(usage, 'inputTokens') ?? getNumberProperty(usage, 'promptTokens');
  if (inputTokens !== undefined) {
    metrics.prompt_tokens = inputTokens;
  }

  const outputTokens =
    getNumberProperty(usage, 'outputTokens') ?? getNumberProperty(usage, 'completionTokens');
  if (outputTokens !== undefined) {
    metrics.completion_tokens = outputTokens;
  }

  const totalTokens = getNumberProperty(usage, 'totalTokens');
  if (totalTokens !== undefined) {
    metrics.tokens = totalTokens;
  }

  const reasoningTokens = getNumberProperty(usage, 'reasoningTokens');
  if (reasoningTokens !== undefined) {
    metrics.completion_reasoning_tokens = reasoningTokens;
  }

  const cachedInputTokens = getNumberProperty(usage, 'cachedInputTokens');
  if (cachedInputTokens !== undefined) {
    metrics.prompt_cached_tokens = cachedInputTokens;
  }

  // Anthropic-specific cache token handling
  if (provider === 'anthropic') {
    const anthropicMetadata = providerMetadata?.anthropic as any;

    if (anthropicMetadata) {
      const cacheReadTokens = getNumberProperty(anthropicMetadata.usage, 'cache_read_input_tokens') || 0;
      const cacheCreationTokens = getNumberProperty(anthropicMetadata.usage, 'cache_creation_input_tokens') || 0;

      const cacheTokens = extractAnthropicCacheTokens(cacheReadTokens, cacheCreationTokens);
      Object.assign(metrics, cacheTokens);

      Object.assign(metrics, finalizeAnthropicTokens(metrics));
    }
  }

  return metrics;
}

function getNumberProperty(obj: unknown, key: string): number | undefined {
  if (!obj || typeof obj !== 'object' || !(key in obj)) {
    return undefined;
  }
  const value = Reflect.get(obj, key);
  return typeof value === 'number' ? value : undefined;
}

interface AnthropicTokenMetrics {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_cached_tokens?: number;
  prompt_cache_creation_tokens?: number;
  tokens?: number;
  [key: string]: number | undefined;
}

function finalizeAnthropicTokens(metrics: AnthropicTokenMetrics): AnthropicTokenMetrics {
  const prompt_tokens =
    (metrics.prompt_tokens || 0) + (metrics.prompt_cached_tokens || 0) + (metrics.prompt_cache_creation_tokens || 0);

  return {
    ...metrics,
    prompt_tokens,
    tokens: prompt_tokens + (metrics.completion_tokens || 0),
  };
}

function extractAnthropicCacheTokens(
  cacheReadTokens: number = 0,
  cacheCreationTokens: number = 0,
): Partial<AnthropicTokenMetrics> {
  const cacheTokens: Partial<AnthropicTokenMetrics> = {};

  if (cacheReadTokens > 0) {
    cacheTokens.prompt_cached_tokens = cacheReadTokens;
  }

  if (cacheCreationTokens > 0) {
    cacheTokens.prompt_cache_creation_tokens = cacheCreationTokens;
  }

  return cacheTokens;
}
