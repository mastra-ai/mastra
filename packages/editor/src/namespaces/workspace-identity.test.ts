import { describe, it, expect } from 'vitest';

import { computeInlineWorkspaceIdentity, stableStringify } from './workspace-identity';

describe('computeInlineWorkspaceIdentity', () => {
  it('produces the same identity when top-level keys are reordered', () => {
    const a = computeInlineWorkspaceIdentity({ name: 'Workspace', autoSync: true });
    const b = computeInlineWorkspaceIdentity({ autoSync: true, name: 'Workspace' });

    expect(a.workspaceId).toBe(b.workspaceId);
    expect(a.configHash).toBe(b.configHash);
    expect(a.workspaceId).toBe(`inline-${a.configHash}`);
  });

  it('produces the same identity when nested object keys are reordered', () => {
    const a = computeInlineWorkspaceIdentity({ name: 'Workspace', search: { limit: 10, provider: 'x' } });
    const b = computeInlineWorkspaceIdentity({ search: { provider: 'x', limit: 10 }, name: 'Workspace' });

    expect(a.workspaceId).toBe(b.workspaceId);
    expect(a.configHash).toBe(b.configHash);
  });

  it('produces a different identity when array order changes', () => {
    const a = computeInlineWorkspaceIdentity({ tools: ['a', 'b'] });
    const b = computeInlineWorkspaceIdentity({ tools: ['b', 'a'] });

    expect(a.workspaceId).not.toBe(b.workspaceId);
  });

  it('produces a different identity when a value changes', () => {
    const a = computeInlineWorkspaceIdentity({ name: 'Workspace', autoSync: true });
    const b = computeInlineWorkspaceIdentity({ name: 'Workspace', autoSync: false });

    expect(a.workspaceId).not.toBe(b.workspaceId);
  });
});

describe('stableStringify', () => {
  it('sorts object keys recursively while preserving array order', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(stableStringify({ outer: { z: 1, a: 2 } })).toBe('{"outer":{"a":2,"z":1}}');
    expect(stableStringify({ list: [3, 1, 2] })).toBe('{"list":[3,1,2]}');
  });
});
