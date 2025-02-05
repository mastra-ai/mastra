import { createMistral } from '@ai-sdk/mistral';

import { MastraLLM } from '../model';

export type MistralModel =
  | 'pixtral-large-latest'
  | 'mistral-large-latest'
  | 'mistral-small-latest'
  | 'ministral-3b-latest'
  | 'ministral-8b-latest'
  | 'pixtral-12b-2409'
  | (string & {});

export class Mistral extends MastraLLM {
  constructor({
    name = 'pixtral-large-latest',
    apiKey = process.env.MISTRAL_API_KEY || '',
    baseURL = 'https://api.mistral.ai/v1',
  }: {
    name?: MistralModel;
    apiKey?: string;
    baseURL?: string;
  } = {}) {
    const mistralModel = createMistral({
      baseURL,
      apiKey,
    });
    super({ model: mistralModel(name) });
  }
}
