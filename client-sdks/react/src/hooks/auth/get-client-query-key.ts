import type { MastraClient } from '@mastra/client-js';

const clientQueryKeys = new WeakMap<MastraClient, number>();
let nextClientQueryKey = 0;

/**
 * Returns a stable, non-sensitive query key for a Mastra client instance.
 * A new client is created whenever its connection options change.
 */
export function getClientQueryKey(client: MastraClient) {
  const existingKey = clientQueryKeys.get(client);
  if (existingKey !== undefined) return existingKey;

  const queryKey = nextClientQueryKey++;
  clientQueryKeys.set(client, queryKey);
  return queryKey;
}
