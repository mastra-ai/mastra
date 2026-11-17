import { MongoNetworkError, MongoServerError } from 'mongodb';
import { describe, expect, it } from 'vitest';
import type { OwnershipView } from './ownership';
import {
  classify,
  idTimestampMs,
  isLiveRow,
  isNewerId,
  p4OutcomeOf,
  planOrphanCleanup,
  resolveCreating,
} from './provisioning';

const at = new Date('2026-11-17T12:00:00Z');
const idAt = (d: Date) =>
  Math.floor(d.getTime() / 1000)
    .toString(16)
    .padStart(8, '0') + '0000000000000001';
const R = idAt(at);
const X = idAt(new Date(at.getTime() + 1000));
const e = new Error('x');

describe('classify', () => {
  it('ok rows', () => {
    expect(classify({ kind: 'ok', id: R }, { name: 'n', id: R }, at)).toEqual({ kind: 'proven', id: R });
    expect(classify({ kind: 'ok', id: R }, { name: 'n', id: X }, at)).toEqual({ kind: 'foreign', byTimestamp: false });
    expect(classify({ kind: 'ok', id: R }, undefined, at)).toEqual({ kind: 'proven', id: R });
    expect(classify({ kind: 'ok', id: R }, { name: 'n', id: R, status: 'DELETING' }, at)).toEqual({
      kind: 'proven',
      id: R,
    });
  });
  it('refused and unknown', () => {
    expect(classify({ kind: 'refused', error: e }, { name: 'n', id: X }, at)).toEqual({ kind: 'not-created' });
    expect(classify({ kind: 'refused', error: e }, undefined, at)).toEqual({ kind: 'not-created' });
    expect(classify({ kind: 'unknown', error: e }, undefined, at)).toEqual({ kind: 'pending' });
    expect(classify({ kind: 'unknown', error: e }, { name: 'n', id: X }, at)).toEqual({
      kind: 'uncertain',
      candidateId: X,
    });
  });
  it('timestamp rule with RF-MARGIN', () => {
    const old = idAt(new Date(at.getTime() - 31_000));
    expect(classify({ kind: 'ok', id: old }, { name: 'n', id: old }, at)).toEqual({
      kind: 'foreign',
      byTimestamp: true,
    });
    expect(classify({ kind: 'ok', id: old }, undefined, at)).toEqual({ kind: 'foreign', byTimestamp: true });
    const edge = idAt(new Date(at.getTime() - 30_000));
    expect(classify({ kind: 'ok', id: edge }, { name: 'n', id: edge }, at)).toEqual({ kind: 'proven', id: edge });
  });
  it('RF-BADID: non-ObjectId ids neither throw nor mis-order', () => {
    expect(classify({ kind: 'ok', id: 'fake-id' }, { name: 'n', id: 'fake-id' }, at)).toEqual({
      kind: 'proven',
      id: 'fake-id',
    });
    expect(classify({ kind: 'ok', id: 'fake-id' }, { name: 'n', id: X }, at)).toEqual({
      kind: 'foreign',
      byTimestamp: false,
    });
    expect(isNewerId('fake-id', X)).toBe(false);
    expect(isNewerId(X, 'fake-id')).toBe(false);
    expect(idTimestampMs('fake-id')).toBeUndefined();
  });
});

describe('classify fix round 1', () => {
  it('ok R + dying row with another id is foreign; same-id dying row stays proven', () => {
    expect(classify({ kind: 'ok', id: R }, { name: 'n', id: X, status: 'DELETING' }, at)).toEqual({
      kind: 'foreign',
      byTimestamp: false,
    });
    expect(classify({ kind: 'ok', id: R }, { name: 'n', id: R, status: 'DOES_NOT_EXIST' }, at)).toEqual({
      kind: 'proven',
      id: R,
    });
  });
  it('unknown + dying row is uncertain', () => {
    expect(classify({ kind: 'unknown', error: e }, { name: 'n', id: X, status: 'DELETING' }, at)).toEqual({
      kind: 'uncertain',
      candidateId: X,
    });
  });
  it('rows without an id never give an empty candidateId', () => {
    expect(classify({ kind: 'unknown', error: e }, { name: 'n' }, at)).toEqual({ kind: 'pending' });
    expect(classify({ kind: 'ok', id: R }, { name: 'n' }, at)).toEqual({ kind: 'foreign', byTimestamp: false });
  });
});

describe('helpers', () => {
  it('isLiveRow', () => {
    expect(isLiveRow(undefined)).toBe(false);
    for (const status of ['READY', 'PENDING', 'BUILDING', undefined])
      expect(isLiveRow({ name: 'n', status })).toBe(true);
    for (const status of ['DELETING', 'DOES_NOT_EXIST']) expect(isLiveRow({ name: 'n', status })).toBe(false);
  });
  it('p4OutcomeOf maps may-have-landed server codes to unknown', () => {
    for (const code of [6, 7, 50, 89, 91, 189, 262, 9001, 10107, 11600, 11602, 13435, 13436])
      expect(p4OutcomeOf(new MongoServerError({ code })).kind).toBe('unknown');
    for (const code of [2, 68]) expect(p4OutcomeOf(new MongoServerError({ code })).kind).toBe('refused');
  });
  it('isNewerId orders 24-hex ids', () => {
    const earlier = idAt(at);
    const later = idAt(new Date(at.getTime() + 5000));
    expect(isNewerId(later, earlier)).toBe(true);
    expect(isNewerId(earlier, later)).toBe(false);
  });
  it('p4OutcomeOf', () => {
    expect(p4OutcomeOf(new MongoServerError({ code: 68, codeName: 'IndexAlreadyExists' })).kind).toBe('refused');
    expect(p4OutcomeOf(new MongoNetworkError('x')).kind).toBe('unknown');
  });
});

