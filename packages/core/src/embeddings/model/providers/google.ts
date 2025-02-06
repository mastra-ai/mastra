import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { embed as embedAi, embedMany as embedManyAi } from 'ai';

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
