import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { formatEther, type Address } from 'viem';
import { getPublicClient } from '../client';

export const getBalance = createTool({
  id: 'evm-get-balance',
  description:
    'Get the native token balance (ETH, MATIC, AVAX, etc.) of an address on any EVM chain. Returns both raw wei and human-readable format.',
  inputSchema: z.object({
    address: z.string().describe('The wallet address to check (0x format)'),
    chainId: z.number().default(1).describe('Chain ID (1=Ethereum, 137=Polygon, 42161=Arbitrum, 8453=Base, etc.)'),
    rpcUrl: z.string().optional().describe('Custom RPC endpoint URL. Uses public RPC if omitted.'),
  }),
  outputSchema: z.object({
    address: z.string(),
    balanceWei: z.string(),
    balanceFormatted: z.string(),
    symbol: z.string(),
    chainId: z.number(),
    chainName: z.string(),
  }),
  execute: async ({ address, chainId, rpcUrl }) => {
    const client = getPublicClient(chainId, rpcUrl);
    const balance = await client.getBalance({ address: address as Address });

    return {
      address,
      balanceWei: balance.toString(),
      balanceFormatted: formatEther(balance),
      symbol: client.chain?.nativeCurrency.symbol || 'ETH',
      chainId,
      chainName: client.chain?.name || 'Unknown',
    };
  },
});
