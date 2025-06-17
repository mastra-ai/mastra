import type { ClickHouseClient } from '@clickhouse/client';
import { createClient } from '@clickhouse/client';
import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import type { MetricResult, TestInfo } from '@mastra/core/eval';
import type { MastraMessageV1, MastraMessageV2, StorageThreadType } from '@mastra/core/memory';
import {
  MastraStorage,
  TABLE_EVALS,
  TABLE_MESSAGES,
  TABLE_SCHEMAS,
  TABLE_THREADS,
  TABLE_TRACES,
  TABLE_WORKFLOW_SNAPSHOT,
} from '@mastra/core/storage';
import type {
  EvalRow,
  PaginationInfo,
  StorageColumn,
  StorageGetMessagesArg,
  TABLE_NAMES,
  WorkflowRun,
  WorkflowRuns,
  StorageGetTracesArg,
} from '@mastra/core/storage';
import type { Trace } from '@mastra/core/telemetry';
import type { WorkflowRunState } from '@mastra/core/workflows';

function safelyParseJSON(jsonString: string): any {
  try {
    return JSON.parse(jsonString);
  } catch {
    return {};
  }
}

type IntervalUnit =
  | 'NANOSECOND'
  | 'MICROSECOND'
  | 'MILLISECOND'
  | 'SECOND'
  | 'MINUTE'
  | 'HOUR'
  | 'DAY'
  | 'WEEK'
  | 'MONTH'
  | 'QUARTER'
  | 'YEAR';

export type ClickhouseConfig = {
  url: string;
  username: string;
  password: string;
  ttl?: {
    [TableKey in TABLE_NAMES]?: {
      row?: { interval: number; unit: IntervalUnit; ttlKey?: string };
      columns?: Partial<{
        [ColumnKey in keyof (typeof TABLE_SCHEMAS)[TableKey]]: {
          interval: number;
          unit: IntervalUnit;
          ttlKey?: string;
        };
      }>;
    };
  };
};

export const TABLE_ENGINES: Record<TABLE_NAMES, string> = {
  [TABLE_MESSAGES]: `MergeTree()`,
  [TABLE_WORKFLOW_SNAPSHOT]: `ReplacingMergeTree()`,
  [TABLE_TRACES]: `MergeTree()`,
  [TABLE_THREADS]: `ReplacingMergeTree()`,
  [TABLE_EVALS]: `MergeTree()`,
};

