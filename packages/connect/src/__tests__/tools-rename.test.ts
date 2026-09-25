import { describe, expect, it, vi } from 'vitest';

import { connect } from '../connect.js';
import { tools } from '../tools.js';

describe('tools()/connect() rename', () => {
  it('exports `tools` and a deprecated `connect` alias', () => {
    // Structural equality: both are callables with the same resolver methods.
    expect(typeof tools).toBe('function');
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect(typeof connect).toBe('function');
  });

  it('produces a resolver with the same shape from either entry point', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const resolverA = tools({ projectId: 'proj_1', client: { accessToken: 't' } });
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const resolverB = connect({ projectId: 'proj_1', client: { accessToken: 't' } });

      for (const resolver of [resolverA, resolverB]) {
        expect(typeof resolver).toBe('function');
        expect(typeof resolver.invalidate).toBe('function');
        expect(typeof resolver.refresh).toBe('function');
        expect(typeof resolver.disconnect).toBe('function');
      }
    } finally {
      warn.mockRestore();
    }
  });

  it('validates options the same way from either entry point', () => {
    expect(() => tools({ ttlMs: -1, projectId: 'p', client: { accessToken: 't' } })).toThrow(/Invalid ttlMs/);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect(() => connect({ ttlMs: -1, projectId: 'p', client: { accessToken: 't' } })).toThrow(/Invalid ttlMs/);
  });
});
