import { Firecrawl } from 'firecrawl';
import type { FirecrawlClientOptions as SdkClientOptions } from 'firecrawl';

export type FirecrawlClientOptions = SdkClientOptions;
export type FirecrawlClient = Firecrawl;

export function getFirecrawlClient(config?: FirecrawlClientOptions): FirecrawlClient {
  const apiKey = config?.apiKey ?? process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Firecrawl API key is required. Pass { apiKey } or set the FIRECRAWL_API_KEY environment variable.',
    );
  }

  return new Firecrawl({ ...config, apiKey });
}

export function createLazyFirecrawlClient(config?: FirecrawlClientOptions): () => FirecrawlClient {
  let client: FirecrawlClient | undefined;

  return () => {
    client ??= getFirecrawlClient(config);
    return client;
  };
}
