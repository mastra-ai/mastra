import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import { ObservationSchema, type AnalyticsStore, type Observation } from './store.js';

export class DuckDbAnalyticsStore implements AnalyticsStore {
  private constructor(
    private readonly instance: DuckDBInstance,
    private readonly connection: DuckDBConnection,
  ) {}

  static async open(path: string) {
    const instance = await DuckDBInstance.create(path);
    const connection = await instance.connect();
    try {
      await connection.run(`CREATE TABLE IF NOT EXISTS analytics_observations (
        source VARCHAR, tenant VARCHAR, sequence BIGINT, payload VARCHAR,
        PRIMARY KEY(source,tenant,sequence))`);
      await connection.run(`CREATE TABLE IF NOT EXISTS analytics_cursors (
        source VARCHAR, tenant VARCHAR, sequence BIGINT, PRIMARY KEY(source,tenant))`);
      return new DuckDbAnalyticsStore(instance, connection);
    } catch (error) {
      connection.closeSync();
      instance.closeSync();
      throw error;
    }
  }

  async cursor(source: string, tenant: string) {
    const result = await this.connection.runAndReadAll(
      'SELECT sequence FROM analytics_cursors WHERE source = ? AND tenant = ?',
      [source, tenant],
    );
    return Number(result.getRowObjects()[0]?.sequence ?? 0);
  }

  async append(source: string, tenant: string, after: number, rows: readonly Observation[]) {
    const parsed = rows.map(row => ObservationSchema.parse(row));
    let sequence = after;
    for (const row of parsed) {
      if (row.tenant_id !== tenant || row.sequence <= sequence) throw new Error('ANALYTICS_SCOPE_OR_ORDER_INVALID');
      sequence = row.sequence;
    }
    await this.connection.run('BEGIN TRANSACTION');
    try {
      if ((await this.cursor(source, tenant)) !== after) throw new Error('ANALYTICS_CURSOR_CONFLICT');
      for (const row of parsed)
        await this.connection.run('INSERT INTO analytics_observations VALUES (?,?,?,?)', [
          source,
          tenant,
          row.sequence,
          JSON.stringify(row),
        ]);
      await this.connection.run(
        'INSERT INTO analytics_cursors VALUES (?,?,?) ON CONFLICT(source,tenant) DO UPDATE SET sequence = excluded.sequence',
        [source, tenant, sequence],
      );
      await this.connection.run('COMMIT');
    } catch (error) {
      await this.connection.run('ROLLBACK');
      throw error;
    }
  }

  async observations(source: string, tenant: string) {
    const result = await this.connection.runAndReadAll(
      'SELECT payload FROM analytics_observations WHERE source = ? AND tenant = ? ORDER BY sequence',
      [source, tenant],
    );
    return result.getRowObjects().map(row => ObservationSchema.parse(JSON.parse(String(row.payload))));
  }

  close() {
    this.connection.closeSync();
    this.instance.closeSync();
  }
}
