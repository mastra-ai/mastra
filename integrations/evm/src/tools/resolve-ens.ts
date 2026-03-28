import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { type Address } from 'viem';
import { normalize } from 'viem/ens';
import { getPublicClient } from '../client';

export const resolveEns = createTool({
  id: 'evm-resolve-ens',
  description:
    'Resolve an ENS name to an Ethereum address, or reverse-resolve an address to its ENS name. Works on Ethereum mainnet.',
  inputSchema: z.object({
    nameOrAddress: z.string().describe('Either an ENS name (e.g. "vitalik.eth") or an Ethereum address (0x format)'),
    rpcUrl: z.string().optional().describe('Custom RPC endpoint URL for Ethereum mainnet'),
  }),
  outputSchema: z.object({
    name: z.string().nullable(),
    address: z.string().nullable(),
    direction: z.string(),
  }),
  execute: async ({ nameOrAddress, rpcUrl }) => {
    const client = getPublicClient(1, rpcUrl);

    const isAddress = nameOrAddress.startsWith('0x') && nameOrAddress.length === 42;

    if (isAddress) {
      const name = await client.getEnsName({ address: nameOrAddress as Address });
      return {
        name: name ?? null,
        address: nameOrAddress,
        direction: 'reverse',
      };
    }

    const address = await client.getEnsAddress({ name: normalize(nameOrAddress) });
    return {
      name: nameOrAddress,
      address: address ?? null,
      direction: 'forward',
    };
  },
});
