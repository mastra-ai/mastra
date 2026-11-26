import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { describe, expect, it } from 'vitest';
import { AdvisoryStore } from '../src/advisory/store.js';
import { InvestigationStore } from '../src/investigation/store.js';

describe('durable advisory reassessment fanout', () => {
  it('materializes at most 100 target events per transaction and resumes at the saved cursor', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scanner-advisory-reassessment-'));
    const url = `file:${join(directory, 'scanner.db')}`;
    const client = createClient({ url });
    const advisory = new AdvisoryStore(url);
    let investigation = new InvestigationStore(url);
    try {
      await client.execute('CREATE TABLE scanner_migrations(version INTEGER PRIMARY KEY)');
      await advisory.initialize();
      await investigation.initialize();
      const createdAt = new Date(Date.now() - 60000).toISOString();
      for (let index = 0; index < 105; index++) {
        const id = randomUUID();
        await client.execute({
          sql: `INSERT INTO scanner_investigations
            (id,owner,scan_id,idempotency_key,state,revision,data) VALUES (?,?,?,?,?,?,?)`,
          args: [
            id,
            'local-operator',
            randomUUID(),
            randomUUID(),
            'COMPLETED',
            1,
            JSON.stringify({ createdAt, lineage: { targetId: `target-${String(index).padStart(3, '0')}` } }),
          ],
        });
      }
      await advisory.importPage(
        'head',
        [
          {
            id: 'CVE-2026-42420',
            aliases: [],
            status: 'published',
            supersededBy: [],
            title: 'Owned structured test advisory',
            affected: [],
            sources: [{ name: 'Owned fixture', url: 'https://example.invalid/advisory', license: 'fixture' }],
            modifiedAt: new Date().toISOString(),
          },
        ],
        null,
      );
      expect(await investigation.materializeAdvisoryEvents('local-operator', 100)).toBe(100);
      expect(
        (await client.execute('SELECT COUNT(*) AS total FROM scanner_advisory_reassessment_events')).rows[0]?.total,
      ).toBe(100);
      await investigation.close();
      investigation = new InvestigationStore(url);
      await investigation.initialize();
      expect(await investigation.materializeAdvisoryEvents('local-operator', 100)).toBe(5);
      expect(await investigation.materializeAdvisoryEvents('local-operator', 100)).toBe(0);
      const events = await client.execute(
        'SELECT target_id FROM scanner_advisory_reassessment_events ORDER BY target_id',
      );
      expect(events.rows).toHaveLength(105);
      expect(events.rows[0]?.target_id).toBe('target-000');
      expect(events.rows.at(-1)?.target_id).toBe('target-104');
    } finally {
      await investigation.close();
      advisory.close();
      client.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
