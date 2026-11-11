import { randomUUID } from 'node:crypto';
import { TABLE_THREADS } from '@mastra/core/storage';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryPG, threadMetadataIndexName } from './index';

const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';

const THREAD_COUNT = 5000;

type CapturedQuery = { text: string; values: unknown[] };
type PlanNode = { 'Node Type': string; 'Index Name'?: string; Plans?: PlanNode[] };

// Short: the existing default indexes reject schema-prefixed names over 63 characters.
const newSchemaName = (label: string) => `tm_${label}_${randomUUID().replaceAll('-', '').slice(0, 6)}`;

function indexNamesInPlan(node: PlanNode): string[] {
  return [...(node['Index Name'] ? [node['Index Name']] : []), ...(node.Plans ?? []).flatMap(indexNamesInPlan)];
}

const silentLogger = () => {
  const warn = vi.fn();
  return { warn, logger: { warn, info: vi.fn(), debug: vi.fn(), error: vi.fn(), trackException: vi.fn() } as any };
};

/**
 * Channel adapters look up the thread for every incoming message by metadata
 * (`channel_externalThreadId`, plus `channel_ownerId` when scoped to an agent), and Factory
 * looks up session threads by `factorySessionId`. Without an index each lookup scans every
 * thread. These tests run the exact SQL listThreads() sends through EXPLAIN on a seeded table.
 */
