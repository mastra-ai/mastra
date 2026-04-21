import type { LanguageModelV2, LanguageModelV2CallOptions } from '@ai-sdk/provider-v5';
import type { MastraLanguageModelV2 } from '../../shared.types';
import { createStreamFromGenerateResult } from '../generate-to-stream';

type StreamResult = Awaited<ReturnType<LanguageModelV2['doStream']>>;

function stripStrictFromFunctionTools(options: LanguageModelV2CallOptions): LanguageModelV2CallOptions {
  if (!options.tools?.length) {
    return options;
  }

  const sanitizedTools = options.tools.map((tool: Record<string, unknown>) => {
    if (tool.type !== 'function' || !('strict' in tool)) {
      return tool;
    }

    const { strict: _strict, ...rest } = tool;
    return rest;
  });

  return {
    ...options,
    tools: sanitizedTools as typeof options.tools,
  };
}

/**
 * Wrapper class for AI SDK V5 (LanguageModelV2) that converts doGenerate to return
 * a stream format for consistency with Mastra's streaming architecture.
 */
export class AISDKV5LanguageModel implements MastraLanguageModelV2 {
  /**
   * The language model must specify which language model interface version it implements.
   */
  readonly specificationVersion: 'v2' = 'v2';
  /**
   * Name of the provider for logging purposes.
   */
  readonly provider: string;
  /**
   * Provider-specific model ID for logging purposes.
   */
  readonly modelId: string;
  readonly gatewayId?: string;
  /**
   * Supported URL patterns by media type for the provider.
   *
   * The keys are media type patterns or full media types (e.g. `*\/*` for everything, `audio/*`, `video/*`, or `application/pdf`).
   * and the values are arrays of regular expressions that match the URL paths.
   * The matching should be against lower-case URLs.
   * Matched URLs are supported natively by the model and are not downloaded.
   * @returns A map of supported URL patterns by media type (as a promise or a plain object).
   */
  supportedUrls: PromiseLike<Record<string, RegExp[]>> | Record<string, RegExp[]>;

  #model: LanguageModelV2;

  constructor(config: LanguageModelV2) {
    this.#model = config;
    this.provider = this.#model.provider;
    this.modelId = this.#model.modelId;
    this.gatewayId = (config as { gatewayId?: string }).gatewayId;
    this.supportedUrls = this.#model.supportedUrls;
  }

  async doGenerate(options: LanguageModelV2CallOptions) {
    const result = await this.#model.doGenerate(stripStrictFromFunctionTools(options));

    return {
      ...result,
      request: result.request!,
      response: result.response as unknown as StreamResult['response'],
      stream: createStreamFromGenerateResult(result),
    };
  }

  async doStream(options: LanguageModelV2CallOptions) {
    return await this.#model.doStream(stripStrictFromFunctionTools(options));
  }

  /**
   * Custom serialization for tracing/observability spans.
   * `#model` is already a true JS private field and not enumerable, so
   * the wrapped provider SDK client can't leak. This method makes the
   * safe shape explicit and avoids walking `supportedUrls` (a
   * PromiseLike / regex map that isn't useful in spans).
   */
  serializeForSpan(): { specificationVersion: 'v2'; modelId: string; provider: string; gatewayId?: string } {
    return {
      specificationVersion: this.specificationVersion,
      modelId: this.modelId,
      provider: this.provider,
      gatewayId: this.gatewayId,
    };
  }
}
