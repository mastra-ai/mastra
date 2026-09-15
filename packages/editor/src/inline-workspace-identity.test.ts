import { describe, expect, it } from 'vitest';

import { createInlineWorkspaceIdentity } from './inline-workspace-identity';

describe('createInlineWorkspaceIdentity', () => {
  it('ignores top-level object property order', () => {
    expect(createInlineWorkspaceIdentity({ name: 'Workspace', autoSync: true })).toEqual(
      createInlineWorkspaceIdentity({ autoSync: true, name: 'Workspace' }),
    );
  });

  it('ignores nested object property order', () => {
    expect(createInlineWorkspaceIdentity({ search: { bm25: { k1: 1.2, b: 0.75 }, autoIndexPaths: ['docs'] } })).toEqual(
      createInlineWorkspaceIdentity({ search: { autoIndexPaths: ['docs'], bm25: { b: 0.75, k1: 1.2 } } }),
    );
  });

  it('preserves array order as part of the identity', () => {
    expect(createInlineWorkspaceIdentity({ skills: ['first', 'second'] })).not.toEqual(
      createInlineWorkspaceIdentity({ skills: ['second', 'first'] }),
    );
  });

  it('changes identity when a configuration value changes', () => {
    const first = createInlineWorkspaceIdentity({ name: 'Workspace', autoSync: true });
    const second = createInlineWorkspaceIdentity({ name: 'Workspace', autoSync: false });

    expect(first).not.toEqual(second);
    expect(first.workspaceId).toBe(`inline-${first.configHash}`);
    expect(first.configHash).toMatch(/^[a-f0-9]{12}$/);
  });
});
