import { createKnowledgeStorageTests } from '@internal/storage-test-utils';
import { createClient } from '@libsql/client';
import { TABLE_KNOWLEDGE_RECORDS } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { KnowledgeLibSQL } from '.';

createKnowledgeStorageTests(() => new KnowledgeLibSQL({ url: 'file::memory:?cache=shared' }));

describe('KnowledgeLibSQL initialization', () => {
  it('is repeatable and adds knowledge tables to an existing store', async () => {
    const client = createClient({ url: 'file::memory:?cache=shared' });
    try {
      await client.execute('CREATE TABLE existing_domain (id TEXT PRIMARY KEY)');
      await client.execute("INSERT INTO existing_domain (id) VALUES ('preserved')");
      const store = new KnowledgeLibSQL({ client });

      await store.init();
      await store.init();

      const tables = await client.execute({
        sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        args: [TABLE_KNOWLEDGE_RECORDS],
      });
      expect(tables.rows).toHaveLength(1);
      expect((await client.execute('SELECT id FROM existing_domain')).rows[0]?.id).toBe('preserved');
    } finally {
      client.close();
    }
  });
});
