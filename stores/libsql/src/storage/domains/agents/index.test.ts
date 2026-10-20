import { createClient } from '@libsql/client';
import { TABLE_AGENT_VERSIONS } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { AgentsLibSQL } from '.';

describe('AgentsLibSQL', () => {
  it('adds modelList to an existing agent versions table', async () => {
    const client = createClient({ url: 'file::memory:?cache=shared' });

    try {
      const agents = new AgentsLibSQL({ client });
      await agents.init();
      await client.execute(`ALTER TABLE ${TABLE_AGENT_VERSIONS} DROP COLUMN modelList`);

      await new AgentsLibSQL({ client }).init();

      const columns = await client.execute(`PRAGMA table_info(${TABLE_AGENT_VERSIONS})`);
      expect(columns.rows.map(column => column.name)).toContain('modelList');
    } finally {
      client.close();
    }
  });
});
