import { describe, expect, it } from 'vitest';
import { createDatasetSnapshot } from '../../../../datasets/snapshot';
import { InMemoryDB } from '../../inmemory-db';
import { DatasetsInMemory } from '../inmemory';

function fixture() {
  return createDatasetSnapshot({
    formatVersion: 1,
    datasetIdentity: '00000000-0000-4000-8000-000000000001',
    configuration: { name: 'Lookup cases', inputSchema: { type: ['string', 'null'] }, tags: [], scorerIds: [] },
    items: [
      {
        itemIdentity: '00000000-0000-4000-8000-000000000002',
        createdAt: '2020-01-01T01:02:03.456Z',
        updatedAt: '2021-02-03T04:05:06.789Z',
        payload: {
          input: null,
          groundTruth: null,
          expectedTrajectory: { steps: [] },
          scorerIds: [],
          requestContext: {},
          metadata: { authored: true },
          toolMocks: [{ toolName: 'lookup', args: {}, output: null }],
          unmockedToolPolicy: 'deny',
          source: { type: 'trace', referenceId: 'original-trace' },
        },
      },
    ],
    provenance: {
      exportedAt: '2026-09-17T12:00:00Z',
      sourceDatasetId: 'original-id',
      itemVersion: 25,
      configurationBasis: 'export-time',
    },
  });
}

function setup() {
  const db = new InMemoryDB();
  return { db, store: new DatasetsInMemory({ db }) };
}

const exportOptions = { acknowledgeSensitiveData: true } as const;

