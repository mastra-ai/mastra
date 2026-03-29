import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getPublicClient } from '../client';
import { validateAddress, serializeBigInts, wrapError } from '../utils';

const abiEntrySchema = z
  .object({
    type: z.string(),
    name: z.string().optional(),
    inputs: z.array(z.record(z.unknown())).optional(),
    outputs: z.array(z.record(z.unknown())).optional(),
    stateMutability: z.string().optional(),
  })
  .passthrough();

export const readContract = createTool({
  id: 'evm-read-contract',
  description:
    'Read data from any smart contract by calling a view/pure function. Provide the contract address, the ABI for the function you want to call, and its arguments.',
  inputSchema: z.object({
    contractAddress: z.string().describe('The smart contract address (0x format)'),
    abi: z.array(abiEntrySchema).max(10).describe('The contract ABI entries. Only include the function you want to call. Each entry needs at minimum: type, name, inputs, outputs, stateMutability.'),
    functionName: z.string().describe('The function name to call'),
    args: z.array(z.unknown()).default([]).describe('Function arguments as an ordered array'),
    chainId: z.number().default(1).describe('Chain ID'),
    rpcUrl: z.string().url().optional().describe('Custom RPC endpoint URL'),
  }),
  outputSchema: z.object({
    result: z.unknown(),
    contractAddress: z.string(),
    functionName: z.string(),
    chainId: z.number(),
  }),
  execute: async ({ contractAddress, abi, functionName, args, chainId, rpcUrl }) => {
    try {
      const addr = validateAddress(contractAddress);
      const client = getPublicClient(chainId, rpcUrl);

      const result = await client.readContract({
        address: addr,
        abi,
        functionName,
        args,
      });

      return {
        result: serializeBigInts(result),
        contractAddress: addr,
        functionName,
        chainId,
      };
    } catch (error) {
      wrapError(`Failed to call ${functionName}() on ${contractAddress} (chain ${chainId})`, error);
    }
  },
});
