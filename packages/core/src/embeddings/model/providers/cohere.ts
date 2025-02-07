import { createCohere } from '@ai-sdk/cohere';
import { embed as embedAi, embedMany as embedManyAi, EmbedResult, EmbedManyResult } from 'ai';

import { MastraEmbedder } from './embedder';

export type CohereEmbeddingModelNames =
  | 'embed-english-v3.0'
  | 'embed-english-light-v3.0'
  | 'embed-multilingual-v3.0'
  | 'embed-multilingual-light-v3.0'
  | (string & {});

export async function embed(
  value: string,
  {
    apiKey = process.env.COHERE_API_KEY || '',
    model = 'embed-english-v3.0',
    baseURL,
    maxRetries = 3,
  }: {
    maxRetries?: number;
    apiKey?: string;
    model: CohereEmbeddingModelNames;
    baseURL?: string;
  },
) {
  const cohere = createCohere({
    baseURL,
    apiKey,
  });
  const eModel = cohere.textEmbeddingModel(model);
  return await embedAi({ model: eModel, value, maxRetries });
}

export async function embedMany(
  values: string[],
  {
    apiKey = process.env.COHERE_API_KEY || '',
    model = 'embed-english-v3.0',
    baseURL,
    maxRetries = 3,
  }: {
    maxRetries?: number;
    apiKey?: string;
    model: CohereEmbeddingModelNames;
    baseURL?: string;
  },
) {
  const cohere = createCohere({
    baseURL,
    apiKey,
  });
  const eModel = cohere.textEmbeddingModel(model);
  return await embedManyAi({
    model: eModel,
    values,
    maxRetries,
  });
}

export class CohereEmbedder extends MastraEmbedder {
  apiKey: string;
  model: CohereEmbeddingModelNames;
  baseURL: string | undefined;
  constructor({
    apiKey = process.env.COHERE_API_KEY || '',
    model = 'embed-english-v3.0',
    baseURL,
  }: {
    apiKey?: string;
    model: CohereEmbeddingModelNames;
    baseURL?: string;
  }) {
    super();
    this.apiKey = apiKey;
    this.model = model;
    this.baseURL = baseURL;
  }

  async embed(value: string, { maxRetries }: { maxRetries?: number } = { maxRetries: 3 }): Promise<EmbedResult<string>> {
    return embed(value, {
      apiKey: this.apiKey,
      model: this.model,
      baseURL: this.baseURL,
      maxRetries,
    });
  }

  async embedMany(values: string[], { maxRetries }: { maxRetries?: number } = { maxRetries: 3 }): Promise<EmbedManyResult<string>> {
    return embedMany(values, {
      apiKey: this.apiKey,
      model: this.model,
      baseURL: this.baseURL,
      maxRetries,
    });
  }
}
