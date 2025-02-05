import { createOpenAI } from '@ai-sdk/openai';

import { MastraEmbedding } from '../base';

export type OpenAIEmbeddingModelNames =
  | 'text-embedding-3-small'
  | 'text-embedding-3-large'
  | 'text-embedding-ada-002'
  | (string & {});

export class OpenAIEmbeddingModel extends MastraEmbedding {
  constructor({
    apiKey = process.env.OPENAI_API_KEY || '',
    model,
    baseURL,
  }: {
    apiKey?: string;
    model: OpenAIEmbeddingModelNames;
    baseURL?: string;
  }) {
    const openai = createOpenAI({
      baseURL,
      apiKey,
    });
    super({ model: openai.textEmbeddingModel(model) });
  }
}
