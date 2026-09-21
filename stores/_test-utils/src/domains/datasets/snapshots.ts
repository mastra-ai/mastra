import { createDatasetSnapshot } from '@mastra/core/datasets';
import { createScorer } from '@mastra/core/evals';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import type { DatasetsStorage } from '@mastra/core/storage';
import { expect, it } from 'vitest';

export function datasetSnapshotTransferFixture(toolMocks = true) {
  return createDatasetSnapshot({
    formatVersion: 1,
    datasetIdentity: '00000000-0000-4000-8000-000000000001',
    configuration: {
      name: 'Portable lookup cases',
      description: 'Round-trip verification',
      metadata: { authored: true },
      inputSchema: { type: ['object', 'null'] },
      groundTruthSchema: { type: ['object', 'null'] },
      requestContextSchema: { type: 'object' },
      tags: ['approved'],
      targetType: 'workflow',
      targetIds: ['lookup'],
      scorerIds: ['accuracy'],
    },
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
          metadata: { label: 'hello 🌎 漢字' },
          ...(toolMocks ? { toolMocks: [{ toolName: 'lookup', args: {}, output: null }] } : {}),
          unmockedToolPolicy: 'deny',
          source: { type: 'trace', referenceId: 'source-trace' },
        },
      },
      {
        itemIdentity: '00000000-0000-4000-8000-000000000003',
        createdAt: '2020-01-01T01:02:03.456Z',
        updatedAt: '2020-02-03T04:05:06.789Z',
        payload: { externalId: 'authored-id', input: { values: [null, false, 0, '', [], {}] } },
      },
    ],
    provenance: {
      exportedAt: '2026-09-17T12:00:00Z',
      sourceDatasetId: 'original-local-id',
      itemVersion: 25,
      configurationBasis: 'export-time',
    },
  });
}

