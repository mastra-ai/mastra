import {
  mainnet,
  sepolia,
  arbitrum,
  optimism,
  polygon,
  base,
  avalanche,
  bsc,
  gnosis,
  fantom,
  celo,
  zora,
  scroll,
  linea,
  blast,
  type Chain,
} from 'viem/chains';

export const SUPPORTED_CHAINS: Record<number, Chain> = {
  [mainnet.id]: mainnet,
  [sepolia.id]: sepolia,
  [arbitrum.id]: arbitrum,
  [optimism.id]: optimism,
  [polygon.id]: polygon,
  [base.id]: base,
  [avalanche.id]: avalanche,
  [bsc.id]: bsc,
  [gnosis.id]: gnosis,
  [fantom.id]: fantom,
  [celo.id]: celo,
  [zora.id]: zora,
  [scroll.id]: scroll,
  [linea.id]: linea,
  [blast.id]: blast,
};

export function getChain(chainId: number): Chain {
  const chain = SUPPORTED_CHAINS[chainId];
  if (!chain) {
    const supported = Object.entries(SUPPORTED_CHAINS)
      .map(([id, c]) => `${c.name} (${id})`)
      .join(', ');
    throw new Error(`Unsupported chain ID: ${chainId}. Supported: ${supported}`);
  }
  return chain;
}
