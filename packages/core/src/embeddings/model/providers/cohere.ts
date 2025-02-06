import { createCohere } from '@ai-sdk/cohere';
import { embed as embedAi, embedMany as embedManyAi } from 'ai';

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
