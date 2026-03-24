import type { AgentConfig } from '@mastra/core/agent';
import type { MastraModelConfig } from '@mastra/core/llm';

type TieredModelTarget = MastraModelConfig;

export interface ModelByInputTokensConfig {
  upTo: Record<number, TieredModelTarget>;
}

function isTieredModelTarget(model: unknown): model is TieredModelTarget {
  if (typeof model === 'string') {
    return true;
  }

  if (!model || typeof model !== 'object') {
    return false;
  }

  return (
    'modelId' in model ||
    'id' in model ||
    'providerId' in model ||
    'provider' in model ||
    ('doGenerate' in model && 'doStream' in model)
  );
}

function normalizeThresholds(config: ModelByInputTokensConfig) {
  const entries = Object.entries(config.upTo);

  if (entries.length === 0) {
    throw new Error('ModelByInputTokens requires at least one threshold in "upTo"');
  }

  for (const [limitStr, model] of entries) {
    const limit = Number(limitStr);
    if (!Number.isFinite(limit) || limit <= 0) {
      throw new Error(`ModelByInputTokens threshold keys must be positive numbers. Got: ${limitStr}`);
    }

    if (!isTieredModelTarget(model)) {
      throw new Error(`ModelByInputTokens requires a valid model target for threshold ${limitStr}`);
    }
  }

  return entries.map(([limitStr, model]) => ({ limit: Number(limitStr), model })).sort((a, b) => a.limit - b.limit);
}

export class ModelByInputTokens {
  private readonly thresholds: Array<{ limit: number; model: AgentConfig['model'] }>;

  constructor(config: ModelByInputTokensConfig) {
    this.thresholds = normalizeThresholds(config);
  }

  resolve(inputTokens: number): AgentConfig['model'] {
    for (const { limit, model } of this.thresholds) {
      if (inputTokens <= limit) {
        return model;
      }
    }

    const maxLimit = this.thresholds[this.thresholds.length - 1]!.limit;
    throw new Error(
      `ModelByInputTokens: input token count (${inputTokens}) exceeds the largest configured threshold (${maxLimit}). ` +
        `Please configure a higher threshold or use a larger model.`,
    );
  }

  getThresholds(): number[] {
    return this.thresholds.map(t => t.limit);
  }
}
