import { createOllama } from 'ollama-ai-provider';

import { MastraLLM } from '../model';

export type OllamaModel = string & {};

export class OllamaAI extends MastraLLM {
  constructor({
    name,
    baseURL,
    headers,
    fetch,
  }: {
    name: OllamaModel;
    baseURL: string;
    headers?: Record<string, string>;
    fetch?: typeof globalThis.fetch;
  }) {
    const ollama = createOllama({
      baseURL,
      fetch,
      headers,
    });

    super({ model: ollama(name) });
  }
}