describe('resolveCreating', () => {
  const recent = idAt(new Date(at.getTime() - 5000));
  it('absent, held or older than the margin: delete', () => {
    expect(resolveCreating(undefined, at, new Set())).toEqual({ action: 'delete', byTimestamp: false });
    expect(resolveCreating({ name: 'n', id: recent }, at, new Set([recent]))).toEqual({
      action: 'delete',
      byTimestamp: false,
    });
    const old = idAt(new Date(at.getTime() - 31_000));
    expect(resolveCreating({ name: 'n', id: old }, at, new Set())).toEqual({ action: 'delete', byTimestamp: true });
  });
  it('a recent unheld id, of any status, is uncertain', () => {
    expect(resolveCreating({ name: 'n', id: recent }, at, new Set())).toEqual({
      action: 'uncertain',
      candidateId: recent,
    });
    expect(resolveCreating({ name: 'n', id: recent, status: 'DELETING' }, at, new Set([X]))).toEqual({
      action: 'uncertain',
      candidateId: recent,
    });
  });
});

describe('planOrphanCleanup', () => {
  const STALE = '0'.repeat(24);
  const user = (_id: string, extra: Partial<OwnershipView> = {}): OwnershipView => ({
    _id,
    searchIndexName: `${_id}_vec`,
    ...extra,
  });
  it('an owner holding R is released without a rewrite', () => {
    const u = user('u', { textSearchIndexName: 'N', ownsTextIndex: true, indexIds: [{ name: 'N', id: R }] });
    expect(planOrphanCleanup('N', R, R, [u])).toEqual({ kind: 'release', owners: [{ toId: 'u' }] });
  });
  it('an owner with a stale or missing id is rewritten to R only when the listing shows R', () => {
    const stale = user('s', { textSearchIndexName: 'N', ownsTextIndex: true, indexIds: [{ name: 'N', id: STALE }] });
    const none = user('n', { searchIndexName: 'N', ownsVectorIndex: true });
    expect(planOrphanCleanup('N', R, R, [stale, none])).toEqual({
      kind: 'release',
      owners: [
        { toId: 's', rewriteId: R },
        { toId: 'n', rewriteId: R },
      ],
    });
    expect(planOrphanCleanup('N', R, X, [stale])).toEqual({ kind: 'release', owners: [{ toId: 's' }] });
    expect(planOrphanCleanup('N', R, undefined, [stale])).toEqual({ kind: 'release', owners: [{ toId: 's' }] });
  });
  it('owners come first; non-owners are left alone', () => {
    const owner = user('z', { textSearchIndexName: 'N', ownsTextIndex: true, indexIds: [{ name: 'N', id: R }] });
    expect(planOrphanCleanup('N', R, R, [user('a', { textSearchIndexName: 'N' }), owner])).toEqual({
      kind: 'release',
      owners: [{ toId: 'z' }],
    });
  });
  it('non-owners only: a transfer of R to the lowest _id when the listing shows R', () => {
    const b = user('b', { textSearchIndexName: 'N' });
    const a = user('a', { searchIndexName: 'N' });
    expect(planOrphanCleanup('N', R, R, [b, a])).toEqual({
      kind: 'transfer',
      toId: 'a',
      field: 'ownsVectorIndex',
      id: R,
    });
    expect(planOrphanCleanup('N', R, R, [b])).toEqual({ kind: 'transfer', toId: 'b', field: 'ownsTextIndex', id: R });
  });
  it('non-owners only and R not listed: forget', () => {
    const a = user('a', { textSearchIndexName: 'N' });
    expect(planOrphanCleanup('N', R, undefined, [a])).toEqual({ kind: 'forget' });
    expect(planOrphanCleanup('N', R, X, [a])).toEqual({ kind: 'forget' });
  });
  it('no users: drop', () => {
    expect(planOrphanCleanup('N', R, R, [])).toEqual({ kind: 'drop' });
    expect(planOrphanCleanup('N', R, R, [user('a', { textSearchIndexName: 'M' })])).toEqual({ kind: 'drop' });
  });
  it('a retired-vector-name holder counts as an owner', () => {
    const r = user('r', { retiredVectorIndexNames: ['N'] });
    expect(planOrphanCleanup('N', R, R, [user('a', { textSearchIndexName: 'N' }), r])).toEqual({
      kind: 'release',
      owners: [{ toId: 'r', rewriteId: R }],
    });
  });
});
