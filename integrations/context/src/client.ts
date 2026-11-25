import ContextDev from 'context.dev';
import type { ClientOptions } from 'context.dev';

export type ContextClientOptions = ClientOptions;
export type ContextClient = ContextDev;

export function getContextClient(config?: ContextClientOptions): ContextClient {
  const apiKey = config?.apiKey ?? process.env.CONTEXT_DEV_API_KEY;
  if (!apiKey) {
    throw new Error('Context.dev API key is required. Pass { apiKey } or set CONTEXT_DEV_API_KEY env var.');
  }
  return new ContextDev({ ...config, apiKey });
}
