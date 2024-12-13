import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { createCohere } from '@ai-sdk/cohere';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI } from '@ai-sdk/openai';
import { embed, EmbeddingModel, embedMany } from 'ai';
import { createVoyage } from 'voyage-ai-provider';

import { EmbeddingOptions } from './types';

export async function createEmbedding({ model, value, maxRetries }: EmbeddingOptions) {
  let embeddingModel: EmbeddingModel<string>;

  if (model.provider === 'OPEN_AI') {
    const openai = createOpenAI({
      apiKey: model.apiKey || process.env.OPENAI_API_KEY,
    });
    embeddingModel = openai.embedding(model.name);
  } else if (model.provider === 'COHERE') {
    const cohere = createCohere({
      apiKey: model.apiKey || process.env.COHERE_API_KEY,
    });
    embeddingModel = cohere.embedding(model.name);
  } else if (model.provider === 'AMAZON') {
    const amazon = createAmazonBedrock({
      region: process.env.AWS_REGION || '',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      sessionToken: process.env.AWS_SESSION_TOKEN || '',
    });
    embeddingModel = amazon.embedding(model.name);
  } else if (model.provider === 'GOOGLE') {
    const google = createGoogleGenerativeAI({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      apiKey: model.apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
    });
    embeddingModel = google.textEmbeddingModel(model.name);
  } else if (model.provider === 'MISTRAL') {
    const mistral = createMistral({
      baseURL: 'https://api.mistral.ai/v1',
      apiKey: model.apiKey || process.env.MISTRAL_API_KEY || '',
    });
    embeddingModel = mistral.textEmbeddingModel(model.name);
  } else if (model.provider === 'VOYAGE') {
    const voyage = createVoyage({
      baseURL: 'https://api.voyageai.com/v1',
      apiKey: model.apiKey || process.env.VOYAGE_API_KEY || '',
    });
    embeddingModel = voyage.textEmbeddingModel(model.name);
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

  return await embed({
    model: embeddingModel,
    value,
    maxRetries,
  });
}
