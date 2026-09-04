import { describe, expect, it } from 'vitest';

import { InProcessSandboxAddressRegistry } from './address-registry.js';

describe('InProcessSandboxAddressRegistry', () => {
  it('returns undefined for an unknown sandbox id', () => {
    const registry = new InProcessSandboxAddressRegistry();
    expect(registry.get('sbx_missing')).toBeUndefined();
  });

  it('round-trips a set → get', () => {
    const registry = new InProcessSandboxAddressRegistry();
    registry.set('sbx_1', 'http://[fd12::1]:47000');
    expect(registry.get('sbx_1')).toBe('http://[fd12::1]:47000');
  });

  it('overwrites on repeat set', () => {
    const registry = new InProcessSandboxAddressRegistry();
    registry.set('sbx_1', 'http://[fd12::1]:47000');
    registry.set('sbx_1', 'http://[fd12::2]:47000');
    expect(registry.get('sbx_1')).toBe('http://[fd12::2]:47000');
  });

  it('delete removes the entry and is a no-op on unknown ids', () => {
    const registry = new InProcessSandboxAddressRegistry();
    registry.set('sbx_1', 'http://[fd12::1]:47000');
    registry.delete('sbx_1');
    expect(registry.get('sbx_1')).toBeUndefined();
    // No throw on unknown id.
    registry.delete('sbx_missing');
  });

  it('tracks isolated entries for independent sandbox ids', () => {
    const registry = new InProcessSandboxAddressRegistry();
    registry.set('sbx_a', 'http://[fd12::a]:47000');
    registry.set('sbx_b', 'http://[fd12::b]:47000');
    expect(registry.get('sbx_a')).toBe('http://[fd12::a]:47000');
    expect(registry.get('sbx_b')).toBe('http://[fd12::b]:47000');
    expect(registry.size).toBe(2);
  });
});
