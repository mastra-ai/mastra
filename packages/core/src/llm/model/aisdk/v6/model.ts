import type { LanguageModelV3, LanguageModelV3CallOptions } from '@ai-sdk/provider-v6';
import type { MastraLanguageModelV3 } from '../../shared.types';
import { createStreamFromGenerateResult } from '../generate-to-stream';

type StreamResult = Awaited<ReturnType<LanguageModelV3['doStream']>>;

/**
 * Wrapper class for AI SDK V6 (LanguageModelV3) that converts doGenerate to return
 * a stream format for consistency with Mastra's streaming architecture.
 */
export class AISDKV6LanguageModel implements MastraLanguageModelV3 {
  /**
   * The language model must specify which language model interface version it implements.
   */
  readonly specificationVersion: 'v3' = 'v3';
  /**
   * Name of the provider for logging purposes.
   */
  readonly provider: string;
  /**
   * Provider-specific model ID for logging purposes.
   */
  readonly modelId: string;
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

  #model: LanguageModelV3;

  constructor(config: LanguageModelV3) {
    this.#model = config;
    this.provider = this.#model.provider;
    this.modelId = this.#model.modelId;
    this.supportedUrls = this.#model.supportedUrls;
  }

  async doGenerate(options: LanguageModelV3CallOptions) {
    const result = await this.#model.doGenerate(options);

    return {
      request: result.request!,
      response: result.response as unknown as StreamResult['response'],
      stream: createStreamFromGenerateResult(result),
    };
  }

  async doStream(options: LanguageModelV3CallOptions) {
    return await this.#model.doStream(options);
  }
}
