import { describe, expect, it } from 'vitest';

import {
  backfillPriorities,
  defaultAccountLabel,
  findSameSubscription,
  isSameSubscription,
  mintAccountId,
  nextPriority,
  orderAccountsFromActive,
  planActivation,
  planRemoval,
  renameAccount,
  reorderAccounts,
  selectActivationTarget,
  sortByPriority,
} from './account-registry.js';
import type { PoolEntry } from './account-registry.js';

interface Entry extends PoolEntry {
  label: string;
  secret: string;
}

function entry(
  id: string,
  opts: { active?: boolean; identity?: string; secret?: string; priority?: number } = {},
): Entry {
  return {
    id,
    label: `label ${id}`,
    active: opts.active ?? false,
    secret: opts.secret ?? `secret-${id}`,
    ...(opts.identity !== undefined ? { identity: opts.identity } : {}),
    ...(opts.priority !== undefined ? { priority: opts.priority } : {}),
  };
}

describe('priority', () => {
  it('sorts by priority, ties and missing priorities keeping creation order', () => {
    const pool = [
      entry('a', { priority: 2 }),
      entry('b'),
      entry('c', { priority: 0 }),
      entry('d', { priority: 2 }),
      entry('e'),
    ];
    expect(ids(sortByPriority(pool))).toEqual(['c', 'a', 'd', 'b', 'e']);
    expect(ids(pool)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('gives a new account one past the highest priority', () => {
    expect(nextPriority([])).toBe(0);
    expect(nextPriority([entry('a', { priority: 4 }), entry('b'), entry('c', { priority: 1 })])).toBe(5);
  });

  it('backfills missing priorities after the existing ones, in creation order', () => {
    const pool = [entry('a'), entry('b', { priority: 3 }), entry('c')];
    expect(backfillPriorities(pool).map(e => [e.id, e.priority])).toEqual([
      ['a', 4],
      ['c', 5],
    ]);
    expect(backfillPriorities([entry('x', { priority: 0 })])).toEqual([]);
    expect(pool[0]!.priority).toBeUndefined();
  });

  it('backfilling a legacy pool reproduces its insertion order', () => {
    const pool = [entry('a'), entry('b'), entry('c')];
    const filled = backfillPriorities(pool);
    expect(ids(sortByPriority(filled))).toEqual(['a', 'b', 'c']);
  });

  it('reorders to the given ids, unlisted entries following in their current order', () => {
    const pool = [
      entry('a', { priority: 0 }),
      entry('b', { priority: 1 }),
      entry('c', { priority: 2 }),
      entry('d', { priority: 3 }),
    ];
    const changed = reorderAccounts(pool, ['c', 'a']);
    expect(changed?.map(e => [e.id, e.priority])).toEqual([
      ['c', 0],
      ['a', 1],
      ['b', 2],
    ]);
    const merged = pool.map(e => changed?.find(c => c.id === e.id) ?? e);
    expect(ids(sortByPriority(merged))).toEqual(['c', 'a', 'b', 'd']);
  });

  it('reports no changes when the order is already the requested one', () => {
    const pool = [entry('a', { priority: 0 }), entry('b', { priority: 1 })];
    expect(reorderAccounts(pool, ['a', 'b'])).toEqual([]);
  });

  it('refuses a reorder naming an unknown id or an id twice', () => {
    const pool = [entry('a', { priority: 0 }), entry('b', { priority: 1 })];
    expect(reorderAccounts(pool, ['b', 'zzz'])).toBeUndefined();
    expect(reorderAccounts(pool, ['b', 'b'])).toBeUndefined();
  });

  it('rotates in priority order rather than creation order', () => {
    const pool = [entry('a', { priority: 2, active: true }), entry('b', { priority: 0 }), entry('c', { priority: 1 })];
    expect(ids(orderAccountsFromActive(pool, 'a'))).toEqual(['a', 'b', 'c']);
    expect(ids(orderAccountsFromActive(pool, 'c'))).toEqual(['c', 'a', 'b']);
    expect(ids(orderAccountsFromActive(pool, undefined))).toEqual(['b', 'c', 'a']);
    expect(selectActivationTarget(pool)?.id).toBe('b');
  });

  it('hands over to the next entry in priority order when the active one is removed', () => {
    const pool = [entry('a', { priority: 0, active: true }), entry('b', { priority: 2 }), entry('c', { priority: 1 })];
    expect(planRemoval(pool, 'a')?.next?.id).toBe('c');
    expect(planRemoval([...pool.slice(1), { ...pool[0]!, priority: 3 }], 'a')?.next?.id).toBe('c');
  });
});

const ids = (entries: readonly PoolEntry[]) => entries.map(e => e.id);

describe('mintAccountId', () => {
  it('mints `${providerId}:${uuid}` ids that never repeat', () => {
    const a = mintAccountId('anthropic');
    const b = mintAccountId('anthropic');
    expect(a).toMatch(/^anthropic:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});

describe('defaultAccountLabel', () => {
  it('numbers accounts from the provider name', () => {
    expect(defaultAccountLabel('Anthropic (Claude Pro/Max)', 3)).toBe('Anthropic (Claude Pro/Max) account 3');
  });
});

describe('subscription matching (dedupe)', () => {
  const pool = [
    entry('p:a', { identity: 'org-1', secret: 's1' }),
    entry('p:legacy', { secret: 's2' }),
    entry('p:c', { secret: 's3' }),
  ];
  const sameSecret = (secret: string) => (e: Entry) => e.secret === secret;

  it('prefers identity over legacy id over identical credentials, across the whole pool', () => {
    // Every criterion matches a different entry; identity wins.
    expect(
      findSameSubscription(pool, { identity: 'org-1', legacyId: 'p:legacy', sameCredential: sameSecret('s3') })?.id,
    ).toBe('p:a');
    expect(
      findSameSubscription(pool, { identity: 'org-9', legacyId: 'p:legacy', sameCredential: sameSecret('s3') })?.id,
    ).toBe('p:legacy');
    expect(
      findSameSubscription(pool, { identity: 'org-9', legacyId: 'p:none', sameCredential: sameSecret('s3') })?.id,
    ).toBe('p:c');
  });

  it('finds nothing for a new subscription', () => {
    expect(
      findSameSubscription(pool, { identity: 'org-9', legacyId: 'p:none', sameCredential: sameSecret('new') }),
    ).toBeUndefined();
    expect(findSameSubscription(pool, {})).toBeUndefined();
  });

  it('does not treat a missing identity as a match for identity-less entries', () => {
    expect(isSameSubscription(entry('p:x'), { identity: undefined })).toBe(false);
  });

  it('isSameSubscription matches on any one criterion', () => {
    expect(isSameSubscription(pool[0]!, { identity: 'org-1' })).toBe(true);
    expect(isSameSubscription(pool[1]!, { legacyId: 'p:legacy' })).toBe(true);
    expect(isSameSubscription(pool[2]!, { sameCredential: sameSecret('s3') })).toBe(true);
    expect(
      isSameSubscription(pool[2]!, { identity: 'org-1', legacyId: 'p:legacy', sameCredential: sameSecret('s1') }),
    ).toBe(false);
  });
});

describe('orderAccountsFromActive', () => {
  const pool = [entry('p:a'), entry('p:b'), entry('p:c')];

  it('starts at the active entry and wraps once in insertion order', () => {
    expect(ids(orderAccountsFromActive(pool, 'p:b'))).toEqual(['p:b', 'p:c', 'p:a']);
    expect(ids(orderAccountsFromActive(pool, 'p:c'))).toEqual(['p:c', 'p:a', 'p:b']);
  });

  it('is plain insertion order with no or an unknown active id', () => {
    expect(ids(orderAccountsFromActive(pool, undefined))).toEqual(['p:a', 'p:b', 'p:c']);
    expect(ids(orderAccountsFromActive(pool, 'p:gone'))).toEqual(['p:a', 'p:b', 'p:c']);
  });

  it('never mutates the input', () => {
    const order = orderAccountsFromActive(pool, 'p:a');
    expect(order).not.toBe(pool);
    expect(ids(pool)).toEqual(['p:a', 'p:b', 'p:c']);
  });
});

describe('activation', () => {
  it('rotates to the entry after the active one, wrapping to the front', () => {
    expect(selectActivationTarget([entry('p:a', { active: true }), entry('p:b'), entry('p:c')])?.id).toBe('p:b');
    expect(selectActivationTarget([entry('p:a'), entry('p:b'), entry('p:c', { active: true })])?.id).toBe('p:a');
  });

  it('rotates to the first entry when none is active', () => {
    expect(selectActivationTarget([entry('p:a'), entry('p:b')])?.id).toBe('p:a');
  });

  it('has nothing to rotate to in a pool of zero or one', () => {
    expect(selectActivationTarget([])).toBeUndefined();
    expect(selectActivationTarget([entry('p:a', { active: true })])).toBeUndefined();
  });

  it('targets the named entry, or nothing when it is not in the pool', () => {
    const pool = [entry('p:a', { active: true }), entry('p:b')];
    expect(selectActivationTarget(pool, 'p:a')?.id).toBe('p:a');
    expect(selectActivationTarget(pool, 'p:b')?.id).toBe('p:b');
    expect(selectActivationTarget(pool, 'p:gone')).toBeUndefined();
    expect(planActivation(pool, 'p:gone')).toBeUndefined();
  });

  it('plans exactly one active entry, healing a multi-active pool', () => {
    const pool = [
      entry('p:a', { active: true }),
      entry('p:b', { active: true }),
      entry('p:c'),
      entry('p:d', { active: true }),
    ];
    const plan = planActivation(pool, 'p:c')!;
    expect(plan.target.id).toBe('p:c');
    expect(plan.previous?.id).toBe('p:a');
    expect(ids(plan.alsoActive)).toEqual(['p:b', 'p:d']);
  });

  it('has no previous entry when re-activating the active one', () => {
    const plan = planActivation([entry('p:a', { active: true }), entry('p:b')], 'p:a')!;
    expect(plan.previous).toBeUndefined();
    expect(plan.alsoActive).toEqual([]);
  });
});

describe('planRemoval', () => {
  it('activates the next entry when the active one is removed', () => {
    const plan = planRemoval([entry('p:a', { active: true }), entry('p:b'), entry('p:c')], 'p:a')!;
    expect(plan.removed.id).toBe('p:a');
    expect(plan.next?.id).toBe('p:b');
  });

  it('activates the first remaining entry when the active last one is removed', () => {
    expect(planRemoval([entry('p:a'), entry('p:b'), entry('p:c', { active: true })], 'p:c')!.next?.id).toBe('p:a');
  });

  it('leaves the active entry alone when an inactive one is removed', () => {
    const plan = planRemoval([entry('p:a', { active: true }), entry('p:b')], 'p:b')!;
    expect(plan.next).toBeUndefined();
    expect(plan.alsoActive).toEqual([]);
  });

  it('activates nothing when the last entry is removed', () => {
    const plan = planRemoval([entry('p:a', { active: true })], 'p:a')!;
    expect(plan.removed.active).toBe(true);
    expect(plan.next).toBeUndefined();
  });

  it('deactivates stray active entries other than the takeover', () => {
    const plan = planRemoval([entry('p:a', { active: true }), entry('p:b'), entry('p:c', { active: true })], 'p:a')!;
    expect(plan.next?.id).toBe('p:b');
    expect(ids(plan.alsoActive)).toEqual(['p:c']);
  });

  it('plans nothing for an unknown id', () => {
    expect(planRemoval([entry('p:a', { active: true })], 'p:gone')).toBeUndefined();
  });
});

describe('renameAccount', () => {
  it('returns a renamed copy that keeps every other field', () => {
    const pool = [entry('p:a', { active: true, identity: 'org-1' })];
    const renamed = renameAccount(pool, 'p:a', 'Work');
    expect(renamed).toEqual({ ...pool[0], label: 'Work' });
    expect(pool[0]!.label).toBe('label p:a');
  });

  it('returns nothing for an id outside the pool', () => {
    expect(renameAccount([entry('p:a')], 'q:a', 'Work')).toBeUndefined();
  });
});
