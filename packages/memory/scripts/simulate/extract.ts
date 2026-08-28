/**
 * Conversation simulation — step 1: extract real threads into a local Postgres.
 *
 * Read-only against the source. Refuses any non-localhost target.
 *
 *   pnpm simulate:extract -- \
 *     --source "$SIMULATE_SOURCE_URL" \
 *     --target "postgres://user@127.0.0.1:55432/simulate_input" \
 *     --threads 5
 */
import { createRequire } from 'node:module';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

/**
 * Tables copied per selected thread, with the column holding the thread id.
 *
 * Replay consumes ONLY `mastra_observational_memory` — cycles are reconstructed from the
 * recorded OM generations, never from the source messages. The thread and message rows are
 * copied deliberately as local debugging context: when a reconstructed cycle looks wrong,
 * the original conversation is right there to inspect instead of requiring another trip to
 * the source database. They are inert inputs, not part of the replay.
 */
export const COPIED_TABLES = [
  { table: 'mastra_threads', threadColumn: 'id' },
  { table: 'mastra_messages', threadColumn: 'thread_id' },
  { table: 'mastra_observational_memory', threadColumn: 'threadId' },
] as const;

export function hostOf(url: string): string {
  return new URL(url).hostname;
}

/** True only for loopback hosts. A host merely containing "localhost" is rejected. */
export function isLocalPostgresUrl(url: string): boolean {
  let host: string;
  try {
    host = hostOf(url);
  } catch {
    return false;
  }
  return LOCAL_HOSTS.has(host);
}

export function assertLocalTarget(url: string): void {
  if (!isLocalPostgresUrl(url)) {
    throw new Error(
      `refusing to write to a non-local target: host "${(() => {
        try {
          return hostOf(url);
        } catch {
          return '<unparsable>';
        }
      })()}" is not 127.0.0.1, localhost, or [::1]`,
    );
  }
}

export type ThreadSelection = { sql: string; params: unknown[] };

/**
 * Explicit ids, or the most-recent N threads that actually carry an OM record
 * (a thread with no OM record has nothing to reconstruct).
 */
export function buildThreadSelection(opts: { threads?: number; threadIds?: string[] }): ThreadSelection {
  const ids = opts.threadIds ?? [];
  const hasIds = ids.length > 0;
  const hasCount = typeof opts.threads === 'number';
  if (hasIds === hasCount) {
    throw new Error('pass exactly one of --threads <n> or --thread-id <id> (repeatable)');
  }
  if (hasIds) {
    return { sql: `SELECT id FROM mastra_threads WHERE id = ANY($1::text[])`, params: [ids] };
  }
  if (!Number.isInteger(opts.threads) || (opts.threads as number) < 1) {
    throw new Error('--threads must be a positive integer');
  }
  return {
    sql: `SELECT t.id
            FROM mastra_threads t
            JOIN mastra_observational_memory om ON om."threadId" = t.id
           GROUP BY t.id, t."createdAt"
           ORDER BY t."createdAt" DESC
           LIMIT $1`,
    params: [opts.threads],
  };
}

export type Args = { source: string; target: string; threads?: number; threadIds: string[] };

export function parseArgs(argv: string[]): Args {
  const out: Args = { source: '', target: '', threadIds: [] };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    switch (flag) {
      case '--source':
        out.source = value ?? '';
        i++;
        break;
      case '--target':
        out.target = value ?? '';
        i++;
        break;
      case '--threads':
        out.threads = Number(value);
        i++;
        break;
      case '--thread-id':
        if (value) out.threadIds.push(value);
        i++;
        break;
      default:
        throw new Error(`unknown flag: ${flag}`);
    }
  }
  if (!out.source) throw new Error('--source <postgres-url> is required');
  if (!out.target) throw new Error('--target <postgres-url> is required');
  return out;
}

type PgClient = {
  connect(): Promise<void>;
  end(): Promise<void>;
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};

