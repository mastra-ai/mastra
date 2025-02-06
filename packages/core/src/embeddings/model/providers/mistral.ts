import { createMistral } from '@ai-sdk/mistral';

import { MastraEmbedding } from '../base';

export type MistralEmbeddingModelNames = 'mistral-embed' | (string & {});

export class MistralEmbeddingModel extends MastraEmbedding {
  constructor({
    apiKey = process.env.MISTRAL_API_KEY || '',
    model,
    baseURL,
  }: {
    apiKey?: string;
    model: MistralEmbeddingModelNames;
    baseURL?: string;
  }) {
    const mistral = createMistral({
      baseURL,
      apiKey,
    });
    super({ model: mistral.textEmbeddingModel(model) });
  }
}
