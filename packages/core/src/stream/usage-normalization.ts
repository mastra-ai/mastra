import type { LanguageModelUsage } from './types';

type UsagePath = readonly string[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readUsageNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }
  return undefined;
}

function getUsageNumber(usage: Record<string, unknown>, key: string): number | undefined {
  return readUsageNumber(usage[key]);
}

function getNestedUsageNumber(usage: Record<string, unknown>, path: UsagePath): number | undefined {
  let current: unknown = usage;
  for (const key of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[key];
  }
  return readUsageNumber(current);
}

function getFirstUsageNumber(usage: Record<string, unknown>, paths: readonly UsagePath[]): number | undefined {
  for (const path of paths) {
    const [firstKey] = path;
    if (!firstKey) {
      continue;
    }
    const value = path.length === 1 ? getUsageNumber(usage, firstKey) : getNestedUsageNumber(usage, path);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function hasProviderNativeUsageShape(usage: Record<string, unknown>): boolean {
  return (
    isRecord(usage.inputTokens) ||
    isRecord(usage.outputTokens) ||
    usage.promptTokens !== undefined ||
    usage.completionTokens !== undefined ||
    usage.prompt_tokens !== undefined ||
    usage.completion_tokens !== undefined ||
    usage.total_tokens !== undefined ||
    usage.input_token_count !== undefined ||
    usage.output_token_count !== undefined ||
    usage.promptTokenCount !== undefined ||
    usage.candidatesTokenCount !== undefined ||
    usage.reasoning_tokens !== undefined ||
    usage.cache_read_input_tokens !== undefined ||
    usage.cache_creation_input_tokens !== undefined ||
    usage.outputTokenDetails !== undefined ||
    usage.prompt_tokens_details !== undefined ||
    usage.completion_tokens_details !== undefined ||
    usage.output_tokens_details !== undefined ||
    usage.input_tokens_details !== undefined ||
    usage.usageMetadata !== undefined
  );
}

export function normalizeLanguageModelUsage(usage: unknown): LanguageModelUsage {
  if (!isRecord(usage)) {
    return {
      inputTokens: undefined,
      outputTokens: undefined,
      totalTokens: undefined,
      reasoningTokens: undefined,
      cachedInputTokens: undefined,
      cacheCreationInputTokens: undefined,
      raw: undefined,
    };
  }

  const inputTokens = getFirstUsageNumber(usage, [
    ['inputTokens'],
    ['promptTokens'],
    ['prompt_tokens'],
    ['input_token_count'],
    ['inputTokenCount'],
    ['promptTokenCount'],
    ['inputTokens', 'total'],
    ['usageMetadata', 'promptTokenCount'],
  ]);
  const outputTokens = getFirstUsageNumber(usage, [
    ['outputTokens'],
    ['completionTokens'],
    ['completion_tokens'],
    ['output_tokens'],
    ['output_token_count'],
    ['outputTokenCount'],
    ['candidatesTokenCount'],
    ['outputTokens', 'total'],
    ['usageMetadata', 'candidatesTokenCount'],
  ]);
  const explicitTotalTokens = getFirstUsageNumber(usage, [
    ['totalTokens'],
    ['total_tokens'],
    ['totalTokenCount'],
    ['usageMetadata', 'totalTokenCount'],
  ]);
  const totalTokens =
    explicitTotalTokens ??
    (inputTokens !== undefined || outputTokens !== undefined ? (inputTokens ?? 0) + (outputTokens ?? 0) : undefined);

  const normalized: LanguageModelUsage = {
    inputTokens,
    outputTokens,
    totalTokens,
    reasoningTokens: getFirstUsageNumber(usage, [
      ['reasoningTokens'],
      ['outputTokenDetails', 'reasoningTokens'],
      ['outputTokens', 'reasoning'],
      ['completion_tokens_details', 'reasoning_tokens'],
      ['output_tokens_details', 'reasoning_tokens'],
      ['reasoning_tokens'],
      ['thoughtsTokenCount'],
      ['usageMetadata', 'thoughtsTokenCount'],
    ]),
    cachedInputTokens: getFirstUsageNumber(usage, [
      ['cachedInputTokens'],
      ['inputTokens', 'cacheRead'],
      ['input_tokens_details', 'cached_tokens'],
      ['prompt_tokens_details', 'cached_tokens'],
      ['cache_read_input_tokens'],
    ]),
    cacheCreationInputTokens: getFirstUsageNumber(usage, [
      ['cacheCreationInputTokens'],
      ['inputTokens', 'cacheWrite'],
      ['cache_creation_input_tokens'],
    ]),
    raw: usage.raw !== undefined ? usage.raw : hasProviderNativeUsageShape(usage) ? usage : undefined,
  };

  return normalized;
}