export const COLUMN_TYPES: Record<StorageColumn['type'], string> = {
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
  protected db: ClickHouseClient;
  protected ttl: ClickhouseConfig['ttl'] = {};

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
        output_format_json_quote_64bit_integers: 0,
      },
    });
    this.ttl = config.ttl;
  }

  private transformEvalRow(row: Record<string, any>): EvalRow {
    row = transformRow(row);
    const resultValue = JSON.parse(row.result as string);
    const testInfoValue = row.test_info ? JSON.parse(row.test_info as string) : undefined;

    if (!resultValue || typeof resultValue !== 'object' || !('score' in resultValue)) {
      throw new Error(`Invalid MetricResult format: ${JSON.stringify(resultValue)}`);
    }

    return {
      input: row.input as string,
      output: row.output as string,
      result: resultValue as MetricResult,
      agentName: row.agent_name as string,
      metricName: row.metric_name as string,
      instructions: row.instructions as string,
      testInfo: testInfoValue as TestInfo,
      globalRunId: row.global_run_id as string,
      runId: row.run_id as string,
      createdAt: row.created_at as string,
    };
  }

  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    try {
      const baseQuery = `SELECT *, toDateTime64(createdAt, 3) as createdAt FROM ${TABLE_EVALS} WHERE agent_name = {var_agent_name:String}`;
      const typeCondition =
        type === 'test'
          ? " AND test_info IS NOT NULL AND JSONExtractString(test_info, 'testPath') IS NOT NULL"
          : type === 'live'
            ? " AND (test_info IS NULL OR JSONExtractString(test_info, 'testPath') IS NULL)"
            : '';

      const result = await this.db.query({
        query: `${baseQuery}${typeCondition} ORDER BY createdAt DESC`,
        query_params: { var_agent_name: agentName },
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      if (!result) {
        return [];
      }

      const rows = await result.json();
      return rows.data.map((row: any) => this.transformEvalRow(row));
    } catch (error) {
      // Handle case where table doesn't exist yet
      if (error instanceof Error && error.message.includes('no such table')) {
        return [];
      }
      this.logger.error('Failed to get evals for the specified agent: ' + (error as any)?.message);
      throw error;
    }
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    try {
      await this.db.insert({
        table: tableName,
        values: records.map(record => ({
          ...Object.fromEntries(
            Object.entries(record).map(([key, value]) => [
              key,
              TABLE_SCHEMAS[tableName as TABLE_NAMES]?.[key]?.type === 'timestamp'
                ? new Date(value).toISOString()
                : value,
            ]),
          ),
        })),
        format: 'JSONEachRow',
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
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
    filters,
    fromDate,
    toDate,
  }: {
    name?: string;
    scope?: string;
    page: number;
    perPage: number;
    attributes?: Record<string, string>;
    filters?: Record<string, any>;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<any[]> {
    const limit = perPage;
    const offset = page * perPage;

    const args: Record<string, any> = {};

    const conditions: string[] = [];
    if (name) {
      conditions.push(`name LIKE CONCAT({var_name:String}, '%')`);
      args.var_name = name;
    }
    if (scope) {
      conditions.push(`scope = {var_scope:String}`);
      args.var_scope = scope;
    }
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        conditions.push(`JSONExtractString(attributes, '${key}') = {var_attr_${key}:String}`);
        args[`var_attr_${key}`] = value;
      });
    }

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        conditions.push(
          `${key} = {var_col_${key}:${COLUMN_TYPES[TABLE_SCHEMAS.mastra_traces?.[key]?.type ?? 'text']}}`,
        );
        args[`var_col_${key}`] = value;
      });
    }

    if (fromDate) {
      conditions.push(`createdAt >= {var_from_date:DateTime64(3)}`);
      args.var_from_date = fromDate.getTime() / 1000; // Convert to Unix timestamp
    }

    if (toDate) {
      conditions.push(`createdAt <= {var_to_date:DateTime64(3)}`);
      args.var_to_date = toDate.getTime() / 1000; // Convert to Unix timestamp
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.db.query({
      query: `SELECT *, toDateTime64(createdAt, 3) as createdAt FROM ${TABLE_TRACES} ${whereClause} ORDER BY "createdAt" DESC LIMIT ${limit} OFFSET ${offset}`,
      query_params: args,
      clickhouse_settings: {
        // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
        date_time_input_format: 'best_effort',
        date_time_output_format: 'iso',
        use_client_time_zone: 1,
        output_format_json_quote_64bit_integers: 0,
      },
    });

    if (!result) {
      return [];
    }

    const resp = await result.json();
    const rows: any[] = resp.data;
    return rows.map(row => ({
      id: row.id,
      parentSpanId: row.parentSpanId,
      traceId: row.traceId,
      name: row.name,
      scope: row.scope,
      kind: row.kind,
      status: safelyParseJSON(row.status as string),
      events: safelyParseJSON(row.events as string),
      links: safelyParseJSON(row.links as string),
      attributes: safelyParseJSON(row.attributes as string),
      startTime: row.startTime,
      endTime: row.endTime,
      other: safelyParseJSON(row.other as string),
      createdAt: row.createdAt,
    }));
  }

  async optimizeTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    await this.db.command({
      query: `OPTIMIZE TABLE ${tableName} FINAL`,
    });
  }

  async materializeTtl({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    await this.db.command({
      query: `ALTER TABLE ${tableName} MATERIALIZE TTL;`,
    });
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
          const columnTtl = this.ttl?.[tableName]?.columns?.[name];
          return `"${name}" ${COLUMN_TYPES[def.type]} ${constraints.join(' ')} ${columnTtl ? `TTL toDateTime(${columnTtl.ttlKey ?? 'createdAt'}) + INTERVAL ${columnTtl.interval} ${columnTtl.unit}` : ''}`;
        })
        .join(',\n');

      const rowTtl = this.ttl?.[tableName]?.row;
      const sql =
        tableName === TABLE_WORKFLOW_SNAPSHOT
          ? `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          ${['id String'].concat(columns)}
        )
        ENGINE = ${TABLE_ENGINES[tableName]}
        PRIMARY KEY (createdAt, run_id, workflow_name)
        ORDER BY (createdAt, run_id, workflow_name)
        ${rowTtl ? `TTL toDateTime(${rowTtl.ttlKey ?? 'createdAt'}) + INTERVAL ${rowTtl.interval} ${rowTtl.unit}` : ''}
        SETTINGS index_granularity = 8192
          `
          : `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          ${columns}
        )
        ENGINE = ${TABLE_ENGINES[tableName]}
        PRIMARY KEY (createdAt, ${tableName === TABLE_EVALS ? 'run_id' : 'id'})
        ORDER BY (createdAt, ${tableName === TABLE_EVALS ? 'run_id' : 'id'})
        ${this.ttl?.[tableName]?.row ? `TTL toDateTime(createdAt) + INTERVAL ${this.ttl[tableName].row.interval} ${this.ttl[tableName].row.unit}` : ''}
        SETTINGS index_granularity = 8192
      `;

      await this.db.query({
        query: sql,
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });
    } catch (error) {
      console.error(`Error creating table ${tableName}:`, error);
      throw error;
    }
  }

  protected getSqlType(type: StorageColumn['type']): string {
    switch (type) {
      case 'text':
        return 'String';
      case 'timestamp':
        return 'DateTime64(3)';
      case 'integer':
      case 'bigint':
        return 'Int64';
      case 'jsonb':
        return 'String';
      default:
        return super.getSqlType(type); // fallback to base implementation
    }
  }

  /**
   * Alters table schema to add columns if they don't exist
   * @param tableName Name of the table
   * @param schema Schema of the table
   * @param ifNotExists Array of column names to add if they don't exist
   */
  async alterTable({
    tableName,
    schema,
    ifNotExists,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    try {
      // 1. Get existing columns
      const describeSql = `DESCRIBE TABLE ${tableName}`;
      const result = await this.db.query({
        query: describeSql,
      });
      const rows = await result.json();
      const existingColumnNames = new Set(rows.data.map((row: any) => row.name.toLowerCase()));

      // 2. Add missing columns
      for (const columnName of ifNotExists) {
        if (!existingColumnNames.has(columnName.toLowerCase()) && schema[columnName]) {
          const columnDef = schema[columnName];
          let sqlType = this.getSqlType(columnDef.type);
          if (columnDef.nullable !== false) {
            sqlType = `Nullable(${sqlType})`;
          }
          const defaultValue = columnDef.nullable === false ? this.getDefaultValue(columnDef.type) : '';
          // Use backticks or double quotes as needed for identifiers
          const alterSql =
            `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS "${columnName}" ${sqlType} ${defaultValue}`.trim();

          await this.db.query({
            query: alterSql,
          });
          this.logger?.debug?.(`Added column ${columnName} to table ${tableName}`);
        }
      }
    } catch (error) {
      this.logger?.error?.(
        `Error altering table ${tableName}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(`Failed to alter table ${tableName}: ${error}`);
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
          output_format_json_quote_64bit_integers: 0,
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
          output_format_json_quote_64bit_integers: 0,
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
          ([key]) =>
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
          output_format_json_quote_64bit_integers: 0,
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
          output_format_json_quote_64bit_integers: 0,
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
          output_format_json_quote_64bit_integers: 0,
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
          output_format_json_quote_64bit_integers: 0,
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
        format: 'JSONEachRow',
        values: [
          {
            id: updatedThread.id,
            resourceId: updatedThread.resourceId,
            title: updatedThread.title,
            metadata: updatedThread.metadata,
            createdAt: updatedThread.createdAt,
            updatedAt: updatedThread.updatedAt.toISOString(),
          },
        ],
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
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
        query: `DELETE FROM "${TABLE_MESSAGES}" WHERE thread_id = {var_thread_id:String};`,
        query_params: { var_thread_id: threadId },
        clickhouse_settings: {
          output_format_json_quote_64bit_integers: 0,
        },
      });

      // Then delete the thread
      await this.db.command({
        query: `DELETE FROM "${TABLE_THREADS}" WHERE id = {var_id:String};`,
        query_params: { var_id: threadId },
        clickhouse_settings: {
          output_format_json_quote_64bit_integers: 0,
        },
      });
    } catch (error) {
      console.error('Error deleting thread:', error);
      throw error;
    }
  }

  public async getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
  public async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  public async getMessages({
    threadId,
    resourceId,
    selectBy,
    format,
  }: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
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
            output_format_json_quote_64bit_integers: 0,
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
          output_format_json_quote_64bit_integers: 0,
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

      const list = new MessageList({ threadId, resourceId }).add(messages, 'memory');
      if (format === `v2`) return list.get.all.v2();
      return list.get.all.v1();
    } catch (error) {
      console.error('Error getting messages:', error);
      throw error;
    }
  }

  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  async saveMessages(
    args: { messages: MastraMessageV1[]; format?: undefined | 'v1' } | { messages: MastraMessageV2[]; format: 'v2' },
  ): Promise<MastraMessageV2[] | MastraMessageV1[]> {
    const { messages, format = 'v1' } = args;
    if (messages.length === 0) return messages;

    try {
      const threadId = messages[0]?.threadId;
      const resourceId = messages[0]?.resourceId;
      if (!threadId) {
        throw new Error('Thread ID is required');
      }

      // Check if thread exists
      const thread = await this.getThreadById({ threadId });
      if (!thread) {
        throw new Error(`Thread ${threadId} not found`);
      }

      // Execute message inserts and thread update in parallel for better performance
      await Promise.all([
        // Insert messages
        this.db.insert({
          table: TABLE_MESSAGES,
          format: 'JSONEachRow',
          values: messages.map(message => ({
            id: message.id,
            thread_id: threadId,
            content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
            createdAt: message.createdAt.toISOString(),
            role: message.role,
            type: message.type || 'v2',
          })),
          clickhouse_settings: {
            // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
            date_time_input_format: 'best_effort',
            use_client_time_zone: 1,
            output_format_json_quote_64bit_integers: 0,
          },
        }),
        // Update thread's updatedAt timestamp
        this.db.insert({
          table: TABLE_THREADS,
          format: 'JSONEachRow',
          values: [
            {
              id: thread.id,
              resourceId: thread.resourceId,
              title: thread.title,
              metadata: thread.metadata,
              createdAt: thread.createdAt,
              updatedAt: new Date().toISOString(),
            },
          ],
          clickhouse_settings: {
            date_time_input_format: 'best_effort',
            use_client_time_zone: 1,
            output_format_json_quote_64bit_integers: 0,
          },
        }),
      ]);

      const list = new MessageList({ threadId, resourceId }).add(messages, 'memory');
      if (format === `v2`) return list.get.all.v2();
      return list.get.all.v1();
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
          output_format_json_quote_64bit_integers: 0,
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

  private parseWorkflowRun(row: any): WorkflowRun {
    let parsedSnapshot: WorkflowRunState | string = row.snapshot as string;
    if (typeof parsedSnapshot === 'string') {
      try {
        parsedSnapshot = JSON.parse(row.snapshot as string) as WorkflowRunState;
      } catch (e) {
        // If parsing fails, return the raw snapshot string
        console.warn(`Failed to parse snapshot for workflow ${row.workflow_name}: ${e}`);
      }
    }

    return {
      workflowName: row.workflow_name,
      runId: row.run_id,
      snapshot: parsedSnapshot,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      resourceId: row.resourceId,
    };
  }

  async getWorkflowRuns({
    workflowName,
    fromDate,
    toDate,
    limit,
    offset,
    resourceId,
  }: {
    workflowName?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
    resourceId?: string;
  } = {}): Promise<WorkflowRuns> {
    try {
      const conditions: string[] = [];
      const values: Record<string, any> = {};

      if (workflowName) {
        conditions.push(`workflow_name = {var_workflow_name:String}`);
        values.var_workflow_name = workflowName;
      }

      if (resourceId) {
        const hasResourceId = await this.hasColumn(TABLE_WORKFLOW_SNAPSHOT, 'resourceId');
        if (hasResourceId) {
          conditions.push(`resourceId = {var_resourceId:String}`);
          values.var_resourceId = resourceId;
        } else {
          console.warn(`[${TABLE_WORKFLOW_SNAPSHOT}] resourceId column not found. Skipping resourceId filter.`);
        }
      }

      if (fromDate) {
        conditions.push(`createdAt >= {var_from_date:DateTime64(3)}`);
        values.var_from_date = fromDate.getTime() / 1000; // Convert to Unix timestamp
      }

      if (toDate) {
        conditions.push(`createdAt <= {var_to_date:DateTime64(3)}`);
        values.var_to_date = toDate.getTime() / 1000; // Convert to Unix timestamp
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limitClause = limit !== undefined ? `LIMIT ${limit}` : '';
      const offsetClause = offset !== undefined ? `OFFSET ${offset}` : '';

      let total = 0;
      // Only get total count when using pagination
      if (limit !== undefined && offset !== undefined) {
        const countResult = await this.db.query({
          query: `SELECT COUNT(*) as count FROM ${TABLE_WORKFLOW_SNAPSHOT} ${TABLE_ENGINES[TABLE_WORKFLOW_SNAPSHOT].startsWith('ReplacingMergeTree') ? 'FINAL' : ''} ${whereClause}`,
          query_params: values,
          format: 'JSONEachRow',
        });
        const countRows = await countResult.json();
        total = Number((countRows as Array<{ count: string | number }>)[0]?.count ?? 0);
      }

      // Get results
      const result = await this.db.query({
        query: `
          SELECT 
            workflow_name,
            run_id,
            snapshot,
            toDateTime64(createdAt, 3) as createdAt,
            toDateTime64(updatedAt, 3) as updatedAt,
            resourceId
          FROM ${TABLE_WORKFLOW_SNAPSHOT} ${TABLE_ENGINES[TABLE_WORKFLOW_SNAPSHOT].startsWith('ReplacingMergeTree') ? 'FINAL' : ''}
          ${whereClause}
          ORDER BY createdAt DESC
          ${limitClause}
          ${offsetClause}
        `,
        query_params: values,
        format: 'JSONEachRow',
      });

      const resultJson = await result.json();
      const rows = resultJson as any[];
      const runs = rows.map(row => {
        return this.parseWorkflowRun(row);
      });

      // Use runs.length as total when not paginating
      return { runs, total: total || runs.length };
    } catch (error) {
      console.error('Error getting workflow runs:', error);
      throw error;
    }
  }

  async getWorkflowRunById({
    runId,
    workflowName,
  }: {
    runId: string;
    workflowName?: string;
  }): Promise<WorkflowRun | null> {
    try {
      const conditions: string[] = [];
      const values: Record<string, any> = {};

      if (runId) {
        conditions.push(`run_id = {var_runId:String}`);
        values.var_runId = runId;
      }

      if (workflowName) {
        conditions.push(`workflow_name = {var_workflow_name:String}`);
        values.var_workflow_name = workflowName;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get results
      const result = await this.db.query({
        query: `
          SELECT 
            workflow_name,
            run_id,
            snapshot,
            toDateTime64(createdAt, 3) as createdAt,
            toDateTime64(updatedAt, 3) as updatedAt,
            resourceId
          FROM ${TABLE_WORKFLOW_SNAPSHOT} ${TABLE_ENGINES[TABLE_WORKFLOW_SNAPSHOT].startsWith('ReplacingMergeTree') ? 'FINAL' : ''}
          ${whereClause}
        `,
        query_params: values,
        format: 'JSONEachRow',
      });

      const resultJson = await result.json();
      if (!Array.isArray(resultJson) || resultJson.length === 0) {
        return null;
      }
      return this.parseWorkflowRun(resultJson[0]);
    } catch (error) {
      console.error('Error getting workflow run by ID:', error);
      throw error;
    }
  }

  private async hasColumn(table: string, column: string): Promise<boolean> {
    const result = await this.db.query({
      query: `DESCRIBE TABLE ${table}`,
      format: 'JSONEachRow',
    });
    const columns = (await result.json()) as { name: string }[];
    return columns.some(c => c.name === column);
  }

  async getTracesPaginated(_args: StorageGetTracesArg): Promise<PaginationInfo & { traces: Trace[] }> {
    throw new Error('Method not implemented.');
  }

  async getThreadsByResourceIdPaginated(_args: {
    resourceId: string;
    page?: number;
    perPage?: number;
  }): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    throw new Error('Method not implemented.');
  }

  async getMessagesPaginated(
    _args: StorageGetMessagesArg,
  ): Promise<PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }> {
    throw new Error('Method not implemented.');
  }

  async close(): Promise<void> {
    await this.db.close();
  }

  async updateMessages(_args: {
    messages: Partial<Omit<MastraMessageV2, 'createdAt'>> &
      {
        id: string;
        content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
      }[];
  }): Promise<MastraMessageV2[]> {
    this.logger.error('updateMessages is not yet implemented in ClickhouseStore');
    throw new Error('Method not implemented');
  }
}
