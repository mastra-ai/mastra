import {
  MastraStorage,
  MessageType,
  StorageColumn,
  StorageGetMessagesArg,
  TABLE_NAMES,
  ThreadType,
  WorkflowRunState,
} from '@mastra/core';
import pg from 'pg';
import pgPromise from 'pg-promise';
import type { IDatabase, IMain } from 'pg-promise';

export interface PostgresConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
}

export class PostgresStore extends MastraStorage {
  private db: IDatabase<any>;
  private pgp: IMain;
  private pool: pg.Pool;
  hasTables: boolean = false;

  constructor(config: PostgresConfig) {
    super({ name: 'Postgres' });
    this.pgp = pgPromise();
    this.db = this.pgp(config);
    this.pool = new pg.Pool({ connectionString: config.connectionString });
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    const columns = Object.entries(schema).map(([name, column]) => {
      let definition = `${this.pgp.as.name(name)} ${column.type === 'text' ? 'TEXT' : 'TIMESTAMP WITH TIME ZONE'}`;
      if (!column.nullable) {
        definition += ' NOT NULL';
      }
      return definition;
    });

    const primaryKeys = Object.entries(schema)
      .filter(([_, column]) => column.primaryKey)
      .map(([name]) => this.pgp.as.name(name));

    const tableQuery = `
      CREATE TABLE IF NOT EXISTS ${this.pgp.as.name(tableName)} (
        ${columns.join(',\n        ')}${primaryKeys.length > 0 ? `,\n        PRIMARY KEY (${primaryKeys.join(', ')})` : ''}
      );
    `;

    this.logger.debug('Creating table', {
      tableName,
      tableQuery,
    });

    await this.db.none(tableQuery);
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    await this.db.none(`TRUNCATE TABLE ${this.pgp.as.name(tableName)}`);
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    const columns = Object.keys(record);
    const placeholders = columns.map((_, i) => `$${i + 1}`);
    const values = Object.values(record);

    const query = `INSERT INTO ${this.pgp.as.name(tableName)} (${columns.map(col => this.pgp.as.name(col)).join(', ')}) VALUES (${placeholders.join(', ')})`;
    await this.db.none(query, values);
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    const columns = Object.keys(keys);
    const values = Object.values(keys);
    const conditions = columns.map((col, i) => `${this.pgp.as.name(col)} = $${i + 1}`).join(' AND ');
    const query = `SELECT * FROM ${this.pgp.as.name(tableName)} WHERE ${conditions}`;
    const result = await this.db.oneOrNone(query, values);
    return result as R | null;
  }

