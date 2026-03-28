import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { type Address, formatUnits } from 'viem';
import { getPublicClient } from '../client';

const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

export const getTokenBalance = createTool({
  id: 'evm-get-token-balance',
  description:
    'Get the ERC-20 token balance of an address. Automatically fetches token symbol, name, and decimals for formatting.',
  inputSchema: z.object({
    address: z.string().describe('The wallet address to check (0x format)'),
    tokenAddress: z.string().describe('The ERC-20 token contract address (0x format)'),
    chainId: z.number().default(1).describe('Chain ID'),
    rpcUrl: z.string().optional().describe('Custom RPC endpoint URL'),
  }),
  outputSchema: z.object({
    address: z.string(),
    tokenAddress: z.string(),
    balanceRaw: z.string(),
    balanceFormatted: z.string(),
    decimals: z.number(),
    symbol: z.string(),
    name: z.string(),
    chainId: z.number(),
  }),
  execute: async ({ address, tokenAddress, chainId, rpcUrl }) => {
    const client = getPublicClient(chainId, rpcUrl);
    const addr = address as Address;
    const token = tokenAddress as Address;

    const [balance, decimals, symbol, name] = await Promise.all([
      client.readContract({ address: token, abi: ERC20_ABI, functionName: 'balanceOf', args: [addr] }),
      client.readContract({ address: token, abi: ERC20_ABI, functionName: 'decimals' }),
      client.readContract({ address: token, abi: ERC20_ABI, functionName: 'symbol' }),
      client.readContract({ address: token, abi: ERC20_ABI, functionName: 'name' }),
    ]);

    return {
      address,
      tokenAddress,
      balanceRaw: balance.toString(),
      balanceFormatted: formatUnits(balance, decimals),
      decimals,
      symbol,
      name,
      chainId,
    };
  },
});
