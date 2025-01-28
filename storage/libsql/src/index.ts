import { createClient } from '@libsql/client';
import type { Client } from '@libsql/client';
import { MastraStorage, StorageColumn, TABLE_NAMES, ThreadType, MessageType } from '@mastra/core';

export interface LibSQLConfig {
  url: string;
  authToken?: string;
}

export class LibSQLStorage extends MastraStorage {
  private client: Client;

  constructor(config: LibSQLConfig) {
    super('LIBSQL');

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

    const tableQuery = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columns.join(',\n        ')}${primaryKeys.length > 0 ? `,\n        PRIMARY KEY (${primaryKeys.join(', ')})` : ''}
      );
    `;

    this.logger.debug('Creating table', {
      tableName,
      tableQuery,
    });

    await this.client.execute(tableQuery);
  }

  protected async clearTable(tableName: TABLE_NAMES): Promise<void> {
    await this.client.execute(`DELETE FROM ${tableName}`);
  }

  protected async insert(tableName: TABLE_NAMES, record: Record<string, any>): Promise<void> {
    const columns = Object.keys(record);
    const values = Object.values(record);
    const placeholders = columns.map(() => '?').join(', ');
    const insertQuery = `
          INSERT INTO ${tableName} (${columns.join(', ')})
          VALUES (${placeholders})
        `;

    this.logger.debug('insert row', {
      tableName,
      sql: insertQuery,
      args: values,
    });

    await this.client.execute({
      sql: insertQuery,
      args: values,
    });
  }

  protected async load<R>(tableName: TABLE_NAMES, keys: Record<string, string>): Promise<R | null> {
    const conditions = Object.entries(keys)
      .map(([key]) => `${key} = ?`)
      .join(' AND ');
    const values = Object.values(keys);

    const selectQuery = `SELECT * FROM ${tableName} WHERE ${conditions}`;

    this.logger.debug('select row', {
      tableName,
      sql: selectQuery,
      args: values,
    });

    const result = await this.client.execute({
      sql: selectQuery,
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

  async getThreadById(_params: { threadId: string }): Promise<ThreadType | null> {
    throw new Error('not implemented yet');
  }

  async getThreadsByResourceId(_params: { resourceid: string }): Promise<ThreadType[]> {
    throw new Error('not implemented yet');
  }

  async saveThread(_params: { thread: ThreadType }): Promise<ThreadType> {
    throw new Error('not implemented yet');
  }

  async updateThread(_id: string, _title: string, _metadata: Record<string, unknown>): Promise<ThreadType> {
    throw new Error('not implemented yet');
  }

  async deleteThread(_id: string): Promise<void> {
    throw new Error('not implemented yet');
  }

  async getMessages<T = unknown>(_params: { threadId: string }): Promise<T> {
    throw new Error('not implemented yet');
  }

  async saveMessages(_params: { messages: MessageType[] }): Promise<MessageType[]> {
    throw new Error('not implemented yet');
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
