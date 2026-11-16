import { describe, expect, it } from 'vitest';
import { planDeleteCleanup } from './ownership';
import type { OwnershipView } from './ownership';

const own = (o: Partial<OwnershipView> = {}): OwnershipView => ({ _id: 'own', searchIndexName: 'v', ...o });
const sib = (_id: string, o: Partial<OwnershipView> = {}): OwnershipView => ({ _id, searchIndexName: 'v', ...o });
const none = { drop: [], transfers: [], released: [], rewrites: [], kept: [] };

describe('planDeleteCleanup', () => {
  it('drops an unreferenced owned text index', () => {
    expect(planDeleteCleanup(own({ textSearchIndexName: 't', ownsTextIndex: true }), [], {})).toEqual({
      ...none,
      drop: ['t'],
    });
  });
  it('ignores an unowned current text index', () => {
    expect(planDeleteCleanup(own({ textSearchIndexName: 't' }), [], {})).toEqual(none);
  });
  it('drops an unreferenced retired name', () => {
    expect(planDeleteCleanup(own({ retiredTextIndexNames: ['r'] }), [sib('a')], {})).toEqual({ ...none, drop: ['r'] });
  });
  it('transfers to a sibling using the text index unowned', () => {
    expect(
      planDeleteCleanup(
        own({ textSearchIndexName: 't', ownsTextIndex: true }),
        [sib('a', { textSearchIndexName: 't' })],
        { t: 'X' },
      ),
    ).toEqual({ ...none, transfers: [{ toId: 'a', field: 'ownsTextIndex', name: 't', id: 'X' }] });
  });
  it('picks the lowest _id among non-owning users', () => {
    const plan = planDeleteCleanup(
      own({ textSearchIndexName: 't', ownsTextIndex: true }),
      [sib('b', { textSearchIndexName: 't' }), sib('a', { textSearchIndexName: 't' })],
      { t: 'X' },
    );
    expect(plan.transfers).toEqual([{ toId: 'a', field: 'ownsTextIndex', name: 't', id: 'X' }]);
  });
  it('releases when a sibling owns it as retired', () => {
    expect(
      planDeleteCleanup(own({ retiredTextIndexNames: ['r'] }), [sib('a', { retiredTextIndexNames: ['r'] })], {}),
    ).toEqual({ ...none, released: ['r'] });
  });
  it('ignores deleting siblings', () => {
    expect(
      planDeleteCleanup(
        own({ textSearchIndexName: 't', ownsTextIndex: true }),
        [sib('a', { textSearchIndexName: 't', deleting: true })],
        {},
      ),
    ).toEqual({ ...none, drop: ['t'] });
  });
  it('transfers a shared vector index with ownsVectorIndex', () => {
    expect(planDeleteCleanup(own({ ownsVectorIndex: true }), [sib('a')], { v: 'X' })).toEqual({
      ...none,
      transfers: [{ toId: 'a', field: 'ownsVectorIndex', name: 'v', id: 'X' }],
    });
  });
  it('releases when another sibling owns a name a different sibling uses unowned', () => {
    const plan = planDeleteCleanup(
      own({ textSearchIndexName: 't', ownsTextIndex: true }),
      [sib('a', { textSearchIndexName: 't' }), sib('b', { textSearchIndexName: 't', ownsTextIndex: true })],
      {},
    );
    expect(plan).toEqual({ ...none, released: ['t'] });
  });
  it('classifies a duplicated candidate once', () => {
    expect(
      planDeleteCleanup(own({ textSearchIndexName: 't', ownsTextIndex: true, retiredTextIndexNames: ['t'] }), [], {}),
    ).toEqual({ ...none, drop: ['t'] });
  });

  it('retired vector name: a sibling holding it retired releases', () => {
    expect(
      planDeleteCleanup(own({ retiredVectorIndexNames: ['v0'] }), [sib('a', { retiredVectorIndexNames: ['v0'] })], {}),
    ).toEqual({ ...none, released: ['v0'] });
  });
  it('retired vector name: a sibling using it as its current name blocks the drop', () => {
    expect(
      planDeleteCleanup(
        own({ retiredVectorIndexNames: ['v0'], indexIds: [{ name: 'v0', id: 'R' }] }),
        [sib('a', { searchIndexName: 'v0' })],
        {
          v0: 'R',
        },
      ),
    ).toEqual({ ...none, transfers: [{ toId: 'a', field: 'ownsVectorIndex', name: 'v0', id: 'R' }] });
  });
  it('mismatched-id owner: rewrite only when observed equals own id', () => {
    const o = own({ textSearchIndexName: 't', ownsTextIndex: true, indexIds: [{ name: 't', id: 'R' }] });
    const s = [sib('a', { textSearchIndexName: 't', ownsTextIndex: true, indexIds: [{ name: 't', id: 'S' }] })];
    expect(planDeleteCleanup(o, s, { t: 'R' })).toEqual({
      ...none,
      released: ['t'],
      rewrites: [{ toId: 'a', name: 't', id: 'R' }],
    });
    expect(planDeleteCleanup(o, s, { t: 'X' })).toEqual({ ...none, released: ['t'], rewrites: [] });
  });
  it('proven transfer overwrites a stale recipient entry', () => {
    expect(
      planDeleteCleanup(
        own({ textSearchIndexName: 't', ownsTextIndex: true, indexIds: [{ name: 't', id: 'R' }] }),
        [sib('a', { textSearchIndexName: 't', indexIds: [{ name: 't', id: 'S' }] })],
        { t: 'R' },
      ),
    ).toEqual({
      ...none,
      transfers: [{ toId: 'a', field: 'ownsTextIndex', name: 't', id: 'R' }],
      rewrites: [{ toId: 'a', name: 't', id: 'R' }],
    });
  });
  it('stale-id user, incarnation replaced: transfer nothing', () => {
    expect(
      planDeleteCleanup(
        own({ textSearchIndexName: 't', ownsTextIndex: true, indexIds: [{ name: 't', id: 'R' }] }),
        [sib('a', { textSearchIndexName: 't' })],
        { t: 'X' },
      ),
    ).toEqual({ ...none, transfers: [], kept: ['t'], drop: [] });
  });
  it('legacy no-id owner, name present: TOFU transfer', () => {
    expect(
      planDeleteCleanup(
        own({ textSearchIndexName: 't', ownsTextIndex: true }),
        [sib('a', { textSearchIndexName: 't' })],
        { t: 'X' },
      ).transfers,
    ).toEqual([{ toId: 'a', field: 'ownsTextIndex', name: 't', id: 'X' }]);
  });
  it('legacy no-id owner, name absent: transfer nothing', () => {
    expect(
      planDeleteCleanup(
        own({ textSearchIndexName: 't', ownsTextIndex: true }),
        [sib('a', { textSearchIndexName: 't' })],
        {},
      ),
    ).toEqual({ ...none, kept: ['t'] });
  });
});
