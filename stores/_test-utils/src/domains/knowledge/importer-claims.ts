import { Knowledge } from '@mastra/core/knowledge';
import type { KnowledgeImporterHandlerContext } from '@mastra/core/knowledge';
import {
  KnowledgeConflictError,
  knowledgeImporterBindingKey,
  knowledgeImportNodeAddress,
  knowledgeImportStoredRecordId,
} from '@mastra/core/storage';
import type { KnowledgeImportClaimant, KnowledgeStorage, MastraCompositeStore } from '@mastra/core/storage';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * FACT-471: one importer source bound into two project scopes. Imported identity is per destination,
 * so each binding imports its own copy of an item and can never fail on, overwrite or remove the
 * other's, while outside edits are still rejected.
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

type Binding = typeof bindingA | typeof bindingB;
/** The node a binding stored for a provider address. */
async function nodeIn(storage: KnowledgeStorage, binding: Binding, address: string): Promise<string> {
  const entry = await storage.getNodeAddress({ source, address: knowledgeImportNodeAddress(binding.scope, address) });
  if (!entry) throw new Error(`no node for ${address} in ${binding.scope}`);
  return entry.nodeId;
}
/** The stored id of a record the fireflies importer named in a binding. */
const recordIn = (binding: Binding, id: string) =>
  knowledgeImportStoredRecordId({ importerId: 'fireflies', binding: knowledgeImporterBindingKey(binding) }, id);

