import type { ObservationModelContext, ResolvedActivationTTL } from './types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const SHORT_TTL = 5 * MINUTE;
const OPENAI_EXTENDED_TTL = HOUR;
const GEMINI_TTL = 24 * HOUR;
const DEEPSEEK_TTL = HOUR;
const GROQ_TTL = 2 * HOUR;

function normalize(value?: string): string {
  return value?.toLowerCase() ?? '';
}

function isOpenAIShortTtlModel(modelId: string): boolean {
  return /^gpt-4/.test(modelId) || /^gpt-5(?:$|-|\.([1-4])(?:$|-))/.test(modelId);
}

function getOpenAIPromptCacheRetention(
  providerOptions?: ObservationModelContext['providerOptions'],
): string | undefined {
  const openaiOptions = providerOptions?.openai as { promptCacheRetention?: unknown } | undefined;
  return typeof openaiOptions?.promptCacheRetention === 'string'
    ? openaiOptions.promptCacheRetention.toLowerCase()
    : undefined;
}

export function resolveActivationTTL(
  activateAfterIdle: ResolvedActivationTTL | undefined,
  modelContext?: ObservationModelContext,
): number | undefined {
  if (activateAfterIdle !== 'auto') {
    return activateAfterIdle;
  }

  return resolveAutoActivationTTL(modelContext);
}

export function resolveAutoActivationTTL(modelContext?: ObservationModelContext): number {
  const provider = normalize(modelContext?.provider);
  const modelId = normalize(modelContext?.modelId);

  if (provider.includes('openai')) {
    const promptCacheRetention = getOpenAIPromptCacheRetention(modelContext?.providerOptions);
    if (promptCacheRetention === '24h') return OPENAI_EXTENDED_TTL;
    if (promptCacheRetention === 'in_memory') return SHORT_TTL;
    return isOpenAIShortTtlModel(modelId) ? SHORT_TTL : OPENAI_EXTENDED_TTL;
  }

  if (provider.includes('google') || provider.includes('gemini')) return GEMINI_TTL;
  if (provider.includes('deepseek')) return DEEPSEEK_TTL;
  if (provider.includes('groq')) return GROQ_TTL;
  if (provider.includes('anthropic')) return SHORT_TTL;
  if (provider.includes('xai') || provider.includes('grok')) return SHORT_TTL;
  if (provider.includes('openrouter')) return SHORT_TTL;

  return SHORT_TTL;
}
