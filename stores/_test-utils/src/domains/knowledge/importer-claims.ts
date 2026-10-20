import { Knowledge } from '@mastra/core/knowledge';
import type { KnowledgeImporterHandlerContext } from '@mastra/core/knowledge';
import { KnowledgeConflictError, knowledgeImporterBindingKey } from '@mastra/core/storage';
import type { KnowledgeImportClaimant, KnowledgeStorage, MastraCompositeStore } from '@mastra/core/storage';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * FACT-471: one importer source bound into two project scopes. Node identity is global per
 * `(source, address)`, so both bindings share one node and one record per id, each owning only
 * its own claims, while outside edits are still rejected.
 */
const source = 'fireflies:workspace-1';
const bindingA = { source, scope: 'project:alpha' } as const;
const bindingB = { source, scope: 'project:beta' } as const;

interface Item {
  address: string;
  name: string;
  records: Array<{ id: string; text: string }>;
  /** Address of an imported container scope (under the binding scope) the item also belongs in. */
  container?: string;
}
type Payload = { items: Item[]; removed?: string[]; containers?: string[] };

function createKnowledge(storage: MastraCompositeStore) {
  return new Knowledge({
    storage,
    structure: {
      scopes: [
        { address: 'org:acme', name: 'Acme' },
        { address: 'project:alpha', name: 'Alpha', parentAddresses: ['org:acme'] },
        { address: 'project:beta', name: 'Beta', parentAddresses: ['org:acme'] },
      ],
    },
    // A second importer bound to the same source string: it must never share ownership with `fireflies`.
    importers: ['fireflies', 'other-importer'].map(id => ({
      id,
      access: { 'project:$projectId': 'owner' as const },
      handler: async (ctx: KnowledgeImporterHandlerContext) => {
        const payload = ctx.payload as Payload | undefined;
        const importer = await ctx.importer();
        for (const address of payload?.containers ?? []) {
          await importer.upsertNode(address, { name: address, isScope: true, scopes: [importer.scope] });
        }
        for (const item of payload?.items ?? []) {
          const scopes = item.container ? [importer.scope, item.container] : [importer.scope];
          const node = await importer.upsertNode(item.address, { name: item.name, scopes });
          const existing = new Set((await node.listKnowledge()).map(record => record.id));
          for (const record of item.records) {
            if (!existing.has(record.id)) await node.appendKnowledge(record);
          }
        }
        for (const address of payload?.removed ?? []) await importer.removeNode(address);
      },
    })),
  });
}

const person: Item = {
  address: 'person:shane@mastra.ai',
  name: 'Shane',
  records: [{ id: 'rec-shane-1', text: 'Shane runs the Thursday sync.' }],
};

const openStores: MastraCompositeStore[] = [];

async function setup(createStore: () => MastraCompositeStore | Promise<MastraCompositeStore>) {
  const store = await createStore();
  openStores.push(store);
  const knowledge = createKnowledge(store);
  await knowledge.reconcile();
  const storage = await knowledge.getStorage();
  return {
    knowledge,
    storage,
    importer: knowledge.getImporter('fireflies')!,
    alpha: (await storage.getScopeAddress('project:alpha'))!.scopeNodeId,
    beta: (await storage.getScopeAddress('project:beta'))!.scopeNodeId,
    org: (await storage.getScopeAddress('org:acme'))!.scopeNodeId,
  };
}

const sorted = (ids: string[]) => [...ids].sort();

