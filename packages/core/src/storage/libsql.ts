import { createClient, Client } from '@libsql/client';

import { MessageType, ThreadType } from '../memory';

import { MastraStorage, TABLE_NAMES } from './base';
import { StorageColumn } from './types';

export interface LibSQLConfig {
  url: string;
  authToken?: string;
}

export class MastraStorageLibSql extends MastraStorage {
  private client: Client;

  constructor({ name, config }: { name: string; config: LibSQLConfig }) {
    super({ name });
    this.client = createClient({
      url: config.url,
      authToken: config.authToken,
    });
  }

  private getCreateTableSQL(tableName: TABLE_NAMES, schema: Record<string, StorageColumn>): string {
    const columns = Object.entries(schema).map(([name, col]) => {
      let type = col.type.toUpperCase();
      if (type === 'TEXT') type = 'TEXT';
      if (type === 'TIMESTAMP') type = 'TEXT'; // Store timestamps as ISO strings

      const nullable = col.nullable ? '' : 'NOT NULL';
      const primaryKey = col.primaryKey ? 'PRIMARY KEY' : '';

      return `${name} ${type} ${nullable} ${primaryKey}`.trim();
    });

    // For workflow_snapshot table, create a composite primary key
    if (tableName === MastraStorage.TABLE_WORKFLOW_SNAPSHOT) {
      return `CREATE TABLE IF NOT EXISTS ${tableName} (
                ${columns.join(',\n')},
                PRIMARY KEY (workflow_name, run_id)
            )`;
    }

    return `CREATE TABLE IF NOT EXISTS ${tableName} (${columns.join(', ')})`;
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    try {
      const sql = this.getCreateTableSQL(tableName, schema);
      await this.client.execute(sql);
    } catch (error) {
      this.logger.error(`Error creating table ${tableName}: ${error}`);
      throw error;
    }
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      await this.client.execute(`DELETE FROM ${tableName}`);
    } catch (e) {
      if (e instanceof Error) {
        this.logger.error(e.message);
      }
    }
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    try {
      const columns = Object.keys(record);
      const values = Object.values(record).map(v => (typeof v === 'object' ? JSON.stringify(v) : v));
      const placeholders = values.map(() => '?').join(', ');

      await this.client.execute({
        sql: `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
        args: values,
      });
    } catch (error) {
      this.logger.error(`Error upserting into table ${tableName}: ${error}`);
      throw error;
    }
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    const conditions = Object.entries(keys)
      .map(([key]) => `${key} = ?`)
      .join(' AND ');
    const values = Object.values(keys);

    const result = await this.client.execute({
      sql: `SELECT * FROM ${tableName} WHERE ${conditions} LIMIT 1`,
      args: values,
    });

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    // Parse any JSON strings in the result
    const parsed = Object.fromEntries(
      Object.entries(row || {}).map(([k, v]) => {
        try {
          return [k, typeof v === 'string' ? JSON.parse(v) : v];
        } catch {
          return [k, v];
        }
      }),
    );

    return parsed as R;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<ThreadType | null> {
    const result = await this.load<ThreadType>({
      tableName: MastraStorage.TABLE_THREADS,
      keys: { id: threadId },
    });

    if (!result) {
      return null;
    }

    return {
      ...result,
      metadata: typeof result.metadata === 'string' ? JSON.parse(result.metadata) : result.metadata,
    };
  }

  async getThreadsByResourceId({ resource_id }: { resource_id: string }): Promise<ThreadType[]> {
    const result = await this.client.execute({
      sql: `SELECT * FROM ${MastraStorage.TABLE_THREADS} WHERE resource_id = ?`,
      args: [resource_id],
    });

    if (!result.rows) {
      return [];
    }

    return result.rows.map(thread => ({
      id: thread.id,
      resource_id: thread.resource_id,
      title: thread.title,
      created_at: thread.created_at,
      updated_at: thread.updated_at,
      metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
    })) as any as ThreadType[];
  }

  async saveThread({ thread }: { thread: ThreadType }): Promise<ThreadType> {
    await this.insert({
      tableName: MastraStorage.TABLE_THREADS,
      record: {
        created_at: new Date(),
        ...thread,
        metadata: JSON.stringify(thread.metadata),
      },
    });

    return thread;
  }

  async updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<ThreadType> {
    const thread = await this.getThreadById({ threadId: id });
    if (!thread) {
      throw new Error(`Thread ${id} not found`);
    }

    const updatedThread = {
      ...thread,
      title,
      metadata: {
        ...thread.metadata,
        ...metadata,
      },
    };

    await this.client.execute({
      sql: `UPDATE ${MastraStorage.TABLE_THREADS} SET title = ?, metadata = ? WHERE id = ?`,
      args: [title, JSON.stringify(updatedThread.metadata), id],
    });

    return updatedThread;
  }

  async deleteThread({ id }: { id: string }): Promise<void> {
    await this.client.execute({
      sql: `DELETE FROM ${MastraStorage.TABLE_THREADS} WHERE id = ?`,
      args: [id],
    });
    // Messages will be automatically deleted due to CASCADE constraint
  }

  async getMessages({ threadId }: { threadId: string }): Promise<MessageType[]> {
    const result = await this.client.execute({
      sql: `SELECT * FROM ${MastraStorage.TABLE_MESSAGES} WHERE thread_id = ? ORDER BY created_at ASC`,
      args: [threadId],
    });

    if (!result.rows) {
      return [] as MessageType[];
    }

    return result.rows.map(({ content }) => {
      console.log(content);
      const contentParsed = typeof content === 'string' ? JSON.parse(content) : content;
      console.log(contentParsed);
      return contentParsed;
    }) as MessageType[];
  }

  async saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    if (messages.length === 0) return messages;

    const tx = await this.client.transaction('write');

    try {
      const threadId = messages[0]?.threadId;
      if (!threadId) {
        throw new Error('Thread ID is required');
      }

      for (const message of messages) {
        await tx.execute({
          sql: `INSERT INTO ${MastraStorage.TABLE_MESSAGES} (id, thread_id, content, created_at) 
                              VALUES (?, ?, ?, ?)`,
          args: [message.id, threadId, JSON.stringify(message), message.created_at || new Date().toISOString()],
        });
      }

      await tx.commit();

      return messages;
    } catch (error) {
      console.error('Failed to save messages in database', error);
      await tx.rollback();
      throw error;
    }
  }
}
