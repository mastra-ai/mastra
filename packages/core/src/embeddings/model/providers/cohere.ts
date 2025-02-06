import { createCohere } from '@ai-sdk/cohere';

import { MastraEmbedding } from '../base';

export type CohereEmbeddingModelNames =
  | 'embed-english-v3.0'
  | 'embed-multilingual-v3.0'
  | 'embed-english-light-v3.0'
  | 'embed-multilingual-light-v3.0'
  | 'embed-english-v2.0'
  | 'embed-english-light-v2.0'
  | 'embed-multilingual-v2.0'
  | (string & {});

export class CohereEmbeddingModel extends MastraEmbedding {
  constructor({
    apiKey = process.env.COHERE_API_KEY || '',
    model,
    baseURL,
    fetch,
    headers,
  }: {
    apiKey?: string;
    model: CohereEmbeddingModelNames;
    baseURL?: string;
    fetch?: typeof globalThis.fetch;
    headers?: Record<string, string>;
  }) {
    const cohere = createCohere({
      apiKey,
      baseURL,
      fetch,
      headers,
    });
    super({ model: cohere.embedding(model) });
  }
}
