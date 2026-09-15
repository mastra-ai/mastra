import { randomUUID } from 'node:crypto';
import { createDatasetFidelityTests } from '@internal/storage-test-utils';
import { createDatasetSnapshot, parseDatasetSnapshot } from '@mastra/core/datasets';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DatasetsPG } from './domains/datasets';
import { connectionString } from './test-utils';

describe('PostgreSQL dataset field fidelity', () => {
  const schemaName = `fidelity_${randomUUID().replaceAll('-', '')}`;
  const pool = new Pool({ connectionString });
  const storage = new DatasetsPG({ pool, schemaName });
  beforeAll(async () => {
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    await storage.init();
  });
  afterAll(async () => {
    try {
      await pool.query(`DROP SCHEMA "${schemaName}" CASCADE`);
    } finally {
      await pool.end();
    }
  });

  createDatasetFidelityTests(() => storage);

  it('returns each selected payload once and retains timezone-aware timestamps', async () => {
    const dataset = await storage.createDataset({ name: 'projection' });
    const item = await storage.addItem({ datasetId: dataset.id, input: null });
    const querySpy = vi.spyOn(pool, 'query');
    let select: string | undefined;
    try {
      expect(await storage.getItemById({ id: item.id })).toEqual(item);
      select = querySpy.mock.calls
        .map(([sql]) => sql)
        .find(sql => typeof sql === 'string' && sql.includes('mastra_dataset_items'));
    } finally {
      querySpy.mockRestore();
    }
    if (!select) throw new Error('Missing item SELECT');
    const result = await pool.query(select, [item.id]);
    const names = result.fields.map(field => field.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of ['input', 'groundTruth', 'expectedTrajectory']) {
      expect(result.fields.filter(field => field.name === name)).toEqual([expect.objectContaining({ dataTypeID: 25 })]);
    }
    expect(names).toEqual(expect.arrayContaining(['createdAtZ', 'updatedAtZ']));
  });

  it.each(['\u0000', { nested: '\u0000' }, { '\u0000': 'key' }])(
    'rejects artifact JSON %j containing NUL without partial writes',
    async input => {
      const dataset = await storage.createDataset({ name: 'unsupported-json' });
      const snapshot = createDatasetSnapshot({
        formatVersion: 1,
        datasetIdentity: randomUUID(),
        configuration: { name: dataset.name },
        items: [
          {
            itemIdentity: randomUUID(),
            createdAt: '2026-09-01T09:00:00.123Z',
            updatedAt: '2026-09-10T10:00:00.456Z',
            payload: { input },
          },
        ],
        provenance: {
          exportedAt: new Date().toISOString(),
          sourceDatasetId: dataset.id,
          itemVersion: dataset.version,
          configurationBasis: 'export-time',
        },
      });
      const parsed = parseDatasetSnapshot(JSON.stringify(snapshot));
      expect(parsed.items[0]?.payload.input).toEqual(input);
      await expect(
        storage.batchInsertItems({
          datasetId: dataset.id,
          items: [{ input: 'valid' }, { input: parsed.items[0]?.payload.input }],
        }),
      ).rejects.toThrow(/unsupported Unicode escape sequence/);
      expect(
        (await storage.listItems({ datasetId: dataset.id, pagination: { page: 0, perPage: false } })).items,
      ).toEqual([]);
      expect((await storage.getDatasetById({ id: dataset.id }))?.version).toBe(dataset.version);
    },
  );

  it('keeps legacy SQL NULL absent and new JSON null distinct, including bulk tombstones', async () => {
    const dataset = await storage.createDataset({ name: 'nulls' });
    const item = await storage.addItem({ datasetId: dataset.id, externalId: 'legacy', input: 'before' });
    await pool.query(
      `UPDATE "${schemaName}".mastra_dataset_items SET "groundTruth" = NULL, "expectedTrajectory" = NULL WHERE id = $1`,
      [item.id],
    );
    const read = await storage.getItemById({ id: item.id });
    expect(read?.groundTruth).toBeUndefined();
    expect(read?.expectedTrajectory).toBeUndefined();
    expect(
      await storage.addItem({
        datasetId: dataset.id,
        externalId: 'legacy',
        input: 'before',
        groundTruth: null,
        expectedTrajectory: null,
      }),
    ).toEqual(read);
    const updated = await storage.updateItem({
      datasetId: dataset.id,
      id: item.id,
      input: null,
      groundTruth: null,
      expectedTrajectory: null,
      scorerIds: [],
    });
    expect(await storage.getItemById({ id: item.id })).toEqual(updated);
    const cleared = await storage.updateItem({ datasetId: dataset.id, id: item.id, scorerIds: null });
    expect(cleared.scorerIds).toBeUndefined();
    expect(await storage.getItemById({ id: item.id })).toEqual(cleared);
    const raw = await pool.query(
      `SELECT "groundTruth" IS NULL AS "sqlNull", jsonb_typeof("groundTruth") AS "jsonType" FROM "${schemaName}".mastra_dataset_items WHERE id = $1 AND "validTo" IS NULL`,
      [item.id],
    );
    expect(raw.rows[0]).toEqual({ sqlNull: false, jsonType: 'null' });
    await storage.batchDeleteItems({ datasetId: dataset.id, itemIds: [item.id] });
    expect((await storage.getItemHistory(item.id))[0]).toMatchObject({
      isDeleted: true,
      input: null,
      groundTruth: null,
      expectedTrajectory: null,
    });
  });
});
