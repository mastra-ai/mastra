import { OpenAIChatSettings } from '@ai-sdk/openai/internal';
import { createXai } from '@ai-sdk/xai';

import { MastraLLM } from '../model';

export type XGrokModel = 'grok-beta' | 'grok-vision-beta' | 'grok-2-1212' | 'grok-2-vision-1212' | (string & {});

export class Grok extends MastraLLM {
  constructor({
    name = 'grok-beta',
    apiKey = process.env.XAI_API_KEY ?? '',
    baseURL = 'https://api.x.ai/v1',
    settings,
  }: {
    settings?: OpenAIChatSettings;
    name?: string;
    apiKey?: string;
    baseURL?: string;
  }) {
    const xAi = createXai({
      baseURL,
      apiKey,
    });

    super({ model: xAi(name, settings) });
  }
}
