import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { formatUnits } from 'viem';
import { getPublicClient } from '../client';
import { validateAddress, wrapError } from '../utils';

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
    try {
      const addr = validateAddress(address);
      const client = getPublicClient(chainId, rpcUrl);
      const balance = await client.getBalance({ address: addr });
      const decimals = client.chain?.nativeCurrency.decimals ?? 18;

      return {
        address: addr,
        balanceWei: balance.toString(),
        balanceFormatted: formatUnits(balance, decimals),
        symbol: client.chain?.nativeCurrency.symbol || 'ETH',
        chainId,
        chainName: client.chain?.name || 'Unknown',
      };
    } catch (error) {
      wrapError(`Failed to get balance for ${address} on chain ${chainId}`, error);
    }
  },
});
