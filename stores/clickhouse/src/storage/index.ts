import type { MessageType, StorageThreadType } from '@mastra/core/memory';
import {
  MastraStorage,
  TABLE_EVALS,
  TABLE_MESSAGES,
  TABLE_SCHEMAS,
  TABLE_THREADS,
  TABLE_TRACES,
  TABLE_WORKFLOW_SNAPSHOT,
} from '@mastra/core/storage';
import type { EvalRow, StorageColumn, StorageGetMessagesArg, TABLE_NAMES } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { createClient, ClickHouseClient } from '@clickhouse/client';

export type ClickhouseConfig = {
  url: string;
  username: string;
  password: string;
};

const TABLE_ENGINES: Record<TABLE_NAMES, string> = {
  [TABLE_MESSAGES]: `MergeTree()`,
  [TABLE_WORKFLOW_SNAPSHOT]: `ReplacingMergeTree()`,
  [TABLE_TRACES]: `MergeTree()`,
  [TABLE_THREADS]: `ReplacingMergeTree()`,
  [TABLE_EVALS]: `MergeTree()`,
};

const COLUMN_TYPES: Record<StorageColumn['type'], string> = {
  text: 'String',
  timestamp: 'DateTime64(3)',
  uuid: 'String',
  jsonb: 'String',
  integer: 'Int64',
  bigint: 'Int64',
};

function transformRows<R>(rows: any[]): R[] {
  return rows.map((row: any) => transformRow<R>(row));
}

function transformRow<R>(row: any): R {
  if (!row) {
    return row;
  }

  if (row.createdAt) {
    row.createdAt = new Date(row.createdAt);
  }
  if (row.updatedAt) {
    row.updatedAt = new Date(row.updatedAt);
  }
  return row;
}

export class ClickhouseStore extends MastraStorage {
  private db: ClickHouseClient;

  constructor(config: ClickhouseConfig) {
    super({ name: 'ClickhouseStore' });
    this.db = createClient({
      url: config.url,
      username: config.username,
      password: config.password,
      clickhouse_settings: {
        date_time_input_format: 'best_effort',
        date_time_output_format: 'iso', // This is crucial
        use_client_time_zone: 1,
      },
    });
  }

