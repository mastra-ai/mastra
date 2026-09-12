import { describe, expect, it, vi } from 'vitest';

import { InMemoryDB } from '../../../storage/domains/inmemory-db';
import type { KnowledgeScopeGrant } from '../../../storage/domains/knowledge';
import { InMemoryKnowledgeStorage } from '../../../storage/domains/knowledge/inmemory';
import { KnowledgeAccessEvaluator, KnowledgeAccessFrontierCache } from '../cache';
import {
  canAccessKnowledgeNode,
  evaluateKnowledgeAccessFrontier,
  getKnowledgeNodeAccess,
  getKnowledgeScopeAccess,
} from '../evaluator';

const PRINCIPAL = '10000000-0000-4000-8000-000000000001';
const TEAM = '10000000-0000-4000-8000-000000000002';
const PROJECT = '10000000-0000-4000-8000-000000000003';
const COMPANION = '10000000-0000-4000-8000-000000000004';
const SIBLING = '10000000-0000-4000-8000-000000000005';

function grant(
  scopeNodeId: string,
  scopeRefId: string,
  role: KnowledgeScopeGrant['role'],
  canSuggest?: boolean,
): KnowledgeScopeGrant {
  return { scopeNodeId, scopeRefId, role, canSuggest };
}

describe('Knowledge access frontier evaluator', () => {
  it('caps chained grants at the capabilities held on the referenced scope', () => {
    const frontier = evaluateKnowledgeAccessFrontier({
      vouchedScopeIds: [PRINCIPAL],
      grants: [
        grant(TEAM, PRINCIPAL, 'readonly'),
        grant(PROJECT, TEAM, 'edit'),
        grant(COMPANION, PRINCIPAL, 'edit'),
        grant(SIBLING, COMPANION, 'owner'),
      ],
      accessEpoch: 7,
    });

    expect(frontier.accessEpoch).toBe(7);
    expect(getKnowledgeScopeAccess(frontier, PRINCIPAL)).toBeUndefined();
    expect(getKnowledgeScopeAccess(frontier, TEAM)?.capabilities).toMatchObject({ read: true, edit: false });
    // Readonly on the team yields at most readonly on what the team is granted.
    expect(getKnowledgeScopeAccess(frontier, PROJECT)?.capabilities).toMatchObject({ read: true, edit: false });
    expect(getKnowledgeScopeAccess(frontier, SIBLING)?.capabilities).toMatchObject({
      read: true,
      edit: true,
      manageAccess: false,
    });
    expect(Object.isFrozen(frontier)).toBe(true);
    expect(Object.isFrozen(frontier.vouchedScopeIds)).toBe(true);
    expect(Object.isFrozen(frontier.scopes)).toBe(true);
    expect(Object.isFrozen(frontier.scopes[PROJECT])).toBe(true);
  });

  it('converges owner and suggest through mirror cycles regardless of traversal order (S1)', () => {
    const H = PRINCIPAL;
    const A = TEAM;
    const B = PROJECT;
    const M = COMPANION;
    const N = SIBLING;
    const SUGGESTER = '10000000-0000-4000-8000-000000000006';
    const X = '10000000-0000-4000-8000-000000000007';
    const Y = '10000000-0000-4000-8000-000000000008';
    const grants = [
      grant(A, H, 'readonly'),
      grant(B, H, 'owner'),
      grant(M, A, 'mirror'),
      grant(N, M, 'mirror'),
      grant(A, N, 'mirror'),
      grant(A, B, 'owner'),
      grant(SUGGESTER, H, 'readonly', true),
      grant(A, SUGGESTER, 'readonly', true),
      grant(X, Y, 'mirror'),
      grant(Y, X, 'mirror'),
    ];
    const expected = {
      read: true,
      append: true,
      edit: true,
      delete: true,
      createChildren: true,
      manageAccess: true,
      suggest: true,
    };
    for (const ordering of [grants, [...grants].reverse(), [...grants.slice(5), ...grants.slice(0, 5)]]) {
      const frontier = evaluateKnowledgeAccessFrontier({ vouchedScopeIds: [H], grants: ordering, accessEpoch: 1 });
      expect(frontier.scopes[A]).toEqual(expected);
      expect(frontier.scopes[M]).toEqual(expected);
      expect(frontier.scopes[N]).toEqual(expected);
      expect(frontier.scopes[X]).toBeUndefined();
      expect(frontier.scopes[Y]).toBeUndefined();
      expect(frontier.scopes[H]).toBeUndefined();
    }
  });

  it('never escalates a readonly share through self-owned or owning scopes', () => {
    const frontier = evaluateKnowledgeAccessFrontier({
      vouchedScopeIds: [PRINCIPAL],
      grants: [
        grant(PROJECT, PROJECT, 'owner'),
        grant(PROJECT, PRINCIPAL, 'readonly', true),
        grant(TEAM, TEAM, 'owner'),
        grant(TEAM, PRINCIPAL, 'readonly'),
        grant(SIBLING, TEAM, 'owner'),
      ],
      accessEpoch: 1,
    });

    expect(frontier.scopes[PROJECT]).toMatchObject({ read: true, suggest: true, edit: false, manageAccess: false });
    expect(frontier.scopes[TEAM]).toMatchObject({ read: true, edit: false, manageAccess: false });
    // One hop further: the team owns SIBLING, but a readonly share of the team stays readonly.
    expect(frontier.scopes[SIBLING]).toMatchObject({ read: true, append: false, edit: false, manageAccess: false });

    const owner = evaluateKnowledgeAccessFrontier({
      vouchedScopeIds: [PROJECT],
      grants: [grant(PROJECT, PROJECT, 'owner')],
      accessEpoch: 1,
    });
    expect(owner.scopes[PROJECT]).toMatchObject({ read: true, manageAccess: true });
  });

  it('does not make a host-vouched seed readable or mirror capability it never had (S1)', () => {
    const SUGGEST_ONLY = '10000000-0000-4000-8000-000000000006';
    const frontier = evaluateKnowledgeAccessFrontier({
      vouchedScopeIds: [PRINCIPAL],
      grants: [
        grant(PROJECT, PRINCIPAL, 'mirror'),
        grant(SUGGEST_ONLY, TEAM, 'mirror'),
        grant(TEAM, PRINCIPAL, 'readonly', true),
        grant(SIBLING, COMPANION, 'edit'),
        grant(COMPANION, PRINCIPAL, 'mirror'),
      ],
      accessEpoch: 1,
    });

    expect(frontier.scopes[PRINCIPAL]).toBeUndefined();
    expect(frontier.scopes[PROJECT]).toBeUndefined();
    expect(frontier.scopes[COMPANION]).toBeUndefined();
    expect(frontier.scopes[SIBLING]).toBeUndefined();
    expect(canAccessKnowledgeNode(frontier, [PRINCIPAL])).toBe(false);
    expect(frontier.scopes[TEAM]).toMatchObject({ read: true, suggest: true, append: false });
  });

  it('combines successful paths and mirrors the complete effective capability set', () => {
    const frontier = evaluateKnowledgeAccessFrontier({
      vouchedScopeIds: [PRINCIPAL],
      grants: [
        grant(TEAM, PRINCIPAL, 'append', true),
        grant(PROJECT, PRINCIPAL, 'readonly'),
        grant(PROJECT, TEAM, 'owner'),
        grant(COMPANION, PROJECT, 'mirror'),
      ],
      accessEpoch: 1,
    });

    // The owner grant arrives through append access to the team, so it contributes at most append.
    expect(frontier.scopes[PROJECT]).toEqual({
      read: true,
      append: true,
      edit: false,
      delete: false,
      createChildren: false,
      manageAccess: false,
      suggest: false,
    });
    expect(frontier.scopes[COMPANION]).toEqual(frontier.scopes[PROJECT]);
    expect(frontier.scopes[TEAM]?.suggest).toBe(true);
  });

  it('reprocesses mirror paths when referenced capabilities grow and terminates on cycles', () => {
    const frontier = evaluateKnowledgeAccessFrontier({
      vouchedScopeIds: [PRINCIPAL],
      grants: [
        grant(PROJECT, TEAM, 'mirror'),
        grant(TEAM, PROJECT, 'mirror'),
        grant(TEAM, PRINCIPAL, 'readonly', true),
        grant(PROJECT, PRINCIPAL, 'owner'),
      ],
      accessEpoch: 1,
    });

    expect(frontier.scopes[TEAM]).toEqual(frontier.scopes[PROJECT]);
    expect(frontier.scopes[TEAM]).toMatchObject({ manageAccess: true, suggest: true });
  });

  it('joins node direct memberships once against the precomputed frontier', () => {
    const frontier = evaluateKnowledgeAccessFrontier({
      vouchedScopeIds: [PRINCIPAL],
      grants: [grant(TEAM, PRINCIPAL, 'readonly'), grant(PROJECT, PRINCIPAL, 'edit')],
      accessEpoch: 1,
    });

    expect(getKnowledgeNodeAccess(frontier, [TEAM, PROJECT])).toMatchObject({ read: true, edit: true });
    expect(canAccessKnowledgeNode(frontier, [SIBLING])).toBe(false);
  });

  it('normalizes principal sets and bounds cached frontiers', () => {
    const cache = new KnowledgeAccessFrontierCache({ maxEntries: 1 });
    const instance = {};
    const first = evaluateKnowledgeAccessFrontier({ vouchedScopeIds: [TEAM, PRINCIPAL], grants: [], accessEpoch: 1 });
    const second = evaluateKnowledgeAccessFrontier({ vouchedScopeIds: [SIBLING], grants: [], accessEpoch: 1 });

    cache.set(instance, first);
    expect(cache.get(instance, [PRINCIPAL, TEAM, PRINCIPAL], 1)).toBe(first);
    cache.set(instance, second);
    expect(cache.get(instance, [PRINCIPAL, TEAM], 1)).toBeUndefined();
  });

  it('isolates a shared cache by caller-supplied Knowledge instance identity', async () => {
    const cache = new KnowledgeAccessFrontierCache();
    const firstStorage = new InMemoryKnowledgeStorage({ db: new InMemoryDB() });
    const secondStorage = new InMemoryKnowledgeStorage({ db: new InMemoryDB() });
    vi.spyOn(firstStorage, 'getAccessEpoch').mockResolvedValue(1);
    vi.spyOn(secondStorage, 'getAccessEpoch').mockResolvedValue(1);
    const firstGrants = vi
      .spyOn(firstStorage, 'listScopeGrants')
      .mockResolvedValue([grant(PROJECT, PRINCIPAL, 'readonly')]);
    const secondGrants = vi
      .spyOn(secondStorage, 'listScopeGrants')
      .mockResolvedValue([grant(PROJECT, PRINCIPAL, 'owner')]);

    const first = await new KnowledgeAccessEvaluator({ instance: {}, storage: firstStorage, cache }).evaluate([
      PRINCIPAL,
    ]);
    const second = await new KnowledgeAccessEvaluator({ instance: {}, storage: secondStorage, cache }).evaluate([
      PRINCIPAL,
    ]);

    expect(first.scopes[PROJECT]).toMatchObject({ read: true, manageAccess: false });
    expect(second.scopes[PROJECT]).toMatchObject({ read: true, manageAccess: true });
    expect(firstGrants).toHaveBeenCalledOnce();
    expect(secondGrants).toHaveBeenCalledOnce();
  });

  it('invalidates cached frontiers through the shared storage epoch', async () => {
    const db = new InMemoryDB();
    const firstStorage = new InMemoryKnowledgeStorage({ db });
    const secondStorage = new InMemoryKnowledgeStorage({ db });
    const initial = await firstStorage.reconcileStructure({
      scopes: [
        { address: 'principal:one', name: 'Principal' },
        {
          address: 'project:one',
          name: 'Project',
          grants: [{ scopeRefAddress: 'principal:one', role: 'readonly' }],
        },
      ],
    });
    const evaluator = new KnowledgeAccessEvaluator({ instance: {}, storage: firstStorage });
    const listGrants = vi.spyOn(firstStorage, 'listScopeGrants');

    const before = await evaluator.evaluate([initial.scopes['principal:one']!]);
    await expect(evaluator.evaluate([initial.scopes['principal:one']!])).resolves.toBe(before);
    expect(listGrants).toHaveBeenCalledTimes(1);

    // Grants on existing scopes change through the governed grant APIs, which advance
    // the shared access epoch; reconcile only seeds grants when it creates a scope.
    await secondStorage.upsertScopeGrant({
      scopeNodeId: initial.scopes['project:one']!,
      scopeRefId: initial.scopes['principal:one']!,
      role: 'edit',
    });
    const after = await evaluator.evaluate([initial.scopes['principal:one']!]);

    expect(after.accessEpoch).toBe(2);
    expect(after.scopes[initial.scopes['project:one']!]).toMatchObject({ edit: true });

    const team = await secondStorage.reconcileStructure({
      scopes: [{ address: 'team:one', name: 'Team' }],
    });
    await secondStorage.removeScopeGrant({
      scopeNodeId: initial.scopes['project:one']!,
      scopeRefId: initial.scopes['principal:one']!,
    });
    await secondStorage.upsertScopeGrant({
      scopeNodeId: initial.scopes['project:one']!,
      scopeRefId: team.scopes['team:one']!,
      role: 'edit',
    });
    const revoked = await evaluator.evaluate([initial.scopes['principal:one']!]);
    expect(revoked.accessEpoch).toBe(5);
    expect(revoked.scopes[initial.scopes['project:one']!]).toBeUndefined();
    expect(listGrants).toHaveBeenCalledTimes(3);
  });

  it('rechecks the epoch before returning a cached frontier', async () => {
    const storage = new InMemoryKnowledgeStorage({ db: new InMemoryDB() });
    const getEpoch = vi.spyOn(storage, 'getAccessEpoch').mockResolvedValue(1);
    const listGrants = vi.spyOn(storage, 'listScopeGrants').mockResolvedValue([grant(PROJECT, PRINCIPAL, 'readonly')]);
    const evaluator = new KnowledgeAccessEvaluator({ instance: {}, storage });
    await evaluator.evaluate([PRINCIPAL]);

    getEpoch.mockReset().mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockResolvedValue(2);
    listGrants.mockResolvedValue([grant(PROJECT, PRINCIPAL, 'owner')]);
    const frontier = await evaluator.evaluate([PRINCIPAL]);

    expect(frontier.accessEpoch).toBe(2);
    expect(frontier.scopes[PROJECT]).toMatchObject({ manageAccess: true });
    expect(listGrants).toHaveBeenCalledTimes(2);
  });

  it('retries when the epoch changes while grants are being read', async () => {
    const storage = new InMemoryKnowledgeStorage({ db: new InMemoryDB() });
    vi.spyOn(storage, 'getAccessEpoch')
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(2);
    const listGrants = vi.spyOn(storage, 'listScopeGrants').mockResolvedValue([grant(PROJECT, PRINCIPAL, 'readonly')]);

    const frontier = await new KnowledgeAccessEvaluator({ instance: {}, storage }).evaluate([PRINCIPAL]);

    expect(frontier.accessEpoch).toBe(2);
    expect(frontier.scopes[PROJECT]?.read).toBe(true);
    expect(listGrants).toHaveBeenCalledTimes(2);
  });

  it('fails closed after three inconsistent epoch snapshots', async () => {
    const storage = new InMemoryKnowledgeStorage({ db: new InMemoryDB() });
    let epoch = 0;
    vi.spyOn(storage, 'getAccessEpoch').mockImplementation(async () => ++epoch);
    const listGrants = vi.spyOn(storage, 'listScopeGrants').mockResolvedValue([]);

    await expect(new KnowledgeAccessEvaluator({ instance: {}, storage }).evaluate([PRINCIPAL])).rejects.toThrow(
      'Knowledge access grants changed repeatedly',
    );
    expect(listGrants).toHaveBeenCalledTimes(3);
  });
});