export function createKnowledgeImporterMultiBindingTests(
  createStore: () => MastraCompositeStore | Promise<MastraCompositeStore>,
) {
  describe('Knowledge importer: one source bound into two scopes (FACT-471)', () => {
    afterEach(async () => {
      await Promise.all(openStores.splice(0).map(store => (store as { close?: () => Promise<void> }).close?.()));
    });

    it('lets the second binding import the same item and keeps both memberships', async () => {
      const { storage, importer, alpha, beta } = await setup(createStore);
      expect((await importer.run(bindingA, { items: [person] })).status).toBe('succeeded');
      const second = await importer.run(bindingB, { items: [person] });
      expect(second.error).toBeUndefined();
      const nodeId = (await storage.getNodeAddress({ source, address: person.address }))!.nodeId;
      expect(sorted(await storage.getNodeScopeIds(nodeId))).toEqual(sorted([alpha, beta]));
      expect(sorted(await storage.getRecordScopeIds('rec-shane-1'))).toEqual(sorted([alpha, beta]));
      // Replays by either binding are no-ops, never "changed outside importer".
      for (const binding of [bindingA, bindingB, bindingA]) {
        expect((await importer.run(binding, { items: [person] })).error).toBeUndefined();
      }
      expect(sorted(await storage.getNodeScopeIds(nodeId))).toEqual(sorted([alpha, beta]));
    });

    it("isolates each binding's records, removal and run history", async () => {
      const { knowledge, storage, importer, alpha, beta } = await setup(createStore);
      const withAlphaNote = { ...person, records: [...person.records, { id: 'rec-alpha-only', text: 'Alpha note' }] };
      await importer.run(bindingA, { items: [withAlphaNote] });
      await importer.run(bindingB, { items: [person] });
      expect(await storage.getRecordScopeIds('rec-alpha-only')).toEqual([alpha]);

      expect((await importer.run(bindingA, { items: [], removed: [person.address] })).error).toBeUndefined();
      expect(await storage.getRecord({ id: 'rec-alpha-only' })).toBeNull();
      expect(await storage.getRecordScopeIds('rec-shane-1')).toEqual([beta]);
      const nodeId = (await storage.getNodeAddress({ source, address: person.address }))!.nodeId;

      expect((await importer.run(bindingB, { items: [], removed: [person.address] })).error).toBeUndefined();
      expect(await storage.getRecord({ id: 'rec-shane-1' })).toBeNull();
      expect(await storage.getNode(nodeId)).toMatchObject({ id: nodeId });

      for (const binding of [bindingA, bindingB]) {
        const key = knowledgeImporterBindingKey(binding);
        const { runs } = await knowledge.listImportRuns({ importerId: 'fireflies', binding: key });
        expect(runs).toHaveLength(2);
        expect(runs.every(run => run.binding === key)).toBe(true);
      }
    });

    it('still rejects a real outside edit for both bindings', async () => {
      const { knowledge, storage, importer } = await setup(createStore);
      await importer.run(bindingA, { items: [person] });
      await importer.run(bindingB, { items: [person] });
      const nodeId = (await storage.getNodeAddress({ source, address: person.address }))!.nodeId;
      const node = (await storage.getNode(nodeId))!;
      await knowledge.updateNode({ id: nodeId, version: node.version, name: 'Renamed by a person' });
      for (const binding of [bindingA, bindingB]) {
        const run = await importer.run(binding, { items: [{ ...person, name: 'Shane (updated)' }] });
        expect(run.status).toBe('failed');
        expect(run.error).toMatch(/changed outside importer/);
      }
      expect((await storage.getNode(nodeId))!.name).toBe('Renamed by a person');
    });

    it("does not let a different importer naming the same source rewrite or claim the first one's data", async () => {
      const { knowledge, storage, importer, alpha } = await setup(createStore);
      await importer.run(bindingA, { items: [person] });
      const nodeId = (await storage.getNodeAddress({ source, address: person.address }))!.nodeId;
      const before = (await storage.getNode(nodeId))!;

      const other = knowledge.getImporter('other-importer')!;
      const renamed = {
        ...person,
        name: 'Mallory',
        records: [{ id: 'rec-shane-1', text: 'Shane runs the Thursday sync.' }],
      };
      const run = await other.run(bindingB, { items: [renamed] });
      expect(run.error).toMatch(/changed outside importer other-importer/);

      const after = (await storage.getNode(nodeId))!;
      expect(after).toMatchObject({ name: 'Shane', version: before.version });
      expect(await storage.getNodeScopeIds(nodeId)).toEqual([alpha]);
      expect(await storage.getRecordScopeIds('rec-shane-1')).toEqual([alpha]);
      const claims = await storage.listImportClaims({ targetType: 'node', targetId: nodeId });
      expect(claims.map(claim => claim.importerId)).toEqual(['fireflies']);
      // The first importer's own bindings still work.
      expect((await importer.run(bindingB, { items: [person] })).error).toBeUndefined();
    });

    it('shows a node in the binding scope and an imported container to project readers only', async () => {
      const { storage, importer, alpha, beta, org } = await setup(createStore);
      const run = await importer.run(bindingA, {
        containers: ['teamspace:eng'],
        items: [{ ...person, container: 'teamspace:eng' }],
      });
      expect(run.error).toBeUndefined();
      const teamspace = (await storage.getNodeAddress({ source, address: 'teamspace:eng' }))!.nodeId;
      const nodeId = (await storage.getNodeAddress({ source, address: person.address }))!.nodeId;
      expect(sorted(await storage.getNodeScopeIds(nodeId))).toEqual(sorted([alpha, teamspace]));
      expect(await storage.getNodeScopeIds(teamspace)).toEqual([alpha]);

      // A project reader holds the project and its parent chain; it sees the node through the binding scope.
      const projectReader = [alpha, org];
      expect((await storage.listNodes({ scopeIds: projectReader })).map(node => node.id)).toContain(nodeId);
      const visible = await storage.listRecords({ node: nodeId, scopeIds: projectReader });
      expect(visible.records.map(record => record.id)).toEqual(['rec-shane-1']);

      // A reader holding only an unrelated scope sees neither the node nor its records.
      for (const unrelated of [[beta], [org]]) {
        const ids = (await storage.listNodes({ scopeIds: unrelated })).map(node => node.id);
        expect(ids).not.toContain(nodeId);
        expect(ids).not.toContain(teamspace);
        expect((await storage.listRecords({ node: nodeId, scopeIds: unrelated })).records).toEqual([]);
      }
    });

    it('releases one binding, then the last, without ever deleting a node', async () => {
      const { knowledge, storage, importer, alpha, beta } = await setup(createStore);
      const withAlphaNote = { ...person, records: [...person.records, { id: 'rec-alpha-only', text: 'Alpha note' }] };
      await importer.run(bindingA, { items: [withAlphaNote] });
      await importer.run(bindingB, { items: [person] });
      const nodeId = (await storage.getNodeAddress({ source, address: person.address }))!.nodeId;

      await knowledge.releaseImportBinding({ importerId: 'fireflies', binding: knowledgeImporterBindingKey(bindingA) });
      expect(await storage.getNode(nodeId)).toMatchObject({ id: nodeId });
      expect(await storage.getNodeScopeIds(nodeId)).toEqual([beta]);
      expect(await storage.getRecord({ id: 'rec-alpha-only' })).toBeNull();
      expect(await storage.getRecordScopeIds('rec-shane-1')).toEqual([beta]);
      expect((await storage.listRecords({ node: nodeId, scopeIds: [alpha] })).records).toEqual([]);
      // The remaining binding still owns its data: a replay is a no-op, not an outside edit.
      expect((await importer.run(bindingB, { items: [person] })).error).toBeUndefined();

      await knowledge.releaseImportBinding({ importerId: 'fireflies', binding: knowledgeImporterBindingKey(bindingB) });
      expect(await storage.getNode(nodeId)).toMatchObject({ id: nodeId });
      expect(await storage.getRecord({ id: 'rec-shane-1', includeDeleted: true })).toBeNull();
      // Only a scope-less marker of the node's version is left, so it contributes no membership.
      const left = await storage.listImportClaims({ targetType: 'node', targetId: nodeId });
      expect(left.flatMap(claim => claim.scopeIds)).toEqual([]);

      // Moving the source to a binding that never held it adopts the node instead of failing.
      expect((await importer.run(bindingA, { items: [person] })).error).toBeUndefined();
      expect(await storage.getRecordScopeIds('rec-shane-1')).toEqual([alpha]);
      expect(sorted(await storage.getNodeScopeIds(nodeId))).toContain(alpha);
    });

    it('does not let a release turn an earlier outside edit into importer-owned data', async () => {
      const { knowledge, storage, importer } = await setup(createStore);
      await importer.run(bindingA, { items: [person] });
      const nodeId = (await storage.getNodeAddress({ source, address: person.address }))!.nodeId;
      const node = (await storage.getNode(nodeId))!;
      await knowledge.updateNode({ id: nodeId, version: node.version, name: 'Curator title' });
      const sync = { items: [{ ...person, name: 'Shane (updated)' }] };
      expect((await importer.run(bindingA, sync)).status).toBe('failed');
      await knowledge.releaseImportBinding({ importerId: 'fireflies', binding: knowledgeImporterBindingKey(bindingA) });
      for (const binding of [bindingA, bindingB]) {
        const run = await importer.run(binding, sync);
        expect(run.status).toBe('failed');
        expect(run.error).toMatch(/changed outside importer/);
      }
      expect((await storage.getNode(nodeId))!.name).toBe('Curator title');
    });

    it('still treats an outside edit made after every binding was released as an outside edit', async () => {
      const { knowledge, storage, importer } = await setup(createStore);
      await importer.run(bindingA, { items: [person] });
      await knowledge.releaseImportBinding({ importerId: 'fireflies', binding: knowledgeImporterBindingKey(bindingA) });
      const nodeId = (await storage.getNodeAddress({ source, address: person.address }))!.nodeId;
      const node = (await storage.getNode(nodeId))!;
      await knowledge.updateNode({ id: nodeId, version: node.version, name: 'Curated by a person' });
      const run = await importer.run(bindingB, { items: [{ ...person, name: 'Shane (updated)' }] });
      expect(run.status).toBe('failed');
      expect(run.error).toMatch(/changed outside importer/);
      expect((await storage.getNode(nodeId))!.name).toBe('Curated by a person');
    });

    it('converges when both bindings import the same items concurrently', async () => {
      const { storage, importer, alpha, beta } = await setup(createStore);
      const items = Array.from({ length: 8 }, (_, index) => ({
        address: `person:${index}`,
        name: `Person ${index}`,
        records: [{ id: `rec-${index}`, text: `Fact ${index}` }],
      }));
      const runs = await Promise.all([importer.run(bindingA, { items }), importer.run(bindingB, { items })]);
      for (const [index, run] of runs.entries()) {
        if (run.status === 'succeeded') continue;
        // A run may lose a write race; it must never mistake the other binding for an outside edit.
        expect(run.error).not.toMatch(/changed outside importer/);
        expect((await importer.run(index === 0 ? bindingA : bindingB, { items })).error).toBeUndefined();
      }
      for (const item of items) {
        const nodeId = (await storage.getNodeAddress({ source, address: item.address }))!.nodeId;
        expect(sorted(await storage.getNodeScopeIds(nodeId))).toEqual(sorted([alpha, beta]));
        expect(sorted(await storage.getRecordScopeIds(item.records[0]!.id))).toEqual(sorted([alpha, beta]));
      }
    });

    it('recovers when a run is interrupted between its node and record writes', async () => {
      const { storage, importer, alpha, beta } = await setup(createStore);
      await importer.run(bindingA, { items: [person] });
      const betaItem = { ...person, records: [{ id: 'rec-beta-only', text: 'Beta note' }] };
      const createRecord = storage.createRecord.bind(storage);
      storage.createRecord = async () => {
        throw new Error('simulated crash');
      };
      try {
        expect((await importer.run(bindingB, { items: [betaItem] })).status).toBe('failed');
      } finally {
        storage.createRecord = createRecord;
      }
      expect((await importer.run(bindingB, { items: [betaItem] })).error).toBeUndefined();
      const nodeId = (await storage.getNodeAddress({ source, address: person.address }))!.nodeId;
      expect(sorted(await storage.getNodeScopeIds(nodeId))).toEqual(sorted([alpha, beta]));
      expect(await storage.getRecordScopeIds('rec-beta-only')).toEqual([beta]);
      expect(await storage.getRecordScopeIds('rec-shane-1')).toEqual([alpha]);
    });
  });
}

