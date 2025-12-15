import type { LanguageModelV2, LanguageModelV2CallOptions } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import type { MastraLanguageModelV2 } from '../../llm/model/shared.types';
import { AISDKV5LanguageModel } from '../../llm/model/aisdk/v5/model';

export class MastraLanguageModelV2Mock implements MastraLanguageModelV2 {
  readonly specificationVersion = 'v2' as const;
  readonly provider: LanguageModelV2['provider'];
  readonly modelId: LanguageModelV2['modelId'];
  readonly supportedUrls: LanguageModelV2['supportedUrls'];
  #model: MockLanguageModelV2;

  constructor(config: {
    provider?: LanguageModelV2['provider'];
    modelId?: LanguageModelV2['modelId'];
    supportedUrls?: LanguageModelV2['supportedUrls'] | (() => LanguageModelV2['supportedUrls']);
    doGenerate?:
      | LanguageModelV2['doGenerate']
      | Awaited<ReturnType<LanguageModelV2['doGenerate']>>
      | Awaited<ReturnType<LanguageModelV2['doGenerate']>>[];
    doStream?:
      | LanguageModelV2['doStream']
      | Awaited<ReturnType<LanguageModelV2['doStream']>>
      | Awaited<ReturnType<LanguageModelV2['doStream']>>[];
  }) {
    this.#model = new MockLanguageModelV2(config);
    this.provider = this.#model.provider;
    this.modelId = this.#model.modelId;
    this.supportedUrls = this.#model.supportedUrls;
  }

  doGenerate(options: LanguageModelV2CallOptions) {
    const aiSDKModel = new AISDKV5LanguageModel(this.#model);
    return aiSDKModel.doGenerate(options);
  }

  doStream(options: LanguageModelV2CallOptions) {
    const aiSDKModel = new AISDKV5LanguageModel(this.#model);
    return aiSDKModel.doStream(options);
  }

  get doGenerateCalls(): LanguageModelV2CallOptions[] {
    return this.#model.doGenerateCalls;
  }
  get doStreamCalls(): LanguageModelV2CallOptions[] {
    return this.#model.doStreamCalls;
  }
}