  getEvalsByAgentName(_agentName: string, _type?: 'test' | 'live'): Promise<EvalRow[]> {
    throw new Error('Method not implemented.');
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    try {
      await this.db.insert({
        table: tableName,
        values: records.map(record => ({
          ...record,
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString(),
        })),
        format: 'JSONEachRow',
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
        },
      });
    } catch (error) {
      console.error(`Error inserting into ${tableName}:`, error);
      throw error;
    }
  }

  async getTraces({
    name,
    scope,
    page,
    perPage,
    attributes,
  }: {
    name?: string;
    scope?: string;
    page: number;
    perPage: number;
    attributes?: Record<string, string>;
  }): Promise<any[]> {
    let idx = 1;
    const limit = perPage;
    const offset = page * perPage;

    const args: Record<string, any> = {};

    const conditions: string[] = [];
    if (name) {
      conditions.push(`name LIKE CONCAT(\$${idx++}, '%')`);
    }
    if (scope) {
      conditions.push(`scope = \$${idx++}`);
    }
    if (attributes) {
      Object.keys(attributes).forEach(key => {
        conditions.push(`attributes->>'${key}' = \$${idx++}`);
      });
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    if (name) {
      args[name] = 'String';
    }

    if (scope) {
      args[scope] = 'String';
    }

    if (attributes) {
      for (const [_key, value] of Object.entries(attributes)) {
        args[value] = 'String';
      }
    }

    const result = await this.db.query({
      query: `SELECT toDateTime64(createdAt, 3) as createdAt, toDateTime64(updatedAt, 3) as updatedAt FROM ${TABLE_TRACES} ${whereClause} ORDER BY "createdAt" DESC LIMIT ${limit} OFFSET ${offset}`,
      query_params: args,
      clickhouse_settings: {
        // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
        date_time_input_format: 'best_effort',
        date_time_output_format: 'iso',
        use_client_time_zone: 1,
      },
    });

    if (!result) {
      return [];
    }

    const rows = await result.json();
    return transformRows(rows.data);
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
          if (!def.nullable) constraints.push('NOT NULL');
          return `"${name}" ${COLUMN_TYPES[def.type]} ${constraints.join(' ')}`;
        })
        .join(',\n');

      const sql =
        tableName === TABLE_WORKFLOW_SNAPSHOT
          ? `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          ${['id String'].concat(columns)}
        )
        ENGINE = ${TABLE_ENGINES[tableName]}
        PARTITION BY "createdAt"
        PRIMARY KEY (createdAt, run_id, workflow_name)
        ORDER BY (createdAt, run_id, workflow_name)
        SETTINGS index_granularity = 8192;
          `
          : `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          ${columns}
        )
        ENGINE = ${TABLE_ENGINES[tableName]}
        PARTITION BY "createdAt"
        PRIMARY KEY (createdAt, id)
        ORDER BY (createdAt, id)
        SETTINGS index_granularity = 8192;
      `;

      await this.db.query({
        query: sql,
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
        },
      });
    } catch (error) {
      console.error(`Error creating table ${tableName}:`, error);
      throw error;
    }
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      await this.db.query({
        query: `TRUNCATE TABLE ${tableName}`,
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
        },
      });
    } catch (error) {
      console.error(`Error clearing table ${tableName}:`, error);
      throw error;
    }
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    try {
      await this.db.insert({
        table: tableName,
        values: [
          {
            ...record,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
          },
        ],
        format: 'JSONEachRow',
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
        },
      });
    } catch (error) {
      console.error(`Error inserting into ${tableName}:`, error);
      throw error;
    }
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    try {
      const keyEntries = Object.entries(keys);
      const conditions = keyEntries
        .map(
          ([key], index) =>
            `"${key}" = {var_${key}:${COLUMN_TYPES[TABLE_SCHEMAS[tableName as TABLE_NAMES]?.[key]?.type ?? 'text']}}`,
        )
        .join(' AND ');
      const values = keyEntries.reduce((acc, [key, value]) => {
        return { ...acc, [`var_${key}`]: value };
      }, {});

      const result = await this.db.query({
        query: `SELECT *, toDateTime64(createdAt, 3) as createdAt, toDateTime64(updatedAt, 3) as updatedAt FROM ${tableName} ${TABLE_ENGINES[tableName as TABLE_NAMES].startsWith('ReplacingMergeTree') ? 'FINAL' : ''} WHERE ${conditions}`,
        query_params: values,
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
        },
      });

      if (!result) {
        return null;
      }

      const rows = await result.json();
      // If this is a workflow snapshot, parse the snapshot field
      if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
        const snapshot = rows.data[0] as any;
        if (!snapshot) {
          return null;
        }
        if (typeof snapshot.snapshot === 'string') {
          snapshot.snapshot = JSON.parse(snapshot.snapshot);
        }
        return transformRow(snapshot);
      }

      const data: R = transformRow(rows.data[0]);
      return data;
    } catch (error) {
      console.error(`Error loading from ${tableName}:`, error);
      throw error;
    }
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    try {
      const result = await this.db.query({
        query: `SELECT 
          id,
          "resourceId",
          title,
          metadata,
          toDateTime64(createdAt, 3) as createdAt,
          toDateTime64(updatedAt, 3) as updatedAt
        FROM "${TABLE_THREADS}"
        FINAL
        WHERE id = {var_id:String}`,
        query_params: { var_id: threadId },
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
        },
      });

      const rows = await result.json();
      const thread = transformRow(rows.data[0]) as StorageThreadType;

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
      const result = await this.db.query({
        query: `SELECT 
          id,
          "resourceId",
          title,
          metadata,
          toDateTime64(createdAt, 3) as createdAt,
          toDateTime64(updatedAt, 3) as updatedAt
        FROM "${TABLE_THREADS}"
        WHERE "resourceId" = {var_resourceId:String}`,
        query_params: { var_resourceId: resourceId },
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
        },
      });

      const rows = await result.json();
      const threads = transformRows(rows.data) as StorageThreadType[];

      return threads.map((thread: StorageThreadType) => ({
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
      await this.db.insert({
        table: TABLE_THREADS,
        values: [
          {
            ...thread,
            createdAt: thread.createdAt.toISOString(),
            updatedAt: thread.updatedAt.toISOString(),
          },
        ],
        format: 'JSONEachRow',
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
        },
      });

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

      const updatedThread = {
        ...existingThread,
        title,
        metadata: mergedMetadata,
        updatedAt: new Date(),
      };

      await this.db.insert({
        table: TABLE_THREADS,
        values: [
          {
            ...updatedThread,
            updatedAt: updatedThread.updatedAt.toISOString(),
          },
        ],
        format: 'JSONEachRow',
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
        },
      });

      return updatedThread;
    } catch (error) {
      console.error('Error updating thread:', error);
      throw error;
    }
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    try {
      // First delete all messages associated with this thread
      await this.db.command({
        query: `DELETE FROM "${TABLE_MESSAGES}" WHERE thread_id = '${threadId}';`,
        query_params: { var_thread_id: threadId },
        clickhouse_settings: {},
      });

      // Then delete the thread
      await this.db.command({
        query: `DELETE FROM "${TABLE_THREADS}" WHERE id = {var_id:String};`,
        query_params: { var_id: threadId },
        clickhouse_settings: {},
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
        const includeResult = await this.db.query({
          query: `
          WITH ordered_messages AS (
            SELECT 
              *,
              toDateTime64(createdAt, 3) as createdAt,
              toDateTime64(updatedAt, 3) as updatedAt,
              ROW_NUMBER() OVER (ORDER BY "createdAt" DESC) as row_num
            FROM "${TABLE_MESSAGES}"
            WHERE thread_id = {var_thread_id:String}
          )
          SELECT
            m.id AS id, 
            m.content as content, 
            m.role as role, 
            m.type as type,
            m.createdAt as createdAt, 
            m.updatedAt as updatedAt,
            m.thread_id AS "threadId"
          FROM ordered_messages m
          WHERE m.id = ANY({var_include:Array(String)})
          OR EXISTS (
            SELECT 1 FROM ordered_messages target
            WHERE target.id = ANY({var_include:Array(String)})
            AND (
              -- Get previous messages based on the max withPreviousMessages
              (m.row_num <= target.row_num + {var_withPreviousMessages:Int64} AND m.row_num > target.row_num)
              OR
              -- Get next messages based on the max withNextMessages
              (m.row_num >= target.row_num - {var_withNextMessages:Int64} AND m.row_num < target.row_num)
            )
          )
          ORDER BY m."createdAt" DESC
          `,
          query_params: {
            var_thread_id: threadId,
            var_include: include.map(i => i.id),
            var_withPreviousMessages: Math.max(...include.map(i => i.withPreviousMessages || 0)),
            var_withNextMessages: Math.max(...include.map(i => i.withNextMessages || 0)),
          },
          clickhouse_settings: {
            // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
            date_time_input_format: 'best_effort',
            date_time_output_format: 'iso',
            use_client_time_zone: 1,
          },
        });

        const rows = await includeResult.json();
        messages.push(...transformRows(rows.data));
      }

      // Then get the remaining messages, excluding the ids we just fetched
      const result = await this.db.query({
        query: `
        SELECT 
            id, 
            content, 
            role, 
            type,
            toDateTime64(createdAt, 3) as createdAt,
            thread_id AS "threadId"
        FROM "${TABLE_MESSAGES}"
        WHERE thread_id = {threadId:String}
        AND id NOT IN ({exclude:Array(String)})
        ORDER BY "createdAt" DESC
        LIMIT {limit:Int64}
        `,
        query_params: {
          threadId,
          exclude: messages.map(m => m.id),
          limit,
        },
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
        },
      });

      const rows = await result.json();
      messages.push(...transformRows(rows.data));

      // Sort all messages by creation date
      messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // Parse message content
      messages.forEach(message => {
        if (typeof message.content === 'string') {
          try {
            message.content = JSON.parse(message.content);
          } catch {
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

      await this.db.insert({
        table: TABLE_MESSAGES,
        format: 'JSONEachRow',
        values: messages.map(message => ({
          id: message.id,
          thread_id: threadId,
          content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
          createdAt: message.createdAt.toISOString(),
          role: message.role,
          type: message.type,
        })),
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
        },
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
      const currentSnapshot = await this.load({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: { workflow_name: workflowName, run_id: runId },
      });

      const now = new Date();
      const persisting = currentSnapshot
        ? {
            ...currentSnapshot,
            snapshot: JSON.stringify(snapshot),
            updatedAt: now.toISOString(),
          }
        : {
            workflow_name: workflowName,
            run_id: runId,
            snapshot: JSON.stringify(snapshot),
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          };

      await this.db.insert({
        table: TABLE_WORKFLOW_SNAPSHOT,
        format: 'JSONEachRow',
        values: [persisting],
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
        },
      });
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
        tableName: TABLE_WORKFLOW_SNAPSHOT,
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
    await this.db.close();
  }
}