export function createDatasetSnapshotTransferTests(
  getStorage: () => DatasetsStorage,
  options: { toolMocks?: boolean } = {},
) {
  const fixture = () => datasetSnapshotTransferFixture(options.toolMocks !== false);
  const exportOptions = { acknowledgeSensitiveData: true } as const;

  it('round-trips configuration, all authored fields, timestamps and portable identity through actual storage', async () => {
    const store = getStorage();
    const artifact = fixture();
    const imported = await store.importSnapshot({ snapshot: JSON.stringify(artifact), idempotencyKey: 'release' });
    const datasetId = imported.receipt.datasetId;
    const items = (await store.listItems({ datasetId, pagination: { page: 0, perPage: false } })).items;
    expect(items).toHaveLength(2);
    expect(items.every(item => item.createdAt.toISOString() === artifact.items[0]!.createdAt)).toBe(true);
    expect(new Set(items.map(item => item.updatedAt.toISOString()))).toEqual(
      new Set(artifact.items.map(item => item.updatedAt)),
    );
    expect(items.find(item => item.input === null)?.groundTruth).toBeNull();
    expect(items.find(item => item.externalId === 'authored-id')?.groundTruth).toBeUndefined();
    const exported = await store.exportSnapshot({ ...exportOptions, datasetId });
    expect(exported.datasetIdentity).toBe(artifact.datasetIdentity);
    expect(exported.configuration).toEqual(artifact.configuration);
    expect(exported.items).toHaveLength(artifact.items.length);
    expect(exported.items).toEqual(expect.arrayContaining(artifact.items));
    expect(exported.provenance.itemVersion).toBe(1);
    expect(exported.provenance.sourceDatasetId).toBe(datasetId);
  });

  it('imports an empty dataset atomically at local version zero', async () => {
    const store = getStorage();
    const { digest: _digest, ...content } = fixture();
    content.items = [];
    const imported = await store.importSnapshot({
      snapshot: JSON.stringify(createDatasetSnapshot(content)),
      idempotencyKey: 'empty',
    });
    const exported = await store.exportSnapshot({ ...exportOptions, datasetId: imported.receipt.datasetId });
    expect(imported.receipt.datasetVersion).toBe(0);
    expect(exported.items).toEqual([]);
    expect(exported.datasetIdentity).toBe(content.datasetIdentity);
    expect(exported.configuration).toEqual(content.configuration);
  });

  it('replays concurrent same-key imports and rejects changed input without creating a second dataset', async () => {
    const store = getStorage();
    const request = { snapshot: JSON.stringify(fixture()), idempotencyKey: 'concurrent' };
    const imported = await Promise.all(Array.from({ length: 6 }, () => store.importSnapshot(request)));
    expect(new Set(imported.map(result => result.receipt.datasetId)).size).toBe(1);
    expect((await store.listDatasets({ pagination: { page: 0, perPage: false } })).datasets).toHaveLength(1);
    expect(await store.getSnapshotImport({ idempotencyKey: request.idempotencyKey })).toEqual(imported[0]);
    await expect(store.importSnapshot({ ...request, destination: { name: 'Changed' } })).rejects.toThrow(
      'already used',
    );
    expect((await store.listDatasets({ pagination: { page: 0, perPage: false } })).datasets).toHaveLength(1);
  });

  it('allows only one of two conflicting same-key requests to commit', async () => {
    const store = getStorage();
    const snapshot = JSON.stringify(fixture());
    const results = await Promise.allSettled(
      ['First', 'Second'].map(name =>
        store.importSnapshot({ snapshot, idempotencyKey: 'conflict', destination: { name } }),
      ),
    );
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const failures = results.filter(result => result.status === 'rejected');
    expect(failures).toHaveLength(1);
    expect(failures[0]!.reason.message).toContain('already used');
    const datasets = await store.listDatasets({ pagination: { page: 0, perPage: false } });
    expect(datasets.datasets).toHaveLength(1);
    expect((await store.getSnapshotImport({ idempotencyKey: 'conflict' }))?.receipt.datasetId).toBe(
      datasets.datasets[0]!.id,
    );
  });

  it('uses distinct keys for deliberate copies while retaining shared portable lineage', async () => {
    const store = getStorage();
    const snapshot = JSON.stringify(fixture());
    const a = await store.importSnapshot({ snapshot, idempotencyKey: 'copy-a' });
    const b = await store.importSnapshot({ snapshot, idempotencyKey: 'copy-b' });
    expect(a.receipt.datasetId).not.toBe(b.receipt.datasetId);
    const first = await store.exportSnapshot({ ...exportOptions, datasetId: a.receipt.datasetId });
    const second = await store.exportSnapshot({ ...exportOptions, datasetId: b.receipt.datasetId });
    expect(first.datasetIdentity).toBe(second.datasetIdentity);
    expect(first.items).toEqual(expect.arrayContaining(second.items));
  });

  it('retains receipts after deletion and never silently recreates a deleted import', async () => {
    const store = getStorage();
    const request = { snapshot: JSON.stringify(fixture()), idempotencyKey: 'deleted' };
    const first = await store.importSnapshot(request);
    await store.deleteDataset({ id: first.receipt.datasetId });
    expect(await store.importSnapshot(request)).toEqual({ ...first, datasetExists: false });
    expect(await store.getSnapshotImport({ idempotencyKey: request.idempotencyKey })).toEqual({
      ...first,
      datasetExists: false,
    });
    expect((await store.listDatasets({ pagination: { page: 0, perPage: false } })).datasets).toEqual([]);
    await store.createDataset({ id: first.receipt.datasetId, name: 'Unrelated reuse', organizationId: 'other' });
    expect((await store.importSnapshot(request)).datasetExists).toBe(false);
    await expect(store.importSnapshot({ ...request, destination: { name: 'Changed' } })).rejects.toThrow(
      'already used',
    );
  });

  it('isolates import keys and export access by destination tenancy', async () => {
    const store = getStorage();
    const request = { snapshot: JSON.stringify(fixture()), idempotencyKey: 'scoped' };
    const a = await store.importSnapshot({ ...request, destination: { organizationId: 'a', projectId: 'one' } });
    const b = await store.importSnapshot({ ...request, destination: { organizationId: 'b', projectId: 'one' } });
    expect(a.receipt.datasetId).not.toBe(b.receipt.datasetId);
    expect(
      await store.getSnapshotImport({ idempotencyKey: 'scoped', organizationId: 'a', projectId: 'other' }),
    ).toBeNull();
    await expect(
      store.exportSnapshot({ ...exportOptions, datasetId: a.receipt.datasetId, filters: { organizationId: 'b' } }),
    ).rejects.toThrow('not found');
    const exported = await store.exportSnapshot({
      ...exportOptions,
      datasetId: a.receipt.datasetId,
      filters: { organizationId: 'a', projectId: 'one' },
    });
    expect(exported.items).toHaveLength(2);
  });

  it('adopts identities once and retains them across edits, including historical reads', async () => {
    const store = getStorage();
    const dataset = await store.createDataset({ name: 'Original' });
    const item = await store.addItem({ datasetId: dataset.id, input: null });
    const exports = await Promise.all(
      Array.from({ length: 6 }, () => store.exportSnapshot({ ...exportOptions, datasetId: dataset.id })),
    );
    expect(new Set(exports.map(snapshot => snapshot.datasetIdentity)).size).toBe(1);
    expect(new Set(exports.map(snapshot => snapshot.items[0]!.itemIdentity)).size).toBe(1);
    await store.updateItem({ id: item.id, datasetId: dataset.id, input: 'new' });
    await store.updateDataset({ id: dataset.id, name: 'Current configuration' });
    const historical = await store.exportSnapshot({ ...exportOptions, datasetId: dataset.id, version: 1 });
    const current = await store.exportSnapshot({ ...exportOptions, datasetId: dataset.id });
    expect(historical.configuration.name).toBe('Current configuration');
    expect(historical.items[0]!.payload.input).toBeNull();
    expect(current.items[0]!.payload.input).toBe('new');
    expect(current.items[0]!.itemIdentity).toBe(historical.items[0]!.itemIdentity);
    expect(current.items[0]!.createdAt).toBe(item.createdAt.toISOString());
  });

  it('transfers through public Mastra APIs and preserves null versus missing ground truth in real scoring', async () => {
    const source = new Mastra({ storage: new InMemoryStore() });
    const backing = new InMemoryStore();
    backing.stores.datasets = getStorage();
    const target = new Mastra({ storage: backing });
    const original = await source.datasets.create({
      name: 'Public transfer',
      inputSchema: { type: ['string', 'null'] },
    });
    await original.addItem({ input: null, groundTruth: null });
    await original.addItem({ input: 'missing' });
    const artifact = await original.exportSnapshot({ acknowledgeSensitiveData: true });
    const request = { snapshot: JSON.stringify(artifact), idempotencyKey: 'public' };
    expect(await target.datasets.preflightSnapshot(request)).toMatchObject({ canImport: true, itemCount: 2 });
    const imported = await target.datasets.importSnapshot(request);
    const copied = await target.datasets.get({ id: imported.receipt.datasetId });
    const exported = await copied.exportSnapshot({ acknowledgeSensitiveData: true });
    expect(exported.datasetIdentity).toBe(artifact.datasetIdentity);
    expect(exported.items).toHaveLength(2);
    expect(exported.items).toEqual(expect.arrayContaining(artifact.items));
    const scorer = createScorer({
      id: 'null-fidelity',
      name: 'Exact match',
      description: 'Compare actual output with authored ground truth',
    }).generateScore(({ run }) => Number(run.output === run.groundTruth));
    const result = await copied.startExperiment({ task: () => null, scorers: [scorer] });
    expect(result).toMatchObject({ status: 'completed', succeededCount: 2, failedCount: 0, persistenceFailures: 0 });
    for (const item of result.results) {
      expect(item.scores).toEqual([expect.objectContaining({ score: item.input === null ? 1 : 0, error: null })]);
    }
  });

  it('refuses to export erased content after purging an imported item', async () => {
    const store = getStorage();
    const imported = await store.importSnapshot({ snapshot: JSON.stringify(fixture()), idempotencyKey: 'purge' });
    const datasetId = imported.receipt.datasetId;
    const items = await store.listItems({ datasetId, pagination: { page: 0, perPage: false } });
    await store.purgeItem({ datasetId, id: items.items[0]!.id });
    await expect(store.exportSnapshot({ ...exportOptions, datasetId })).rejects.toThrow('purged item content');
    await expect(store.exportSnapshot({ ...exportOptions, datasetId, version: 1 })).rejects.toThrow(
      'purged item content',
    );
    expect((await store.exportSnapshot({ ...exportOptions, datasetId, version: 0 })).datasetIdentity).toBe(
      imported.receipt.datasetIdentity,
    );
  });

  it('validates historical content against export-time configuration', async () => {
    const store = getStorage();
    const dataset = await store.createDataset({ name: 'Schema changes' });
    const item = await store.addItem({ datasetId: dataset.id, input: null });
    await store.updateItem({ id: item.id, datasetId: dataset.id, input: 'new' });
    await store.updateDataset({ id: dataset.id, inputSchema: { type: 'string' } });
    await expect(store.exportSnapshot({ ...exportOptions, datasetId: dataset.id, version: 1 })).rejects.toThrow(
      'captured dataset schemas',
    );
    expect((await store.exportSnapshot({ ...exportOptions, datasetId: dataset.id })).items[0]!.payload.input).toBe(
      'new',
    );
  });

  it('rejects corrupt or schema-incompatible artifacts without visible writes or a retry receipt', async () => {
    const store = getStorage();
    const artifact = fixture();
    artifact.items[0]!.payload.input = 'tampered';
    await expect(
      store.importSnapshot({ snapshot: JSON.stringify(artifact), idempotencyKey: 'invalid' }),
    ).rejects.toThrow();
    const { digest: _digest, ...content } = artifact;
    await expect(
      store.importSnapshot({ snapshot: JSON.stringify(createDatasetSnapshot(content)), idempotencyKey: 'invalid' }),
    ).rejects.toThrow('captured dataset schemas');
    expect(await store.getSnapshotImport({ idempotencyKey: 'invalid' })).toBeNull();
    expect((await store.listDatasets({ pagination: { page: 0, perPage: false } })).datasets).toEqual([]);
  });

  it('rejects artifact schemas with catastrophic regular expressions before compiling them', async () => {
    const store = getStorage();
    const { digest: _digest, ...content } = fixture();
    content.configuration.inputSchema = { type: 'string', pattern: '^(\\w+\\s?)+$' };
    for (const item of content.items) item.payload.input = `${'a'.repeat(40)}!`;
    const artifact = JSON.stringify(createDatasetSnapshot(content));
    const startedAt = performance.now();
    await expect(store.importSnapshot({ snapshot: artifact, idempotencyKey: 'redos' })).rejects.toMatchObject({
      id: 'DATASET_SNAPSHOT_UNSAFE_SCHEMA',
      message: expect.stringContaining('/pattern'),
    });
    expect(performance.now() - startedAt).toBeLessThan(1_000);
    expect(await store.getSnapshotImport({ idempotencyKey: 'redos' })).toBeNull();
    expect((await store.listDatasets({ pagination: { page: 0, perPage: false } })).datasets).toEqual([]);
  });

  it('exports a null artifact description as absent and keeps items in a stable order', async () => {
    const store = getStorage();
    const { digest: _digest, ...content } = fixture();
    content.configuration = { ...content.configuration, description: null };
    const imported = await store.importSnapshot({
      snapshot: JSON.stringify(createDatasetSnapshot(content)),
      idempotencyKey: 'null-description',
    });
    const first = await store.exportSnapshot({ ...exportOptions, datasetId: imported.receipt.datasetId });
    const second = await store.exportSnapshot({ ...exportOptions, datasetId: imported.receipt.datasetId });
    expect('description' in first.configuration).toBe(false);
    expect(first.items.map(item => item.itemIdentity)).toEqual(
      [...content.items.map(item => item.itemIdentity)].sort(),
    );
    expect(second.items).toEqual(first.items);
  });

  it('surfaces invalid requests as storage errors rather than raw validation failures', async () => {
    const store = getStorage();
    await expect(store.importSnapshot({ snapshot: '{"nope":1}', idempotencyKey: 'raw' })).rejects.toMatchObject({
      id: 'DATASET_SNAPSHOT_INVALID_ARTIFACT',
    });
    const dataset = await store.createDataset({ name: 'Options' });
    await expect(
      store.exportSnapshot({ datasetId: dataset.id, acknowledgeSensitiveData: false as unknown as true }),
    ).rejects.toMatchObject({ id: 'DATASET_SNAPSHOT_INVALID_OPTIONS' });
    expect(await store.getSnapshotImport({ idempotencyKey: 'raw' })).toBeNull();
    await expect(store.getSnapshotImport({ idempotencyKey: '' })).rejects.toMatchObject({
      id: 'DATASET_SNAPSHOT_INVALID_OPTIONS',
    });
  });
}