describe('in-memory snapshot transactions', () => {
  it('imports actual source timestamps, then re-exports the full payload and portable identities', async () => {
    const { store } = setup();
    const artifact = fixture();
    const result = await store.importSnapshot({ snapshot: JSON.stringify(artifact), idempotencyKey: 'release' });
    expect(result.datasetExists).toBe(true);
    const item = (
      await store.listItems({ datasetId: result.receipt.datasetId, pagination: { page: 0, perPage: false } })
    ).items[0]!;
    expect(item.createdAt).toEqual(new Date(artifact.items[0]!.createdAt));
    expect(item.updatedAt).toEqual(new Date(artifact.items[0]!.updatedAt));
    const exported = await store.exportSnapshot({ ...exportOptions, datasetId: result.receipt.datasetId });
    expect(exported.configuration).toEqual(artifact.configuration);
    expect(exported.items).toEqual(artifact.items);
    expect(exported.datasetIdentity).toBe(artifact.datasetIdentity);
    expect(exported.provenance.itemVersion).toBe(1);
    expect(exported.provenance.sourceDatasetId).not.toBe(artifact.provenance.sourceDatasetId);
  });

  it('serializes concurrent same-key imports and does not expose mutable receipt references', async () => {
    const { store, db } = setup();
    const request = { snapshot: JSON.stringify(fixture()), idempotencyKey: 'release' };
    const results = await Promise.all(Array.from({ length: 20 }, () => store.importSnapshot(request)));
    expect(new Set(results.map(result => result.receipt.datasetId)).size).toBe(1);
    expect(db.datasets.size).toBe(1);
    expect(db.datasetItems.size).toBe(1);
    expect(db.datasetSnapshotImports.size).toBe(1);
    results[0]!.receipt.datasetId = 'tampered';
    expect((await store.getSnapshotImport({ idempotencyKey: 'release' }))!.receipt.datasetId).toBe(
      results[1]!.receipt.datasetId,
    );
    await expect(store.importSnapshot({ ...request, destination: { name: 'changed' } })).rejects.toThrow(
      'already used',
    );
    expect(db.datasets.size).toBe(1);
  });

  it('retains the original receipt after deletion and does not mistake reused local IDs for the imported dataset', async () => {
    const { store, db } = setup();
    const request = { snapshot: JSON.stringify(fixture()), idempotencyKey: 'release' };
    const imported = await store.importSnapshot(request);
    await store.deleteDataset({ id: imported.receipt.datasetId });
    expect(db.datasetSnapshotIdentities.size).toBe(0);
    expect(await store.importSnapshot(request)).toEqual({ ...imported, datasetExists: false });
    expect(db.datasets.size).toBe(0);
    await store.createDataset({ id: imported.receipt.datasetId, name: 'unrelated', organizationId: 'other-tenant' });
    expect((await store.getSnapshotImport({ idempotencyKey: 'release' }))!.datasetExists).toBe(false);
    expect((await store.importSnapshot(request)).datasetExists).toBe(false);
    await expect(store.importSnapshot({ ...request, destination: { name: 'changed' } })).rejects.toThrow(
      'already used',
    );
  });

  it('scopes receipts and export adoption to the destination tenant', async () => {
    const { store, db } = setup();
    const request = { snapshot: JSON.stringify(fixture()), idempotencyKey: 'release' };
    const a = await store.importSnapshot({ ...request, destination: { organizationId: 'a' } });
    const b = await store.importSnapshot({ ...request, destination: { organizationId: 'b' } });
    expect(a.receipt.datasetId).not.toBe(b.receipt.datasetId);
    expect(await store.getSnapshotImport({ idempotencyKey: 'release', organizationId: 'c' })).toBeNull();
    const count = db.datasetSnapshotIdentities.size;
    await expect(
      store.exportSnapshot({ ...exportOptions, datasetId: a.receipt.datasetId, filters: { organizationId: 'b' } }),
    ).rejects.toThrow('not found');
    expect(db.datasetSnapshotIdentities.size).toBe(count);
    expect(db.datasets.size).toBe(2);
  });

  it('adopts stable identities for existing data and preserves identity across edits and historical exports', async () => {
    const { store } = setup();
    const dataset = await store.createDataset({ name: 'Original' });
    const item = await store.addItem({ datasetId: dataset.id, input: 'old' });
    const exports = await Promise.all(
      Array.from({ length: 10 }, () => store.exportSnapshot({ ...exportOptions, datasetId: dataset.id })),
    );
    expect(new Set(exports.map(snapshot => snapshot.datasetIdentity)).size).toBe(1);
    expect(new Set(exports.map(snapshot => snapshot.items[0]!.itemIdentity)).size).toBe(1);
    await store.updateItem({ datasetId: dataset.id, id: item.id, input: 'new' });
    await store.updateDataset({ id: dataset.id, name: 'Current configuration' });
    const historical = await store.exportSnapshot({ ...exportOptions, datasetId: dataset.id, version: 1 });
    expect(historical.configuration.name).toBe('Current configuration');
    expect(historical.items[0]!.payload.input).toBe('old');
    expect(historical.items[0]!.itemIdentity).toBe(exports[0]!.items[0]!.itemIdentity);
    const current = await store.exportSnapshot({ ...exportOptions, datasetId: dataset.id });
    expect(current.items[0]!.payload.input).toBe('new');
    expect(current.items[0]!.itemIdentity).toBe(historical.items[0]!.itemIdentity);
    expect(current.items[0]!.createdAt).toBe(item.createdAt.toISOString());
  });

  it('leaves no state after invalid imports or rejected export validation', async () => {
    const { store, db } = setup();
    const { digest: _digest, ...content } = fixture();
    content.configuration.inputSchema = { type: ['object'] };
    await expect(
      store.importSnapshot({ snapshot: JSON.stringify(createDatasetSnapshot(content)), idempotencyKey: 'invalid' }),
    ).rejects.toThrow('captured dataset schemas');
    expect(db.datasets.size).toBe(0);
    expect(db.datasetSnapshotIdentities.size).toBe(0);
    expect(db.datasetSnapshotImports.size).toBe(0);
    const dataset = await store.createDataset({ name: 'Too large for budget' });
    await expect(store.exportSnapshot({ ...exportOptions, datasetId: dataset.id, maxBytes: 1 })).rejects.toThrow(
      'byte limit',
    );
    expect(db.datasetSnapshotIdentities.size).toBe(0);
  });

  it('removes purged item mappings and refuses to export purged payloads', async () => {
    const { store, db } = setup();
    const imported = await store.importSnapshot({ snapshot: JSON.stringify(fixture()), idempotencyKey: 'release' });
    const datasetId = imported.receipt.datasetId;
    const item = (await store.listItems({ datasetId, pagination: { page: 0, perPage: false } })).items[0]!;
    await store.purgeItem({ datasetId, id: item.id });
    expect(db.datasetSnapshotIdentities.size).toBe(1);
    await expect(store.exportSnapshot({ ...exportOptions, datasetId })).rejects.toThrow('purged item content');
    expect(db.datasetSnapshotIdentities.size).toBe(1);
  });

  it('keeps custom adapters unsupported unless they explicitly opt into atomic transfer', async () => {
    class Unsupported extends DatasetsInMemory {
      override readonly supportsSnapshotTransfer = false;
    }
    const store = new Unsupported({ db: new InMemoryDB() });
    await expect(
      store.importSnapshot({ snapshot: JSON.stringify(fixture()), idempotencyKey: 'release' }),
    ).rejects.toThrow('does not support');
    await expect(store.exportSnapshot({ ...exportOptions, datasetId: 'anything' })).rejects.toThrow('does not support');
    await expect(store.getSnapshotImport({ idempotencyKey: 'release' })).rejects.toThrow('does not support');
  });
});
