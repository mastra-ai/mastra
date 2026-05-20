import { tavily } from '@tavily/core';
import type { TavilyClientOptions } from '@tavily/core';

export type { TavilyClientOptions };

export type TavilyClient = ReturnType<typeof tavily>;

export function getTavilyClient(config?: TavilyClientOptions): TavilyClient {
  const apiKey = config?.apiKey ?? process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('Tavily API key is required. Pass { apiKey } or set TAVILY_API_KEY env var.');
  }
  // defaulting `clientSource` to `mastra` if not provided
  return tavily({ ...config, apiKey, clientSource: config?.clientSource ?? 'mastra' });
}
