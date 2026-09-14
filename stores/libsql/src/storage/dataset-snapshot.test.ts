import { createClient } from '@libsql/client';
import { createDatasetSnapshot, datasetSnapshotContentSchema, parseDatasetSnapshot } from '@mastra/core/datasets';
import { DatasetsInMemory, InMemoryDB } from '@mastra/core/storage';
import type { DatasetsStorage } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatasetsLibSQL } from './domains/datasets';

// Test-only projection, not a storage export API. Remove only top-level undefined
// fields returned by adapters; never normalize authored JSON or explicit nulls.
function pickDefined(record: object, keys: string[]) {
  return Object.fromEntries(Object.entries(record).filter(([key, value]) => keys.includes(key) && value !== undefined));
}

async function capture(storage: DatasetsStorage, datasetId: string) {
  const dataset = await storage.getDatasetById({ id: datasetId });
  if (!dataset) throw new Error('Missing test dataset');
  const { items } = await storage.listItems({ datasetId, pagination: { page: 0, perPage: 100 } });
  return createDatasetSnapshot(
    datasetSnapshotContentSchema.parse({
      formatVersion: 1,
      datasetIdentity: dataset.id,
      configuration: pickDefined(dataset, [
        'name',
        'description',
        'metadata',
        'inputSchema',
        'groundTruthSchema',
        'requestContextSchema',
        'tags',
        'targetType',
        'targetIds',
        'scorerIds',
      ]),
      items: items.map(item => ({
        itemIdentity: item.id,
        payload: pickDefined(item, [
          'externalId',
          'input',
          'groundTruth',
          'expectedTrajectory',
          'toolMocks',
          'unmockedToolPolicy',
          'scorerIds',
          'requestContext',
          'metadata',
          'source',
        ]),
      })),
      provenance: {
        exportedAt: '2026-09-14T12:00:00Z',
        sourceDatasetId: dataset.id,
        itemVersion: dataset.version,
        configurationBasis: 'export-time',
      },
    }),
  );
}

describe.each(['in-memory', 'libsql'] as const)('snapshot representation compatibility: %s', adapter => {
  let storage: DatasetsStorage;
  let close: () => void;

  beforeEach(async () => {
    if (adapter === 'libsql') {
      const client = createClient({ url: ':memory:' });
      close = () => client.close();
      storage = new DatasetsLibSQL({ client });
    } else {
      close = () => {};
      storage = new DatasetsInMemory({ db: new InMemoryDB() });
    }
    await storage.init();
  });
  afterEach(() => close());

  it('captures an empty dataset without normalizing its stored description', async () => {
    const created = await storage.createDataset({ name: 'empty' });
    expect(created.description).toBeUndefined();
    const reread = await storage.getDatasetById({ id: created.id });
    expect(reread?.description).toBeUndefined();
    const snapshot = await capture(storage, created.id);
    expect(snapshot.configuration.description).toBe(reread?.description);
    expect(snapshot.items).toEqual([]);
    expect(parseDatasetSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it('preserves populated and empty authored fields after create and update', async () => {
    const configuration = {
      name: 'cases',
      description: '',
      metadata: { owner: 'quality' },
      inputSchema: {},
      groundTruthSchema: {},
      requestContextSchema: {},
      targetType: 'agent' as const,
      targetIds: ['support'],
      scorerIds: ['accuracy'],
    };
    const created = await storage.createDataset(configuration);
    expect(created).toMatchObject(configuration);
    expect(await storage.getDatasetById({ id: created.id })).toMatchObject(configuration);
    await storage.updateDataset({ id: created.id, tags: [], targetIds: [], scorerIds: [] });
    const payload = {
      externalId: 'case-1',
      input: JSON.parse('{"__proto__":{"safe":true},"question":"Hi"}'),
      groundTruth: '',
      expectedTrajectory: { custom: [null, false, 0, ''] },
      toolMocks: [{ toolName: 'lookup', args: {}, output: null, matchArgs: 'ignore' as const }],
      unmockedToolPolicy: 'deny' as const,
      scorerIds: [],
      requestContext: {},
      metadata: {},
      source: { type: 'trace' as const, referenceId: 'trace-1' },
    };
    const item = await storage.addItem({ datasetId: created.id, ...payload });
    const snapshot = await capture(storage, created.id);
    expect(snapshot.configuration).toEqual({ ...configuration, tags: [], targetIds: [], scorerIds: [] });
    expect(snapshot.items[0]?.payload).toEqual(payload);
    expect(parseDatasetSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
    expect({}).not.toHaveProperty('safe');
    await storage.updateItem({ datasetId: created.id, id: item.id, toolMocks: [] });
    const updated = await capture(storage, created.id);
    expect(updated.items[0]?.payload).toEqual({ ...payload, toolMocks: [] });
    expect(parseDatasetSnapshot(JSON.stringify(updated))).toEqual(updated);
  });

  it.each(['', false, 0, [], {}].map(input => ({ input })))(
    'preserves primitive and empty JSON input: $input',
    async ({ input }) => {
      const dataset = await storage.createDataset({ name: 'scalar' });
      await storage.addItem({ datasetId: dataset.id, input });
      const snapshot = await capture(storage, dataset.id);
      expect(snapshot.items[0]?.payload.input).toEqual(input);
      expect(snapshot.items[0]?.payload.externalId).toBeNull();
      expect(parseDatasetSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
    },
  );

  it('captures current null normalization without claiming lossless CRUD import', async () => {
    const dataset = await storage.createDataset({ name: 'nulls', inputSchema: {} });
    await storage.updateDataset({ id: dataset.id, inputSchema: null, tags: null, targetIds: null, scorerIds: null });
    const item = await storage.addItem({
      datasetId: dataset.id,
      input: 'case',
      groundTruth: null,
      expectedTrajectory: null,
    });
    await storage.updateItem({ datasetId: dataset.id, id: item.id, scorerIds: null });
    const snapshot = await capture(storage, dataset.id);
    expect(snapshot.configuration).not.toHaveProperty('inputSchema');
    for (const key of ['tags', 'targetIds', 'scorerIds'] as const) {
      expect(snapshot.configuration[key]).toBeUndefined();
    }
    const payload = snapshot.items[0]!.payload;
    for (const key of ['groundTruth', 'expectedTrajectory'] as const) {
      expect(payload[key]).toBeNull();
    }
    expect(payload).not.toHaveProperty('scorerIds');
    expect(parseDatasetSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it('preserves JSON null input in both adapters', async () => {
    const dataset = await storage.createDataset({ name: 'null input' });
    await storage.addItem({ datasetId: dataset.id, input: null });
    expect((await capture(storage, dataset.id)).items[0]?.payload.input).toBeNull();
  });
});
