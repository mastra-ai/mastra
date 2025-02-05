import { createCohere } from '@ai-sdk/cohere';

import { MastraLLM } from '../model';

export type CohereModel = 'command-r-plus' | (string & {});

export class Cohere extends MastraLLM {
  constructor({
    name = 'command-r-plus',
    apiKey = process.env.COHERE_API_KEY || '',
    baseURL = 'https://api.cohere.com/v2',
  }: {
    name?: CohereModel;
    apiKey?: string;
    baseURL?: string;
  }) {
    const cohere = createCohere({
      baseURL,
      apiKey,
    });

    super({ model: cohere(name) });
  }
}
