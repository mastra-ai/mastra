import type { MastraModelConfig } from './shared.types';

/**
 * Reserved key used in RequestContext to pass input token counts to ModelByInputTokens.
 * OM sets this value before calling the Observer or Reflector so that ModelByInputTokens
 * can select the appropriate model based on the actual input size.
 */
export const OM_INPUT_TOKENS_KEY = 'omInputTokens';

/**
 * Configuration for ModelByInputTokens.
 *
 * Each key is an upper-bound threshold (inclusive). Keys must be positive numbers.
 * Values are model targets of any supported type (string ID, config object, LanguageModel, etc.).
 *
 * @example
 * ```ts
 * new ModelByInputTokens({
 *   upTo: {
 *     10_000: 'openai/gpt-4o-mini',
 *     40_000: 'openai/gpt-4o',
 *     1_000_000: 'openai/gpt-4.5',
 *   },
 * })
 * ```
 */
export interface ModelByInputTokensConfig {
  upTo: Record<number, MastraModelConfig>;
}

/**
 * A model selector that chooses a model based on input token count.
 *
 * Given thresholds like `{ upTo: { 10_000: 'model-a', 40_000: 'model-b' } }`:
 * - inputs ≤ 10,000 tokens → 'model-a'
 * - inputs ≤ 40,000 tokens → 'model-b'
 * - inputs > 40,000 → throws an error (no matching threshold)
 *
 * Thresholds are sorted internally, so the order in the config object does not matter.
 */
export class ModelByInputTokens {
  private readonly thresholds: Array<{ limit: number; model: MastraModelConfig }>;

  constructor(config: ModelByInputTokensConfig) {
    const entries = Object.entries(config.upTo);

    if (entries.length === 0) {
      throw new Error('ModelByInputTokens requires at least one threshold in "upTo"');
    }

    for (const [limitStr] of entries) {
      const limit = Number(limitStr);
      if (!Number.isFinite(limit) || limit <= 0) {
        throw new Error(`ModelByInputTokens threshold keys must be positive numbers. Got: ${limitStr}`);
      }
    }

    // Sort thresholds ascending by limit
    this.thresholds = entries
      .map(([limitStr, model]) => ({ limit: Number(limitStr), model }))
      .sort((a, b) => a.limit - b.limit);
  }

  /**
   * Resolve the model for a given input token count.
   * Returns the model for the smallest threshold that is >= inputTokens.
   * Throws if inputTokens exceeds the largest configured threshold.
   */
  resolve(inputTokens: number): MastraModelConfig {
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

  /**
   * Returns the configured thresholds in ascending order.
   * Useful for introspection and debugging.
   */
  getThresholds(): number[] {
    return this.thresholds.map(t => t.limit);
  }
}
