import { OpenAIChatSettings } from '@ai-sdk/openai/internal';

import { MastraLLM } from '../model';

import { openaiCompat } from './openai-compat';

export type BasetenModel =
  | 'llama-3.1-70b-instruct'
  | 'qwen2.5-7b-math-instruct'
  | 'qwen2.5-14b-instruct'
  | 'qwen2.5-32b-coder-instruct'
  | 'llama-3.1-8b-instruct'
  | 'llama-3.1-nemetron-70b'
  | 'llama-3.2-90b-vision-instruct'
  | 'llama-3.1-405b-instruct'
  | 'ultravox-v0.4'
  | 'llama-3.2-1b-vision-instruct'
  | 'llama-3-70b-instruct'
  | 'llama-3-8b-instruct'
  | 'mistral-7b-instruct'
  | 'qwen2.5-14b-coder-instruct'
  | 'qwen2.5-7b-coder-instruct'
  | 'qwen2.5-72b-math-instruct'
  | 'qwen2.5-72b-instruct'
  | 'qwen2.5-32b-instruct'
  | 'qwen2.5-7b-instruct'
  | 'qwen2.5-3b-instruct'
  | 'pixtral-12b'
  | 'phi-3.5-mini-instruct'
  | 'gemma-2-9b'
  | 'gemma-2-27b'
  | 'phi-3-mini-128k-instruct'
  | 'phi-3-mini-4k-instruct'
  | 'zephyr-7b-alpha'
  | 'mixtral-8x7b-instruct'
  | 'mixtral-8x22b'
  | (string & {});

export class BaseTen extends MastraLLM {
  constructor({
    name = 'llama-3.1-70b-instruct',
    apiKey = process.env.BASETEN_API_KEY || '',
    baseURL = 'https://bridge.baseten.co/v1/direct',
    fetch,
    settings,
  }: {
    name?: BasetenModel;
    apiKey?: string;
    baseURL?: string;
    fetch?: typeof globalThis.fetch;
    settings?: OpenAIChatSettings;
  } = {}) {
    if (fetch) {
      throw new Error(
        'Custom fetch is required to use BaseTen. See https://docs.baseten.co/api-reference/openai for more information',
      );
    }

    const baseten = openaiCompat({
      baseURL,
      modelName: name,
      apiKey,
      fetch,
      settings,
    });

    super({ model: baseten });
  }
}
