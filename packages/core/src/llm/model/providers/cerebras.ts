import { createCerebras } from '@ai-sdk/cerebras';

import { MastraLLM } from '../model';

export type CerebrasModel = 'llama3.1-8b' | 'llama3.1-70b' | 'llama3.3-70b' | (string & {});

export class Cerebras extends MastraLLM {
  constructor({
    name = 'llama3.1-8b',
    apiKey = process.env.CEREBRAS_API_KEY || '',
    baseURL = 'https://api.cerebras.ai/v1',
  }: {
    name?: CerebrasModel;
    apiKey?: string;
    baseURL?: string;
  } = {}) {
    const cerebrasModel = createCerebras({
      baseURL,
      apiKey,
    });
    super({ model: cerebrasModel(name) });
  }
}
