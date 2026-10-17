import type { LanguageModelV4, LanguageModelV4CallOptions } from '@ai-sdk/provider';
import { MockLanguageModelV4 } from '@internal/ai-v7/test';
import type { MastraLanguageModelV4 } from '../../llm/model/shared.types';
import { AISDKV7LanguageModel } from '../../llm/model/aisdk/v7/model';

export class MastraLanguageModelV2Mock implements MastraLanguageModelV4 {
  readonly specificationVersion = 'v2' as const;
  readonly provider: LanguageModelV4['provider'];
  readonly modelId: LanguageModelV4['modelId'];
  readonly supportedUrls: LanguageModelV4['supportedUrls'];
  #model: MockLanguageModelV4;

  constructor(config: {
    provider?: LanguageModelV4['provider'];
    modelId?: LanguageModelV4['modelId'];
    supportedUrls?: LanguageModelV4['supportedUrls'] | (() => LanguageModelV4['supportedUrls']);
    doGenerate?:
      | LanguageModelV4['doGenerate']
      | Awaited<ReturnType<LanguageModelV4['doGenerate']>>
      | Awaited<ReturnType<LanguageModelV4['doGenerate']>>[];
    doStream?:
      | LanguageModelV4['doStream']
      | Awaited<ReturnType<LanguageModelV4['doStream']>>
      | Awaited<ReturnType<LanguageModelV4['doStream']>>[];
  }) {
    this.#model = new MockLanguageModelV4(config);
    this.provider = this.#model.provider;
    this.modelId = this.#model.modelId;
    this.supportedUrls = this.#model.supportedUrls;
  }

  doGenerate(options: LanguageModelV4CallOptions) {
    const aiSDKModel = new AISDKV7LanguageModel(this.#model);
    return aiSDKModel.doGenerate(options);
  }

  doStream(options: LanguageModelV4CallOptions) {
    const aiSDKModel = new AISDKV7LanguageModel(this.#model);
    return aiSDKModel.doStream(options);
  }

  get doGenerateCalls(): LanguageModelV4CallOptions[] {
    return this.#model.doGenerateCalls;
  }
  get doStreamCalls(): LanguageModelV4CallOptions[] {
    return this.#model.doStreamCalls;
  }
}
