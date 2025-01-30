import { MastraStorage, TABLE_NAMES } from '@mastra/core';
import { MessageType, StorageThreadType } from '@mastra/core';
import { StorageColumn } from '@mastra/core';
import pgPromise from 'pg-promise';

export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export class PostgresStore extends MastraStorage {
  private db: pgPromise.IDatabase<{}>;
  private pgp: pgPromise.IMain;

  constructor(config: PostgresConfig) {
    super({ name: 'PostgresStore' });
    this.pgp = pgPromise();
    this.db = this.pgp({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
    });
  }

  async createTable({ tableName, schema }: { tableName: TABLE_NAMES; schema: Record<string, StorageColumn> }): Promise<void> {
    try {
      const columns = Object.entries(schema)
        .map(([name, def]) => {
          const constraints = [];
          if (def.primaryKey) constraints.push('PRIMARY KEY');
          if (!def.nullable) constraints.push('NOT NULL');
          return `"${name}" ${def.type.toUpperCase()} ${constraints.join(' ')}`;
        })
        .join(',\n');

      const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          ${columns}
        )
      `;

      await this.db.none(sql);
    } catch (error) {
      console.error(`Error creating table ${tableName}:`, error);
      throw error;
    }
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      await this.db.none(`TRUNCATE TABLE ${tableName} CASCADE`);
    } catch (error) {
      console.error(`Error clearing table ${tableName}:`, error);
      throw error;
    }
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    try {
      const columns = Object.keys(record);
      const values = Object.values(record);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

      await this.db.none(
        `INSERT INTO ${tableName} (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`,
        values,
      );
    } catch (error) {
      console.error(`Error inserting into ${tableName}:`, error);
      throw error;
    }
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    try {
      const keyEntries = Object.entries(keys);
      const conditions = keyEntries.map(([key], index) => `"${key}" = $${index + 1}`).join(' AND ');
      const values = keyEntries.map(([_, value]) => value);

      const result = await this.db.oneOrNone<R>(
        `SELECT * FROM ${tableName} WHERE ${conditions}`,
        values,
      );

      if (!result) {
        return null;
      }

      // If this is a workflow snapshot, parse the snapshot field
      if (tableName === MastraStorage.TABLE_WORKFLOW_SNAPSHOT) {
        const snapshot = result as any;
        if (typeof snapshot.snapshot === 'string') {
          snapshot.snapshot = JSON.parse(snapshot.snapshot);
        }
        return snapshot;
      }

      return result;
    } catch (error) {
      console.error(`Error loading from ${tableName}:`, error);
      throw error;
    }
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    try {
      const thread = await this.db.oneOrNone<StorageThreadType>(
        `SELECT 
          id,
          "resourceId",
          title,
          metadata,
          "createdAt",
          "updatedAt"
        FROM ${MastraStorage.TABLE_THREADS}
        WHERE id = $1`,
        [threadId],
      );

      if (!thread) {
        return null;
      }

      return {
        ...thread,
        metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
        createdAt: thread.createdAt.toISOString(),
        updatedAt: thread.updatedAt.toISOString(),
      };
    } catch (error) {
      console.error(`Error getting thread ${threadId}:`, error);
      throw error;
    }
  }

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    try {
      const threads = await this.db.manyOrNone<StorageThreadType>(
        `SELECT 
          id,
          "resourceId",
          title,
          metadata,
          "createdAt",
          "updatedAt"
        FROM ${MastraStorage.TABLE_THREADS}
        WHERE "resourceId" = $1`,
        [resourceId],
      );

      return threads.map(thread => ({
        ...thread,
        metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
        createdAt: thread.createdAt.toISOString(),
        updatedAt: thread.updatedAt.toISOString(),
      }));
    } catch (error) {
      console.error(`Error getting threads for resource ${resourceId}:`, error);
      throw error;
    }
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    try {
      await this.db.none(
        `INSERT INTO ${MastraStorage.TABLE_THREADS} (
          id,
          "resourceId",
          title,
          metadata,
          "createdAt",
          "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          "resourceId" = EXCLUDED."resourceId",
          title = EXCLUDED.title,
          metadata = EXCLUDED.metadata,
          "createdAt" = EXCLUDED."createdAt",
          "updatedAt" = EXCLUDED."updatedAt"`,
        [
          thread.id,
          thread.resourceId,
          thread.title,
          thread.metadata,
          thread.createdAt,
          thread.updatedAt,
        ],
      );

      return thread;
    } catch (error) {
      console.error('Error saving thread:', error);
      throw error;
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
  }): Promise<StorageThreadType> {
    try {
      // First get the existing thread to merge metadata
      const existingThread = await this.getThreadById({ threadId: id });
      if (!existingThread) {
        throw new Error(`Thread ${id} not found`);
      }

      // Merge the existing metadata with the new metadata
      const mergedMetadata = {
        ...existingThread.metadata,
        ...metadata,
      };

      const thread = await this.db.one<StorageThreadType>(
        `UPDATE ${MastraStorage.TABLE_THREADS}
        SET title = $1,
            metadata = $2,
            "updatedAt" = $3
        WHERE id = $4
        RETURNING *`,
        [title, mergedMetadata, new Date().toISOString(), id],
      );

      return {
        ...thread,
        metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
        createdAt: thread.createdAt.toISOString(),
        updatedAt: thread.updatedAt.toISOString(),
      };
    } catch (error) {
      console.error('Error updating thread:', error);
      throw error;
    }
  }

  async deleteThread({ id }: { id: string }): Promise<void> {
    try {
      await this.db.tx(async (t) => {
        // First delete all messages associated with this thread
        await t.none(
          `DELETE FROM ${MastraStorage.TABLE_MESSAGES} WHERE thread_id = $1`,
          [id],
        );

        // Then delete the thread
        await t.none(
          `DELETE FROM ${MastraStorage.TABLE_THREADS} WHERE id = $1`,
          [id],
        );
      });
    } catch (error) {
      console.error('Error deleting thread:', error);
      throw error;
    }
  }

  async getMessages({ threadId }: { threadId: string }): Promise<MessageType[]> {
    try {
      const messages = await this.db.any<MessageType>(
        `SELECT content FROM ${MastraStorage.TABLE_MESSAGES} 
         WHERE thread_id = $1 
         ORDER BY "createdAt" ASC`,
        [threadId],
      );

      return messages.map(({ content }) => {
        const contentParsed = typeof content === 'string' ? JSON.parse(content) : content;
        return contentParsed;
      });
    } catch (error) {
      console.error('Error getting messages:', error);
      throw error;
    }
  }

  async saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    if (messages.length === 0) return messages;

    try {
      const threadId = messages[0]?.threadId;
      if (!threadId) {
        throw new Error('Thread ID is required');
      }

      await this.db.tx(async (t) => {
        for (const message of messages) {
          await t.none(
            `INSERT INTO ${MastraStorage.TABLE_MESSAGES} (id, thread_id, content, "createdAt", role, type) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              message.id,
              threadId,
              JSON.stringify(message),
              message.createdAt || new Date().toISOString(),
              message.role,
              message.type,
            ],
          );
        }
      });

      return messages;
    } catch (error) {
      console.error('Error saving messages:', error);
      throw error;
    }
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
    try {
      await this.db.none(
        `INSERT INTO ${MastraStorage.TABLE_WORKFLOW_SNAPSHOT} (
          workflow_name,
          run_id,
          snapshot,
          "createdAt",
          "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (workflow_name, run_id) DO UPDATE SET
          snapshot = EXCLUDED.snapshot,
          "updatedAt" = EXCLUDED."updatedAt"`,
        [
          workflowName,
          runId,
          JSON.stringify(snapshot),
          new Date(),
          new Date(),
        ],
      );
    } catch (error) {
      console.error('Error inserting into workflow_snapshot:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.pgp.end();
  }
}
