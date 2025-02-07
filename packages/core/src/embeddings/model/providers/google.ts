import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { embed as embedAi, embedMany as embedManyAi, EmbedResult, EmbedManyResult } from 'ai';

import { MastraEmbedder } from './embedder';

export type GoogleEmbeddingModelNames = 'textembedding-gecko' | 'textembedding-gecko-multilingual' | (string & {});

export async function embed(
  value: string,
  {
    apiKey = process.env.GOOGLE_API_KEY || '',
    model = 'textembedding-gecko',
    baseURL,
    maxRetries = 3,
  }: {
    maxRetries?: number;
    apiKey?: string;
    model: GoogleEmbeddingModelNames;
    baseURL?: string;
  },
) {
  const google = createGoogleGenerativeAI({
    baseURL,
    apiKey,
  });
  const eModel = google.textEmbeddingModel(model);
  return await embedAi({ model: eModel, value, maxRetries });
}

export async function embedMany(
  values: string[],
  {
    apiKey = process.env.GOOGLE_API_KEY || '',
    model = 'textembedding-gecko',
    baseURL,
    maxRetries = 3,
  }: {
    maxRetries?: number;
    apiKey?: string;
    model: GoogleEmbeddingModelNames;
    baseURL?: string;
  },
) {
  const google = createGoogleGenerativeAI({
    baseURL,
    apiKey,
  });
  const eModel = google.textEmbeddingModel(model);
  return await embedManyAi({
    model: eModel,
    values,
    maxRetries,
  });
}

export class GoogleEmbedder extends MastraEmbedder {
  apiKey: string;
  model: GoogleEmbeddingModelNames;
  baseURL: string | undefined;
  constructor({
    apiKey = process.env.GOOGLE_API_KEY || '',
    model = 'textembedding-gecko',
    baseURL,
  }: {
    apiKey?: string;
    model: GoogleEmbeddingModelNames;
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
