import { type MessageType, type StorageThreadType } from '@mastra/core/memory';
import {
  MastraStorage,
  type EvalRow,
  type StorageColumn,
  type StorageGetMessagesArg,
  type TABLE_NAMES,
} from '@mastra/core/storage';
import { type WorkflowRunState } from '@mastra/core/workflows';
import pgPromise from 'pg-promise';

export type PostgresConfig =
  | {
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
    }
  | {
      connectionString: string;
    };

export class PostgresStore extends MastraStorage {
  private db: pgPromise.IDatabase<{}>;
  private pgp: pgPromise.IMain;

  constructor(config: PostgresConfig) {
    super({ name: 'PostgresStore' });
    this.pgp = pgPromise();
    this.db = this.pgp(
      `connectionString` in config
        ? { connectionString: config.connectionString }
        : {
            host: config.host,
            port: config.port,
            database: config.database,
            user: config.user,
            password: config.password,
          },
    );
  }

  getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    throw new Error('Method not implemented.');
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
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
        );
        ${
          tableName === MastraStorage.TABLE_WORKFLOW_SNAPSHOT
            ? `
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'mastra_workflow_snapshot_workflow_name_run_id_key'
          ) THEN
            ALTER TABLE ${tableName}
            ADD CONSTRAINT mastra_workflow_snapshot_workflow_name_run_id_key
            UNIQUE (workflow_name, run_id);
          END IF;
        END $$;
        `
            : ''
        }
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

      const result = await this.db.oneOrNone<R>(`SELECT * FROM ${tableName} WHERE ${conditions}`, values);

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
        FROM "${MastraStorage.TABLE_THREADS}"
        WHERE id = $1`,
        [threadId],
      );

      if (!thread) {
        return null;
      }

      return {
        ...thread,
        metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
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
        FROM "${MastraStorage.TABLE_THREADS}"
        WHERE "resourceId" = $1`,
        [resourceId],
      );

      return threads.map(thread => ({
        ...thread,
        metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
      }));
    } catch (error) {
      console.error(`Error getting threads for resource ${resourceId}:`, error);
      throw error;
    }
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    try {
      await this.db.none(
        `INSERT INTO "${MastraStorage.TABLE_THREADS}" (
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
          thread.metadata ? JSON.stringify(thread.metadata) : null,
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
        `UPDATE "${MastraStorage.TABLE_THREADS}"
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
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
      };
    } catch (error) {
      console.error('Error updating thread:', error);
      throw error;
    }
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    try {
      await this.db.tx(async t => {
        // First delete all messages associated with this thread
        await t.none(`DELETE FROM "${MastraStorage.TABLE_MESSAGES}" WHERE thread_id = $1`, [threadId]);

        // Then delete the thread
        await t.none(`DELETE FROM "${MastraStorage.TABLE_THREADS}" WHERE id = $1`, [threadId]);
      });
    } catch (error) {
      console.error('Error deleting thread:', error);
      throw error;
    }
  }

  async getMessages<T = unknown>({ threadId, selectBy }: StorageGetMessagesArg): Promise<T> {
    try {
      const messages: any[] = [];
      const limit = typeof selectBy?.last === `number` ? selectBy.last : 40;
      const include = selectBy?.include || [];

      if (include.length) {
        const includeResult = await this.db.manyOrNone(
          `
          WITH ordered_messages AS (
            SELECT 
              *,
              ROW_NUMBER() OVER (ORDER BY "createdAt") as row_num
            FROM "${MastraStorage.TABLE_MESSAGES}"
            WHERE thread_id = $1
          )
          SELECT DISTINCT ON (m.id)
            m.id, 
            m.content, 
            m.role, 
            m.type,
            m."createdAt", 
            m.thread_id AS "threadId"
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
          ORDER BY m.id, m."createdAt"
          `,
          [
            threadId,
            include.map(i => i.id),
            Math.max(...include.map(i => i.withPreviousMessages || 0)),
            Math.max(...include.map(i => i.withNextMessages || 0)),
          ],
        );

        messages.push(...includeResult);
      }

      // Then get the remaining messages, excluding the ids we just fetched
      const result = await this.db.manyOrNone(
        `
        SELECT 
            id, 
            content, 
            role, 
            type,
            "createdAt", 
            thread_id AS "threadId"
        FROM "${MastraStorage.TABLE_MESSAGES}"
        WHERE thread_id = $1
        AND id != ALL($2)
        ORDER BY "createdAt" DESC
        LIMIT $3
        `,
        [threadId, messages.map(m => m.id), limit],
      );

      messages.push(...result);

      // Sort all messages by creation date
      messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // Parse message content
      messages.forEach(message => {
        if (typeof message.content === 'string') {
          try {
            message.content = JSON.parse(message.content);
          } catch (e) {
            // If parsing fails, leave as string
          }
        }
      });

      return messages as T;
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

      // Check if thread exists
      const thread = await this.getThreadById({ threadId });
      if (!thread) {
        throw new Error(`Thread ${threadId} not found`);
      }

      await this.db.tx(async t => {
        for (const message of messages) {
          await t.none(
            `INSERT INTO "${MastraStorage.TABLE_MESSAGES}" (id, thread_id, content, "createdAt", role, type) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              message.id,
              threadId,
              typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
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
      const now = new Date().toISOString();
      await this.db.none(
        `INSERT INTO "${MastraStorage.TABLE_WORKFLOW_SNAPSHOT}" (
          workflow_name,
          run_id,
          snapshot,
          "createdAt",
          "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (workflow_name, run_id) DO UPDATE
        SET snapshot = EXCLUDED.snapshot,
            "updatedAt" = EXCLUDED."updatedAt"`,
        [workflowName, runId, JSON.stringify(snapshot), now, now],
      );
    } catch (error) {
      console.error('Error persisting workflow snapshot:', error);
      throw error;
    }
  }

  async loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    try {
      const result = await this.load({
        tableName: MastraStorage.TABLE_WORKFLOW_SNAPSHOT,
        keys: {
          workflow_name: workflowName,
          run_id: runId,
        },
      });

      if (!result) {
        return null;
      }

      return (result as any).snapshot;
    } catch (error) {
      console.error('Error loading workflow snapshot:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    this.pgp.end();
  }
}
