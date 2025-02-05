import { createPerplexity } from '@ai-sdk/perplexity';

import { MastraLLM } from '../model';

export type PerplexityModel = 'sonar' | 'sonar-pro' | (string & {});

export class Perplexity extends MastraLLM {
  constructor({
    name,
    apiKey,
    baseURL,
  }: {
    name?: PerplexityModel;
    apiKey?: string;
    baseURL?: string;
  } = {}) {
    const perplexityModel = createPerplexity({
      baseURL,
      apiKey,
    });

    super({ model: perplexityModel(name || 'sonar') });
  }
}