  async persistWorkflowSnapshot({
    workflowName,
    runId,
    snapshot,
  }: {
    workflowName: string;
    runId: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    await this.db.none(
      `
      INSERT INTO ${this.pgp.as.name(MastraStorage.TABLE_WORKFLOW_SNAPSHOT)}
        (workflow_name, run_id, snapshot, updated_at)
      VALUES
        ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (workflow_name, run_id)
      DO UPDATE SET
        snapshot = EXCLUDED.snapshot,
        updated_at = CURRENT_TIMESTAMP
    `,
      [workflowName, runId, snapshot],
    );
  }

  async loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    const result = await this.db.oneOrNone(
      `
      SELECT snapshot
      FROM ${this.pgp.as.name(MastraStorage.TABLE_WORKFLOW_SNAPSHOT)}
      WHERE workflow_name = $1
        AND run_id = $2
    `,
      [workflowName, runId],
    );

    return result?.snapshot || null;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<ThreadType | null> {
    await this.ensureTablesExist();

    const client = await this.pool.connect();
    try {
      const result = await client.query<ThreadType>(
        `
        SELECT id, title, created_at AS createdAt, updated_at AS updatedAt, resourceid as resourceId, metadata
        FROM mastra_threads
        WHERE id = $1
        `,
        [threadId],
      );

      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async getThreadsByResourceId({ resource_id }: { resource_id: string }): Promise<ThreadType[]> {
    await this.ensureTablesExist();

    const client = await this.pool.connect();
    try {
      const result = await client.query<ThreadType>(
        `
                SELECT id, title, resourceid as resourceId, created_at AS createdAt, updated_at AS updatedAt, metadata
                FROM mastra_threads
                WHERE resourceid = $1
            `,
        [resource_id],
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  async saveThread({ thread }: { thread: ThreadType }): Promise<ThreadType> {
    await this.ensureTablesExist();

    const client = await this.pool.connect();
    try {
      const { id, title, createdAt, updatedAt, resource_id, metadata } = thread;
      const result = await client.query<ThreadType>(
        `
        INSERT INTO mastra_threads (id, title, created_at, updated_at, resourceid, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET title = $2, updated_at = $4, resourceid = $5, metadata = $6
        RETURNING id, title, created_at AS createdAt, updated_at AS updatedAt, resourceid as resourceId, metadata
        `,
        [id, title, createdAt, updatedAt, resource_id, JSON.stringify(metadata)],
      );
      return result?.rows?.[0]!;
    } finally {
      client.release();
    }
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
    const client = await this.pool.connect();
    try {
      const result = await client.query<ThreadType>(
        `
                UPDATE mastra_threads
                SET title = $1, metadata = $2, updated_at = NOW()
                WHERE id = $3
                RETURNING *
                `,
        [title, JSON.stringify(metadata), id],
      );
      return result?.rows?.[0]!;
    } finally {
      client.release();
    }
  }

  async deleteThread({ id }: { id: string }): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `
                DELETE FROM mastra_messages
                WHERE thread_id = $1
                `,
        [id],
      );

      await client.query(
        `
                DELETE FROM mastra_threads
                WHERE id = $1
                `,
        [id],
      );
    } finally {
      client.release();
    }
  }

  async getMessages<T = unknown>({ threadId, selectBy }: StorageGetMessagesArg): Promise<T> {
    await this.ensureTablesExist();

    const client = await this.pool.connect();
    try {
      const messages: any[] = [];
      const limit = selectBy?.last || 100;
      const include = selectBy?.include || [];

      if (include.length) {
        const includeResult = await client.query(
          `
          WITH ordered_messages AS (
            SELECT 
              *,
              ROW_NUMBER() OVER (ORDER BY created_at) as row_num
            FROM mastra_messages 
            WHERE thread_id = $1
          )
          SELECT DISTINCT ON (m.id)
            m.id, 
            m.content, 
            m.role, 
            m.type,
            m.created_at AS "createdAt", 
            m.thread_id AS "threadId",
            m.tool_call_ids AS "toolCallIds",
            m.tool_call_args AS "toolCallArgs",
            m.tokens,
            m.tool_call_args_expire_at AS "toolCallArgsExpireAt"
          FROM ordered_messages m
          WHERE m.id = ANY($2)
          OR EXISTS (
            SELECT 1 FROM ordered_messages target
            WHERE target.id = ANY($2)
            AND (
              -- Get previous messages based on the max withPreviousMessages
              (m.row_num >= target.row_num - $3 AND m.row_num < target.row_num)
              OR
              -- Get next messages based on the max withNextMessages
              (m.row_num <= target.row_num + $4 AND m.row_num > target.row_num)
            )
          )
          ORDER BY m.id, m.created_at
          `,
          [
            threadId,
            include.map(i => i.id),
            Math.max(...include.map(i => i.withPreviousMessages || 0)),
            Math.max(...include.map(i => i.withNextMessages || 0)),
          ],
        );
        messages.push(...includeResult.rows);
      }

      // Then get the remaining messages, excluding the ids we just fetched
      const result = await client.query(
        `
        SELECT 
            id, 
            content, 
            role, 
            type,
            created_at AS "createdAt", 
            thread_id AS "threadId",
            tool_call_ids AS "toolCallIds",
            tool_call_args AS "toolCallArgs",
            tokens,
            tool_call_args_expire_at AS "toolCallArgsExpireAt"
        FROM mastra_messages
        WHERE thread_id = $1
        AND id != ALL($2)
        ORDER BY created_at DESC
        LIMIT $3
        `,
        [threadId, messages.map(m => m.id), limit],
      );

      messages.push(...result.rows);

      // Sort all messages by creation date
      messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      return messages as T;
    } finally {
      client.release();
    }
  }

  async saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    await this.ensureTablesExist();

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const message of messages) {
        // @ts-ignore
        const { id, content, role, createdAt, threadId, toolCallIds, toolCallArgs, type } = message;

        await client.query(
          `
          INSERT INTO mastra_messages (
            id, 
            content, 
            role, 
            created_at, 
            thread_id, 
            tool_call_ids, 
            tool_call_args,
            type
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            id,
            JSON.stringify(content),
            role,
            createdAt?.toISOString(),
            threadId,
            JSON.stringify(toolCallIds),
            JSON.stringify(toolCallArgs),
            type,
          ],
        );
      }
      await client.query('COMMIT');
      return messages;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async validateToolCallArgs({ hashedArgs }: { hashedArgs: string }): Promise<boolean> {
    await this.ensureTablesExist();

    const client = await this.pool.connect();

    try {
      const toolArgsResult = await client.query<{ toolCallIds: string; toolCallArgs: string; createdAt: string }>(
        ` SELECT tool_call_ids as toolCallIds, 
                tool_call_args as toolCallArgs,
                created_at AS createdAt
         FROM mastra_messages
         WHERE tool_call_args::jsonb @> $1
         AND tool_call_args_expire_at > $2
         ORDER BY created_at ASC
         LIMIT 1`,
        [JSON.stringify([hashedArgs]), new Date().toISOString()],
      );

      return toolArgsResult.rows.length > 0;
    } catch (error) {
      console.log('error checking if valid arg exists====', error);
      return false;
    } finally {
      client.release();
    }
  }

  // TODO: This should be handled by the init method of MastraStorage instead
  async ensureTablesExist(): Promise<void> {
    if (this.hasTables) {
      return;
    }

    const client = await this.pool.connect();
    try {
      // Check if the threads table exists
      const threadsResult = await client.query<{ exists: boolean }>(`
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_name = 'mastra_threads'
                );
            `);

      if (!threadsResult?.rows?.[0]?.exists) {
        await client.query(`
                    CREATE TABLE IF NOT EXISTS mastra_threads (
                        id UUID PRIMARY KEY,
                        resourceid TEXT,
                        title TEXT,
                        created_at TIMESTAMP WITH TIME ZONE NOT NULL,
                        updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
                        metadata JSONB
                    );
                `);
      }

      // Check if the messages table exists
      const messagesResult = await client.query<{ exists: boolean }>(`
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_name = 'mastra_messages'
                );
            `);

      if (!messagesResult?.rows?.[0]?.exists) {
        await client.query(`
                    CREATE TABLE IF NOT EXISTS mastra_messages (
                        id UUID PRIMARY KEY,
                        content TEXT NOT NULL,
                        role VARCHAR(20) NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE NOT NULL,
                        tool_call_ids TEXT DEFAULT NULL,
                        tool_call_args TEXT DEFAULT NULL,
                        tool_call_args_expire_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
                        type VARCHAR(20) NOT NULL,
                        tokens INTEGER DEFAULT NULL,
                        thread_id UUID NOT NULL,
                        FOREIGN KEY (thread_id) REFERENCES mastra_threads(id)
                    );
                `);
      }
    } finally {
      client.release();
      this.hasTables = true;
    }
  }

  async close(): Promise<void> {
    await this.db.$pool.end();
  }
}
