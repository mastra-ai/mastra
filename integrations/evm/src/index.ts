export { getBalance, getTokenBalance, readContract, getTransaction, resolveEns, getBlock } from './tools';
export { SUPPORTED_CHAINS, getChain } from './chains';
export { getPublicClient } from './client';

export const evmTools = {
  getBalance: () => import('./tools/get-balance').then(m => m.getBalance),
  getTokenBalance: () => import('./tools/get-token-balance').then(m => m.getTokenBalance),
  readContract: () => import('./tools/read-contract').then(m => m.readContract),
  getTransaction: () => import('./tools/get-transaction').then(m => m.getTransaction),
  resolveEns: () => import('./tools/resolve-ens').then(m => m.resolveEns),
  getBlock: () => import('./tools/get-block').then(m => m.getBlock),
};
