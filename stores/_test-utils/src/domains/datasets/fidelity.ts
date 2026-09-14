import { randomUUID } from 'node:crypto';
import { createDatasetSnapshot, datasetSnapshotContentSchema, parseDatasetSnapshot } from '@mastra/core/datasets';
import { DatasetsInMemory, InMemoryDB } from '@mastra/core/storage';
import type { DatasetsStorage } from '@mastra/core/storage';
import { expect, it } from 'vitest';

const jsonValues = [
  null,
  false,
  0,
  '',
  'null',
  'false',
  '42',
  '[]',
  '{"x":1}',
  '"quoted"',
  [],
  {},
  { nested: [null, false, 0, ''] },
];

export function createDatasetFidelityTests(getStorage: () => DatasetsStorage) {
  it('returns the same optional configuration after creation, lookup, and listing', async () => {
    const storage = getStorage();
    const dataset = await storage.createDataset({ name: 'empty' });
    for (const record of [
      dataset,
      await storage.getDatasetById({ id: dataset.id }),
      (await storage.listDatasets({ pagination: { page: 0, perPage: false } })).datasets.find(
        row => row.id === dataset.id,
      ),
    ]) {
      for (const key of [
        'description',
        'inputSchema',
        'groundTruthSchema',
        'requestContextSchema',
        'tags',
        'targetType',
        'targetIds',
        'scorerIds',
      ] as const) {
        expect(record).not.toBeNull();
        expect(record).toBeDefined();
        expect(record?.[key], key).toBeUndefined();
        expect(JSON.parse(JSON.stringify(record))).not.toHaveProperty(key);
      }
    }
  });

  it('keeps empty configuration values and treats null configuration updates as clears', async () => {
    const storage = getStorage();
    const dataset = await storage.createDataset({
      name: 'config',
      description: '',
      metadata: {},
      inputSchema: {},
      groundTruthSchema: {},
      requestContextSchema: {},
      targetType: 'agent',
      targetIds: [],
      scorerIds: [],
    });
    const empty = await storage.updateDataset({ id: dataset.id, tags: [] });
    expect(await storage.getDatasetById({ id: dataset.id })).toEqual(empty);
    expect(empty).toMatchObject({
      description: '',
      metadata: {},
      inputSchema: {},
      groundTruthSchema: {},
      requestContextSchema: {},
      tags: [],
      targetType: 'agent',
      targetIds: [],
      scorerIds: [],
    });
    const cleared = await storage.updateDataset({
      id: dataset.id,
      inputSchema: null,
      groundTruthSchema: null,
      requestContextSchema: null,
      tags: null,
      targetType: null,
      targetIds: null,
      scorerIds: null,
    });
    expect(await storage.getDatasetById({ id: dataset.id })).toEqual(cleared);
    for (const key of [
      'inputSchema',
      'groundTruthSchema',
      'requestContextSchema',
      'tags',
      'targetType',
      'targetIds',
      'scorerIds',
    ] as const) {
      expect(cleared[key], key).toBeUndefined();
      expect(JSON.parse(JSON.stringify(cleared))).not.toHaveProperty(key);
    }
    const unchanged = await storage.updateDataset({ id: dataset.id, name: 'renamed' });
    expect(unchanged.description).toBe('');
    expect(unchanged.metadata).toEqual({});
    expect(await storage.getDatasetById({ id: dataset.id })).toEqual(unchanged);
  });

  it.each(jsonValues.map(value => ({ value })))(
    'preserves authored JSON value $value across writes and historical reads',
    async ({ value }) => {
      const storage = getStorage();
      const dataset = await storage.createDataset({ name: 'values' });
      const payload = {
        externalId: 'case',
        input: value,
        groundTruth: value,
        expectedTrajectory: value,
        toolMocks: [],
        scorerIds: [],
        requestContext: {},
        metadata: {},
        source: { type: 'json' as const },
      };
      const item = await storage.addItem({ datasetId: dataset.id, ...payload });
      expect(item).toMatchObject(payload);
      expect(await storage.getItemById({ id: item.id })).toEqual(item);
      expect((await storage.batchInsertItems({ datasetId: dataset.id, items: [payload] }))[0]).toEqual(item);
      const updated = await storage.updateItem({ id: item.id, datasetId: dataset.id, metadata: { edited: true } });
      expect(updated).toMatchObject({ ...payload, metadata: { edited: true } });
      expect(await storage.getItemById({ id: item.id })).toEqual(updated);
      expect(await storage.getItemById({ id: item.id, datasetVersion: item.datasetVersion })).toEqual(item);
      expect(await storage.getItemsByVersion({ datasetId: dataset.id, version: item.datasetVersion })).toEqual([item]);
      const listed = await storage.listItems({ datasetId: dataset.id, pagination: { page: 0, perPage: false } });
      expect(listed.items).toEqual([updated]);
      await storage.deleteItem({ id: item.id, datasetId: dataset.id });
      const history = await storage.getItemHistory(item.id);
      expect(history).toHaveLength(3);
      for (const row of history)
        expect(row).toMatchObject({ input: value, groundTruth: value, expectedTrajectory: value });
    },
  );

  it.each(['omitted', 'null'] as const)(
    'retains the original %s representation on equivalent externalId retries',
    async representation => {
      const storage = getStorage();
      const dataset = await storage.createDataset({ name: 'replay' });
      const originalFields = representation === 'null' ? { groundTruth: null, expectedTrajectory: null } : {};
      const retryFields = representation === 'null' ? {} : { groundTruth: null, expectedTrajectory: null };
      const original = await storage.addItem({
        datasetId: dataset.id,
        externalId: 'same',
        input: 'x',
        ...originalFields,
      });
      const retry = { datasetId: dataset.id, externalId: 'same', input: 'x', ...retryFields };
      expect(await storage.addItem(retry)).toEqual(original);
      expect(await storage.batchInsertItems({ datasetId: dataset.id, items: [retry] })).toEqual([original]);
      expect(await storage.getItemById({ id: original.id })).toEqual(original);
      expect(await storage.getItemHistory(original.id)).toHaveLength(1);
      expect((await storage.getDatasetById({ id: dataset.id }))?.version).toBe(original.datasetVersion);
      const updated = await storage.updateItem({
        datasetId: dataset.id,
        id: original.id,
        groundTruth: null,
        expectedTrajectory: null,
      });
      expect(updated.groundTruth).toBeNull();
      expect(updated.expectedTrajectory).toBeNull();
    },
  );

  it('round-trips artifact JSON fields from memory through the adapter and back', async () => {
    const source = new DatasetsInMemory({ db: new InMemoryDB() });
    const destination = getStorage();
    const returned = new DatasetsInMemory({ db: new InMemoryDB() });
    const original = await source.createDataset({ name: 'round-trip', description: '', metadata: {} });
    const payloads = jsonValues.map((value, index) => ({
      externalId: String(index),
      input: value,
      groundTruth: value,
      expectedTrajectory: value,
    }));
    await source.batchInsertItems({ datasetId: original.id, items: payloads });
    let currentStorage: DatasetsStorage = source;
    let currentId = original.id;
    for (const target of [destination, returned]) {
      const record = await currentStorage.getDatasetById({ id: currentId });
      if (!record) throw new Error('Missing round-trip dataset');
      const { items } = await currentStorage.listItems({
        datasetId: currentId,
        pagination: { page: 0, perPage: false },
      });
      const snapshot = parseDatasetSnapshot(
        JSON.stringify(
          createDatasetSnapshot(
            datasetSnapshotContentSchema.parse({
              formatVersion: 1,
              datasetIdentity: randomUUID(),
              configuration: { name: record.name, description: record.description, metadata: record.metadata },
              items: items.map(({ externalId, input, groundTruth, expectedTrajectory }) => ({
                itemIdentity: randomUUID(),
                payload: { externalId, input, groundTruth, expectedTrajectory },
              })),
              provenance: {
                exportedAt: new Date().toISOString(),
                sourceDatasetId: record.id,
                itemVersion: record.version,
                configurationBasis: 'export-time',
              },
            }),
          ),
        ),
      );
      expect(snapshot.configuration).toEqual({ name: 'round-trip', description: '', metadata: {} });
      expect(snapshot.items.map(item => item.payload)).toEqual(expect.arrayContaining(payloads));
      expect(snapshot.items).toHaveLength(payloads.length);
      const created = await target.createDataset({
        name: snapshot.configuration.name,
        description: snapshot.configuration.description ?? undefined,
        metadata: snapshot.configuration.metadata ?? undefined,
      });
      await target.batchInsertItems({
        datasetId: created.id,
        items: snapshot.items.map(({ payload: { externalId, input, groundTruth, expectedTrajectory } }) => ({
          externalId: externalId ?? undefined,
          input,
          groundTruth,
          expectedTrajectory,
        })),
      });
      const reread = await target.listItems({ datasetId: created.id, pagination: { page: 0, perPage: false } });
      expect(
        reread.items.map(({ externalId, input, groundTruth, expectedTrajectory }) => ({
          externalId,
          input,
          groundTruth,
          expectedTrajectory,
        })),
      ).toEqual(expect.arrayContaining(payloads));
      expect(reread.items).toHaveLength(payloads.length);
      currentStorage = target;
      currentId = created.id;
    }
  });

  it('distinguishes absent JSON fields from explicit null while retaining scorer clear semantics', async () => {
    const storage = getStorage();
    const dataset = await storage.createDataset({ name: 'optional' });
    const item = await storage.addItem({ datasetId: dataset.id, input: 'case' });
    const read = await storage.getItemById({ id: item.id });
    expect(read).toEqual(item);
    expect(read?.groundTruth).toBeUndefined();
    expect(read?.expectedTrajectory).toBeUndefined();
    const updated = await storage.updateItem({
      id: item.id,
      datasetId: dataset.id,
      input: null,
      groundTruth: null,
      expectedTrajectory: null,
      scorerIds: [],
    });
    expect(await storage.getItemById({ id: item.id })).toEqual(updated);
    expect(updated).toMatchObject({ groundTruth: null, expectedTrajectory: null, scorerIds: [] });
    const cleared = await storage.updateItem({ id: item.id, datasetId: dataset.id, scorerIds: null });
    expect(cleared.scorerIds).toBeUndefined();
    expect(cleared.groundTruth).toBeNull();
    expect(cleared.expectedTrajectory).toBeNull();
    expect(await storage.getItemById({ id: item.id })).toEqual(cleared);
    await storage.batchDeleteItems({ datasetId: dataset.id, itemIds: [item.id] });
    expect((await storage.getItemHistory(item.id))[0]).toMatchObject({
      isDeleted: true,
      input: null,
      groundTruth: null,
      expectedTrajectory: null,
    });
  });
}
