import { createGoogleGenerativeAI } from '@ai-sdk/google';

import { MastraEmbedding } from '../base';

export type GoogleEmbeddingModelNames = 'text-embedding-004' | (string & {});

export class GoogleGenerativeAIEmbeddingModel extends MastraEmbedding {
  constructor({
    apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
    model,
    baseURL,
  }: {
    apiKey?: string;
    model: GoogleEmbeddingModelNames;
    baseURL?: string;
  }) {
    const google = createGoogleGenerativeAI({
      baseURL,
      apiKey,
    });
    super({ model: google.textEmbeddingModel(model) });
  }
}
