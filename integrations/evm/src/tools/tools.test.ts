import { describe, it, expect } from 'vitest';
import { getBalance } from './get-balance';
import { getTokenBalance } from './get-token-balance';
import { readContract } from './read-contract';
import { getTransaction } from './get-transaction';
import { resolveEns } from './resolve-ens';
import { getBlock } from './get-block';

describe('EVM Tools - Schema Validation', () => {
  it('getBalance has correct id and schemas', () => {
    expect(getBalance.id).toBe('evm-get-balance');
    expect(getBalance.description).toContain('balance');
    expect(getBalance.inputSchema).toBeDefined();
    expect(getBalance.outputSchema).toBeDefined();
    expect(getBalance.execute).toBeDefined();
  });

  it('getTokenBalance has correct id and schemas', () => {
    expect(getTokenBalance.id).toBe('evm-get-token-balance');
    expect(getTokenBalance.description).toContain('ERC-20');
    expect(getTokenBalance.inputSchema).toBeDefined();
    expect(getTokenBalance.outputSchema).toBeDefined();
  });

  it('readContract has correct id and schemas', () => {
    expect(readContract.id).toBe('evm-read-contract');
    expect(readContract.description).toContain('smart contract');
    expect(readContract.inputSchema).toBeDefined();
    expect(readContract.outputSchema).toBeDefined();
  });

  it('getTransaction has correct id and schemas', () => {
    expect(getTransaction.id).toBe('evm-get-transaction');
    expect(getTransaction.description).toContain('transaction');
    expect(getTransaction.inputSchema).toBeDefined();
    expect(getTransaction.outputSchema).toBeDefined();
  });

  it('resolveEns has correct id and schemas', () => {
    expect(resolveEns.id).toBe('evm-resolve-ens');
    expect(resolveEns.description).toContain('ENS');
    expect(resolveEns.inputSchema).toBeDefined();
    expect(resolveEns.outputSchema).toBeDefined();
  });

  it('getBlock has correct id and schemas', () => {
    expect(getBlock.id).toBe('evm-get-block');
    expect(getBlock.description).toContain('block');
    expect(getBlock.inputSchema).toBeDefined();
    expect(getBlock.outputSchema).toBeDefined();
  });
});

describe('EVM Tools - Chain Support', () => {
  it('getBalance defaults to chainId 1', () => {
    const parsed = getBalance.inputSchema.parse({
      address: '0x0000000000000000000000000000000000000000',
    });
    expect(parsed.chainId).toBe(1);
  });
});
