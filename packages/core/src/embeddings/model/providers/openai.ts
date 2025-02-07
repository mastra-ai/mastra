import { createOpenAI } from '@ai-sdk/openai';
import { embed as embedAi, embedMany as embedManyAi, EmbedResult, EmbedManyResult } from 'ai';

import { MastraEmbedder } from './embedder';

export type OpenAIEmbeddingModelNames =
  | 'text-embedding-3-small'
  | 'text-embedding-3-large'
  | 'text-embedding-ada-002'
  | (string & {});

export async function embed(
  value: string,
  {
    apiKey = process.env.OPENAI_API_KEY || '',
    model = 'text-embedding-3-small',
    baseURL,
    maxRetries = 3,
  }: {
    maxRetries?: number;
    apiKey?: string;
    model: OpenAIEmbeddingModelNames;
    baseURL?: string;
  },
) {
  const openai = createOpenAI({
    baseURL,
    apiKey,
  });
  const eModel = openai.textEmbeddingModel(model);
  return await embedAi({ model: eModel, value, maxRetries });
}

export async function embedMany(
  value: string[],
  {
    apiKey = process.env.OPENAI_API_KEY || '',
    model = 'text-embedding-3-small',
    baseURL,
    maxRetries = 3,
  }: {
    maxRetries?: number;
    apiKey?: string;
    model: OpenAIEmbeddingModelNames;
    baseURL?: string;
  },
) {
  const openai = createOpenAI({
    baseURL,
    apiKey,
  });
  const eModel = openai.textEmbeddingModel(model);
  return await embedManyAi({
    model: eModel,
    values: value,
    maxRetries,
  });
}

export class OpenAIEmbedder extends MastraEmbedder {
  apiKey: string;
  model: OpenAIEmbeddingModelNames;
  baseURL: string | undefined;
  constructor({
    apiKey = process.env.OPENAI_API_KEY || '',
    model = 'text-embedding-3-small',
    baseURL,
  }: {
    apiKey?: string;
    model: OpenAIEmbeddingModelNames;
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
