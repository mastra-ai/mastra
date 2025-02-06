import { createMistral } from '@ai-sdk/mistral';
import { embed as embedAi, embedMany as embedManyAi } from 'ai';

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
