import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { formatEther, type Hash } from 'viem';
import { getPublicClient } from '../client';

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
    gasPrice: z.string().nullable(),
    blockNumber: z.string().nullable(),
    status: z.string(),
    chainId: z.number(),
  }),
  execute: async ({ hash, chainId, rpcUrl }) => {
    const client = getPublicClient(chainId, rpcUrl);
    const txHash = hash as Hash;

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
      valueFormatted: formatEther(tx.value),
      gasPrice: tx.gasPrice?.toString() ?? null,
      blockNumber: tx.blockNumber?.toString() ?? null,
      status,
      chainId,
    };
  },
});
