import { createOpenAI } from '@ai-sdk/openai';
import { embed as embedAi, embedMany as embedManyAi } from 'ai';

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
