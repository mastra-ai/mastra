import { describe, it, expect } from 'vitest';
import { getChain, SUPPORTED_CHAINS } from './chains';

describe('Chain Support', () => {
  it('supports Ethereum mainnet (chainId 1)', () => {
    const chain = getChain(1);
    expect(chain.name).toBe('Ethereum');
    expect(chain.id).toBe(1);
  });

  it('supports Polygon (chainId 137)', () => {
    const chain = getChain(137);
    expect(chain.name).toBe('Polygon');
  });

  it('supports Arbitrum (chainId 42161)', () => {
    const chain = getChain(42161);
    expect(chain.name).toBe('Arbitrum One');
  });

  it('supports Base (chainId 8453)', () => {
    const chain = getChain(8453);
    expect(chain.name).toBe('Base');
  });

  it('throws for unsupported chain ID', () => {
    expect(() => getChain(999999)).toThrow('Unsupported chain ID: 999999');
  });

  it('has at least 10 supported chains', () => {
    expect(Object.keys(SUPPORTED_CHAINS).length).toBeGreaterThanOrEqual(10);
  });

  it('all chains have valid id and name', () => {
    for (const [id, chain] of Object.entries(SUPPORTED_CHAINS)) {
      expect(chain.id).toBe(Number(id));
      expect(chain.name).toBeTruthy();
    }
  });
});
