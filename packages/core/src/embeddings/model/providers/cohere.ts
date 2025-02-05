import { createCohere } from '@ai-sdk/cohere';

export type CohereEmbeddingModelNames =
  | 'embed-english-v3.0'
  | 'embed-multilingual-v3.0'
  | 'embed-english-light-v3.0'
  | 'embed-multilingual-light-v3.0'
  | 'embed-english-v2.0'
  | 'embed-english-light-v2.0'
  | 'embed-multilingual-v2.0'
  | (string & {});

export function createCohereEmbeddingModel({
  apiKey,
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
    apiKey: apiKey || process.env.COHERE_API_KEY,
    baseURL,
    fetch,
    headers,
  });
  return cohere.embedding(model);
}
