import { describe, expect, it } from 'vitest';
import {
  assertKnowledgeNoteTextWithinBound,
  assertKnowledgePageDescriptionWithinBound,
  canonicalKnowledgeName,
  knowledgePositionBetween,
  knowledgeScopeReadable,
} from './pages';

describe('knowledgePositionBetween', () => {
  it('always returns a key strictly between its neighbours, never ending in 0', () => {
    const keys = [knowledgePositionBetween()];
    let seed = 7;
    for (let i = 0; i < 500; i++) {
      seed = (seed * 48271) % 2147483647;
      const at = seed % (keys.length + 1);
      const key = knowledgePositionBetween(keys[at - 1], keys[at]);
      if (at > 0) expect(key > keys[at - 1]!).toBe(true);
      if (at < keys.length) expect(key < keys[at]!).toBe(true);
      expect(key.endsWith('0')).toBe(false);
      keys.splice(at, 0, key);
    }
    expect([...keys].sort()).toEqual(keys);
  });

  it('inserts between adjacent keys and before the first key', () => {
    expect(knowledgePositionBetween('a', 'b') > 'a').toBe(true);
    expect(knowledgePositionBetween('a', 'b') < 'b').toBe(true);
    expect(knowledgePositionBetween(undefined, '1') < '1').toBe(true);
    expect(() => knowledgePositionBetween('b', 'a')).toThrow('Invalid position range');
  });
});

describe('knowledgeScopeReadable', () => {
  const team = { address: 'team:acme:support', declaration: 'team:$orgId:$teamId', parentId: 'org-acme' };
  const internal = {
    address: 'account:acme:1/internal',
    declaration: 'account:$orgId:$accountId/internal',
    parentId: 'account-1',
  };

  it('matches exact addresses and declaration prefixes', () => {
    expect(knowledgeScopeReadable(team, { addresses: ['team:acme:support'], prefixes: [], children: [] })).toBe(true);
    expect(
      knowledgeScopeReadable(team, {
        addresses: [],
        prefixes: [{ declaration: 'team:$orgId:$teamId', prefix: 'team:acme:' }],
        children: [],
      }),
    ).toBe(true);
    expect(
      knowledgeScopeReadable(team, {
        addresses: [],
        prefixes: [{ declaration: 'team:$orgId:$teamId', prefix: 'team:globex:' }],
        children: [],
      }),
    ).toBe(false);
    expect(knowledgeScopeReadable(team, 'all')).toBe(true);
  });

  it("doesn't let a parent declaration's prefix reach a template child", () => {
    expect(
      knowledgeScopeReadable(internal, {
        addresses: [],
        prefixes: [{ declaration: 'account:$orgId:$accountId', prefix: 'account:acme:' }],
        children: [],
      }),
    ).toBe(false);
  });
});

describe('knowledgeScopeReadable prefix matching', () => {
  const read = (prefix: string) => ({
    addresses: [],
    prefixes: [{ declaration: 'team:$orgId:$teamId', prefix }],
    children: [],
  });

  it('treats _ and % as plain characters', () => {
    expect(
      knowledgeScopeReadable(
        { address: 'team:a_b:x', declaration: 'team:$orgId:$teamId', parentId: null },
        read('team:a_b:'),
      ),
    ).toBe(true);
    expect(
      knowledgeScopeReadable(
        { address: 'team:axb:x', declaration: 'team:$orgId:$teamId', parentId: null },
        read('team:a_b:'),
      ),
    ).toBe(false);
    expect(
      knowledgeScopeReadable(
        { address: 'team:ab:x', declaration: 'team:$orgId:$teamId', parentId: null },
        read('team:a%:'),
      ),
    ).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(
      knowledgeScopeReadable(
        { address: 'team:ACME:x', declaration: 'team:$orgId:$teamId', parentId: null },
        read('team:acme:'),
      ),
    ).toBe(false);
  });

  it('stops at the segment boundary core prefixes end on', () => {
    expect(
      knowledgeScopeReadable(
        { address: 'team:acmecorp:x', declaration: 'team:$orgId:$teamId', parentId: null },
        read('team:acme:'),
      ),
    ).toBe(false);
    expect(
      knowledgeScopeReadable({ address: 'team:acme:x', declaration: 'team:$orgId:$teamId', parentId: null }, read('')),
    ).toBe(true);
  });
});

describe('knowledgeScopeReadable tree-parent entries', () => {
  const resource = { address: 'resource:u1', declaration: 'resource:$resourceId', parentId: 'org-acme' };
  const read = (declaration: string, parentId: string) => ({
    addresses: [],
    prefixes: [],
    children: [{ declaration, parentId }],
  });

  it('reaches scopes of the declaration under the bound parent only', () => {
    expect(knowledgeScopeReadable(resource, read('resource:$resourceId', 'org-acme'))).toBe(true);
    expect(knowledgeScopeReadable(resource, read('resource:$resourceId', 'org-globex'))).toBe(false);
    expect(knowledgeScopeReadable(resource, read('thread:$threadId', 'org-acme'))).toBe(false);
    expect(knowledgeScopeReadable({ ...resource, parentId: null }, read('resource:$resourceId', 'org-acme'))).toBe(
      false,
    );
  });
});

describe('canonicalKnowledgeName', () => {
  it('folds case, width and whitespace for non-ASCII names the same everywhere', () => {
    expect(canonicalKnowledgeName('  Ünïcode   Pölicy ')).toBe(canonicalKnowledgeName('ünïcode pölicy'));
    expect(canonicalKnowledgeName('Ｒｅｆｕｎｄ')).toBe('refund');
  });
});

describe('page and note token bounds', () => {
  it('accepts text inside the bound and refuses text past it', () => {
    expect(() => assertKnowledgePageDescriptionWithinBound(undefined)).not.toThrow();
    expect(() => assertKnowledgePageDescriptionWithinBound('Support policy for refunds')).not.toThrow();
    expect(() => assertKnowledgePageDescriptionWithinBound('word '.repeat(200))).toThrow(/100 token limit/);
    expect(() => assertKnowledgeNoteTextWithinBound('Refunds over $500 need a manager.')).not.toThrow();
    expect(() => assertKnowledgeNoteTextWithinBound('word '.repeat(400))).toThrow(/250 token limit/);
  });
});
