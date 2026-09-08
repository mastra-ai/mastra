import { createHash } from 'node:crypto';
import type { Knowledge } from '@mastra/core/knowledge';
import { z } from 'zod';

const windowSchema = z.object({
  watermark: z.string().min(1).max(200),
  entries: z
    .array(
      z.object({
        address: z.string().min(1).max(300),
        name: z.string().min(1).max(300),
        revision: z.string().min(1).max(200),
        text: z.string().min(1).max(8000),
        citation: z.string().url(),
      }),
    )
    .max(20),
});

export type ShipyardSourceEntry = z.infer<typeof windowSchema>['entries'][number];

export const shipyardCheckpointSchema = z.object({
  watermark: z.string().min(1).max(200),
  nodes: z.array(z.object({ address: z.string(), nodeId: z.string(), revision: z.string() })).max(20),
});

export const shipyardImportBinding = {
  source: 'shipyard:verified-repository',
  scope: 'feature:knowledge:internal',
} as const;

/** Host-owned readers must reverify immutable source revisions, never trust importer payloads as authority. */
export function registerShipyardMaintenanceImporter(
  knowledge: Knowledge,
  source: {
    readWindow: (watermark: string | undefined, signal: AbortSignal) => Promise<unknown>;
    verify: (entry: ShipyardSourceEntry, signal: AbortSignal) => Promise<boolean>;
  },
) {
  return knowledge.registerImporter({
    id: 'shipyard-maintenance',
    access: { [shipyardImportBinding.scope]: 'owner' },
    handler: async context => {
      const state = await context.state.get('checkpoint');
      const checkpoint = state ? shipyardCheckpointSchema.parse(JSON.parse(state)) : undefined;
      const window = windowSchema.parse(await source.readWindow(checkpoint?.watermark, context.signal));
      if (new Set(window.entries.map(entry => entry.address)).size !== window.entries.length) {
        throw new Error('Source window contains duplicate addresses');
      }
      // Verify the complete bounded window before mutating any graph state.
      for (const entry of window.entries) {
        if (!(await source.verify(entry, context.signal))) throw new Error('Source revision could not be reverified');
      }
      const importer = await context.importer();
      const nodes: { address: string; nodeId: string; revision: string }[] = [];
      for (const entry of window.entries) {
        const node = await importer.upsertNode(entry.address, { name: entry.name, kind: 'feature-evidence' });
        const hash = createHash('sha256').update(JSON.stringify(entry)).digest('hex');
        const recordId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
        const previous = await node.listRecords();
        if (!previous.some(record => record.id === recordId)) {
          await node.appendRecord({
            id: recordId,
            text: entry.text,
            metadata: { revision: entry.revision, citation: entry.citation },
          });
        }
        for (const record of previous) {
          if (record.id !== recordId) await node.removeRecord(record.id);
        }
        nodes.push({ address: entry.address, nodeId: node.id, revision: entry.revision });
        const integrated = await node.listRecords();
        if (integrated.length !== 1 || integrated[0]?.id !== recordId) {
          throw new Error('Integrated graph does not match the verified source revision');
        }
      }
      // One set-last write commits the watermark and its verified graph manifest together.
      await context.state.set('checkpoint', JSON.stringify({ watermark: window.watermark, nodes }));
    },
  });
}
