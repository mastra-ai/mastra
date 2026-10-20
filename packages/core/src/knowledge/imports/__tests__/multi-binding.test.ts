import { describe, expect, it } from 'vitest';
import {
  InMemoryStore,
  knowledgeImporterBindingKey,
  knowledgeImportNodeAddress,
  knowledgeImportStoredRecordId,
} from '../../../storage';
import type { MastraCompositeStore } from '../../../storage';
import { Knowledge } from '../../index';
import type { KnowledgeImporterHandlerContext } from '../types';

/**
 * FACT-471: one importer source bound into two project scopes. Imported identity is per destination, so each
 * binding imports its own copy of an item: neither can fail on, overwrite or remove the other's.
 */

const source = 'fireflies:workspace-1';
const bindingA = { source, scope: 'project:alpha' } as const;
const bindingB = { source, scope: 'project:beta' } as const;
type Binding = typeof bindingA | typeof bindingB;

interface Item {
  address: string;
  name: string;
  records: Array<{ id: string; text: string }>;
}

type Payload = { items: Item[]; removed?: string[] };

export function createMultiBindingKnowledge(storage: MastraCompositeStore = new InMemoryStore({ id: 'fact-471' })) {
  return new Knowledge({
    storage,
    structure: {
      scopes: [
        { address: 'org:acme', name: 'Acme' },
        { address: 'project:alpha', name: 'Alpha', parentAddresses: ['org:acme'] },
        { address: 'project:beta', name: 'Beta', parentAddresses: ['org:acme'] },
      ],
    },
    importers: [
      {
        id: 'fireflies',
        access: { 'project:$projectId': 'owner' },
        handler: async (ctx: KnowledgeImporterHandlerContext<Payload>) => {
          const importer = await ctx.importer();
          for (const item of ctx.payload?.items ?? []) {
            const node = await importer.upsertNode(item.address, { name: item.name, scopes: [importer.scope] });
            const existing = new Set((await node.listKnowledge()).map(record => record.id));
            for (const record of item.records) {
              if (!existing.has(record.id)) await node.appendKnowledge(record);
            }
          }
          for (const address of ctx.payload?.removed ?? []) await importer.removeNode(address);
        },
      },
    ],
  });
}

const person: Item = {
  address: 'person:shane@mastra.ai',
  name: 'Shane',
  records: [{ id: 'rec-shane-1', text: 'Shane runs the Thursday sync.' }],
};

const recordId = (binding: Binding, id: string) =>
  knowledgeImportStoredRecordId({ importerId: 'fireflies', binding: knowledgeImporterBindingKey(binding) }, id);

async function setup(createStorage: () => MastraCompositeStore) {
  const knowledge = createMultiBindingKnowledge(createStorage());
  await knowledge.reconcile();
  const storage = await knowledge.getStorage();
  return {
    knowledge,
    storage,
    importer: knowledge.getImporter<Payload>('fireflies')!,
    alpha: (await storage.getScopeAddress('project:alpha'))!.scopeNodeId,
    beta: (await storage.getScopeAddress('project:beta'))!.scopeNodeId,
    nodeId: async (binding: Binding, address: string) =>
      (await storage.getNodeAddress({ source, address: knowledgeImportNodeAddress(binding.scope, address) }))?.nodeId,
  };
}

