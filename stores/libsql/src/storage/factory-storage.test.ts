import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describeFactoryStorageContract } from '@internal/storage-test-utils';
import type { CollectionSchema } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LibSQLFactoryStorage } from './factory-storage';

describeFactoryStorageContract('libsql', async () => {
  const storage = new LibSQLFactoryStorage({ url: ':memory:' });
  return { storage, close: () => storage.close() };
});

const recordsSchema = {
  name: 'factory_write_lock_records',
  columns: {
    id: { type: 'uuid-pk' },
    value: { type: 'text' },
  },
} satisfies CollectionSchema;

type TestRecord = {
  id: string;
  value: string;
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('LibSQLFactoryStorage shared-client write lock', () => {
  let tmpDir: string;
  let storage: LibSQLFactoryStorage;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'libsql-factory-write-lock-'));
    storage = new LibSQLFactoryStorage({
      id: 'factory-write-lock-regression',
      url: `file:${path.join(tmpDir, 'factory.db')}`,
    });
    await storage.ensureCollections([recordsSchema]);
  });

  afterEach(async () => {
    await storage.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('serializes concurrent Factory transactions', async () => {
    const firstEntered = deferred();
    const releaseFirst = deferred();

    const first = storage.withTransaction(async ops => {
      await ops.insertOne<TestRecord>(recordsSchema.name, { value: 'first' });
      firstEntered.resolve();
      await releaseFirst.promise;
    });
    await firstEntered.promise;

    let secondEntered = false;
    const second = storage.withTransaction(async ops => {
      secondEntered = true;
      await ops.insertOne<TestRecord>(recordsSchema.name, { value: 'second' });
    });
    void second.catch(() => {});

    await Promise.resolve();
    expect(secondEntered).toBe(false);

    releaseFirst.resolve();
    await Promise.all([first, second]);

    const rows = await storage.ops.findMany<TestRecord>(recordsSchema.name, {});
    expect(rows.map(row => row.value).sort()).toEqual(['first', 'second']);
  });

  it('keeps a Factory autocommit write outside a rolled-back Factory transaction', async () => {
    const transactionEntered = deferred();
    const releaseTransaction = deferred();
    const rollback = new Error('roll back Factory transaction');

    const transaction = storage.withTransaction(async ops => {
      await ops.insertOne<TestRecord>(recordsSchema.name, { value: 'rolled-back' });
      transactionEntered.resolve();
      await releaseTransaction.promise;
      throw rollback;
    });
    void transaction.catch(() => {});
    await transactionEntered.promise;

    let autocommitSettled = false;
    const autocommit = storage.ops.insertOne<TestRecord>(recordsSchema.name, { value: 'kept' }).then(row => {
      autocommitSettled = true;
      return row;
    });
    void autocommit.catch(() => {});

    await Promise.resolve();
    expect(autocommitSettled).toBe(false);

    releaseTransaction.resolve();
    await expect(transaction).rejects.toBe(rollback);
    await expect(autocommit).resolves.toMatchObject({ value: 'kept' });

    await expect(storage.ops.findOne<TestRecord>(recordsSchema.name, { value: 'rolled-back' })).resolves.toBeNull();
    await expect(storage.ops.findOne<TestRecord>(recordsSchema.name, { value: 'kept' })).resolves.toMatchObject({
      value: 'kept',
    });
  });

  it('keeps a wrapped Mastra-domain write outside a rolled-back Factory transaction', async () => {
    const experiments = storage.getMastraStorage().stores?.experiments;
    if (!experiments) throw new Error('LibSQLStore experiments domain is unavailable');
    await experiments.init();

    const transactionEntered = deferred();
    const releaseTransaction = deferred();
    const rollback = new Error('roll back Factory transaction');

    const transaction = storage.withTransaction(async ops => {
      await ops.insertOne<TestRecord>(recordsSchema.name, { value: 'rolled-back' });
      transactionEntered.resolve();
      await releaseTransaction.promise;
      throw rollback;
    });
    void transaction.catch(() => {});
    await transactionEntered.promise;

    let experimentSettled = false;
    const experiment = experiments
      .createExperiment({
        datasetId: 'factory-write-lock-dataset',
        datasetVersion: 1,
        targetType: 'agent',
        targetId: 'factory-write-lock-agent',
        totalItems: 1,
      })
      .then(record => {
        experimentSettled = true;
        return record;
      });
    void experiment.catch(() => {});

    await Promise.resolve();
    expect(experimentSettled).toBe(false);

    releaseTransaction.resolve();
    await expect(transaction).rejects.toBe(rollback);
    const created = await experiment;

    const listed = await experiments.listExperiments({
      datasetId: 'factory-write-lock-dataset',
      pagination: { page: 0, perPage: 10 },
    });
    expect(listed.experiments.map(record => record.id)).toContain(created.id);
  });
});
