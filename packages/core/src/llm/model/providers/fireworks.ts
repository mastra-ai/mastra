import { createFireworks } from '@ai-sdk/fireworks';
import { extractReasoningMiddleware, wrapLanguageModel } from 'ai';

import { MastraLLM } from '../model';

export type FireworksModel =
  | 'accounts/fireworks/models/deepseek-v3'
  | 'accounts/fireworks/models/llama-v3p1-405b-instruct'
  | 'accounts/fireworks/models/llama-v3p1-8b-instruct'
  | 'accounts/fireworks/models/llama-v3p2-3b-instruct'
  | 'accounts/fireworks/models/llama-v3p3-70b-instruct'
  | 'accounts/fireworks/models/mixtral-8x7b-instruct-hf'
  | 'accounts/fireworks/models/mixtral-8x22b-instruct'
  | 'accounts/fireworks/models/qwen2p5-coder-32b-instruct'
  | 'accounts/fireworks/models/llama-v3p2-11b-vision-instruct'
  | 'accounts/fireworks/models/yi-large'
  | (string & {});

export class Fireworks extends MastraLLM {
  constructor({ name, apiKey = process.env.FIREWORKS_API_KEY || '' }: { name: FireworksModel; apiKey?: string }) {
    const fireworksModel = createFireworks({ apiKey });
    super({ model: fireworksModel(name) });
  }
}

export class FireworksReasoning extends MastraLLM {
  constructor({
    name,
    apiKey = process.env.FIREWORKS_API_KEY || '',
  }: {
    name: 'accounts/fireworks/models/deepseek-r1';
    apiKey?: string;
  }) {
    const fireworksModel = createFireworks({ apiKey });

    const enhancedModel = wrapLanguageModel({
      model: fireworksModel(name),
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    });

    super({ model: enhancedModel });
  }
}
