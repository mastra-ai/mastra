import { randomUUID } from 'crypto';
import type { LanguageModelV2, LanguageModelV2CallOptions } from '@ai-sdk/provider-v5';
import type { MastraLanguageModelV2 } from '../../shared.types';

type StreamResult = Awaited<ReturnType<LanguageModelV2['doStream']>>;

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
    this.supportedUrls = this.#model.supportedUrls;
  }

  async doGenerate(options: LanguageModelV2CallOptions) {
    const result = await this.#model.doGenerate(options);

    return {
      request: result.request!,
      response: result.response as unknown as StreamResult['response'],
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: result.warnings });
          controller.enqueue({
            type: 'response-metadata',
            id: result.response?.id,
            modelId: result.response?.modelId,
            timestamp: result.response?.timestamp,
          });

          for (const message of result.content) {
            if (message.type === 'tool-call') {
              const toolCall = message;
              controller.enqueue({
                type: 'tool-input-start',
                id: toolCall.toolCallId,
                toolName: toolCall.toolName,
              });
              controller.enqueue({
                type: 'tool-input-delta',
                id: toolCall.toolCallId,
                delta: toolCall.input,
              });
              controller.enqueue({
                type: 'tool-input-end',
                id: toolCall.toolCallId,
              });
              controller.enqueue(toolCall);
            } else if (message.type === 'tool-result') {
              const toolResult = message;
              controller.enqueue(toolResult);
            } else if (message.type === 'text') {
              const text = message;
              const id = `msg_${randomUUID()}`;
              controller.enqueue({
                type: 'text-start',
                id,
                providerMetadata: text.providerMetadata,
              });
              controller.enqueue({
                type: 'text-delta',
                id,
                delta: text.text,
              });
              controller.enqueue({
                type: 'text-end',
                id,
              });
            } else if (message.type === 'reasoning') {
              const id = `reasoning_${randomUUID()}`;

              const reasoning = message;
              controller.enqueue({
                type: 'reasoning-start',
                id,
                providerMetadata: reasoning.providerMetadata,
              });
              controller.enqueue({
                type: 'reasoning-delta',
                id,
                delta: reasoning.text,
                providerMetadata: reasoning.providerMetadata,
              });
              controller.enqueue({
                type: 'reasoning-end',
                id,
                providerMetadata: reasoning.providerMetadata,
              });
            } else if (message.type === 'file') {
              const file = message;
              controller.enqueue({
                type: 'file',
                mediaType: file.mediaType,
                data: file.data,
              });
            } else if (message.type === 'source') {
              const source = message;
              if (source.sourceType === 'url') {
                controller.enqueue({
                  type: 'source',
                  id: source.id,
                  sourceType: 'url',
                  url: source.url,
                  title: source.title,
                  providerMetadata: source.providerMetadata,
                });
              } else {
                controller.enqueue({
                  type: 'source',
                  id: source.id,
                  sourceType: 'document',
                  mediaType: source.mediaType,
                  filename: source.filename,
                  title: source.title,
                  providerMetadata: source.providerMetadata,
                });
              }
            }
          }

          controller.enqueue({
            type: 'finish',
            finishReason: result.finishReason,
            usage: result.usage,
            providerMetadata: result.providerMetadata,
          });

          controller.close();
        },
      }),
    };
  }

  async doStream(options: LanguageModelV2CallOptions) {
    return await this.#model.doStream(options);
  }
}
