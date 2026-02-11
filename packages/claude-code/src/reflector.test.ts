import { describe, it, expect } from 'vitest';
import { parseReflectorOutput, validateCompression } from './reflector.js';
import { TokenCounter } from './token-counter.js';

describe('parseReflectorOutput', () => {
  const tokenCounter = new TokenCounter();

  it('parses well-formed XML output', () => {
    const output = `
<observations>
Date: Jan 15, 2026
* 🔴 (14:30) User building Next.js app with Supabase auth
* 🟡 (14:45) Auth middleware implemented and working
</observations>
`;

    const result = parseReflectorOutput(output, tokenCounter);

    expect(result.observations).toContain('User building Next.js app');
    expect(result.observations).toContain('Auth middleware implemented');
    expect(result.tokenCount).toBeGreaterThan(0);
  });

  it('handles missing XML tags', () => {
    const output = `
* 🔴 (14:30) User building Next.js app
* 🟡 (14:45) Auth middleware implemented
`;

    const result = parseReflectorOutput(output, tokenCounter);
    expect(result.observations).toContain('User building Next.js app');
    expect(result.tokenCount).toBeGreaterThan(0);
  });
});

describe('validateCompression', () => {
  it('returns true when compression succeeds', () => {
    expect(validateCompression(5000, 10000)).toBe(true);
  });

  it('returns false when compression fails', () => {
    expect(validateCompression(15000, 10000)).toBe(false);
  });

  it('returns false when equal to threshold', () => {
    expect(validateCompression(10000, 10000)).toBe(false);
  });
});
