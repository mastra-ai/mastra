import { randomUUID } from 'node:crypto';
import { Spanner } from '@google-cloud/spanner';
import { createDatasetFidelityTests } from '@internal/storage-test-utils';
import { afterAll, beforeAll, describe, vi } from 'vitest';
import { DatasetsSpanner } from './domains/datasets';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

describe.skipIf(process.env.ENABLE_TESTS !== 'true')('Spanner dataset field fidelity', () => {
  process.env.SPANNER_EMULATOR_HOST ||= 'localhost:9010';
  const client = new Spanner({ projectId: process.env.SPANNER_PROJECT_ID || 'test-project' });
  // Own the emulator instance so parallel test files cannot race during bootstrap.
  const instanceId = `fidelity-${randomUUID().slice(0, 8)}`;
  const instance = client.instance(instanceId);
  const database = instance.database('dataset-fidelity');
  const storage = new DatasetsSpanner({ database });
  beforeAll(async () => {
    const [, instanceOperation] = await client.createInstance(instanceId, {
      config: 'emulator-config',
      nodes: 1,
      displayName: instanceId,
    });
    await instanceOperation.promise();
    const [, operation] = await instance.createDatabase(database.id);
    await operation.promise();
    await storage.init();
  }, 120_000);
  afterAll(async () => {
    try {
      await database.close();
      await instance.delete();
    } finally {
      await client.close();
    }
  });
  createDatasetFidelityTests(() => storage);
});
