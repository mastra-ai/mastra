import Exa from 'exa-js';

export interface ExaClientOptions {
  /**
   * Exa API key. If omitted, falls back to `process.env.EXA_API_KEY`.
   */
  apiKey?: string;
  /**
   * Override the Exa API base URL. Useful for proxies or self-hosted gateways.
   */
  baseURL?: string;
}

export type ExaClient = Exa;

const INTEGRATION_HEADER = 'mastra';

export function getExaClient(config?: ExaClientOptions): ExaClient {
  const apiKey = config?.apiKey ?? process.env.EXA_API_KEY;
  if (!apiKey) {
    throw new Error('Exa API key is required. Pass { apiKey } or set EXA_API_KEY env var.');
  }

  const client = new Exa(apiKey, config?.baseURL);

  // Attribute API usage to the Mastra integration. The `headers` field on
  // the Exa client is a Headers-like object with a `.set()` method.
  const headers = (client as unknown as { headers?: { set?: (k: string, v: string) => void } }).headers;
  if (headers && typeof headers.set === 'function') {
    headers.set('x-exa-integration', INTEGRATION_HEADER);
  }

  return client;
}
