import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { formatUnits, type Hash } from 'viem';
import { getPublicClient } from '../client';
import { wrapError } from '../utils';

export const getTransaction = createTool({
  id: 'evm-get-transaction',
  description: 'Fetch full transaction details by hash, including sender, recipient, value, gas, and status.',
  inputSchema: z.object({
    hash: z.string().describe('The transaction hash (0x format)'),
    chainId: z.number().default(1).describe('Chain ID'),
    rpcUrl: z.string().optional().describe('Custom RPC endpoint URL'),
  }),
  outputSchema: z.object({
    hash: z.string(),
    from: z.string(),
    to: z.string().nullable(),
    value: z.string(),
    valueFormatted: z.string(),
    symbol: z.string(),
    gasPrice: z.string().nullable(),
    blockNumber: z.string().nullable(),
    status: z.string(),
    chainId: z.number(),
  }),
  execute: async ({ hash, chainId, rpcUrl }) => {
    try {
      const client = getPublicClient(chainId, rpcUrl);
      const txHash = hash as Hash;
      const decimals = client.chain?.nativeCurrency.decimals ?? 18;
      const symbol = client.chain?.nativeCurrency.symbol || 'ETH';

      const [tx, receipt] = await Promise.all([
        client.getTransaction({ hash: txHash }),
        client.getTransactionReceipt({ hash: txHash }).catch(() => null),
      ]);

      let status = 'pending';
      if (receipt) {
        status = receipt.status === 'success' ? 'success' : 'reverted';
      }

      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to ?? null,
        value: tx.value.toString(),
        valueFormatted: formatUnits(tx.value, decimals),
        symbol,
        gasPrice: tx.gasPrice?.toString() ?? null,
        blockNumber: tx.blockNumber?.toString() ?? null,
        status,
        chainId,
      };
    } catch (error) {
      wrapError(`Failed to get transaction ${hash} on chain ${chainId}`, error);
    }
  },
});
