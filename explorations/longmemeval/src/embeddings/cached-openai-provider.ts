import { openai as originalOpenAI, createOpenAI } from '@ai-sdk/openai';
import { OpenAIProvider } from '@ai-sdk/openai';
import { CachedOpenAIEmbeddingModel } from './cached-openai-embedding-model';
import { join } from 'path';

export interface CachedOpenAIOptions {
  apiKey?: string;
  cacheDir?: string;
  baseURL?: string;
  headers?: Record<string, string>;
}

export function createCachedOpenAI(options: CachedOpenAIOptions = {}) {
  // Create the original OpenAI provider
  const provider = createOpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseURL,
    headers: options.headers,
  });

  // Create a proxy that intercepts embedding model creation
  return new Proxy(provider, {
    get(target, prop, receiver) {
      if (prop === 'embedding') {
        // Return a function that creates cached embedding models
        return (modelId: string) => {
          const originalModel = target.embedding(modelId);
          const cacheDir = options.cacheDir || join(process.cwd(), '.embedding-cache', modelId);
          return new CachedOpenAIEmbeddingModel(originalModel, cacheDir);
        };
      }

      // For all other properties, use the original
      return Reflect.get(target, prop, receiver);
    },
  });
}

// Export a default cached OpenAI instance
export const cachedOpenAI = createCachedOpenAI();
