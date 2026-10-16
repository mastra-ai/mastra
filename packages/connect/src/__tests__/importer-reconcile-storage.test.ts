import { Knowledge } from '@mastra/core/knowledge';
import type { KnowledgeImporterHandlerContext } from '@mastra/core/knowledge';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { nodeSelfMetadata, reconcileImporterNodes } from '../importer-runtime.js';
import type { ImporterNodeProbeResult } from '../importer-runtime.js';

/**
 * Real-storage regression for reconcileImporterNodes, modelled on core's
 * binding-identity test: real Knowledge static importer operations over
 * InMemoryStore. Proves handle ids are storage node ids (not addresses), the
 * probed address comes from node metadata, and core's ownership rules hold.
 */

const binding = { source: 'linear:conn-1', scope: 'project:dest' } as const;
const foreignBinding = { source: 'linear:conn-2', scope: 'project:dest' } as const;
const ADDRESSES = ['linear:document:a', 'linear:document:b', 'linear:document:c'];

type Mode = { kind: 'seed' } | { kind: 'reconcile'; probe: (address: string) => Promise<ImporterNodeProbeResult> };

function createKnowledge(role: 'owner' | 'edit') {
  let mode: Mode = { kind: 'seed' };
  const handleIds: string[] = [];
  const probed: string[] = [];
  const results: Awaited<ReturnType<typeof reconcileImporterNodes>>[] = [];

  const seedHandler = (addresses: string[]) => async (ctx: KnowledgeImporterHandlerContext) => {
    const importer = await ctx.importer();
    for (const address of addresses) {
      const node = await importer.upsertNode(address, { name: address, metadata: nodeSelfMetadata(address) });
      await node.appendKnowledge({ text: `body of ${address}` });
    }
  };

  const knowledge = new Knowledge({
    storage: new InMemoryStore({ id: 'connect-reconcile-storage' }),
    structure: { scopes: [{ address: 'project:dest', name: 'Destination' }] },
    importers: [
      {
        id: 'linear',
        access: { 'project:dest': role },
        triggers: { webhook: { bindings: [binding] } },
        handler: async ctx => {
          if (mode.kind === 'seed') return seedHandler(ADDRESSES)(ctx);
          const importer = await ctx.importer();
          handleIds.push(...(await importer.listNodes()).map(h => h.id));
          const { probe } = mode;
          results.push(
            await reconcileImporterNodes({
              importer,
              state: ctx.state,
              cursorKey: 'linear:reconcile:cursor',
              addressPrefixes: ['linear:document:'],
              canRemove: role === 'owner',
              probe: async address => {
                probed.push(address);
                return probe(address);
              },
              signal: ctx.signal,
              limit: 50,
            }),
          );
        },
      },
      {
        id: 'linear-other',
        access: { 'project:dest': 'owner' },
        triggers: { webhook: { bindings: [foreignBinding] } },
        handler: seedHandler(['linear:document:b']),
      },
    ],
  });

  return {
    knowledge,
    handleIds,
    probed,
    results,
    setMode(next: Mode) {
      mode = next;
    },
  };
}

async function recordTexts(knowledge: Knowledge, source: string) {
  const storage = await knowledge.getStorage();
  const dest = await storage.getScopeAddress('project:dest');
  const { records } = await storage.listRecordsBySource({ source, scopeIds: [dest!.scopeNodeId], limit: 100 });
  return records.map(r => r.text).sort();
}

describe('reconcileImporterNodes over real Knowledge storage', () => {
  it('probes metadata addresses of real node ids and removes only the positively removed binding records', async () => {
    const h = createKnowledge('owner');
    await h.knowledge.reconcile();
    expect((await h.knowledge.getImporter('linear')!.run(binding)).status).toBe('succeeded');
    expect((await h.knowledge.getImporter('linear-other')!.run(foreignBinding)).status).toBe('succeeded');

    h.setMode({ kind: 'reconcile', probe: async a => (a === 'linear:document:b' ? 'removed' : 'present') });
    expect((await h.knowledge.getImporter('linear')!.run(binding)).status).toBe('succeeded');

    // Handle ids are storage node ids, distinct from provider addresses.
    expect(h.handleIds).toHaveLength(3);
    for (const id of h.handleIds) expect(ADDRESSES).not.toContain(id);
    expect(h.probed).toEqual(ADDRESSES);
    expect(h.results).toEqual([{ probed: 3, removedRecords: 1, wrapped: true }]);

    expect(await recordTexts(h.knowledge, binding.source)).toEqual([
      'body of linear:document:a',
      'body of linear:document:c',
    ]);
    // Another source's node at the same address is never a candidate.
    expect(await recordTexts(h.knowledge, foreignBinding.source)).toEqual(['body of linear:document:b']);
    // Nodes are kept.
    const storage = await h.knowledge.getStorage();
    expect(await storage.getNodeAddress({ source: binding.source, address: 'linear:document:b' })).toBeTruthy();
  });

  it('is a no-op for an edit-role binding', async () => {
    const h = createKnowledge('edit');
    await h.knowledge.reconcile();
    expect((await h.knowledge.getImporter('linear')!.run(binding)).status).toBe('succeeded');

    h.setMode({ kind: 'reconcile', probe: async () => 'removed' });
    expect((await h.knowledge.getImporter('linear')!.run(binding)).status).toBe('succeeded');

    expect(h.probed).toEqual([]);
    expect(await recordTexts(h.knowledge, binding.source)).toHaveLength(3);
  });
});
