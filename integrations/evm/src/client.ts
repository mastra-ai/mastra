import { createPublicClient, http, type PublicClient, type Transport, type Chain } from 'viem';
import { getChain } from './chains';

const clientCache = new Map<string, PublicClient<Transport, Chain>>();

export function getPublicClient(chainId: number, rpcUrl?: string): PublicClient<Transport, Chain> {
  const cacheKey = `${chainId}:${rpcUrl || 'default'}`;

  const cached = clientCache.get(cacheKey);
  if (cached) return cached;

  const chain = getChain(chainId);
  const transport = rpcUrl ? http(rpcUrl) : http();

  const client = createPublicClient({ chain, transport });
  clientCache.set(cacheKey, client);

  return client;
}
