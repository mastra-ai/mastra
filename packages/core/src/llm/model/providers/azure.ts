import { createAzure } from '@ai-sdk/azure';
import { OpenAIChatSettings } from '@ai-sdk/openai/internal';
import { extractReasoningMiddleware, wrapLanguageModel } from 'ai';

import { MastraLLM } from '../model';

export type AzureModel = 'gpt-35-turbo-instruct' | (string & {});

export class Azure extends MastraLLM {
  constructor({
    name = 'gpt-35-turbo-instruct',
    resourceName = process.env.AZURE_RESOURCE_NAME || '',
    apiKey = process.env.AZURE_API_KEY || '',
    apiVersion,
    baseURL,
    headers,
    fetch,
    settings,
  }: {
    name?: AzureModel;
    resourceName?: string;
    apiKey?: string;
    apiVersion?: string;
    baseURL?: string;
    headers?: Record<string, string>;
    fetch?: typeof globalThis.fetch;
    settings?: OpenAIChatSettings;
  }) {
    const azure = createAzure({
      resourceName,
      apiKey,
      apiVersion,
      baseURL,
      headers,
      fetch,
    });

    super({ model: azure(name, settings) });
  }
}

export class AzureReasoning extends MastraLLM {
  constructor({
    name = 'gpt-35-turbo-instruct',
    resourceName = process.env.AZURE_RESOURCE_NAME || '',
    apiKey = process.env.AZURE_API_KEY || '',
    apiVersion,
    baseURL,
    headers,
    fetch,
    settings,
  }: {
    name?: AzureModel;
    resourceName?: string;
    apiKey?: string;
    apiVersion?: string;
    baseURL?: string;
    headers?: Record<string, string>;
    fetch?: typeof globalThis.fetch;
    settings?: OpenAIChatSettings;
  }) {
    const azure = createAzure({
      resourceName,
      apiKey,
      apiVersion,
      baseURL,
      headers,
      fetch,
    });

    const enhancedModel = wrapLanguageModel({
      model: azure(name, settings),
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    });

    super({ model: enhancedModel });
  }
}
