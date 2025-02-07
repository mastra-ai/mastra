import { createMistral } from '@ai-sdk/mistral';
import { embed as embedAi, embedMany as embedManyAi, EmbedResult, EmbedManyResult } from 'ai';

import { MastraEmbedder } from './embedder';

export type MistralEmbeddingModelNames = 'mistral-embed' | (string & {});

export async function embed(
  value: string,
  {
    apiKey = process.env.MISTRAL_API_KEY || '',
    model = 'mistral-embed',
    baseURL,
    maxRetries = 3,
  }: {
    maxRetries?: number;
    apiKey?: string;
    model: MistralEmbeddingModelNames;
    baseURL?: string;
  },
) {
  const mistral = createMistral({
    baseURL,
    apiKey,
  });
  const eModel = mistral.textEmbeddingModel(model);
  return await embedAi({ model: eModel, value, maxRetries });
}

export async function embedMany(
  values: string[],
  {
    apiKey = process.env.MISTRAL_API_KEY || '',
    model = 'mistral-embed',
    baseURL,
    maxRetries = 3,
  }: {
    maxRetries?: number;
    apiKey?: string;
    model: MistralEmbeddingModelNames;
    baseURL?: string;
  },
) {
  const mistral = createMistral({
    baseURL,
    apiKey,
  });
  const eModel = mistral.textEmbeddingModel(model);
  return await embedManyAi({
    model: eModel,
    values,
    maxRetries,
  });
}

export class MistralEmbedder extends MastraEmbedder {
  apiKey: string;
  model: MistralEmbeddingModelNames;
  baseURL: string | undefined;
  constructor({
    apiKey = process.env.MISTRAL_API_KEY || '',
    model = 'mistral-embed',
    baseURL,
  }: {
    apiKey?: string;
    model: MistralEmbeddingModelNames;
    baseURL?: string;
  }) {
    super();
    this.apiKey = apiKey;
    this.model = model;
    this.baseURL = baseURL;
  }

  async embed(
    value: string,
    { maxRetries }: { maxRetries?: number } = { maxRetries: 3 },
  ): Promise<EmbedResult<string>> {
    return embed(value, {
      apiKey: this.apiKey,
      model: this.model,
      baseURL: this.baseURL,
      maxRetries,
    });
  }

  async embedMany(
    values: string[],
    { maxRetries }: { maxRetries?: number } = { maxRetries: 3 },
  ): Promise<EmbedManyResult<string>> {
    return embedMany(values, {
      apiKey: this.apiKey,
      model: this.model,
      baseURL: this.baseURL,
      maxRetries,
    });
  }
}
