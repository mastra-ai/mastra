import { createOpenAI } from '@ai-sdk/openai';
import { OpenAIChatSettings } from '@ai-sdk/openai/internal';

import { MastraLLM } from '../model';

export function openaiCompat({
  baseURL,
  apiKey,
  modelName,
  fetch,
  settings,
}: {
  baseURL?: string;
  apiKey?: string;
  modelName: string;
  fetch?: typeof globalThis.fetch;
  settings?: OpenAIChatSettings;
}) {
  const client = createOpenAI({
    baseURL,
    apiKey,
    fetch,
  });
  return client(modelName, settings);
}

export class OpenaiCompat extends MastraLLM {
  constructor({
    name,
    apiKey,
    baseURL,
    fetch,
    settings,
  }: {
    name: string;
    apiKey?: string;
    baseURL?: string;
    fetch?: typeof globalThis.fetch;
    settings?: OpenAIChatSettings;
  }) {
    super({ model: openaiCompat({ modelName: name, apiKey, baseURL, fetch, settings }) });
  }
}
