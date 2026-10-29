import { describe, expect, it } from 'vitest';
import { canonicalKnowledgeName, knowledgePositionBetween, knowledgeScopeReadable } from './pages';

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
  const team = { address: 'team:acme:support', declaration: 'team:$orgId:$teamId' };
  const internal = { address: 'account:acme:1/internal', declaration: 'account:$orgId:$accountId/internal' };

  it('matches exact addresses and declaration prefixes', () => {
    expect(knowledgeScopeReadable(team, { addresses: ['team:acme:support'], prefixes: [] })).toBe(true);
    expect(
      knowledgeScopeReadable(team, {
        addresses: [],
        prefixes: [{ declaration: 'team:$orgId:$teamId', prefix: 'team:acme:' }],
      }),
    ).toBe(true);
    expect(
      knowledgeScopeReadable(team, {
        addresses: [],
        prefixes: [{ declaration: 'team:$orgId:$teamId', prefix: 'team:globex:' }],
      }),
    ).toBe(false);
    expect(knowledgeScopeReadable(team, 'all')).toBe(true);
  });

  it("doesn't let a parent declaration's prefix reach a template child", () => {
    expect(
      knowledgeScopeReadable(internal, {
        addresses: [],
        prefixes: [{ declaration: 'account:$orgId:$accountId', prefix: 'account:acme:' }],
      }),
    ).toBe(false);
  });
});

describe('canonicalKnowledgeName', () => {
  it('folds case, width and whitespace for non-ASCII names the same everywhere', () => {
    expect(canonicalKnowledgeName('  Ünïcode   Pölicy ')).toBe(canonicalKnowledgeName('ünïcode pölicy'));
    expect(canonicalKnowledgeName('Ｒｅｆｕｎｄ')).toBe('refund');
  });
});
