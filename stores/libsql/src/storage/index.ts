import { createClient } from '@libsql/client';
import type { Client, InValue } from '@libsql/client';
import { MessageList } from '@mastra/core/agent';
import type { MastraMessageV2 } from '@mastra/core/agent';
import type { MetricResult, TestInfo } from '@mastra/core/eval';
import type { MastraMessageV1, StorageThreadType } from '@mastra/core/memory';
import {
  MastraStorage,
  TABLE_EVALS,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_TRACES,
  TABLE_WORKFLOW_SNAPSHOT,
} from '@mastra/core/storage';
import type {
  EvalRow,
  PaginationArgs,
  PaginationInfo,
  StorageColumn,
  StorageGetMessagesArg,
  TABLE_NAMES,
  WorkflowRun,
  WorkflowRuns,
} from '@mastra/core/storage';
import type { Trace } from '@mastra/core/telemetry';
import { parseSqlIdentifier } from '@mastra/core/utils';
import type { WorkflowRunState } from '@mastra/core/workflows';

function safelyParseJSON(jsonString: string): any {
  try {
    return JSON.parse(jsonString);
  } catch {
    return {};
  }
}

export interface LibSQLConfig {
  url: string;
  authToken?: string;
  /**
   * Maximum number of retries for write operations if an SQLITE_BUSY error occurs.
   * @default 5
   */
  maxRetries?: number;
  /**
   * Initial backoff time in milliseconds for retrying write operations on SQLITE_BUSY.
   * The backoff time will double with each retry (exponential backoff).
   * @default 100
   */
  initialBackoffMs?: number;
}

export class LibSQLStore extends MastraStorage {
  private client: Client;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;

  constructor(config: LibSQLConfig) {
    super({ name: `LibSQLStore` });

    this.maxRetries = config.maxRetries ?? 5;
    this.initialBackoffMs = config.initialBackoffMs ?? 100;

    // need to re-init every time for in memory dbs or the tables might not exist
    if (config.url.endsWith(':memory:')) {
      this.shouldCacheInit = false;
    }

    this.client = createClient(config);

    // Set PRAGMAs for better concurrency, especially for file-based databases
    if (config.url.startsWith('file:') || config.url.includes(':memory:')) {
      this.client
        .execute('PRAGMA journal_mode=WAL;')
        .then(() => this.logger.debug('LibSQLStore: PRAGMA journal_mode=WAL set.'))
        .catch(err => this.logger.warn('LibSQLStore: Failed to set PRAGMA journal_mode=WAL.', err));
      this.client
        .execute('PRAGMA busy_timeout = 5000;') // 5 seconds
        .then(() => this.logger.debug('LibSQLStore: PRAGMA busy_timeout=5000 set.'))
        .catch(err => this.logger.warn('LibSQLStore: Failed to set PRAGMA busy_timeout.', err));
    }
  }

  private getCreateTableSQL(tableName: TABLE_NAMES, schema: Record<string, StorageColumn>): string {
    const parsedTableName = parseSqlIdentifier(tableName, 'table name');
    const columns = Object.entries(schema).map(([name, col]) => {
      const parsedColumnName = parseSqlIdentifier(name, 'column name');
      let type = col.type.toUpperCase();
      if (type === 'TEXT') type = 'TEXT';
      if (type === 'TIMESTAMP') type = 'TEXT'; // Store timestamps as ISO strings
      // if (type === 'BIGINT') type = 'INTEGER';

      const nullable = col.nullable ? '' : 'NOT NULL';
      const primaryKey = col.primaryKey ? 'PRIMARY KEY' : '';

      return `${parsedColumnName} ${type} ${nullable} ${primaryKey}`.trim();
    });

    // For workflow_snapshot table, create a composite primary key
    if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
      const stmnt = `CREATE TABLE IF NOT EXISTS ${parsedTableName} (
                ${columns.join(',\n')},
                PRIMARY KEY (workflow_name, run_id)
            )`;
      return stmnt;
    }

