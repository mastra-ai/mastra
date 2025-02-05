import { createGroq } from '@ai-sdk/groq';
import { extractReasoningMiddleware, wrapLanguageModel } from 'ai';

import { MastraLLM } from '../model';

export type GroqModel =
  | 'llama3-groq-70b-8192-tool-use-preview'
  | 'llama3-groq-8b-8192-tool-use-preview'
  | 'gemma2-9b-it'
  | 'gemma-7b-it'
  | (string & {});

export class Groq extends MastraLLM {
  constructor({
    name = 'gemma2-9b-it',
    apiKey = process.env.GROQ_API_KEY || '',
    baseURL = 'https://api.groq.com/openai/v1',
  }: {
    name?: GroqModel;
    apiKey?: string;
    baseURL?: string;
  } = {}) {
    const groqModel = createGroq({
      baseURL,
      apiKey,
    });

    super({ model: groqModel(name) });
  }
}
export class GroqReasoning extends MastraLLM {
  constructor({
    name = 'deepseek-r1-distill-llama-70b',
    apiKey = process.env.GROQ_API_KEY || '',
    baseURL = 'https://api.groq.com/openai/v1',
  }: {
    name?: 'deepseek-r1-distill-llama-70b';
    apiKey?: string;
    baseURL?: string;
  } = {}) {
    const groqModel = createGroq({
      baseURL,
      apiKey,
    });

    const enhancedModel = wrapLanguageModel({
      model: groqModel(name),
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    });

    super({ model: enhancedModel });
  }
}