describe('thread metadata filters', () => {
  let admin: pg.Client;
  const schemas: string[] = [];

  const threadIndexes = async (schemaName: string) => {
    const { rows } = await admin.query<{ name: string; valid: boolean }>(
      `SELECT c.relname AS name, i.indisvalid AS valid
         FROM pg_index i
         JOIN pg_class c ON c.oid = i.indexrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relname = $2`,
      [schemaName, threadMetadataIndexName(schemaName)],
    );
    return rows;
  };

  /** Creates the threads table, then turns it into an existing table without the new index. */
  const createExistingThreadsTable = async (schemaName: string, metadataType: 'jsonb' | 'text') => {
    schemas.push(schemaName);
    const pool = new pg.Pool({ connectionString, max: 2 });
    try {
      const memory = new MemoryPG({ pool, schemaName });
      memory.__setLogger(silentLogger().logger);
      await memory.init();
    } finally {
      await pool.end();
    }
    await admin.query(`DROP INDEX IF EXISTS "${schemaName}"."${threadMetadataIndexName(schemaName)}"`);
    if (metadataType === 'text') {
      // Deployments created before metadata became jsonb still have a TEXT column.
      await admin.query(`ALTER TABLE "${schemaName}".${TABLE_THREADS} ALTER COLUMN metadata DROP DEFAULT`);
      await admin.query(`ALTER TABLE "${schemaName}".${TABLE_THREADS} ALTER COLUMN metadata TYPE text`);
    }
  };

  const insertThreadsSQL = (schemaName: string, metadataType: 'jsonb' | 'text') =>
    `INSERT INTO "${schemaName}".${TABLE_THREADS}
       (id, "resourceId", title, metadata, "createdAt", "updatedAt", "createdAtZ", "updatedAtZ")
     SELECT 'thread-' || i, 'resource-' || (i % 50), 'Thread ' || i,
            jsonb_build_object(
              'channel_externalThreadId', 'ext-' || i,
              'channel_ownerId', 'agent-' || (i % 5),
              'factorySessionId', 'session-' || (i % 1000),
              'channel_subscribed', 'true'
            )::${metadataType},
            now(), now(), now(), now()
       FROM generate_series(1, ${THREAD_COUNT}) AS i`;

  beforeAll(async () => {
    admin = new pg.Client({ connectionString });
    await admin.connect();
  });

  afterAll(async () => {
    for (const schemaName of schemas) {
      await admin?.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    }
    await admin?.end();
  });

  describe.each(['jsonb', 'text'] as const)('on a %s metadata column', metadataType => {
    const schemaName = newSchemaName(metadataType);
    let pool: pg.Pool;
    let memory: MemoryPG;
    let captured: CapturedQuery[] = [];

    beforeAll(async () => {
      await createExistingThreadsTable(schemaName, metadataType);
      await admin.query(insertThreadsSQL(schemaName, metadataType));

      pool = new pg.Pool({ connectionString, max: 4 });
      const query = pool.query.bind(pool) as (...args: any[]) => any;
      vi.spyOn(pool, 'query').mockImplementation(((text: unknown, values?: unknown[]) => {
        if (typeof text === 'string') captured.push({ text, values: values ?? [] });
        return query(text, values);
      }) as any);

      // Restart on the populated table: init builds the index over the existing rows.
      memory = new MemoryPG({ pool, schemaName });
      const { warn, logger } = silentLogger();
      memory.__setLogger(logger);
      await memory.init();
      expect(warn).not.toHaveBeenCalled();
      await admin.query(`ANALYZE "${schemaName}".${TABLE_THREADS}`);
    }, 60000);

    afterAll(async () => {
      vi.restoreAllMocks();
      await pool?.end();
    });

    /** Runs listThreads and EXPLAINs every metadata-filtered statement it sent. */
    const explainListThreads = async (args: Parameters<MemoryPG['listThreads']>[0]) => {
      captured = [];
      const result = await memory.listThreads(args);
      const statements = captured.filter(q => q.text.includes(`."${TABLE_THREADS}"`) && q.text.includes('@>'));
      // COUNT(*) and the page query.
      expect(statements.map(q => q.text.split(' ').slice(0, 2).join(' '))).toEqual(['SELECT COUNT(*)', 'SELECT id,']);
      const plans: string[][] = [];
      for (const statement of statements) {
        const { rows } = await admin.query(`EXPLAIN (FORMAT JSON) ${statement.text}`, statement.values);
        plans.push(indexNamesInPlan(rows[0]['QUERY PLAN'][0].Plan));
      }
      return { result, plans };
    };

    it('finds the channel thread for an incoming message through the index', async () => {
      const { result, plans } = await explainListThreads({
        filter: { metadata: { channel_externalThreadId: 'ext-4242' } },
        perPage: 1,
      });

      expect(result.total).toBe(1);
      expect(result.threads.map(t => t.id)).toEqual(['thread-4242']);
      expect(plans).toEqual([[threadMetadataIndexName(schemaName)], [threadMetadataIndexName(schemaName)]]);
    });

    it('finds the agent-scoped channel thread through the index', async () => {
      const { result, plans } = await explainListThreads({
        filter: { metadata: { channel_externalThreadId: 'ext-4242', channel_ownerId: 'agent-2' } },
        perPage: 1,
      });

      expect(result.total).toBe(1);
      expect(result.threads.map(t => t.id)).toEqual(['thread-4242']);
      expect(plans).toEqual([[threadMetadataIndexName(schemaName)], [threadMetadataIndexName(schemaName)]]);
    });

    it('returns nothing for a thread claimed by another agent', async () => {
      const result = await memory.listThreads({
        filter: { metadata: { channel_externalThreadId: 'ext-4242', channel_ownerId: 'agent-3' } },
        perPage: 1,
      });
      expect(result.total).toBe(0);
    });

    it('lists every thread of a Factory session', async () => {
      const { result, plans } = await explainListThreads({
        filter: { metadata: { factorySessionId: 'session-7' } },
        perPage: false,
      });
      expect(result.threads.map(t => t.id).sort()).toEqual(
        ['thread-7', 'thread-1007', 'thread-2007', 'thread-3007', 'thread-4007'].sort(),
      );
      expect(plans).toEqual([[threadMetadataIndexName(schemaName)], [threadMetadataIndexName(schemaName)]]);
    });
  });

  describe('on startup', () => {
    it('creates the index once when init runs again', async () => {
      const schemaName = newSchemaName('twice');
      schemas.push(schemaName);
      const pool = new pg.Pool({ connectionString, max: 2 });
      try {
        for (let run = 0; run < 2; run++) {
          const memory = new MemoryPG({ pool, schemaName });
          const { warn, logger } = silentLogger();
          memory.__setLogger(logger);
          await memory.init();
          expect(warn).not.toHaveBeenCalled();
        }
      } finally {
        await pool.end();
      }
      expect(await threadIndexes(schemaName)).toEqual([{ name: threadMetadataIndexName(schemaName), valid: true }]);
    });

    it('does not create the index when default indexes are skipped', async () => {
      const schemaName = newSchemaName('skip');
      schemas.push(schemaName);
      const pool = new pg.Pool({ connectionString, max: 2 });
      try {
        await new MemoryPG({ pool, schemaName, skipDefaultIndexes: true }).init();
      } finally {
        await pool.end();
      }
      expect(await threadIndexes(schemaName)).toEqual([]);
    });

    it('starts without the index when a legacy thread has metadata that is not JSON', async () => {
      const schemaName = newSchemaName('badjson');
      await createExistingThreadsTable(schemaName, 'text');
      await admin.query(insertThreadsSQL(schemaName, 'text'));
      await admin.query(`UPDATE "${schemaName}".${TABLE_THREADS} SET metadata = 'not json' WHERE id = 'thread-17'`);

      const pool = new pg.Pool({ connectionString, max: 2 });
      try {
        for (let run = 0; run < 2; run++) {
          const memory = new MemoryPG({ pool, schemaName });
          const { warn, logger } = silentLogger();
          memory.__setLogger(logger);
          await expect(memory.init()).resolves.toBeUndefined();
          expect(warn).toHaveBeenCalledWith(
            expect.stringContaining(`Failed to create index ${threadMetadataIndexName(schemaName)}`),
            expect.anything(),
          );
          // A failed concurrent build leaves an INVALID index that writes would still maintain.
          expect(await threadIndexes(schemaName)).toEqual([]);
        }

        // Unchanged behaviour: the metadata filter casts every row, so it already failed on
        // this row before the index existed.
        const memory = new MemoryPG({ pool, schemaName });
        memory.__setLogger(silentLogger().logger);
        await expect(
          memory.listThreads({ filter: { metadata: { channel_externalThreadId: 'ext-1' } }, perPage: 1 }),
        ).rejects.toThrow();

        // Once the row is repaired, the next startup builds the index.
        await admin.query(`UPDATE "${schemaName}".${TABLE_THREADS} SET metadata = '{}' WHERE id = 'thread-17'`);
        await new MemoryPG({ pool, schemaName }).init();
        expect(await threadIndexes(schemaName)).toEqual([{ name: threadMetadataIndexName(schemaName), valid: true }]);
      } finally {
        await pool.end();
      }
    }, 60000);
  });
});