export function createKnowledgeImporterMultiBindingTests(
  createStore: () => MastraCompositeStore | Promise<MastraCompositeStore>,
) {
  describe('Knowledge importer: one source bound into two scopes (FACT-471)', () => {
    afterEach(async () => {
      await Promise.all(openStores.splice(0).map(store => (store as { close?: () => Promise<void> }).close?.()));
    });

    it('imports the same item into a second binding as its own copy', async () => {
      const { storage, importer, alpha, beta } = await setup(createStore);
      expect((await importer.run(bindingA, { items: [person] })).status).toBe('succeeded');
      const second = await importer.run(bindingB, { items: [person] });
      expect(second.error).toBeUndefined();
      const [a, b] = [await nodeIn(storage, bindingA, person.address), await nodeIn(storage, bindingB, person.address)];
      expect(a).not.toBe(b);
      expect(await storage.getNodeScopeIds(a)).toEqual([alpha]);
      expect(await storage.getNodeScopeIds(b)).toEqual([beta]);
      expect(await storage.getRecordScopeIds(recordIn(bindingA, 'rec-shane-1'))).toEqual([alpha]);
      expect(await storage.getRecordScopeIds(recordIn(bindingB, 'rec-shane-1'))).toEqual([beta]);
      // Replays by either binding are no-ops, never "changed outside importer".
      for (const binding of [bindingA, bindingB, bindingA]) {
        expect((await importer.run(binding, { items: [person] })).error).toBeUndefined();
      }
    });

    it("never lets one binding change the other binding's node or records", async () => {
      const { storage, importer } = await setup(createStore);
      const withAlphaNote = { ...person, records: [{ id: 'rec-alpha-only', text: 'Alpha note' }] };
      await importer.run(bindingA, { items: [withAlphaNote] });
      const a = (await storage.getNode(await nodeIn(storage, bindingA, person.address)))!;
      const alphaNote = (await storage.getRecord({ id: recordIn(bindingA, 'rec-alpha-only') }))!;

      const run = await importer.run(bindingB, { items: [{ ...person, name: 'Shane (from beta)' }] });
      expect(run.error).toBeUndefined();
      expect(await storage.getNode(a.id)).toEqual(a);
      expect(await storage.getRecord({ id: alphaNote.id })).toEqual(alphaNote);
      expect((await storage.getNode(await nodeIn(storage, bindingB, person.address)))!.name).toBe('Shane (from beta)');
    });

    it('shows each project reader only its own copy', async () => {
      const { storage, importer, alpha, beta, org } = await setup(createStore);
      await importer.run(bindingA, { items: [person] });
      await importer.run(bindingB, { items: [person] });
      const [a, b] = [await nodeIn(storage, bindingA, person.address), await nodeIn(storage, bindingB, person.address)];
      for (const [reader, own, other] of [
        [[alpha, org], a, b],
        [[beta, org], b, a],
      ] as const) {
        const ids = (await storage.listNodes({ scopeIds: [...reader] })).map(node => node.id);
        expect(ids).toContain(own);
        expect(ids).not.toContain(other);
        expect((await storage.listRecords({ node: other, scopeIds: [...reader] })).records).toEqual([]);
        expect((await storage.listRecords({ node: own, scopeIds: [...reader] })).records).toHaveLength(1);
      }
    });

    it("keeps each binding's removal and run history to itself", async () => {
      const { knowledge, storage, importer } = await setup(createStore);
      await importer.run(bindingA, { items: [person] });
      await importer.run(bindingB, { items: [person] });
      expect((await importer.run(bindingA, { items: [], removed: [person.address] })).error).toBeUndefined();
      expect(await storage.getRecord({ id: recordIn(bindingA, 'rec-shane-1') })).toBeNull();
      expect(await storage.getRecord({ id: recordIn(bindingB, 'rec-shane-1') })).not.toBeNull();
      expect(await storage.getNode(await nodeIn(storage, bindingA, person.address))).not.toBeNull();

      for (const binding of [bindingA, bindingB]) {
        const key = knowledgeImporterBindingKey(binding);
        const { runs } = await knowledge.listImportRuns({ importerId: 'fireflies', binding: key });
        expect(runs.length).toBeGreaterThan(0);
        expect(runs.every(run => run.binding === key)).toBe(true);
      }
    });

    it("rejects an outside edit to one binding's node and leaves the other binding working", async () => {
      const { knowledge, storage, importer } = await setup(createStore);
      await importer.run(bindingA, { items: [person] });
      await importer.run(bindingB, { items: [person] });
      const nodeId = await nodeIn(storage, bindingA, person.address);
      const node = (await storage.getNode(nodeId))!;
      await knowledge.updateNode({ id: nodeId, version: node.version, name: 'Renamed by a person' });
      const renamed = { ...person, name: 'Shane (updated)' };
      const run = await importer.run(bindingA, { items: [renamed] });
      expect(run.status).toBe('failed');
      expect(run.error).toMatch(/changed outside importer/);
      expect((await storage.getNode(nodeId))!.name).toBe('Renamed by a person');
      expect((await importer.run(bindingB, { items: [renamed] })).error).toBeUndefined();
    });

    it("does not let a different importer naming the same source rewrite or claim the first one's data", async () => {
      const { knowledge, storage, importer, alpha } = await setup(createStore);
      await importer.run(bindingA, { items: [person] });
      const nodeId = await nodeIn(storage, bindingA, person.address);
      const before = (await storage.getNode(nodeId))!;
      const other = knowledge.getImporter('other-importer')!;
      const renamed = { ...person, name: 'Mallory' };

      // Into the same destination: the address is taken, so it fails without writing.
      const sameScope = await other.run(bindingA, { items: [renamed] });
      expect(sameScope.error).toMatch(/changed outside importer other-importer/);
      // Into another destination it gets its own copy and still cannot touch the first one's.
      expect((await other.run(bindingB, { items: [renamed] })).error).toBeUndefined();

      expect(await storage.getNode(nodeId)).toEqual(before);
      expect(await storage.getNodeScopeIds(nodeId)).toEqual([alpha]);
      expect(await storage.getRecordScopeIds(recordIn(bindingA, 'rec-shane-1'))).toEqual([alpha]);
      const claims = await storage.listImportClaims({ targetType: 'node', targetId: nodeId });
      expect(claims.map(claim => claim.importerId)).toEqual(['fireflies']);
      expect((await importer.run(bindingA, { items: [person] })).error).toBeUndefined();
    });

    it('shows a node in the binding scope and an imported container to project readers only', async () => {
      const { storage, importer, alpha, beta, org } = await setup(createStore);
      const run = await importer.run(bindingA, {
        containers: ['teamspace:eng'],
        items: [{ ...person, container: 'teamspace:eng' }],
      });
      expect(run.error).toBeUndefined();
      const teamspace = await nodeIn(storage, bindingA, 'teamspace:eng');
      const nodeId = await nodeIn(storage, bindingA, person.address);
      expect(sorted(await storage.getNodeScopeIds(nodeId))).toEqual(sorted([alpha, teamspace]));
      expect(await storage.getNodeScopeIds(teamspace)).toEqual([alpha]);

      // A project reader holds the project and its parent chain; it sees the node through the binding scope.
      const projectReader = [alpha, org];
      expect((await storage.listNodes({ scopeIds: projectReader })).map(node => node.id)).toContain(nodeId);
      const visible = await storage.listRecords({ node: nodeId, scopeIds: projectReader });
      expect(visible.records.map(record => record.id)).toEqual([recordIn(bindingA, 'rec-shane-1')]);

      // A reader holding only an unrelated scope sees neither the node nor its records.
      for (const unrelated of [[beta], [org]]) {
        const ids = (await storage.listNodes({ scopeIds: unrelated })).map(node => node.id);
        expect(ids).not.toContain(nodeId);
        expect(ids).not.toContain(teamspace);
        expect((await storage.listRecords({ node: nodeId, scopeIds: unrelated })).records).toEqual([]);
      }
    });

    it('retires a binding without changing retained knowledge, placement, references or indexing', async () => {
      const { knowledge, storage, importer, alpha, beta } = await setup(createStore);
      await importer.run(bindingA, { items: [person] });
      await importer.run(bindingB, { items: [person] });
      const a = await nodeIn(storage, bindingA, person.address);
      const b = await nodeIn(storage, bindingB, person.address);
      const recordId = recordIn(bindingA, 'rec-shane-1');
      const notes = await storage.createNode({ name: 'Notes', scopeIds: [alpha] });
      const firstReference = await storage.createRecord({
        node: notes.id,
        text: 'Remember [[Shane]].',
        scopeIds: [alpha],
      });
      const snapshot = async () => ({
        node: await storage.getNode(a),
        record: await storage.getRecord({ id: recordId, includeDeleted: true }),
        nodeScopes: await storage.getNodeScopeIds(a),
        recordScopes: await storage.getRecordScopeIds(recordId),
        addresses: await storage.listNodeAddresses({ source }),
        mentions: await storage.listMentioningRecords({ node: a, scopeIds: [alpha] }),
        outbox: await storage.listSemanticOutbox(),
        activity: await storage.listActivity({ scopeIds: [alpha, beta] }),
        otherNode: await storage.getNode(b),
        otherRecord: await storage.getRecord({ id: recordIn(bindingB, 'rec-shane-1') }),
      });
      const before = await snapshot();
      for (let attempt = 0; attempt < 2; attempt++) {
        await knowledge.releaseImportBinding({
          importerId: 'fireflies',
          binding: knowledgeImporterBindingKey(bindingA),
        });
        expect(await snapshot()).toEqual(before);
      }
      expect((await storage.listRecords({ node: a, scopeIds: [alpha] })).records.map(record => record.id)).toEqual([
        recordId,
      ]);
      expect((await storage.listRecords({ node: a, scopeIds: [beta] })).records).toEqual([]);
      expect(
        (await storage.listMentioningRecords({ node: a, scopeIds: [alpha] })).records.map(record => record.id),
      ).toEqual([firstReference.id]);
      const later = await storage.createRecord({
        node: notes.id,
        text: 'Later reference to [[Shane]].',
        scopeIds: [alpha],
      });
      expect(
        (await storage.listMentioningRecords({ node: a, scopeIds: [alpha] })).records.map(record => record.id).sort(),
      ).toEqual([firstReference.id, later.id].sort());
      expect((await storage.listMentioningRecords({ node: b, scopeIds: [beta] })).records).toEqual([]);
      for (const targetType of ['node', 'record'] as const) {
        const left = await storage.listImportClaims({ targetType, targetId: targetType === 'node' ? a : recordId });
        expect(left.flatMap(claim => claim.scopeIds)).toEqual(targetType === 'node' ? [] : [alpha]);
      }
      expect((await importer.run(bindingA, { items: [person] })).error).toBeUndefined();
      expect(await nodeIn(storage, bindingA, person.address)).toBe(a);
      expect((await importer.run(bindingA, { items: [], removed: [person.address] })).error).toBeUndefined();
      expect(await storage.getRecord({ id: recordId, includeDeleted: true })).toBeNull();
      expect(await storage.getNode(a)).toEqual(before.node);
      expect(await storage.getRecord({ id: recordIn(bindingB, 'rec-shane-1') })).toEqual(before.otherRecord);
    });

    it('allows a later reference to an empty retained node without creating a replacement', async () => {
      const { knowledge, storage, importer, alpha } = await setup(createStore);
      await importer.run(bindingA, { items: [person] });
      await importer.run(bindingA, { items: [], removed: [person.address] });
      const nodeId = await nodeIn(storage, bindingA, person.address);
      await knowledge.releaseImportBinding({ importerId: 'fireflies', binding: knowledgeImporterBindingKey(bindingA) });
      expect((await storage.listRecords({ node: nodeId, scopeIds: [alpha] })).records).toEqual([]);
      const note = await storage.createNode({ name: 'Later note', scopeIds: [alpha] });
      const record = await storage.createRecord({
        node: note.id,
        text: 'Follow up with [[Shane]].',
        scopeIds: [alpha],
      });
      expect(
        (await storage.listMentioningRecords({ node: nodeId, scopeIds: [alpha] })).records.map(item => item.id),
      ).toEqual([record.id]);
      expect(
        (await storage.listNodes({ scopeIds: [alpha] })).filter(node => node.name === 'Shane').map(node => node.id),
      ).toEqual([nodeId]);
    });

    it.each(['before', 'after'] as const)(
      'preserves a record edited %s retirement rather than refreshing its ownership',
      async when => {
        const { knowledge, storage, importer, alpha, org } = await setup(createStore);
        await importer.run(bindingA, { items: [person] });
        const id = recordIn(bindingA, 'rec-shane-1');
        const initial = (await storage.getRecord({ id }))!;
        const retire = () =>
          knowledge.releaseImportBinding({ importerId: 'fireflies', binding: knowledgeImporterBindingKey(bindingA) });
        if (when === 'after') await retire();
        const edited = await storage.setRecordScopes({ id, version: initial.version, scopeIds: [alpha, org] });
        if (when === 'before') await retire();
        expect((await importer.run(bindingA, { items: [person] })).status).toBe('failed');
        await importer.run(bindingA, { items: [], removed: [person.address] });
        expect(await storage.getRecord({ id })).toEqual(edited);
        const claims = await storage.listImportClaims({ targetType: 'record', targetId: id });
        expect(claims).toEqual([expect.objectContaining({ version: initial.version, scopeIds: [alpha] })]);
      },
    );

    it('does not let a release turn an earlier outside edit into importer-owned data', async () => {
      const { knowledge, storage, importer } = await setup(createStore);
      await importer.run(bindingA, { items: [person] });
      const nodeId = await nodeIn(storage, bindingA, person.address);
      const node = (await storage.getNode(nodeId))!;
      await knowledge.updateNode({ id: nodeId, version: node.version, name: 'Curator title' });
      const sync = { items: [{ ...person, name: 'Shane (updated)' }] };
      expect((await importer.run(bindingA, sync)).status).toBe('failed');
      await knowledge.releaseImportBinding({ importerId: 'fireflies', binding: knowledgeImporterBindingKey(bindingA) });
      const run = await importer.run(bindingA, sync);
      expect(run.status).toBe('failed');
      expect(run.error).toMatch(/changed outside importer/);
      expect((await storage.getNode(nodeId))!.name).toBe('Curator title');
    });

    it('still treats an outside edit made after release as an outside edit', async () => {
      const { knowledge, storage, importer } = await setup(createStore);
      await importer.run(bindingA, { items: [person] });
      await knowledge.releaseImportBinding({ importerId: 'fireflies', binding: knowledgeImporterBindingKey(bindingA) });
      const nodeId = await nodeIn(storage, bindingA, person.address);
      const node = (await storage.getNode(nodeId))!;
      await knowledge.updateNode({ id: nodeId, version: node.version, name: 'Curated by a person' });
      const run = await importer.run(bindingA, { items: [{ ...person, name: 'Shane (updated)' }] });
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
      for (const run of runs) expect(run.error).toBeUndefined();
      for (const item of items) {
        expect(await storage.getNodeScopeIds(await nodeIn(storage, bindingA, item.address))).toEqual([alpha]);
        expect(await storage.getNodeScopeIds(await nodeIn(storage, bindingB, item.address))).toEqual([beta]);
      }
    });

    it('recovers when a run is interrupted between its node and record writes', async () => {
      const { storage, importer, beta } = await setup(createStore);
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
      expect(await storage.getRecordScopeIds(recordIn(bindingB, 'rec-beta-only'))).toEqual([beta]);
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

    it.each([
      { name: 'disjoint', scopes: [BETA] },
      { name: 'identical', scopes: [ALPHA] },
      { name: 'partially overlapping', scopes: [ALPHA, BETA] },
    ])('keeps retired placement when another importer removes $name scopes', async ({ scopes }) => {
      const { storage, node } = await seeded();
      const record = await storage.createRecord({
        node: node.id,
        text: 'Retained fact',
        source: 'src',
        scopeIds: [ALPHA],
        claimant: claimantA,
      });
      const other = { ...claimantB, importerId: 'different-importer' };
      const shared = await storage.claimRecord({
        id: record.id,
        version: record.version,
        claimant: other,
        scopeIds: scopes,
      });
      await storage.releaseImportClaims({ importerId: claimantA.importerId, binding: claimantA.binding });
      const removed = await storage.releaseRecordClaim({ id: record.id, version: shared.version, claimant: other });
      expect(removed.deleted).toBe(false);
      expect(await storage.getRecord({ id: record.id })).toMatchObject({ text: record.text });
      expect(await storage.getRecordScopeIds(record.id)).toEqual([ALPHA]);
      expect((await storage.listRecords({ node: node.id, scopeIds: [ALPHA] })).records.map(item => item.id)).toEqual([
        record.id,
      ]);
      expect((await storage.listRecords({ node: node.id, scopeIds: [BETA] })).records).toEqual([]);
      expect(await storage.listImportClaims({ targetType: 'record', targetId: record.id })).toEqual([
        expect.objectContaining({ importerId: claimantA.importerId, scopeIds: [ALPHA] }),
      ]);
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
        text: 's [[Shared]]',
        source: 'src',
        scopeIds: [ALPHA],
        claimant: claimantA,
      });
      await storage.claimRecord({ id: shared.id, version: shared.version, claimant: claimantB, scopeIds: [BETA] });
      const snapshot = async () => ({
        node: await storage.getNode(node.id),
        onlyA: await storage.getRecord({ id: onlyA.id }),
        shared: await storage.getRecord({ id: shared.id }),
        nodeScopes: await storage.getNodeScopeIds(node.id),
        recordScopes: await storage.getRecordScopeIds(shared.id),
        mentions: await storage.listMentioningRecords({ node: node.id, scopeIds: [ALPHA, BETA] }),
        outbox: await storage.listSemanticOutbox(),
      });
      const before = await snapshot();
      for (let attempt = 0; attempt < 2; attempt++) {
        await storage.releaseImportClaims({ importerId: claimantA.importerId, binding: claimantA.binding });
        expect(await snapshot()).toEqual(before);
      }
      expect(await storage.getRecord({ id: onlyA.id })).toEqual(onlyA);
      expect(sorted(await storage.getRecordScopeIds(shared.id))).toEqual(sorted([ALPHA, BETA]));
      expect(sorted(await storage.getNodeScopeIds(node.id))).toEqual(sorted([ALPHA, BETA]));
      expect(await storage.listImportClaims({ targetType: 'node', targetId: node.id })).toEqual([
        expect.objectContaining({ binding: claimantB.binding, version: joined.version }),
      ]);
    });
  });
}
