import { createRunsTableUpgradeTests } from '@internal/storage-test-utils';
import { createClient } from '@libsql/client';
import { afterAll, describe } from 'vitest';

import { WorkflowsLibSQL } from './index';

describe('libSQL storage v2 runs table from an earlier alpha', () => {
  const client = createClient({ url: ':memory:' });

  afterAll(() => client.close());

  createRunsTableUpgradeTests({
    openStore: async () => {
      const workflows = new WorkflowsLibSQL({ client });
      await workflows.init();
      return workflows;
    },
    dropStateColumns: async () => {
      for (const column of ['stateSeq', 'statePatchCount', 'statePatchBytes', 'stateBytes']) {
        await client.execute(`ALTER TABLE mastra_workflow_runs DROP COLUMN "${column}"`);
      }
    },
  });
});
