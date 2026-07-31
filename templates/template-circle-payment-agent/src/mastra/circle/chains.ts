// Adapted from Circle's agent-stack-starter-kits.
// Copyright 2026 Circle Internet Group, Inc.
// SPDX-License-Identifier: Apache-2.0

export type Chain = 'BASE' | 'POLYGON';

export const CHAIN_VALUES = ['BASE', 'POLYGON'] as const satisfies readonly Chain[];

export const DEFAULT_CHAIN: Chain = 'BASE';

interface ChainInfo {
  cli: string;
  label: string;
  rpcUrl: string;
  networks: string[];
}

const CHAINS: Record<Chain, ChainInfo> = {
  BASE: {
    cli: 'BASE',
    label: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    networks: ['eip155:8453', 'base'],
  },
  POLYGON: {
    // The CLI still calls Polygon MATIC. `networks` lists the x402 `accepts[].network`
    // ids sellers use, which are CAIP-2 or a short name depending on the seller.
    cli: 'MATIC',
    label: 'Polygon',
    rpcUrl: 'https://polygon-rpc.com',
    networks: ['eip155:137', 'polygon', 'matic'],
  },
};

// Polygon is used only when a seller does not offer Base.
export const CHAIN_PREFERENCE: readonly Chain[] = ['BASE', 'POLYGON'];

export function chainCli(chain: Chain): string {
  return CHAINS[chain].cli;
}

export function chainLabel(chain: Chain): string {
  return CHAINS[chain].label;
}

export function chainRpcUrl(chain: Chain): string {
  return CHAINS[chain].rpcUrl;
}

export function chainFromNetwork(network: string): Chain | null {
  const n = network.toLowerCase();
  for (const chain of CHAIN_PREFERENCE) {
    if (CHAINS[chain].networks.includes(n)) return chain;
  }
  return null;
}
