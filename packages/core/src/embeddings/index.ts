import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { createCohere } from '@ai-sdk/cohere';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI } from '@ai-sdk/openai';
import { embed as embedAi, EmbeddingModel, embedMany } from 'ai';
import { createVoyage } from 'voyage-ai-provider';

import 'dotenv/config';

import { EmbeddingOptions } from './types';

export * from './types';

export async function embed(value: string | string[], embeddingOptions: EmbeddingOptions) {
  let embeddingModel: EmbeddingModel<string>;
  const { provider, model, apiKey, maxRetries } = embeddingOptions;

  if (provider === 'OPEN_AI') {
    const openai = createOpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
    embeddingModel = openai.embedding(model);
  } else if (provider === 'COHERE') {
    const cohere = createCohere({
      apiKey: apiKey || process.env.COHERE_API_KEY,
    });
    embeddingModel = cohere.embedding(model);
  } else if (provider === 'AMAZON') {
    const amazon = createAmazonBedrock({
      region: process.env.AWS_REGION || '',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      sessionToken: process.env.AWS_SESSION_TOKEN || '',
    });
    embeddingModel = amazon.embedding(model);
  } else if (provider === 'GOOGLE') {
    const google = createGoogleGenerativeAI({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      apiKey: apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
    });
    embeddingModel = google.textEmbeddingModel(model);
  } else if (provider === 'MISTRAL') {
    const mistral = createMistral({
      baseURL: 'https://api.mistral.ai/v1',
      apiKey: apiKey || process.env.MISTRAL_API_KEY || '',
    });
    embeddingModel = mistral.textEmbeddingModel(model);
  } else if (provider === 'VOYAGE') {
    const voyage = createVoyage({
      baseURL: 'https://api.voyageai.com/v1',
      apiKey: apiKey || process.env.VOYAGE_API_KEY || '',
    });
    embeddingModel = voyage.textEmbeddingModel(model);
  } else {
    throw new Error(`Invalid embedding model`);
  }

  if (value instanceof Array) {
    return await embedMany({
      model: embeddingModel,
      values: value,
      maxRetries,
    });
  }

  return await embedAi({
    model: embeddingModel,
    value,
    maxRetries,
  });
}
