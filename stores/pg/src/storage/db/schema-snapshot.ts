import type { DbClient } from '../client';

/**
 * A read-only picture of one Postgres schema's catalog, taken once at the start
 * of `PostgresStore.init()`.
 *
 * Before this existed, every domain's init converged its own tables by asking
 * the server: an `information_schema.columns` probe per column, a `pg_indexes`
 * probe per index, plus an unconditional `CREATE TABLE IF NOT EXISTS` and a
 * no-op `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` per column. On an
 * already-converged schema that is ~350 statements that change nothing, and
 * because init pins every domain to a single backend connection (issue #17679)
 * they are strictly serialized — warm init cost is ~350 x RTT.
 *
 * The snapshot answers all of those questions locally instead, from three
 * catalog reads.
 *
 * **Init-scoped by design.** The snapshot is installed on the store's
 * `RoutingDbClient` for exactly the pinned-init window and cleared in the same
 * `finally` that unpins, so staleness is bounded to a single init() call and
 * runtime code paths keep querying the live catalog. It is deliberately *not* a
 * process-global cache (that shape was proposed in PR #13960 and closed
 * unmerged): every init re-reads the catalog, so a schema that drifted out of
 * band between inits is still detected and healed.
 *
 * **Why `pg_catalog` and not `information_schema`.** `information_schema` views
 * are privilege-filtered: a role with USAGE on the schema but no grants on a
 * table sees the table but none of its columns, which would make the snapshot
 * report "table present, zero columns" and skip DDL that is genuinely needed.
 * The `pg_catalog` views used here are not privilege-filtered, so all three
 * queries share one visibility rule.
 */
export interface SchemaSnapshot {
  /** Schema the snapshot was taken from (`public` when the store has none). */
  readonly schemaName: string;
  /** Unqualified names of tables present in the schema. */
  tables: Set<string>;
  createdTables: Set<string>;
  pendingIndexes: string[];
  /** table name -> column names present on that table. */
  columns: Map<string, Set<string>>;
  /** table name -> column name -> Postgres type name (`jsonb`, `text`, ...). */
  columnTypes: Map<string, Map<string, string>>;
  /** Index names present in the schema, exactly as the catalog stores them. */
  indexes: Set<string>;
  /** Names of indexes that are the replica identity of their table. */
  replicaIdentityIndexes: Set<string>;
  /**
   * Lowercased names of PRIMARY KEY indexes. A primary key is always backed by
   * an index of the same name, so this answers "does constraint X exist?" for
   * primary keys without a `pg_constraint` probe. Lowercased because the
   * queries it replaces compare `conname = lower($1)`.
   */
  primaryKeyIndexes: Set<string>;
}

/**
 * Implemented by `RoutingDbClient` so the `PgDB` instances that share it (one
 * per storage domain) can all read the single snapshot loaded for the current
 * init window.
 */
export interface SchemaSnapshotHost {
  readonly schemaSnapshot: SchemaSnapshot | null;
}

/**
 * Returns the snapshot currently installed on `client`, but only when it was
 * taken from the schema the caller operates on. A store configured for another
 * schema (or a client with no snapshot at all) gets `null` and falls back to
 * probing the live catalog.
 */
export function getSchemaSnapshot(client: unknown, schemaName: string | undefined): SchemaSnapshot | null {
  const snapshot = (client as Partial<SchemaSnapshotHost> | null | undefined)?.schemaSnapshot;
  if (!snapshot) return null;
  return snapshot.schemaName === (schemaName || 'public') ? snapshot : null;
}

/**
 * Reads the catalog for `schemaName` in three queries. Must be called on the
 * pinned init client so the snapshot reflects what that connection will see.
 */
export async function loadSchemaSnapshot(client: DbClient, schemaName: string | undefined): Promise<SchemaSnapshot> {
  const schema = schemaName || 'public';

  const [tableRows, columnRows, indexRows] = await Promise.all([
    client.manyOrNone<{ tablename: string }>(`SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = $1`, [
      schema,
    ]),
    client.manyOrNone<{ table_name: string; column_name: string; data_type: string }>(
      `SELECT c.relname AS table_name, a.attname AS column_name, format_type(a.atttypid, a.atttypmod) AS data_type
         FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname = $1
          AND c.relkind IN ('r', 'p')
          AND a.attnum > 0
          AND NOT a.attisdropped`,
      [schema],
    ),
    // pg_index rather than the pg_indexes view: same names, but it also carries
    // indisreplident, which createTable needs to know whether the
    // workflow_snapshot unique index is already the table's replica identity,
    // and indisprimary, which answers primary-key constraint existence.
    client.manyOrNone<{ indexname: string; is_replica_identity: boolean; is_primary: boolean }>(
      `SELECT c.relname AS indexname, i.indisreplident AS is_replica_identity, i.indisprimary AS is_primary
         FROM pg_catalog.pg_index i
         JOIN pg_catalog.pg_class c ON c.oid = i.indexrelid
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1`,
      [schema],
    ),
  ]);

  const columns = new Map<string, Set<string>>();
  const columnTypes = new Map<string, Map<string, string>>();
  for (const row of columnRows) {
    let set = columns.get(row.table_name);
    if (!set) {
      set = new Set<string>();
      columns.set(row.table_name, set);
    }
    set.add(row.column_name);

    let types = columnTypes.get(row.table_name);
    if (!types) {
      types = new Map<string, string>();
      columnTypes.set(row.table_name, types);
    }
    types.set(row.column_name, row.data_type);
  }

  const indexes = new Set<string>();
  const replicaIdentityIndexes = new Set<string>();
  const primaryKeyIndexes = new Set<string>();
  for (const row of indexRows) {
    indexes.add(row.indexname);
    if (row.is_replica_identity) {
      replicaIdentityIndexes.add(row.indexname);
    }
    if (row.is_primary) {
      primaryKeyIndexes.add(row.indexname.toLowerCase());
    }
  }

  return {
    schemaName: schema,
    tables: new Set(tableRows.map(r => r.tablename)),
    createdTables: new Set(),
    pendingIndexes: [],
    columns,
    columnTypes,
    indexes,
    replicaIdentityIndexes,
    primaryKeyIndexes,
  };
}