export function describeMultiBindingImports(name: string, createStorage: () => MastraCompositeStore) {
  describe(`${name}: one importer source bound into two scopes (FACT-471)`, () => {
    it('imports the same item into a second binding as its own copy', async () => {
      const { storage, importer, alpha, beta, nodeId } = await setup(createStorage);
      expect((await importer.run(bindingA, { items: [person] })).status).toBe('succeeded');
      const second = await importer.run(bindingB, { items: [person] });
      expect(second.error).toBeUndefined();

      const [a, b] = [await nodeId(bindingA, person.address), await nodeId(bindingB, person.address)];
      expect(a).toBeDefined();
      expect(b).toBeDefined();
      expect(a).not.toBe(b);
      expect(await storage.getNodeScopeIds(a!)).toEqual([alpha]);
      expect(await storage.getNodeScopeIds(b!)).toEqual([beta]);
      expect(await storage.getRecordScopeIds(recordId(bindingA, 'rec-shane-1'))).toEqual([alpha]);
      expect(await storage.getRecordScopeIds(recordId(bindingB, 'rec-shane-1'))).toEqual([beta]);
      for (const binding of [bindingA, bindingB, bindingA]) {
        expect((await importer.run(binding, { items: [person] })).error).toBeUndefined();
      }
    });

    it("never lets one binding change the other's node or records", async () => {
      const { storage, importer, nodeId } = await setup(createStorage);
      await importer.run(bindingA, { items: [{ ...person, records: [{ id: 'rec-a', text: 'A only' }] }] });
      const a = (await storage.getNode((await nodeId(bindingA, person.address))!))!;
      const recordA = (await storage.getRecord({ id: recordId(bindingA, 'rec-a') }))!;

      await importer.run(bindingB, { items: [{ ...person, name: 'Shane (from B)' }] });
      expect(await storage.getNode(a.id)).toEqual(a);
      expect(await storage.getRecord({ id: recordA.id })).toEqual(recordA);
      expect((await storage.getNode((await nodeId(bindingB, person.address))!))!.name).toBe('Shane (from B)');
    });

    it("keeps each binding's removal and run history to itself", async () => {
      const { knowledge, storage, importer, nodeId } = await setup(createStorage);
      await importer.run(bindingA, { items: [person] });
      await importer.run(bindingB, { items: [person] });

      expect((await importer.run(bindingA, { items: [], removed: [person.address] })).status).toBe('succeeded');
      expect(await storage.getRecord({ id: recordId(bindingA, 'rec-shane-1') })).toBeNull();
      expect(await storage.getRecord({ id: recordId(bindingB, 'rec-shane-1') })).not.toBeNull();
      expect(await storage.getNode((await nodeId(bindingA, person.address))!)).not.toBeNull();

      for (const binding of [bindingA, bindingB]) {
        const key = knowledgeImporterBindingKey(binding);
        const { runs } = await knowledge.listImportRuns({ importerId: 'fireflies', binding: key });
        expect(runs.every(run => run.binding === key)).toBe(true);
      }
    });

    it("rejects an outside edit to one binding's node without affecting the other", async () => {
      const { knowledge, storage, importer, nodeId } = await setup(createStorage);
      await importer.run(bindingA, { items: [person] });
      await importer.run(bindingB, { items: [person] });
      const a = (await storage.getNode((await nodeId(bindingA, person.address))!))!;
      await knowledge.updateNode({ id: a.id, version: a.version, name: 'Renamed by a person' });

      const renamed = { ...person, name: 'Shane (updated)' };
      const runA = await importer.run(bindingA, { items: [renamed] });
      expect(runA.status).toBe('failed');
      expect(runA.error).toMatch(/changed outside importer/);
      expect((await storage.getNode(a.id))!.name).toBe('Renamed by a person');
      expect((await importer.run(bindingB, { items: [renamed] })).error).toBeUndefined();
    });

    it('converges when both bindings import concurrently', async () => {
      const { storage, importer, alpha, beta, nodeId } = await setup(createStorage);
      const items = Array.from({ length: 8 }, (_, index) => ({
        address: `person:${index}`,
        name: `Person ${index}`,
        records: [{ id: `rec-${index}`, text: `Fact ${index}` }],
      }));
      const runs = await Promise.all([importer.run(bindingA, { items }), importer.run(bindingB, { items })]);
      for (const run of runs) expect(run.error).toBeUndefined();
      for (const item of items) {
        expect(await storage.getNodeScopeIds((await nodeId(bindingA, item.address))!)).toEqual([alpha]);
        expect(await storage.getNodeScopeIds((await nodeId(bindingB, item.address))!)).toEqual([beta]);
      }
    });

    it('keeps provider record ids distinct when one ends in the storage suffix (public run)', async () => {
      const { storage, importer, nodeId } = await setup(createStorage);
      const lookalike = recordId(bindingA, 'item');
      const item = {
        ...person,
        records: [
          { id: 'item', text: 'Same text' },
          { id: lookalike, text: 'Same text' },
        ],
      };
      expect((await importer.run(bindingA, { items: [item] })).error).toBeUndefined();
      const node = (await nodeId(bindingA, person.address))!;
      const stored = (
        await storage.listRecords({ node, scopeIds: [(await storage.getScopeAddress('project:alpha'))!.scopeNodeId] })
      ).records;
      expect(stored.map(record => record.id).sort()).toEqual(
        [recordId(bindingA, 'item'), recordId(bindingA, lookalike)].sort(),
      );

      // Removing the item drops both of its records and nothing else.
      expect((await importer.run(bindingA, { items: [], removed: [person.address] })).error).toBeUndefined();
      for (const id of ['item', lookalike]) {
        expect(await storage.getRecord({ id: recordId(bindingA, id), includeDeleted: true })).toBeNull();
      }
    });

    it('recovers when a run is interrupted after its first write', async () => {
      const { storage, importer, beta } = await setup(createStorage);
      await importer.run(bindingA, { items: [person] });
      const original = storage.createRecord.bind(storage);
      let failed = false;
      storage.createRecord = async input => {
        if (!failed) {
          failed = true;
          throw new Error('simulated crash');
        }
        return original(input);
      };
      const item = { ...person, records: [{ id: 'rec-beta-only', text: 'Beta note' }] };
      expect((await importer.run(bindingB, { items: [item] })).status).toBe('failed');
      storage.createRecord = original;

      expect((await importer.run(bindingB, { items: [item] })).error).toBeUndefined();
      expect(await storage.getRecordScopeIds(recordId(bindingB, 'rec-beta-only'))).toEqual([beta]);
    });
  });
}

describeMultiBindingImports('InMemory', () => new InMemoryStore({ id: `fact-471-${Math.random()}` }));
