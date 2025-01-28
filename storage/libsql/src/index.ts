import { createClient } from '@libsql/client';
import type { Client } from '@libsql/client';
import { MastraStorage, WorkflowRunState, StorageColumn, TABLE_NAMES, WorkflowRow } from '@mastra/core';

export interface LibSQLConfig {
  url: string;
  authToken?: string;
}

export class LibSQLStorage extends MastraStorage {
  private client: Client;

  constructor(config: LibSQLConfig) {
    super();
    this.client = createClient({
      url: config.url,
      authToken: config.authToken,
    });
  }

  protected async createTable(tableName: TABLE_NAMES, schema: Record<string, StorageColumn>): Promise<void> {
    const columns = Object.entries(schema).map(([name, column]) => {
      let definition = `${name} ${column.type === 'text' ? 'TEXT' : 'TEXT'}`;
      if (!column.nullable) {
        definition += ' NOT NULL';
      }
      return definition;
    });

    const primaryKeys = Object.entries(schema)
      .filter(([_, column]) => column.primaryKey)
      .map(([name]) => name);

    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columns.join(',\n        ')}${primaryKeys.length > 0 ? `,\n        PRIMARY KEY (${primaryKeys.join(', ')})` : ''}
      );
    `);
  }

  protected async clearTable(tableName: TABLE_NAMES): Promise<void> {
    await this.client.execute(`DELETE FROM ${tableName}`);
  }

  protected async insert(tableName: typeof MastraStorage.TABLE_WORKFLOWS, record: WorkflowRow): Promise<void>;
  protected async insert(tableName: TABLE_NAMES, record: Record<string, any>): Promise<void> {
    if (tableName === MastraStorage.TABLE_WORKFLOWS) {
      const data = {
        workflow_name: record.workflow_name,
        run_id: record.run_id,
        snapshot: JSON.stringify(record.snapshot),
        created_at: record.created_at?.toISOString(),
        updated_at: record.updated_at?.toISOString(),
      };

      await this.client.execute({
        sql: `
          INSERT INTO ${tableName} (workflow_name, run_id, snapshot, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (workflow_name, run_id) DO UPDATE SET
            snapshot = excluded.snapshot,
            updated_at = excluded.updated_at
        `,
        args: [data.workflow_name, data.run_id, data.snapshot, data.created_at, data.updated_at],
      });
    } else {
      const columns = Object.keys(record);
      const placeholders = columns.map(() => '?').join(', ');
      const values = Object.values(record);

      await this.client.execute({
        sql: `
          INSERT INTO ${tableName} (${columns.join(', ')})
          VALUES (${placeholders})
        `,
        args: values,
      });
    }
  }

  protected async load<R extends WorkflowRunState>(
    tableName: typeof MastraStorage.TABLE_WORKFLOWS,
    keys: { workflow_name: string; run_id: string },
  ): Promise<R>;
  protected async load<R>(tableName: TABLE_NAMES, keys: Record<string, string>): Promise<R> {
    const conditions = Object.entries(keys)
      .map(([key]) => `${key} = ?`)
      .join(' AND ');
    const values = Object.values(keys);

    const result = await this.client.execute({
      sql: `SELECT * FROM ${tableName} WHERE ${conditions}`,
      args: values,
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    if (tableName === MastraStorage.TABLE_WORKFLOWS) {
      return {
        ...row,
        snapshot: JSON.parse(row.snapshot as string),
        created_at: new Date(row.created_at as string),
        updated_at: new Date(row.updated_at as string),
      } as R;
    }

    return row as R;
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