/** Identifiers cannot be bound as parameters, so any source-provided name is escaped by hand. */
function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function loadPg(): { Client: new (config: { connectionString: string }) => PgClient } {
  // `pg` is not a dependency of this package; borrow the workspace copy rather than adding one.
  const require = createRequire(new URL('../../../../stores/pg/package.json', import.meta.url));
  return require('pg');
}

async function copyTable(
  source: PgClient,
  target: PgClient,
  spec: (typeof COPIED_TABLES)[number],
  threadIds: string[],
): Promise<number> {
  const columns = (
    await source.query(
      `SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
      [spec.table],
    )
  ).rows as { column_name: string; data_type: string }[];
  if (columns.length === 0) throw new Error(`source has no table ${spec.table}`);

  const quoted = columns.map(c => quoteIdentifier(c.column_name)).join(', ');
  await target.query(`DROP TABLE IF EXISTS "${spec.table}"`);
  await target.query(
    `CREATE TABLE "${spec.table}" (${columns.map(c => `${quoteIdentifier(c.column_name)} ${c.data_type}`).join(', ')})`,
  );

  const rows = (
    await source.query(`SELECT ${quoted} FROM "${spec.table}" WHERE "${spec.threadColumn}" = ANY($1::text[])`, [
      threadIds,
    ])
  ).rows;

  // json/jsonb round-trips as a JS value; hand it back to Postgres as text plus an explicit
  // cast, otherwise a JS array is serialized as a Postgres array literal and rejected as json.
  const isJson = columns.map(c => c.data_type === 'jsonb' || c.data_type === 'json');
  const placeholders = columns.map((c, i) => (isJson[i] ? `$${i + 1}::${c.data_type}` : `$${i + 1}`)).join(', ');
  for (const row of rows) {
    const values = columns.map((c, i) => {
      const value = row[c.column_name];
      return isJson[i] && value !== null && value !== undefined ? JSON.stringify(value) : value;
    });
    await target.query(`INSERT INTO ${quoteIdentifier(spec.table)} (${quoted}) VALUES (${placeholders})`, values);
  }
  return rows.length;
}

export async function main(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  assertLocalTarget(args.target);

  const { Client } = loadPg();
  const source = new Client({ connectionString: args.source });
  const target = new Client({ connectionString: args.target });
  let sourceConnected = false;
  let targetConnected = false;
  try {
    // Track each connection independently: if the second one rejects, the first still gets closed.
    await source.connect();
    sourceConnected = true;
    await target.connect();
    targetConnected = true;

    // Any write against the source now fails loudly instead of succeeding quietly.
    await source.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');

    const selection = buildThreadSelection({ threads: args.threads, threadIds: args.threadIds });
    const threadIds = (await source.query(selection.sql, selection.params)).rows.map(r => r.id as string);
    if (threadIds.length === 0) throw new Error('no threads matched the selection');

    const counts: Record<string, number> = {};
    for (const spec of COPIED_TABLES) {
      counts[spec.table] = await copyTable(source, target, spec, threadIds);
    }

    const perThread = (
      await target.query(
        `SELECT "threadId", count(*)::int AS n FROM mastra_observational_memory GROUP BY "threadId" ORDER BY n DESC`,
      )
    ).rows;
    for (const row of perThread) {
      console.log(`OM_RECORDS thread=${row.threadId} count=${row.n}`);
    }
    console.log(`EXTRACTED_THREADS=${counts['mastra_threads']}`);
    console.log(`EXTRACTED_MESSAGES=${counts['mastra_messages']}`);
    console.log(`EXTRACTED_OM_RECORDS=${counts['mastra_observational_memory']}`);
  } finally {
    await Promise.all([
      sourceConnected ? source.end() : Promise.resolve(),
      targetConnected ? target.end() : Promise.resolve(),
    ]);
  }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch(err => {
    console.error(String(err instanceof Error ? err.message : err));
    process.exit(1);
  });
}
