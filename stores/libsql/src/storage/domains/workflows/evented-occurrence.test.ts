import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { afterAll, beforeAll, describe, expect } from 'vitest';
import { LibSQLStore } from '../..';
import { describeOccurrenceReplayCases } from '../../../../../../packages/core/src/workflows/evented/test-utils/occurrence-replay-cases';

describe.each([1, 2] as const)('LibSQL evented occurrence replay on storage v%i', storageVersion => {
  let dir: string;
  let url: string;
  let storage: LibSQLStore;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), `mastra-occurrence-v${storageVersion}-`));
    url = `file:${join(dir, 'runs.db')}`;
    storage = new LibSQLStore({ id: 'evented-guard', url });
    await storage.init();
    expect((await storage.getStore('workflows'))!.supportsWorkflowStepGuards()).toBe(true);
  });
  afterAll(async () => {
    await storage.close();
    await rm(dir, { recursive: true, force: true, maxRetries: 5 });
  });

  describeOccurrenceReplayCases({
    getStorage: () => storage,
    storageVersion,
    countV1Snapshots: async () => {
      const client = createClient({ url });
      try {
        const { rows } = await client.execute('SELECT count(*) AS n FROM mastra_workflow_snapshot');
        return Number(rows[0]!.n);
      } finally {
        client.close();
      }
    },
  });
});
