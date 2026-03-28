import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { type Address } from 'viem';
import { getPublicClient } from '../client';

export const readContract = createTool({
  id: 'evm-read-contract',
  description:
    'Read data from any smart contract by calling a view/pure function. Provide the contract address, function ABI, and arguments.',
  inputSchema: z.object({
    contractAddress: z.string().describe('The smart contract address (0x format)'),
    abi: z.array(z.record(z.unknown())).describe('The contract ABI (array of function definitions). Only include the function you want to call.'),
    functionName: z.string().describe('The function name to call'),
    args: z.array(z.unknown()).default([]).describe('Function arguments as an ordered array'),
    chainId: z.number().default(1).describe('Chain ID'),
    rpcUrl: z.string().optional().describe('Custom RPC endpoint URL'),
  }),
  outputSchema: z.object({
    result: z.unknown(),
    contractAddress: z.string(),
    functionName: z.string(),
    chainId: z.number(),
  }),
  execute: async ({ contractAddress, abi, functionName, args, chainId, rpcUrl }) => {
    const client = getPublicClient(chainId, rpcUrl);

    const result = await client.readContract({
      address: contractAddress as Address,
      abi,
      functionName,
      args,
    });

    return {
      result: typeof result === 'bigint' ? result.toString() : result,
      contractAddress,
      functionName,
      chainId,
    };
  },
});
