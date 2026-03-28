import { isAddress, getAddress } from 'viem';

export function validateAddress(input: string): `0x${string}` {
  if (!isAddress(input)) {
    throw new Error(`Invalid EVM address: "${input}". Expected a 0x-prefixed hex string (42 characters).`);
  }
  return getAddress(input);
}

export function serializeBigInts(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(serializeBigInts);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, serializeBigInts(v)]),
    );
  }
  return value;
}

export function wrapError(context: string, error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`${context}: ${message}`);
}