const ORG = '20000000-0000-4000-8000-000000000001';
const ALPHA = '20000000-0000-4000-8000-000000000002';
const BETA = '20000000-0000-4000-8000-000000000003';
const claimantA: KnowledgeImportClaimant = {
  importerId: 'importer',
  binding: JSON.stringify(['src', 'project:alpha']),
  source: 'src',
};
const claimantB: KnowledgeImportClaimant = {
  importerId: 'importer',
  binding: JSON.stringify(['src', 'project:beta']),
  source: 'src',
};

/** Storage-level contract for importer claims: membership union, atomic claim versions, release. */
export function createKnowledgeImportClaimStorageTests(
  createStorage: () => KnowledgeStorage | Promise<KnowledgeStorage>,
) {
  describe('Knowledge storage importer claims', () => {
    async function seeded() {
      const storage = await createStorage();
      await storage.init();
      await storage.createNode({ id: ORG, name: 'Org', isScope: true, scopeIds: [] });
      await storage.createNode({ id: ALPHA, name: 'Alpha', isScope: true, scopeIds: [ORG] });
      await storage.createNode({ id: BETA, name: 'Beta', isScope: true, scopeIds: [ORG] });
      const node = await storage.createNode({ name: 'Shared', scopeIds: [ALPHA], claimant: claimantA });
      return { storage, node };
    }

    it('records the creating claimant atomically with the node and record', async () => {
      const { storage, node } = await seeded();
      expect(await storage.listImportClaims({ targetType: 'node', targetId: node.id })).toEqual([
        expect.objectContaining({ ...claimantA, scopeIds: [ALPHA], version: node.version }),
      ]);
      const record = await storage.createRecord({
        id: 'r1',
        node: node.id,
        text: 'fact',
        source: 'src',
        scopeIds: [ALPHA],
        claimant: claimantA,
      });
      expect(await storage.listImportClaims({ targetType: 'record', targetId: record.id })).toEqual([
        expect.objectContaining({ ...claimantA, scopeIds: [ALPHA], version: 1 }),
      ]);
    });

    it('unions node memberships across claimants without touching record versions', async () => {
      const { storage, node } = await seeded();
      const record = await storage.createRecord({
        id: 'r1',
        node: node.id,
        text: 'f',
        source: 'src',
        scopeIds: [ALPHA],
      });
      const joined = await storage.setNodeScopes({
        id: node.id,
        version: node.version,
        claimant: claimantB,
        scopeIds: [BETA],
      });
      expect(joined.version).toBe(node.version + 1);
      expect([...(await storage.getNodeScopeIds(node.id))].sort()).toEqual([ALPHA, BETA].sort());
      expect((await storage.getRecord({ id: record.id }))!.version).toBe(record.version);
      // Every claim that was current stays current, so neither binding sees an outside edit.
      const claims = await storage.listImportClaims({ targetType: 'node', targetId: node.id });
      expect(claims.map(claim => claim.version)).toEqual([joined.version, joined.version]);

      // Replacing B's claim with the same scopes is a no-op; dropping it keeps A's membership.
      expect(
        (await storage.setNodeScopes({ id: node.id, version: joined.version, claimant: claimantB, scopeIds: [BETA] }))
          .version,
      ).toBe(joined.version);
      await expect(
        storage.setNodeScopes({ id: node.id, version: node.version, claimant: claimantB, scopeIds: [BETA] }),
      ).rejects.toThrow(KnowledgeConflictError);
      const moved = await storage.setNodeScopes({
        id: node.id,
        version: joined.version,
        claimant: claimantA,
        scopeIds: [BETA],
      });
      expect(await storage.getNodeScopeIds(node.id)).toEqual([BETA]);
      expect(moved.version).toBe(joined.version + 1);
    });

    it('keeps record claims current through a node update', async () => {
      const { storage, node } = await seeded();
      const record = await storage.createRecord({
        id: 'r1',
        node: node.id,
        text: 'f',
        source: 'src',
        scopeIds: [ALPHA],
        claimant: claimantA,
      });
      await storage.updateNode({ id: node.id, version: node.version, name: 'Shared renamed', claimant: claimantA });
      const bumped = (await storage.getRecord({ id: record.id }))!;
      expect(bumped.version).toBe(record.version + 1);
      expect(await storage.listImportClaims({ targetType: 'record', targetId: record.id })).toEqual([
        expect.objectContaining({ version: bumped.version }),
      ]);
    });

    it('shares a record between claimants and deletes it only with the last claim', async () => {
      const { storage, node } = await seeded();
      const record = await storage.createRecord({
        id: 'r1',
        node: node.id,
        text: 'f',
        source: 'src',
        scopeIds: [ALPHA],
        claimant: claimantA,
      });
      const shared = await storage.claimRecord({
        id: record.id,
        version: record.version,
        claimant: claimantB,
        scopeIds: [BETA],
      });
      expect([...(await storage.getRecordScopeIds(record.id))].sort()).toEqual([ALPHA, BETA].sort());

      const afterA = await storage.releaseRecordClaim({ id: record.id, version: shared.version, claimant: claimantA });
      expect(afterA.deleted).toBe(false);
      expect(await storage.getRecordScopeIds(record.id)).toEqual([BETA]);
      expect(await storage.listImportClaims({ targetType: 'record', targetId: record.id })).toEqual([
        expect.objectContaining({ binding: claimantB.binding, version: afterA.record.version }),
      ]);

      const afterB = await storage.releaseRecordClaim({
        id: record.id,
        version: afterA.record.version,
        claimant: claimantB,
      });
      expect(afterB.deleted).toBe(true);
      expect(await storage.getRecord({ id: record.id, includeDeleted: true })).toBeNull();
      expect(await storage.listImportClaims({ targetType: 'record', targetId: record.id })).toEqual([]);
    });

    it('releases every claim one binding holds and nothing else', async () => {
      const { storage, node } = await seeded();
      const joined = await storage.setNodeScopes({
        id: node.id,
        version: node.version,
        claimant: claimantB,
        scopeIds: [BETA],
      });
      const onlyA = await storage.createRecord({
        id: 'ra',
        node: node.id,
        text: 'a',
        source: 'src',
        scopeIds: [ALPHA],
        claimant: claimantA,
      });
      const shared = await storage.createRecord({
        id: 'rs',
        node: node.id,
        text: 's',
        source: 'src',
        scopeIds: [ALPHA],
        claimant: claimantA,
      });
      await storage.claimRecord({ id: shared.id, version: shared.version, claimant: claimantB, scopeIds: [BETA] });

      await storage.releaseImportClaims({ importerId: claimantA.importerId, binding: claimantA.binding });
      expect(await storage.getRecord({ id: onlyA.id })).toBeNull();
      expect(await storage.getRecordScopeIds(shared.id)).toEqual([BETA]);
      expect(await storage.getNodeScopeIds(node.id)).toEqual([BETA]);
      expect(await storage.listImportClaims({ targetType: 'node', targetId: node.id })).toEqual([
        expect.objectContaining({ binding: claimantB.binding, version: joined.version + 1 }),
      ]);
    });
  });
}
