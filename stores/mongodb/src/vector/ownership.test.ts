import { describe, expect, it } from 'vitest';
import { planDeleteCleanup } from './ownership';
import type { OwnershipView } from './ownership';

const own = (o: Partial<OwnershipView> = {}): OwnershipView => ({ _id: 'own', searchIndexName: 'v', ...o });
const sib = (_id: string, o: Partial<OwnershipView> = {}): OwnershipView => ({ _id, searchIndexName: 'v', ...o });

describe('planDeleteCleanup', () => {
  it('drops an unreferenced owned text index', () => {
    expect(planDeleteCleanup(own({ textSearchIndexName: 't', ownsTextIndex: true }), [])).toEqual({
      drop: ['t'],
      transfers: [],
      released: [],
    });
  });
  it('ignores an unowned current text index', () => {
    expect(planDeleteCleanup(own({ textSearchIndexName: 't' }), [])).toEqual({ drop: [], transfers: [], released: [] });
  });
  it('drops an unreferenced retired name', () => {
    expect(planDeleteCleanup(own({ retiredTextIndexNames: ['r'] }), [sib('a')])).toEqual({
      drop: ['r'],
      transfers: [],
      released: [],
    });
  });
  it('transfers to a sibling using the text index unowned', () => {
    expect(
      planDeleteCleanup(own({ textSearchIndexName: 't', ownsTextIndex: true }), [
        sib('a', { textSearchIndexName: 't' }),
      ]),
    ).toEqual({ drop: [], transfers: [{ toId: 'a', field: 'ownsTextIndex', name: 't' }], released: [] });
  });
  it('picks the lowest _id among non-owning users', () => {
    const plan = planDeleteCleanup(own({ textSearchIndexName: 't', ownsTextIndex: true }), [
      sib('b', { textSearchIndexName: 't' }),
      sib('a', { textSearchIndexName: 't' }),
    ]);
    expect(plan.transfers).toEqual([{ toId: 'a', field: 'ownsTextIndex', name: 't' }]);
  });
  it('releases when a sibling owns it as retired', () => {
    expect(
      planDeleteCleanup(own({ retiredTextIndexNames: ['r'] }), [sib('a', { retiredTextIndexNames: ['r'] })]),
    ).toEqual({
      drop: [],
      transfers: [],
      released: ['r'],
    });
  });
  it('ignores deleting siblings', () => {
    expect(
      planDeleteCleanup(own({ textSearchIndexName: 't', ownsTextIndex: true }), [
        sib('a', { textSearchIndexName: 't', deleting: true }),
      ]),
    ).toEqual({ drop: ['t'], transfers: [], released: [] });
  });
  it('transfers a shared vector index with ownsVectorIndex', () => {
    expect(planDeleteCleanup(own({ ownsVectorIndex: true }), [sib('a')])).toEqual({
      drop: [],
      transfers: [{ toId: 'a', field: 'ownsVectorIndex', name: 'v' }],
      released: [],
    });
  });
  it('releases when another sibling owns a name a different sibling uses unowned', () => {
    const plan = planDeleteCleanup(own({ textSearchIndexName: 't', ownsTextIndex: true }), [
      sib('a', { textSearchIndexName: 't' }),
      sib('b', { textSearchIndexName: 't', ownsTextIndex: true }),
    ]);
    expect(plan).toEqual({ drop: [], transfers: [], released: ['t'] });
  });
  it('classifies a duplicated candidate once', () => {
    expect(
      planDeleteCleanup(own({ textSearchIndexName: 't', ownsTextIndex: true, retiredTextIndexNames: ['t'] }), []),
    ).toEqual({ drop: ['t'], transfers: [], released: [] });
  });
});
