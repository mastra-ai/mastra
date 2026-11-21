import Ceramic from 'ceramic-ai';
import type { ClientOptions } from 'ceramic-ai';

export type CeramicClientOptions = ClientOptions;
export type CeramicClient = Ceramic;

export function getCeramicClient(config?: CeramicClientOptions): CeramicClient {
  const apiKey = config?.apiKey ?? process.env.CERAMIC_API_KEY;
  if (!apiKey) {
    throw new Error('Ceramic API key is required. Pass { apiKey } or set the CERAMIC_API_KEY environment variable.');
  }

  const fetch = config?.fetch ?? globalThis.fetch;

  return new Ceramic({
    ...config,
    apiKey,
    fetch: (url, init) => {
      const headers = new Headers(init?.headers);
      // Project-wide aggregate usage attribution. Append at the transport boundary to
      // preserve SDK/caller headers and keep attribution on subsequent requests and retries.
      headers.set('User-Agent', [headers.get('User-Agent'), 'mastra'].filter(Boolean).join(' '));
      return fetch(url, { ...init, headers });
    },
  });
}

export function createLazyCeramicClient(config?: CeramicClientOptions): () => CeramicClient {
  let client: CeramicClient | undefined;

  return () => {
    client ??= getCeramicClient(config);
    return client;
  };
}
