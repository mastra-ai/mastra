import { createClient } from '@libsql/client';
import { TABLE_EXPERIMENT_RESULTS } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { ExperimentsLibSQL } from '.';

describe('ExperimentsLibSQL initialization', () => {
  it('unwraps double-encoded experiment result tags so tag filtering matches legacy rows', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      const store = new ExperimentsLibSQL({ client });
      await store.init();

      const now = new Date().toISOString();
      // `binary` mirrors the production write path (LibSQLDB stores jsonb columns via jsonb()).
      const insertRow = (id: string, tags: string | null, binary = false) =>
        client.execute({
          sql: `INSERT INTO "${TABLE_EXPERIMENT_RESULTS}"
            ("id","experimentId","itemId","input","startedAt","completedAt","retryCount","attempt","tags","createdAt")
            VALUES (?,?,?,?,?,?,?,?,${binary ? 'jsonb(?)' : '?'},?)`,
          args: [id, 'exp-1', `item-${id}`, '{}', now, now, 0, 0, tags, now],
        });

      // Legacy rows: tags JSON-encoded twice by the old insert path (binary = what actually landed in prod).
      await insertRow('legacy', JSON.stringify(JSON.stringify(['regression', 'smoke'])), true);
      await insertRow('legacy-text', JSON.stringify(JSON.stringify(['regression'])));
      // Healthy rows: single-encoded array.
      await insertRow('healthy', JSON.stringify(['regression']), true);
      await insertRow('healthy-text', JSON.stringify(['regression']));
      // Non-array JSON string must be left untouched.
      await insertRow('plain-string', JSON.stringify('not-an-array'), true);
      // Malformed JSON must not break init() or tag filtering.
      await insertRow('malformed', '{not json');
      await insertRow('untagged', null);

      // Re-running init applies the backfill on existing data.
      await store.init();

      const rows = await client.execute(
        `SELECT "id", json("tags") AS "tags" FROM "${TABLE_EXPERIMENT_RESULTS}" WHERE "id" <> 'malformed' ORDER BY "id"`,
      );
      const byId = Object.fromEntries(rows.rows.map(r => [r.id as string, r.tags]));
      expect(byId.legacy).toBe(JSON.stringify(['regression', 'smoke']));
      expect(byId['legacy-text']).toBe(JSON.stringify(['regression']));
      expect(byId.healthy).toBe(JSON.stringify(['regression']));
      expect(byId['healthy-text']).toBe(JSON.stringify(['regression']));
      expect(byId['plain-string']).toBe(JSON.stringify('not-an-array'));
      expect(byId.untagged).toBeNull();
      const malformed = await client.execute(
        `SELECT "tags" FROM "${TABLE_EXPERIMENT_RESULTS}" WHERE "id" = 'malformed'`,
      );
      expect(malformed.rows[0]?.tags).toBe('{not json');

      const { results, pagination } = await store.listExperimentResults({
        experimentId: 'exp-1',
        pagination: { page: 0, perPage: 10 },
        tags: ['regression'],
      });
      expect(pagination.total).toBe(4);
      expect(results.map(r => r.id).sort()).toEqual(['healthy', 'healthy-text', 'legacy', 'legacy-text']);
      expect(results.find(r => r.id === 'legacy')?.tags).toEqual(['regression', 'smoke']);

      // Idempotent: a third init leaves data unchanged.
      await store.init();
      const again = await client.execute(
        `SELECT json("tags") AS "tags" FROM "${TABLE_EXPERIMENT_RESULTS}" WHERE "id" = 'legacy'`,
      );
      expect(again.rows[0]?.tags).toBe(JSON.stringify(['regression', 'smoke']));
    } finally {
      client.close();
    }
  });
});
