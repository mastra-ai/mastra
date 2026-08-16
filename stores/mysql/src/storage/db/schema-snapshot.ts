import type { Pool, RowDataPacket } from 'mysql2/promise';

/**
 * A read-only picture of one MySQL schema's catalog, taken once at the start of
 * `MySQLStore.init()`.
 *
 * Before this existed, every domain's init converged its own tables by asking
 * the server: a `SELECT COUNT(*)` table probe and a column-list probe per
 * table, an `information_schema.STATISTICS` probe per index, plus raw
 * `CREATE INDEX` statements whose duplicate errors were swallowed. On an
 * already-converged schema that is over a hundred statements that change
 * nothing, each one a client-server round trip.
 *
 * The snapshot answers all of those questions locally instead, from three
 * catalog reads. It only ever answers per-object presence questions ("is this
 * table/column/index present?"), never whole-schema equality: convergence is
 * additive, so an older client against a newer schema must still read as
 * converged.
 *
 * **Init-scoped by design.** The snapshot is installed on the store's shared
 * operations domain for exactly the init() window and cleared in the same
 * `finally`, so staleness is bounded to a single init() call and runtime code
 * paths keep querying the live catalog. It is deliberately *not* a
 * process-global cache (that shape was proposed for pg in PR #13960 and closed
 * unmerged): every init re-reads the catalog, so a schema that drifted out of
 * band between inits is still detected and healed. Consulting code maintains
 * the snapshot as it creates objects, so later domains in the same init see
 * what earlier ones created.
 *
 * Field reads are casing-agnostic (`row.TABLE_NAME ?? row.table_name`) because
 * mysql2 returns `information_schema` result keys uppercase on mysql:9.7 but
 * the casing can vary with server settings.
 */
export interface SchemaSnapshot {
  /** Schema the snapshot was taken from. */
  readonly schemaName: string;
  /** Lowercased names of tables present in the schema. */
  tables: Set<string>;
  /** lowercased table name -> lowercased column names present on that table. */
  columns: Map<string, Set<string>>;
  /**
   * `table.index` keys (both lowercased) for indexes present in the schema.
   * MySQL index names are unique per table, not per schema, so presence is
   * keyed the same way the STATISTICS probe matches: table plus index name.
   */
  indexes: Set<string>;
}

/** Builds the `table.index` presence key the snapshot uses. */
export function indexKey(table: string, index: string): string {
  return `${table.toLowerCase()}.${index.toLowerCase()}`;
}

const lower = (value: unknown): string => String(value).toLowerCase();

/**
 * Reads the catalog for `schemaName` in three queries. Returns null when no
 * schema name is available (a pool with no default database): correctness over
 * optimization, callers fall back to today's per-probe behavior.
 */
export async function loadSchemaSnapshot(pool: Pool, schemaName: string | undefined): Promise<SchemaSnapshot | null> {
  if (!schemaName) return null;

  const [[tableRows], [columnRows], [indexRows]] = await Promise.all([
    pool.execute<RowDataPacket[]>(`SELECT table_name FROM information_schema.tables WHERE table_schema = ?`, [
      schemaName,
    ]),
    pool.execute<RowDataPacket[]>(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = ?`,
      [schemaName],
    ),
    pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT table_name, index_name FROM information_schema.statistics WHERE table_schema = ?`,
      [schemaName],
    ),
  ]);

  const tables = new Set<string>();
  for (const row of tableRows ?? []) {
    tables.add(lower(row.table_name ?? row.TABLE_NAME));
  }

  const columns = new Map<string, Set<string>>();
  for (const row of columnRows ?? []) {
    const table = lower(row.table_name ?? row.TABLE_NAME);
    let set = columns.get(table);
    if (!set) {
      set = new Set<string>();
      columns.set(table, set);
    }
    set.add(lower(row.column_name ?? row.COLUMN_NAME));
  }

  const indexes = new Set<string>();
  for (const row of indexRows ?? []) {
    indexes.add(indexKey(lower(row.table_name ?? row.TABLE_NAME), lower(row.index_name ?? row.INDEX_NAME)));
  }

  return { schemaName, tables, columns, indexes };
}
