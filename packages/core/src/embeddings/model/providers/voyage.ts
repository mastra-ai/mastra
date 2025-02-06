import { embed as embedAi, embedMany as embedManyAi } from 'ai';
import { createVoyage } from 'voyage-ai-provider';

export type VoyageEmbeddingModelNames = 'voyage-01' | (string & {});

export async function embed(
  value: string,
  {
    apiKey = process.env.VOYAGE_API_KEY || '',
    model = 'voyage-01',
    baseURL,
    maxRetries = 3,
  }: {
    maxRetries?: number;
    apiKey?: string;
    model: VoyageEmbeddingModelNames;
    baseURL?: string;
  },
) {
  const voyage = createVoyage({
    baseURL,
    apiKey,
  });
  const eModel = voyage.textEmbeddingModel(model);
  return await embedAi({ model: eModel, value, maxRetries });
}

export async function embedMany(
  values: string[],
  {
    apiKey = process.env.VOYAGE_API_KEY || '',
    model = 'voyage-01',
    baseURL,
    maxRetries = 3,
  }: {
    maxRetries?: number;
    apiKey?: string;
    model: VoyageEmbeddingModelNames;
    baseURL?: string;
  },
) {
  const voyage = createVoyage({
    baseURL,
    apiKey,
  });
  const eModel = voyage.textEmbeddingModel(model);
  return await embedManyAi({
    model: eModel,
    values,
    maxRetries,
  });
}
