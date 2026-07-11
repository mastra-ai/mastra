import type { LanguageModelV1, LanguageModelV1CallOptions } from '@internal/ai-sdk-v4';

/**
 * Wrapper class for AI SDK v4 (LanguageModelV1) legacy models.
 *
 * The wrapped `#model` is held in a true JS private field so the
 * underlying SDK client (and any enumerable config it exposes) cannot
 * leak into observability spans. `serializeForSpan()` makes the safe
 * shape explicit.
 *
 * This wrapper is applied by `resolveModelConfig` when a raw v4 model
 * is passed to Mastra, so callers do not need to construct it directly.
 */
export class AISDKV4LegacyLanguageModel implements LanguageModelV1 {
  readonly specificationVersion: 'v1' = 'v1';
  readonly provider: LanguageModelV1['provider'];
  readonly modelId: LanguageModelV1['modelId'];
  readonly defaultObjectGenerationMode: LanguageModelV1['defaultObjectGenerationMode'];
  readonly supportsImageUrls?: LanguageModelV1['supportsImageUrls'];
  readonly supportsStructuredOutputs?: LanguageModelV1['supportsStructuredOutputs'];

  #model: LanguageModelV1;

  constructor(config: LanguageModelV1) {
    this.#model = config;
    this.provider = config.provider;
    this.modelId = config.modelId;
    this.defaultObjectGenerationMode = config.defaultObjectGenerationMode;
    this.supportsImageUrls = config.supportsImageUrls;
    this.supportsStructuredOutputs = config.supportsStructuredOutputs;
  }

  supportsUrl(url: URL): boolean {
    return this.#model.supportsUrl?.(url) ?? false;
  }

  doGenerate(options: LanguageModelV1CallOptions) {
    return this.#model.doGenerate(options);
  }

  doStream(options: LanguageModelV1CallOptions) {
    return this.#model.doStream(options);
  }

  /**
   * Custom serialization for tracing/observability spans.
   * `#model` is already a true JS private field and not enumerable, so
   * the wrapped provider SDK client can't leak. This method makes the
   * safe shape explicit.
   */
  serializeForSpan(): { specificationVersion: 'v1'; modelId: string; provider: string } {
    return {
      specificationVersion: this.specificationVersion,
      modelId: this.modelId,
      provider: this.provider,
    };
  }
}
