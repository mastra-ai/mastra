import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getPublicClient } from '../client';
import { wrapError } from '../utils';

export const getBlock = createTool({
  id: 'evm-get-block',
  description: 'Get block information by block number. Omit blockNumber to get the latest block. Returns timestamp, gas used, transaction count, and base fee.',
  inputSchema: z.object({
    blockNumber: z.number().optional().describe('Block number to query. Omit to get the latest block.'),
    chainId: z.number().default(1).describe('Chain ID'),
    rpcUrl: z.string().url().optional().describe('Custom RPC endpoint URL'),
  }),
  outputSchema: z.object({
    number: z.string(),
    hash: z.string().nullable(),
    timestamp: z.string(),
    timestampDate: z.string(),
    gasUsed: z.string(),
    gasLimit: z.string(),
    baseFeePerGas: z.string().nullable(),
    transactionCount: z.number(),
    chainId: z.number(),
  }),
  execute: async ({ blockNumber, chainId, rpcUrl }) => {
    try {
      const client = getPublicClient(chainId, rpcUrl);

      if (blockNumber !== undefined && (!Number.isInteger(blockNumber) || blockNumber < 0)) {
        throw new Error('blockNumber must be a non-negative integer');
      }

      const block = blockNumber !== undefined
        ? await client.getBlock({ blockNumber: BigInt(blockNumber) })
        : await client.getBlock();

      return {
        number: block.number?.toString() || '0',
        hash: block.hash ?? null,
        timestamp: block.timestamp.toString(),
        timestampDate: new Date(Number(block.timestamp) * 1000).toISOString(),
        gasUsed: block.gasUsed.toString(),
        gasLimit: block.gasLimit.toString(),
        baseFeePerGas: block.baseFeePerGas?.toString() ?? null,
        transactionCount: block.transactions.length,
        chainId,
      };
    } catch (error) {
      wrapError(`Failed to get block ${blockNumber ?? 'latest'} on chain ${chainId}`, error);
    }
  },
});
