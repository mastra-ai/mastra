import { createClient, type Client } from '@libsql/client';
import { join } from 'node:path';

import { type MessageType, type StorageThreadType } from '../memory';

import { MastraStorage, type TABLE_NAMES } from './base';
import { type StorageColumn, type StorageGetMessagesArg, type EvalRow } from './types';

export * from '../vector/libsql/index';

export interface LibSQLConfig {
  url: string;
  authToken?: string;
}

export class DefaultStorage extends MastraStorage {
  private client: Client;

  constructor({ config }: { config: LibSQLConfig }) {
    super({ name: `MastraStorageLibSql` });

    this.client = createClient({
      url: this.rewriteDbUrl(config.url),
      authToken: config.authToken,
    });
  }

  protected rewriteDbUrl(url: string): string {
    // If this is a relative file path (starts with file: but not file:/)
    if (url.startsWith('file:') && !url.startsWith('file:/')) {
      const cwd = process.cwd();

      // Get the relative path part after 'file:'
      const relativePath = url.slice('file:'.length);

      // If we're in a .mastra directory, use the parent directory
      if (cwd.endsWith('.mastra') || cwd.endsWith('.mastra/')) {
        const baseDir = join(cwd, `..`);

        // Rewrite to be relative to the base directory
        const fullPath = join(baseDir, relativePath);

        this.logger.debug(
          `Initializing LibSQL db with url ${url} with relative file path from inside .mastra directory. Rewriting relative file url to "file:${fullPath}". This ensures it's outside the .mastra directory. If the db is stored inside .mastra it will be deleted when Mastra re-bundles code.`,
        );

        return `file:${fullPath}`;
      }
    }

    return url;
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
      const stmnt = `CREATE TABLE IF NOT EXISTS ${tableName} (
                ${columns.join(',\n')},
                PRIMARY KEY (workflow_name, run_id)
            )`;
      return stmnt;
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
      this.logger.debug(`Creating table ${tableName}`);
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
      const values = Object.values(record).map(v => {
        if (typeof v === `undefined`) {
          // returning an undefined value will cause libsql to throw
          return null;
        }
        return typeof v === 'object' ? JSON.stringify(v) : v;
      });
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

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    const result = await this.load<StorageThreadType>({
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

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    const result = await this.client.execute({
      sql: `SELECT * FROM ${MastraStorage.TABLE_THREADS} WHERE resourceId = ?`,
      args: [resourceId],
    });

    if (!result.rows) {
      return [];
    }

    return result.rows.map(thread => ({
      id: thread.id,
      resourceId: thread.resourceId,
      title: thread.title,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
    })) as any as StorageThreadType[];
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    await this.insert({
      tableName: MastraStorage.TABLE_THREADS,
      record: {
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
  }): Promise<StorageThreadType> {
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

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    await this.client.execute({
      sql: `DELETE FROM ${MastraStorage.TABLE_THREADS} WHERE id = ?`,
      args: [threadId],
    });
    // Messages will be automatically deleted due to CASCADE constraint
  }

  private parseRow(row: any): MessageType {
    let content = row.content;
    try {
      content = JSON.parse(row.content);
    } catch (e) {
      // use content as is if it's not JSON
    }
    return {
      id: row.id,
      content,
      role: row.role,
      type: row.type,
      createdAt: new Date(row.createdAt as string),
      threadId: row.thread_id,
    } as MessageType;
  }

  async getMessages<T extends MessageType[]>({ threadId, selectBy }: StorageGetMessagesArg): Promise<T> {
    try {
      const messages: MessageType[] = [];
      const limit = typeof selectBy?.last === `number` ? selectBy.last : 40;

      // If we have specific messages to select
      if (selectBy?.include?.length) {
        const includeIds = selectBy.include.map(i => i.id);
        const maxPrev = Math.max(...selectBy.include.map(i => i.withPreviousMessages || 0));
        const maxNext = Math.max(...selectBy.include.map(i => i.withNextMessages || 0));

        // Get messages around all specified IDs in one query using row numbers
        const includeResult = await this.client.execute({
          sql: `
            WITH numbered_messages AS (
              SELECT 
                id,
                content,
                role,
                type,
                "createdAt",
                thread_id,
                ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) as row_num
              FROM "${MastraStorage.TABLE_MESSAGES}"
              WHERE thread_id = ?
            ),
            target_positions AS (
              SELECT row_num as target_pos
              FROM numbered_messages
              WHERE id IN (${includeIds.map(() => '?').join(', ')})
            )
            SELECT DISTINCT m.*
            FROM numbered_messages m
            CROSS JOIN target_positions t
            WHERE m.row_num BETWEEN (t.target_pos - ?) AND (t.target_pos + ?)
            ORDER BY m."createdAt" ASC
          `,
          args: [threadId, ...includeIds, maxPrev, maxNext],
        });

        if (includeResult.rows) {
          messages.push(...includeResult.rows.map((row: any) => this.parseRow(row)));
        }
      }

      // Get remaining messages, excluding already fetched IDs
      const excludeIds = messages.map(m => m.id);
      const remainingSql = `
        SELECT 
          id, 
          content, 
          role, 
          type,
          "createdAt", 
          thread_id
        FROM "${MastraStorage.TABLE_MESSAGES}"
        WHERE thread_id = ?
        ${excludeIds.length ? `AND id NOT IN (${excludeIds.map(() => '?').join(', ')})` : ''}
        ORDER BY "createdAt" DESC
        LIMIT ?
      `;
      const remainingArgs = [threadId, ...(excludeIds.length ? excludeIds : []), limit];

      const remainingResult = await this.client.execute({
        sql: remainingSql,
        args: remainingArgs,
      });

      if (remainingResult.rows) {
        messages.push(...remainingResult.rows.map((row: any) => this.parseRow(row)));
      }

      // Sort all messages by creation date
      messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      return messages as T;
    } catch (error) {
      this.logger.error('Error getting messages:', error as Error);
      throw error;
    }
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
        const time = message.createdAt || new Date();
        await tx.execute({
          sql: `INSERT INTO ${MastraStorage.TABLE_MESSAGES} (id, thread_id, content, role, type, createdAt) 
                              VALUES (?, ?, ?, ?, ?, ?)`,
          args: [
            message.id,
            threadId,
            typeof message.content === 'object' ? JSON.stringify(message.content) : message.content,
            message.role,
            message.type,
            time instanceof Date ? time.toISOString() : time,
          ],
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

  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    try {
      const baseQuery = `SELECT * FROM ${MastraStorage.TABLE_EVALS} WHERE meta->>'$.agentName' = ?`;
      const typeCondition =
        type === 'test'
          ? " AND meta->>'$.testPath' IS NOT NULL"
          : type === 'live'
            ? " AND meta->>'$.testPath' IS NULL"
            : '';

      const result = await this.client.execute({
        sql: `${baseQuery}${typeCondition} ORDER BY createdAt DESC`,
        args: [agentName],
      });

      if (!result.rows) {
        return [];
      }

      return result.rows.map(row => ({
        ...row,
        result: typeof row.result === 'string' ? JSON.parse(row.result) : row.result,
        meta: typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta,
        input: row.input,
        output: row.output,
        createdAt: row.createdAt,
      })) as EvalRow[];
    } catch (error) {
      // Handle case where table doesn't exist yet
      if (error instanceof Error && error.message.includes('no such table')) {
        return [];
      }
      console.error('Failed to get evals for the specified agent', error);
      throw error;
    }
  }
}

export { DefaultStorage as MastraStorageLibSql };
