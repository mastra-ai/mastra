import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { createDatasetSnapshotTransferTests, datasetSnapshotTransferFixture } from '@internal/storage-test-utils';
import { createClient } from '@libsql/client';
import type { Client } from '@libsql/client';
import { DatasetsInMemory, InMemoryDB } from '@mastra/core/storage';
import type { DatasetSnapshotImportResult, DatasetsStorage } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONNECTION_TIMEOUT_MS } from './db';
import { DatasetsLibSQL } from './domains/datasets';

describe.each(['in-memory', 'libsql'] as const)('snapshot transfer: %s', adapter => {
  let storage: DatasetsStorage;
  let client: Client | undefined;
  beforeEach(async () => {
    if (adapter === 'libsql') {
      client = createClient({ url: ':memory:' });
      storage = new DatasetsLibSQL({ client });
    } else {
      storage = new DatasetsInMemory({ db: new InMemoryDB() });
    }
    await storage.init();
  });
  afterEach(() => client?.close());
  createDatasetSnapshotTransferTests(() => storage);
});

describe('LibSQL snapshot atomicity', () => {
  let client: Client;
  let store: DatasetsLibSQL;
  beforeEach(async () => {
    client = createClient({ url: ':memory:' });
    store = new DatasetsLibSQL({ client });
    await store.init();
  });
  afterEach(() => client.close());

  it.each([
    'mastra_datasets',
    'mastra_dataset_items',
    'mastra_dataset_versions',
    'mastra_dataset_snapshot_identities',
    'mastra_dataset_snapshot_imports',
  ])('rolls back every import write when insertion into %s fails', async table => {
    await client.execute(
      `CREATE TRIGGER fail_import BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT, 'injected failure'); END`,
    );
    const request = { snapshot: JSON.stringify(datasetSnapshotTransferFixture()), idempotencyKey: 'retry' };
    await expect(store.importSnapshot(request)).rejects.toThrow('injected failure');
    for (const tableName of [
      'mastra_datasets',
      'mastra_dataset_items',
      'mastra_dataset_versions',
      'mastra_dataset_snapshot_identities',
      'mastra_dataset_snapshot_imports',
    ]) {
      expect((await client.execute(`SELECT COUNT(*) AS count FROM ${tableName}`)).rows[0]!.count).toBe(0);
    }
    await client.execute('DROP TRIGGER fail_import');
    expect((await store.importSnapshot(request)).datasetExists).toBe(true);
  });

  it('rolls back when persisted values differ from the import plan', async () => {
    await client.execute(
      `CREATE TRIGGER corrupt_import AFTER INSERT ON mastra_dataset_items BEGIN UPDATE mastra_dataset_items SET groundTruth = NULL WHERE id = NEW.id AND datasetVersion = NEW.datasetVersion; END`,
    );
    await expect(
      store.importSnapshot({ snapshot: JSON.stringify(datasetSnapshotTransferFixture()), idempotencyKey: 'corrupt' }),
    ).rejects.toThrow('did not preserve');
    expect((await store.listDatasets({ pagination: { page: 0, perPage: false } })).datasets).toEqual([]);
    expect(await store.getSnapshotImport({ idempotencyKey: 'corrupt' })).toBeNull();
  });

  it('initializes snapshot tables on an existing dataset database without changing authored data', async () => {
    const dataset = await store.createDataset({ name: 'Existing database' });
    const item = await store.addItem({ datasetId: dataset.id, input: null, groundTruth: null });
    await client.execute('DROP TABLE mastra_dataset_snapshot_identities');
    await client.execute('DROP TABLE mastra_dataset_snapshot_imports');
    await store.init();
    await store.init();
    expect(await store.getItemById({ id: item.id })).toEqual(item);
    expect(
      (await store.exportSnapshot({ datasetId: dataset.id, acknowledgeSensitiveData: true })).items[0]!.payload
        .groundTruth,
    ).toBeNull();
  });
});

