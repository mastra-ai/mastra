import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRunsTableUpgradeTests } from '@internal/storage-test-utils';
import type { Client } from '@libsql/client';
import { createClient } from '@libsql/client';
import { afterAll, describe } from 'vitest';

import { WorkflowsLibSQL } from './index';

describe('libSQL storage v2 runs table from an earlier alpha', () => {
  // A file, so each store gets its own connection to the same database, like separate processes.
  const dir = mkdtempSync(join(tmpdir(), 'libsql-runs-upgrade-'));
  const url = `file:${join(dir, 'db.sqlite')}`;
  const clients: Client[] = [];

  afterAll(() => {
    clients.forEach(client => client.close());
    rmSync(dir, { recursive: true, force: true });
  });

  createRunsTableUpgradeTests({
    openStore: async () => {
      const client = createClient({ url });
      clients.push(client);
      const workflows = new WorkflowsLibSQL({ client });
      await workflows.init();
      return workflows;
    },
    dropStateColumns: async () => {
      // The last store opened, whose connection has read the current schema.
      const client = clients.at(-1)!;
      for (const column of ['stateSeq', 'statePatchCount', 'statePatchBytes', 'stateBytes']) {
        await client.execute(`ALTER TABLE mastra_workflow_runs DROP COLUMN "${column}"`);
      }
    },
  });
});