    return `CREATE TABLE IF NOT EXISTS ${parsedTableName} (${columns.join(', ')})`;
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    try {
      this.logger.debug(`Creating database table`, { tableName, operation: 'schema init' });
      const sql = this.getCreateTableSQL(tableName, schema);
      await this.client.execute(sql);
    } catch (error) {
      this.logger.error(`Error creating table ${tableName}: ${error}`);
      throw error;
    }
  }

  protected getSqlType(type: StorageColumn['type']): string {
    switch (type) {
      case 'bigint':
        return 'INTEGER'; // SQLite uses INTEGER for all integer sizes
      case 'jsonb':
        return 'TEXT'; // Store JSON as TEXT in SQLite
      default:
        return super.getSqlType(type);
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
    const parsedTableName = parseSqlIdentifier(tableName, 'table name');

    try {
      // 1. Get existing columns using PRAGMA
      const pragmaQuery = `PRAGMA table_info(${parsedTableName})`;
      const result = await this.client.execute(pragmaQuery);
      const existingColumnNames = new Set(result.rows.map((row: any) => row.name.toLowerCase()));

      // 2. Add missing columns
      for (const columnName of ifNotExists) {
        if (!existingColumnNames.has(columnName.toLowerCase()) && schema[columnName]) {
          const columnDef = schema[columnName];
          const sqlType = this.getSqlType(columnDef.type); // ensure this exists or implement
          const nullable = columnDef.nullable === false ? 'NOT NULL' : '';
          // In SQLite, you must provide a DEFAULT if adding a NOT NULL column to a non-empty table
          const defaultValue = columnDef.nullable === false ? this.getDefaultValue(columnDef.type) : '';
          const alterSql =
            `ALTER TABLE ${parsedTableName} ADD COLUMN "${columnName}" ${sqlType} ${nullable} ${defaultValue}`.trim();

          await this.client.execute(alterSql);
          this.logger?.debug?.(`Added column ${columnName} to table ${parsedTableName}`);
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
    const parsedTableName = parseSqlIdentifier(tableName, 'table name');
    try {
      await this.client.execute(`DELETE FROM ${parsedTableName}`);
    } catch (e) {
      if (e instanceof Error) {
        this.logger.error(e.message);
      }
    }
  }

  private prepareStatement({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): {
    sql: string;
    args: InValue[];
  } {
    const parsedTableName = parseSqlIdentifier(tableName, 'table name');
    const columns = Object.keys(record).map(col => parseSqlIdentifier(col, 'column name'));
    const values = Object.values(record).map(v => {
      if (typeof v === `undefined`) {
        // returning an undefined value will cause libsql to throw
        return null;
      }
      if (v instanceof Date) {
        return v.toISOString();
      }
      return typeof v === 'object' ? JSON.stringify(v) : v;
    });
    const placeholders = values.map(() => '?').join(', ');

    return {
      sql: `INSERT OR REPLACE INTO ${parsedTableName} (${columns.join(', ')}) VALUES (${placeholders})`,
      args: values,
    };
  }

  private async executeWriteOperationWithRetry<T>(
    operationFn: () => Promise<T>,
    operationDescription: string,
  ): Promise<T> {
    let retries = 0;

    while (true) {
      try {
        return await operationFn();
      } catch (error: any) {
        if (
          error.message &&
          (error.message.includes('SQLITE_BUSY') || error.message.includes('database is locked')) &&
          retries < this.maxRetries
        ) {
          retries++;
          const backoffTime = this.initialBackoffMs * Math.pow(2, retries - 1);
          this.logger.warn(
            `LibSQLStore: Encountered SQLITE_BUSY during ${operationDescription}. Retrying (${retries}/${this.maxRetries}) in ${backoffTime}ms...`,
          );
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        } else {
          this.logger.error(`LibSQLStore: Error during ${operationDescription} after ${retries} retries: ${error}`);
          throw error;
        }
      }
    }
  }

  public insert(args: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    return this.executeWriteOperationWithRetry(() => this.doInsert(args), `insert into table ${args.tableName}`);
  }

  private async doInsert({
    tableName,
    record,
  }: {
    tableName: TABLE_NAMES;
    record: Record<string, any>;
  }): Promise<void> {
    await this.client.execute(
      this.prepareStatement({
        tableName,
        record,
      }),
    );
  }

  public batchInsert(args: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    return this.executeWriteOperationWithRetry(
      () => this.doBatchInsert(args),
      `batch insert into table ${args.tableName}`,
    );
  }

  private async doBatchInsert({
    tableName,
    records,
  }: {
    tableName: TABLE_NAMES;
    records: Record<string, any>[];
  }): Promise<void> {
    if (records.length === 0) return;
    const batchStatements = records.map(r => this.prepareStatement({ tableName, record: r }));
    await this.client.batch(batchStatements, 'write');
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    const parsedTableName = parseSqlIdentifier(tableName, 'table name');

    const parsedKeys = Object.keys(keys).map(key => parseSqlIdentifier(key, 'column name'));

    const conditions = parsedKeys.map(key => `${key} = ?`).join(' AND ');
    const values = Object.values(keys);

    const result = await this.client.execute({
      sql: `SELECT * FROM ${parsedTableName} WHERE ${conditions} ORDER BY createdAt DESC LIMIT 1`,
      args: values,
    });

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    // Checks whether the string looks like a JSON object ({}) or array ([])
    // If the string starts with { or [, it assumes it's JSON and parses it
    // Otherwise, it just returns, preventing unintended number conversions
    const parsed = Object.fromEntries(
      Object.entries(row || {}).map(([k, v]) => {
        try {
          return [k, typeof v === 'string' ? (v.startsWith('{') || v.startsWith('[') ? JSON.parse(v) : v) : v];
        } catch {
          return [k, v];
        }
      }),
    );

    return parsed as R;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    const result = await this.load<StorageThreadType>({
      tableName: TABLE_THREADS,
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

  /**
   * @deprecated use getThreadsByResourceIdPaginated instead for paginated results.
   */
  public async getThreadsByResourceId(args: { resourceId: string }): Promise<StorageThreadType[]> {
    const { resourceId } = args;

    try {
      const baseQuery = `FROM ${TABLE_THREADS} WHERE resourceId = ?`;
      const queryParams: InValue[] = [resourceId];

      const mapRowToStorageThreadType = (row: any): StorageThreadType => ({
        id: row.id as string,
        resourceId: row.resourceId as string,
        title: row.title as string,
        createdAt: new Date(row.createdAt as string), // Convert string to Date
        updatedAt: new Date(row.updatedAt as string), // Convert string to Date
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      });

      // Non-paginated path
      const result = await this.client.execute({
        sql: `SELECT * ${baseQuery} ORDER BY createdAt DESC`,
        args: queryParams,
      });

      if (!result.rows) {
        return [];
      }
      return result.rows.map(mapRowToStorageThreadType);
    } catch (error) {
      this.logger.error(`Error getting threads for resource ${resourceId}:`, error);
      return [];
    }
  }

  public async getThreadsByResourceIdPaginated(
    args: {
      resourceId: string;
    } & PaginationArgs,
  ): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    const { resourceId, page = 0, perPage = 100 } = args;

    try {
      const baseQuery = `FROM ${TABLE_THREADS} WHERE resourceId = ?`;
      const queryParams: InValue[] = [resourceId];

      const mapRowToStorageThreadType = (row: any): StorageThreadType => ({
        id: row.id as string,
        resourceId: row.resourceId as string,
        title: row.title as string,
        createdAt: new Date(row.createdAt as string), // Convert string to Date
        updatedAt: new Date(row.updatedAt as string), // Convert string to Date
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      });

      const currentOffset = page * perPage;

      const countResult = await this.client.execute({
        sql: `SELECT COUNT(*) as count ${baseQuery}`,
        args: queryParams,
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      if (total === 0) {
        return {
          threads: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      const dataResult = await this.client.execute({
        sql: `SELECT * ${baseQuery} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        args: [...queryParams, perPage, currentOffset],
      });

      const threads = (dataResult.rows || []).map(mapRowToStorageThreadType);

      return {
        threads,
        total,
        page,
        perPage,
        hasMore: currentOffset + threads.length < total,
      };
    } catch (error) {
      this.logger.error(`Error getting threads for resource ${resourceId}:`, error);
      return { threads: [], total: 0, page, perPage, hasMore: false };
    }
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    await this.insert({
      tableName: TABLE_THREADS,
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
      sql: `UPDATE ${TABLE_THREADS} SET title = ?, metadata = ? WHERE id = ?`,
      args: [title, JSON.stringify(updatedThread.metadata), id],
    });

    return updatedThread;
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    // Delete messages for this thread (manual step)
    await this.client.execute({
      sql: `DELETE FROM ${TABLE_MESSAGES} WHERE thread_id = ?`,
      args: [threadId],
    });

    await this.client.execute({
      sql: `DELETE FROM ${TABLE_THREADS} WHERE id = ?`,
      args: [threadId],
    });
    // TODO: Need to check if CASCADE is enabled so that messages will be automatically deleted due to CASCADE constraint
  }

  private parseRow(row: any): MastraMessageV2 {
    let content = row.content;
    try {
      content = JSON.parse(row.content);
    } catch {
      // use content as is if it's not JSON
    }
    const result = {
      id: row.id,
      content,
      role: row.role,
      createdAt: new Date(row.createdAt as string),
      threadId: row.thread_id,
      resourceId: row.resourceId,
    } as MastraMessageV2;
    if (row.type && row.type !== `v2`) result.type = row.type;
    return result;
  }

  private async _getIncludedMessages(threadId: string, selectBy: StorageGetMessagesArg['selectBy']) {
    const include = selectBy?.include;
    if (!include) return null;

    const includeIds = include.map(i => i.id);
    const maxPrev = Math.max(...include.map(i => i.withPreviousMessages || 0));
    const maxNext = Math.max(...include.map(i => i.withNextMessages || 0));

    const includeResult = await this.client.execute({
      sql: `
          WITH numbered_messages AS (
            SELECT 
              id, content, role, type, "createdAt", thread_id,
              ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) as row_num
            FROM "${TABLE_MESSAGES}"
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
    return includeResult.rows?.map((row: any) => this.parseRow(row));
  }

  /**
   * @deprecated use getMessagesPaginated instead for paginated results.
   */
  public async getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
  public async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  public async getMessages({
    threadId,
    selectBy,
    format,
  }: StorageGetMessagesArg & {
    format?: 'v1' | 'v2';
  }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    try {
      const messages: MastraMessageV2[] = [];
      const limit = typeof selectBy?.last === `number` ? selectBy.last : 40;

      if (selectBy?.include?.length) {
        const includeMessages = await this._getIncludedMessages(threadId, selectBy);
        if (includeMessages) {
          messages.push(...includeMessages);
        }
      }

      const excludeIds = messages.map(m => m.id);
      const remainingSql = `
          SELECT id, content, role, type, "createdAt", thread_id
          FROM "${TABLE_MESSAGES}"
          WHERE thread_id = ?
          ${excludeIds.length ? `AND id NOT IN (${excludeIds.map(() => '?').join(', ')})` : ''}
          ORDER BY "createdAt" DESC LIMIT ?
        `;
      const remainingArgs = [threadId, ...(excludeIds.length ? excludeIds : []), limit];
      const remainingResult = await this.client.execute({ sql: remainingSql, args: remainingArgs });
      if (remainingResult.rows) {
        messages.push(...remainingResult.rows.map((row: any) => this.parseRow(row)));
      }
      messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const list = new MessageList().add(messages, 'memory');
      if (format === `v2`) return list.get.all.v2();
      return list.get.all.v1();
    } catch (error) {
      this.logger.error('Error getting messages:', error as Error);
      throw error;
    }
  }

  public async getMessagesPaginated(
    args: StorageGetMessagesArg & {
      format?: 'v1' | 'v2';
    },
  ): Promise<PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }> {
    const { threadId, format, selectBy } = args;
    const { page = 0, perPage = 40, dateRange } = selectBy?.pagination || {};
    const fromDate = dateRange?.start;
    const toDate = dateRange?.end;

    const messages: MastraMessageV2[] = [];

    if (selectBy?.include?.length) {
      const includeMessages = await this._getIncludedMessages(threadId, selectBy);
      if (includeMessages) {
        messages.push(...includeMessages);
      }
    }

    try {
      const currentOffset = page * perPage;

      const conditions: string[] = [`thread_id = ?`];
      const queryParams: InValue[] = [threadId];

      if (fromDate) {
        conditions.push(`"createdAt" >= ?`);
        queryParams.push(fromDate.toISOString());
      }
      if (toDate) {
        conditions.push(`"createdAt" <= ?`);
        queryParams.push(toDate.toISOString());
      }
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await this.client.execute({
        sql: `SELECT COUNT(*) as count FROM ${TABLE_MESSAGES} ${whereClause}`,
        args: queryParams,
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      if (total === 0) {
        return {
          messages: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      const dataResult = await this.client.execute({
        sql: `SELECT id, content, role, type, "createdAt", thread_id FROM ${TABLE_MESSAGES} ${whereClause} ORDER BY "createdAt" DESC LIMIT ? OFFSET ?`,
        args: [...queryParams, perPage, currentOffset],
      });

      messages.push(...(dataResult.rows || []).map((row: any) => this.parseRow(row)));

      const messagesToReturn =
        format === 'v1'
          ? new MessageList().add(messages, 'memory').get.all.v1()
          : new MessageList().add(messages, 'memory').get.all.v2();

      return {
        messages: messagesToReturn,
        total,
        page,
        perPage,
        hasMore: currentOffset + messages.length < total,
      };
    } catch (error) {
      this.logger.error('Error getting paginated messages:', error as Error);
      return { messages: [], total: 0, page, perPage, hasMore: false };
    }
  }

  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  async saveMessages({
    messages,
    format,
  }:
    | { messages: MastraMessageV1[]; format?: undefined | 'v1' }
    | { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[] | MastraMessageV1[]> {
    if (messages.length === 0) return messages;

    try {
      const threadId = messages[0]?.threadId;
      if (!threadId) {
        throw new Error('Thread ID is required');
      }

      // Prepare batch statements for all messages
      const batchStatements = messages.map(message => {
        const time = message.createdAt || new Date();
        return {
          sql: `INSERT INTO ${TABLE_MESSAGES} (id, thread_id, content, role, type, createdAt) 
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [
            message.id,
            threadId,
            typeof message.content === 'object' ? JSON.stringify(message.content) : message.content,
            message.role,
            message.type || 'v2',
            time instanceof Date ? time.toISOString() : time,
          ],
        };
      });

      const now = new Date().toISOString();
      batchStatements.push({
        sql: `UPDATE ${TABLE_THREADS} SET updatedAt = ? WHERE id = ?`,
        args: [now, threadId],
      });

      // Execute all inserts in a single batch
      await this.client.batch(batchStatements, 'write');

      const list = new MessageList().add(messages, 'memory');
      if (format === `v2`) return list.get.all.v2();
      return list.get.all.v1();
    } catch (error) {
      this.logger.error('Failed to save messages in database: ' + (error as { message: string })?.message);
      throw error;
    }
  }

  private transformEvalRow(row: Record<string, any>): EvalRow {
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

  /** @deprecated use getEvals instead */
  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    try {
      const baseQuery = `SELECT * FROM ${TABLE_EVALS} WHERE agent_name = ?`;
      const typeCondition =
        type === 'test'
          ? " AND test_info IS NOT NULL AND test_info->>'testPath' IS NOT NULL"
          : type === 'live'
            ? " AND (test_info IS NULL OR test_info->>'testPath' IS NULL)"
            : '';

      const result = await this.client.execute({
        sql: `${baseQuery}${typeCondition} ORDER BY created_at DESC`,
        args: [agentName],
      });

      return result.rows?.map(row => this.transformEvalRow(row)) ?? [];
    } catch (error) {
      // Handle case where table doesn't exist yet
      if (error instanceof Error && error.message.includes('no such table')) {
        return [];
      }
      this.logger.error('Failed to get evals for the specified agent: ' + (error as any)?.message);
      throw error;
    }
  }

  async getEvals(
    options: {
      agentName?: string;
      type?: 'test' | 'live';
    } & PaginationArgs = {},
  ): Promise<PaginationInfo & { evals: EvalRow[] }> {
    const { agentName, type, page = 0, perPage = 100, dateRange } = options;
    const fromDate = dateRange?.start;
    const toDate = dateRange?.end;

    const conditions: string[] = [];
    const queryParams: InValue[] = [];

    if (agentName) {
      conditions.push(`agent_name = ?`);
      queryParams.push(agentName);
    }

    if (type === 'test') {
      conditions.push(`(test_info IS NOT NULL AND json_extract(test_info, '$.testPath') IS NOT NULL)`);
    } else if (type === 'live') {
      conditions.push(`(test_info IS NULL OR json_extract(test_info, '$.testPath') IS NULL)`);
    }

    if (fromDate) {
      conditions.push(`created_at >= ?`);
      queryParams.push(fromDate.toISOString());
    }

    if (toDate) {
      conditions.push(`created_at <= ?`);
      queryParams.push(toDate.toISOString());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.client.execute({
      sql: `SELECT COUNT(*) as count FROM ${TABLE_EVALS} ${whereClause}`,
      args: queryParams,
    });
    const total = Number(countResult.rows?.[0]?.count ?? 0);

    const currentOffset = page * perPage;
    const hasMore = currentOffset + perPage < total;

    if (total === 0) {
      return {
        evals: [],
        total: 0,
        page,
        perPage,
        hasMore: false,
      };
    }

    const dataResult = await this.client.execute({
      sql: `SELECT * FROM ${TABLE_EVALS} ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      args: [...queryParams, perPage, currentOffset],
    });

    return {
      evals: dataResult.rows?.map(row => this.transformEvalRow(row)) ?? [],
      total,
      page,
      perPage,
      hasMore,
    };
  }

  /**
   * @deprecated use getTracesPaginated instead.
   */
  public async getTraces(args: {
    name?: string;
    scope?: string;
    page: number;
    perPage: number;
    attributes?: Record<string, string>;
    filters?: Record<string, any>;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<Trace[]> {
    if (args.fromDate || args.toDate) {
      (args as any).dateRange = {
        start: args.fromDate,
        end: args.toDate,
      };
    }
    const result = await this.getTracesPaginated(args);
    return result.traces;
  }

  public async getTracesPaginated(
    args: {
      name?: string;
      scope?: string;
      attributes?: Record<string, string>;
      filters?: Record<string, any>;
    } & PaginationArgs,
  ): Promise<PaginationInfo & { traces: Trace[] }> {
    const { name, scope, page = 0, perPage = 100, attributes, filters, dateRange } = args;
    const fromDate = dateRange?.start;
    const toDate = dateRange?.end;
    const currentOffset = page * perPage;

    const queryArgs: InValue[] = [];
    const conditions: string[] = [];

    if (name) {
      conditions.push('name LIKE ?');
      queryArgs.push(`${name}%`);
    }
    if (scope) {
      conditions.push('scope = ?');
      queryArgs.push(scope);
    }
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        conditions.push(`json_extract(attributes, '$.${key}') = ?`);
        queryArgs.push(value);
      });
    }
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        conditions.push(`${parseSqlIdentifier(key, 'filter key')} = ?`);
        queryArgs.push(value);
      });
    }
    if (fromDate) {
      conditions.push('createdAt >= ?');
      queryArgs.push(fromDate.toISOString());
    }
    if (toDate) {
      conditions.push('createdAt <= ?');
      queryArgs.push(toDate.toISOString());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.client.execute({
      sql: `SELECT COUNT(*) as count FROM ${TABLE_TRACES} ${whereClause}`,
      args: queryArgs,
    });
    const total = Number(countResult.rows?.[0]?.count ?? 0);

    if (total === 0) {
      return {
        traces: [],
        total: 0,
        page,
        perPage,
        hasMore: false,
      };
    }

    const dataResult = await this.client.execute({
      sql: `SELECT * FROM ${TABLE_TRACES} ${whereClause} ORDER BY "startTime" DESC LIMIT ? OFFSET ?`,
      args: [...queryArgs, perPage, currentOffset],
    });

    const traces =
      dataResult.rows?.map(
        row =>
          ({
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
          }) as Trace,
      ) ?? [];

    return {
      traces,
      total,
      page,
      perPage,
      hasMore: currentOffset + traces.length < total,
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
      const args: InValue[] = [];

      if (workflowName) {
        conditions.push('workflow_name = ?');
        args.push(workflowName);
      }

      if (fromDate) {
        conditions.push('createdAt >= ?');
        args.push(fromDate.toISOString());
      }

      if (toDate) {
        conditions.push('createdAt <= ?');
        args.push(toDate.toISOString());
      }

      if (resourceId) {
        const hasResourceId = await this.hasColumn(TABLE_WORKFLOW_SNAPSHOT, 'resourceId');
        if (hasResourceId) {
          conditions.push('resourceId = ?');
          args.push(resourceId);
        } else {
          console.warn(`[${TABLE_WORKFLOW_SNAPSHOT}] resourceId column not found. Skipping resourceId filter.`);
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      let total = 0;
      // Only get total count when using pagination
      if (limit !== undefined && offset !== undefined) {
        const countResult = await this.client.execute({
          sql: `SELECT COUNT(*) as count FROM ${TABLE_WORKFLOW_SNAPSHOT} ${whereClause}`,
          args,
        });
        total = Number(countResult.rows?.[0]?.count ?? 0);
      }

      // Get results
      const result = await this.client.execute({
        sql: `SELECT * FROM ${TABLE_WORKFLOW_SNAPSHOT} ${whereClause} ORDER BY createdAt DESC${limit !== undefined && offset !== undefined ? ` LIMIT ? OFFSET ?` : ''}`,
        args: limit !== undefined && offset !== undefined ? [...args, limit, offset] : args,
      });

      const runs = (result.rows || []).map(row => this.parseWorkflowRun(row));

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
    const conditions: string[] = [];
    const args: (string | number)[] = [];

    if (runId) {
      conditions.push('run_id = ?');
      args.push(runId);
    }

    if (workflowName) {
      conditions.push('workflow_name = ?');
      args.push(workflowName);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.client.execute({
      sql: `SELECT * FROM ${TABLE_WORKFLOW_SNAPSHOT} ${whereClause}`,
      args,
    });

    if (!result.rows?.[0]) {
      return null;
    }

    return this.parseWorkflowRun(result.rows[0]);
  }

  private async hasColumn(table: string, column: string): Promise<boolean> {
    const result = await this.client.execute({
      sql: `PRAGMA table_info(${table})`,
    });
    return (await result.rows)?.some((row: any) => row.name === column);
  }

  private parseWorkflowRun(row: Record<string, any>): WorkflowRun {
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
      workflowName: row.workflow_name as string,
      runId: row.run_id as string,
      snapshot: parsedSnapshot,
      resourceId: row.resourceId as string,
      createdAt: new Date(row.createdAt as string),
      updatedAt: new Date(row.updatedAt as string),
    };
  }
}

export { LibSQLStore as DefaultStorage };