// Each worker is a separate `LibSQLStore` on its own thread, standing in for a separate
// process. Imports from `dist` like the core multiprocess test because worker threads
// bypass Vite's TypeScript loader.
const workerScript = `
import { parentPort, workerData } from 'node:worker_threads';
import { LibSQLStore } from ${JSON.stringify(join(__dirname, '../../dist/index.js').replace(/\\/g, '/'))};

const store = new LibSQLStore({ id: 'worker', url: workerData.url});
try {
  await store.init();
  const datasets = await store.getStore('datasets');
  // Report readiness, then wait for the parent's start signal so every worker imports at once.
  const started = new Promise(resolve => parentPort.once('message', resolve));
  parentPort.postMessage({ ready: true });
  await started;
  parentPort.postMessage({ ok: true, result: await datasets.importSnapshot(workerData.request) });
} catch (error) {
  parentPort.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
} finally {
  await store.close();
}
`;

type WorkerMessage = { ready: true } | { ok: true; result: DatasetSnapshotImportResult } | { ok: false; error: string };

async function raceWorkerImports(
  script: string,
  url: string,
  request: { snapshot: string; idempotencyKey: string },
  count: number,
): Promise<DatasetSnapshotImportResult[]> {
  const workers = Array.from({ length: count }, () => new Worker(script, { workerData: { url, request } }));
  const ready: Promise<void>[] = [];
  const results = workers.map(worker => {
    let markReady!: () => void;
    ready.push(new Promise<void>(resolve => (markReady = resolve)));
    return new Promise<DatasetSnapshotImportResult>((resolve, reject) => {
      worker.on('message', (message: WorkerMessage) => {
        if ('ready' in message) markReady();
        else if (message.ok) resolve(message.result);
        else reject(new Error(message.error));
      });
      worker.once('error', reject);
    });
  });
  await Promise.all(ready);
  for (const worker of workers) worker.postMessage('start');
  return Promise.all(results);
}

// Independent stores stand in for separate processes sharing one database file. They
// must run on separate threads: the native driver's busy wait is synchronous, so two
// clients on one thread deadlock until `busy_timeout` expires. `LibSQLStore` configures
// that timeout on local files so a contended BEGIN waits instead of failing.
it('arbitrates same-key imports across independent clients', { timeout: 30_000 }, async () => {
  // The worker imports the built package. A stale build fails with a misleading
  // "does not support atomic dataset snapshot transfer", so check for it up front.
  const built = await import(join(__dirname, '../../dist/index.js'));
  const probe = new built.DatasetsLibSQL({ client: createClient({ url: ':memory:' }) });
  expect(probe.supportsSnapshotTransfer, 'run `pnpm build:lib` in stores/libsql before this test').toBe(true);
  const directory = mkdtempSync(join(tmpdir(), 'dataset-snapshot-transfer-'));
  const url = `file:${join(directory, 'test.db')}`;
  const script = join(directory, 'worker.mjs');
  writeFileSync(script, workerScript);
  const request = { snapshot: JSON.stringify(datasetSnapshotTransferFixture()), idempotencyKey: 'durable' };
  const client = createClient({ url, timeout: DEFAULT_CONNECTION_TIMEOUT_MS });
  try {
    const results = await raceWorkerImports(script, url, request, 3);
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
    expect(results[0]!.datasetExists).toBe(true);
    const store = new DatasetsLibSQL({ client });
    await store.init();
    expect(await store.importSnapshot(request)).toEqual(results[0]);
    expect((await store.listDatasets({ pagination: { page: 0, perPage: false } })).datasets).toHaveLength(1);
  } finally {
    client.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

it('recovers a durable receipt after closing every original connection', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dataset-snapshot-reconnect-'));
  const url = `file:${join(directory, 'test.db')}`;
  let client = createClient({ url });
  const request = { snapshot: JSON.stringify(datasetSnapshotTransferFixture()), idempotencyKey: 'reconnect' };
  try {
    const original = new DatasetsLibSQL({ client });
    await original.init();
    const imported = await original.importSnapshot(request);
    client.close();
    // A second reader confirms the commit is durable, then also closes before the real reconnect.
    client = createClient({ url });
    const reader = new DatasetsLibSQL({ client });
    expect((await reader.listDatasets({ pagination: { page: 0, perPage: false } })).datasets).toHaveLength(1);
    client.close();
    client = createClient({ url });
    const reconnected = new DatasetsLibSQL({ client });
    await reconnected.init();
    expect(await reconnected.getSnapshotImport({ idempotencyKey: request.idempotencyKey })).toEqual(imported);
    expect(await reconnected.importSnapshot(request)).toEqual(imported);
    expect((await reconnected.listDatasets({ pagination: { page: 0, perPage: false } })).datasets).toHaveLength(1);
  } finally {
    client.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
