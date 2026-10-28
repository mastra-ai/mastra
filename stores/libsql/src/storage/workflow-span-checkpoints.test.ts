import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll } from 'vitest';
import { createWorkflowSpanCheckpointTests } from '../../../_test-utils/src/domains/workflows/span-checkpoints';
import { LibSQLStore } from './index';

const directories: string[] = [];
createWorkflowSpanCheckpointTests(async () => {
  const directory = await mkdtemp(join(tmpdir(), 'obs-724-checkpoints-'));
  directories.push(directory);
  const store = new LibSQLStore({ id: 'checkpoints', url: `file:${join(directory, 'db.sqlite')}` });
  await store.init();
  return store;
});
afterAll(async () => {
  await Promise.all(directories.map(path => rm(path, { recursive: true, force: true })));
});
