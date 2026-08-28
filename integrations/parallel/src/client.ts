import Parallel from 'parallel-web';
import type { ClientOptions } from 'parallel-web';

export type ParallelClientOptions = ClientOptions;
export type ParallelClient = Parallel;

export function getParallelClient(config?: ParallelClientOptions): ParallelClient {
  const apiKey = config?.apiKey ?? process.env.PARALLEL_API_KEY;
  if (!apiKey) {
    throw new Error('Parallel API key is required. Pass { apiKey } or set the PARALLEL_API_KEY environment variable.');
  }

  return new Parallel({ ...config, apiKey });
}

export function createLazyParallelClient(config?: ParallelClientOptions): () => ParallelClient {
  let client: ParallelClient | undefined;

  return () => {
    client ??= getParallelClient(config);
    return client;
  };
}
