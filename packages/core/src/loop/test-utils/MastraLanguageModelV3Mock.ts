import type { LanguageModelV3, LanguageModelV3CallOptions } from '@ai-sdk/provider-v6';
import { MockLanguageModelV3 } from '@internal/ai-v6/test';
import type { MastraLanguageModelV3 } from '../../llm/model/shared.types';
import { AISDKV6LanguageModel } from '../../llm/model/aisdk/v6/model';

export class MastraLanguageModelV3Mock implements MastraLanguageModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider: LanguageModelV3['provider'];
  readonly modelId: LanguageModelV3['modelId'];
  readonly supportedUrls: LanguageModelV3['supportedUrls'];
  #model: MockLanguageModelV3;

  constructor(config: {
    provider?: LanguageModelV3['provider'];
    modelId?: LanguageModelV3['modelId'];
    supportedUrls?: LanguageModelV3['supportedUrls'] | (() => LanguageModelV3['supportedUrls']);
    doGenerate?:
      | LanguageModelV3['doGenerate']
      | Awaited<ReturnType<LanguageModelV3['doGenerate']>>
      | Awaited<ReturnType<LanguageModelV3['doGenerate']>>[];
    doStream?:
      | LanguageModelV3['doStream']
      | Awaited<ReturnType<LanguageModelV3['doStream']>>
      | Awaited<ReturnType<LanguageModelV3['doStream']>>[];
  }) {
    this.#model = new MockLanguageModelV3(config);
    this.provider = this.#model.provider;
    this.modelId = this.#model.modelId;
    this.supportedUrls = this.#model.supportedUrls;
  }

  doGenerate(options: LanguageModelV3CallOptions) {
    const aiSDKModel = new AISDKV6LanguageModel(this.#model);
    return aiSDKModel.doGenerate(options);
  }

  doStream(options: LanguageModelV3CallOptions) {
    const aiSDKModel = new AISDKV6LanguageModel(this.#model);
    return aiSDKModel.doStream(options);
  }

  get doGenerateCalls(): LanguageModelV3CallOptions[] {
    return this.#model.doGenerateCalls;
  }
  get doStreamCalls(): LanguageModelV3CallOptions[] {
    return this.#model.doStreamCalls;
  }
}
