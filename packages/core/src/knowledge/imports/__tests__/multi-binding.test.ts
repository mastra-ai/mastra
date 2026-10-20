import { describe, expect, it } from 'vitest';
import { InMemoryStore, knowledgeImporterBindingKey } from '../../../storage';
import type { MastraCompositeStore } from '../../../storage';
import { Knowledge } from '../../index';
import type { KnowledgeImporterHandlerContext } from '../types';

/**
 * FACT-471: one importer source bound into two project scopes. Node identity is global per
 * `(source, address)`, so both bindings must share one node, each owning only its own claims.
 */

const source = 'fireflies:workspace-1';
const bindingA = { source, scope: 'project:alpha' } as const;
const bindingB = { source, scope: 'project:beta' } as const;

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
          const scope = JSON.parse(ctx.run.binding)[1] as string;
          const importer = await ctx.importer();
          for (const item of ctx.payload?.items ?? []) {
            const node = await importer.upsertNode(item.address, { name: item.name, scopes: [scope] });
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

async function scopeIds(knowledge: Knowledge) {
  const storage = await knowledge.getStorage();
  const alpha = (await storage.getScopeAddress('project:alpha'))!.scopeNodeId;
  const beta = (await storage.getScopeAddress('project:beta'))!.scopeNodeId;
  return { alpha, beta };
}

export function describeMultiBindingImports(name: string, createStorage: () => MastraCompositeStore) {
  describe(`${name}: one importer source bound into two scopes (FACT-471)`, () => {
    it('lets a second binding import the same item without a "changed outside importer" failure', async () => {
      const knowledge = createMultiBindingKnowledge(createStorage());
      await knowledge.reconcile();
      const importer = knowledge.getImporter<Payload>('fireflies')!;
      const { alpha, beta } = await scopeIds(knowledge);

      const first = await importer.run(bindingA, { items: [person] });
      expect(first).toMatchObject({ status: 'succeeded' });
      const second = await importer.run(bindingB, { items: [person] });
      expect(second.error).toBeUndefined();
      expect(second.status).toBe('succeeded');

      const storage = await knowledge.getStorage();
      const address = await storage.getNodeAddress({ source, address: person.address });
      expect(address).not.toBeNull();
      expect((await storage.getNodeScopeIds(address!.nodeId)).sort()).toEqual([alpha, beta].sort());
      expect((await storage.getRecordScopeIds('rec-shane-1')).sort()).toEqual([alpha, beta].sort());

      // Re-running either binding is a no-op: neither sees the other's write as an outside edit.
      expect((await importer.run(bindingA, { items: [person] })).status).toBe('succeeded');
      expect((await importer.run(bindingB, { items: [person] })).status).toBe('succeeded');
      expect((await storage.getNodeScopeIds(address!.nodeId)).sort()).toEqual([alpha, beta].sort());
    });

    it("keeps each binding's records, removal and state isolated", async () => {
      const knowledge = createMultiBindingKnowledge(createStorage());
      await knowledge.reconcile();
      const importer = knowledge.getImporter<Payload>('fireflies')!;
      const { alpha, beta } = await scopeIds(knowledge);
      const storage = await knowledge.getStorage();

      const onlyAlpha = { ...person, records: [...person.records, { id: 'rec-alpha-only', text: 'Alpha note' }] };
      expect((await importer.run(bindingA, { items: [onlyAlpha] })).status).toBe('succeeded');
      expect((await importer.run(bindingB, { items: [person] })).status).toBe('succeeded');

      // A record claimed only by A is visible only in A.
      expect(await storage.getRecordScopeIds('rec-alpha-only')).toEqual([alpha]);

      // Provider-confirmed removal through A drops only A's claims; B keeps the shared record and the node.
      expect((await importer.run(bindingA, { items: [], removed: [person.address] })).status).toBe('succeeded');
      expect(await storage.getRecord({ id: 'rec-alpha-only' })).toBeNull();
      expect(await storage.getRecordScopeIds('rec-shane-1')).toEqual([beta]);
      const nodeId = (await storage.getNodeAddress({ source, address: person.address }))!.nodeId;
      expect(await storage.getNode(nodeId)).toMatchObject({ id: nodeId });
      expect(await storage.getNodeScopeIds(nodeId)).toEqual(expect.arrayContaining([beta]));

      // Removal through B releases the last claim: the record goes, the node stays.
      expect((await importer.run(bindingB, { items: [], removed: [person.address] })).status).toBe('succeeded');
      expect(await storage.getRecord({ id: 'rec-shane-1' })).toBeNull();
      expect(await storage.getNode(nodeId)).toMatchObject({ id: nodeId });

      // Runs and run history stay per binding.
      const runsA = await knowledge.listImportRuns({
        importerId: 'fireflies',
        binding: knowledgeImporterBindingKey(bindingA),
      });
      const runsB = await knowledge.listImportRuns({
        importerId: 'fireflies',
        binding: knowledgeImporterBindingKey(bindingB),
      });
      expect(runsA.runs.every(run => run.binding === knowledgeImporterBindingKey(bindingA))).toBe(true);
      expect(runsB.runs.every(run => run.binding === knowledgeImporterBindingKey(bindingB))).toBe(true);
      expect(runsA.runs).toHaveLength(2);
      expect(runsB.runs).toHaveLength(2);
    });

    it('still rejects a real outside edit for both bindings', async () => {
      const knowledge = createMultiBindingKnowledge(createStorage());
      await knowledge.reconcile();
      const importer = knowledge.getImporter<Payload>('fireflies')!;
      const storage = await knowledge.getStorage();

      await importer.run(bindingA, { items: [person] });
      await importer.run(bindingB, { items: [person] });
      const nodeId = (await storage.getNodeAddress({ source, address: person.address }))!.nodeId;
      const node = (await storage.getNode(nodeId))!;
      await knowledge.updateNode({ id: nodeId, version: node.version, name: 'Renamed by a person' });

      const renamed = { ...person, name: 'Shane (updated)' };
      for (const binding of [bindingA, bindingB]) {
        const run = await importer.run(binding, { items: [renamed] });
        expect(run.status).toBe('failed');
        expect(run.error).toMatch(/changed outside importer/);
      }
      expect((await storage.getNode(nodeId))!.name).toBe('Renamed by a person');
    });

    it('keeps both claims when the two bindings import concurrently', async () => {
      const knowledge = createMultiBindingKnowledge(createStorage());
      await knowledge.reconcile();
      const importer = knowledge.getImporter<Payload>('fireflies')!;
      const { alpha, beta } = await scopeIds(knowledge);
      const items = Array.from({ length: 8 }, (_, index) => ({
        address: `person:${index}`,
        name: `Person ${index}`,
        records: [{ id: `rec-${index}`, text: `Fact ${index}` }],
      }));

      const runs = await Promise.all([importer.run(bindingA, { items }), importer.run(bindingB, { items })]);
      // A run may lose a version race; retrying it must converge without outside-edit errors.
      for (const [index, run] of runs.entries()) {
        if (run.status !== 'succeeded') {
          expect(run.error).not.toMatch(/changed outside importer/);
          const retry = await importer.run(index === 0 ? bindingA : bindingB, { items });
          expect(retry.error).toBeUndefined();
        }
      }
      const storage = await knowledge.getStorage();
      for (const item of items) {
        const nodeId = (await storage.getNodeAddress({ source, address: item.address }))!.nodeId;
        expect((await storage.getNodeScopeIds(nodeId)).sort()).toEqual([alpha, beta].sort());
        expect((await storage.getRecordScopeIds(item.records[0]!.id)).sort()).toEqual([alpha, beta].sort());
      }
    });

    it('recovers when a run is interrupted after its first write', async () => {
      const storageInstance = createStorage();
      const knowledge = createMultiBindingKnowledge(storageInstance);
      await knowledge.reconcile();
      const importer = knowledge.getImporter<Payload>('fireflies')!;
      const { alpha, beta } = await scopeIds(knowledge);

      await importer.run(bindingA, { items: [person] });
      // Interrupt B between the node write and its record write.
      const storage = await knowledge.getStorage();
      const original = storage.createRecord.bind(storage);
      let failed = false;
      storage.createRecord = async input => {
        if (!failed) {
          failed = true;
          throw new Error('simulated crash');
        }
        return original(input);
      };
      const crashed = await importer.run(bindingB, {
        items: [{ ...person, records: [{ id: 'rec-beta-only', text: 'Beta note' }] }],
      });
      expect(crashed.status).toBe('failed');
      storage.createRecord = original;

      const retried = await importer.run(bindingB, {
        items: [{ ...person, records: [{ id: 'rec-beta-only', text: 'Beta note' }] }],
      });
      expect(retried.error).toBeUndefined();
      const nodeId = (await storage.getNodeAddress({ source, address: person.address }))!.nodeId;
      expect((await storage.getNodeScopeIds(nodeId)).sort()).toEqual([alpha, beta].sort());
      expect(await storage.getRecordScopeIds('rec-beta-only')).toEqual([beta]);
      expect(await storage.getRecordScopeIds('rec-shane-1')).toEqual([alpha]);
    });
  });
}

describeMultiBindingImports('InMemory', () => new InMemoryStore({ id: `fact-471-${Math.random()}` }));
