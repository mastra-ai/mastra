import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatasetFidelityTests } from '@internal/storage-test-utils';
import { createClient } from '@libsql/client';
import { DatasetsInMemory, InMemoryDB } from '@mastra/core/storage';
import type { DatasetsStorage } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatasetsLibSQL } from './domains/datasets';

describe.each(['in-memory', 'libsql'] as const)('dataset field fidelity: %s', adapter => {
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

  createDatasetFidelityTests(() => storage);
});

it('persists JSON null across LibSQL connections without reinterpreting legacy SQL NULL', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dataset-fidelity-'));
  const url = `file:${join(directory, 'test.db')}`;
  let client = createClient({ url });
  try {
    let storage = new DatasetsLibSQL({ client });
    await storage.init();
    const dataset = await storage.createDataset({ name: 'persistent' });
    const item = await storage.addItem({
      datasetId: dataset.id,
      input: null,
      groundTruth: null,
      expectedTrajectory: null,
    });
    const legacy = await storage.addItem({ datasetId: dataset.id, externalId: 'legacy', input: 'legacy' });
    // The previous writer encoded both omitted and explicit null optional values as SQL NULL.
    await client.execute({
      sql: 'UPDATE mastra_dataset_items SET groundTruth = NULL, expectedTrajectory = NULL WHERE id = ?',
      args: [legacy.id],
    });
    const raw = await client.execute({
      sql: 'SELECT input IS NULL AS sqlNull, json_type(input) AS jsonType FROM mastra_dataset_items WHERE id = ?',
      args: [item.id],
    });
    expect(raw.rows[0]).toMatchObject({ sqlNull: 0, jsonType: 'null' });
    client.close();
    client = createClient({ url });
    storage = new DatasetsLibSQL({ client });
    await storage.init();
    expect(await storage.getItemById({ id: item.id })).toEqual(item);
    const legacyRead = await storage.getItemById({ id: legacy.id });
    expect(legacyRead?.groundTruth).toBeUndefined();
    expect(legacyRead?.expectedTrajectory).toBeUndefined();
    expect(
      await storage.addItem({
        datasetId: dataset.id,
        externalId: 'legacy',
        input: 'legacy',
        groundTruth: null,
        expectedTrajectory: null,
      }),
    ).toEqual(legacyRead);
  } finally {
    client.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
