import { describe, it, expect } from 'vitest';
import { validateAddress, serializeBigInts, wrapError } from './utils';

describe('validateAddress', () => {
  it('accepts valid checksummed address', () => {
    const result = validateAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    expect(result).toBe('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
  });

  it('accepts valid lowercase address and returns checksummed', () => {
    const result = validateAddress('0xd8da6bf26964af9d7eed9e03e53415d37aa96045');
    expect(result).toBe('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
  });

  it('rejects invalid address', () => {
    expect(() => validateAddress('not-an-address')).toThrow('Invalid EVM address');
  });

  it('rejects address with invalid hex characters', () => {
    expect(() => validateAddress('0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG')).toThrow('Invalid EVM address');
  });

  it('rejects short address', () => {
    expect(() => validateAddress('0x1234')).toThrow('Invalid EVM address');
  });
});

describe('serializeBigInts', () => {
  it('serializes a bigint to string', () => {
    expect(serializeBigInts(123n)).toBe('123');
  });

  it('passes through non-bigint values', () => {
    expect(serializeBigInts('hello')).toBe('hello');
    expect(serializeBigInts(42)).toBe(42);
    expect(serializeBigInts(null)).toBe(null);
    expect(serializeBigInts(true)).toBe(true);
  });

  it('serializes bigints in arrays', () => {
    expect(serializeBigInts([1n, 2n, 3n])).toEqual(['1', '2', '3']);
  });

  it('serializes bigints in nested objects', () => {
    const input = { a: 1n, b: { c: 2n, d: 'hello' }, e: [3n] };
    expect(serializeBigInts(input)).toEqual({ a: '1', b: { c: '2', d: 'hello' }, e: ['3'] });
  });

  it('handles Uniswap-style tuple returns', () => {
    const slot0 = { sqrtPriceX96: 1234567890123456789012345678n, tick: -42000n, fee: 3000 };
    const result = serializeBigInts(slot0) as Record<string, unknown>;
    expect(result.sqrtPriceX96).toBe('1234567890123456789012345678');
    expect(result.tick).toBe('-42000');
    expect(result.fee).toBe(3000);
  });
});

describe('wrapError', () => {
  it('wraps Error instances with context', () => {
    expect(() => wrapError('Test context', new Error('original'))).toThrow('Test context: original');
  });

  it('wraps non-Error values', () => {
    expect(() => wrapError('Test context', 'string error')).toThrow('Test context: string error');
  });
});
