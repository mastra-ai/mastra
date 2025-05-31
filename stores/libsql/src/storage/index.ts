import { createClient } from '@libsql/client';
import type { Client, InValue } from '@libsql/client';
import { MessageList } from '@mastra/core/agent';
import type { MastraMessageV2 } from '@mastra/core/agent';
import type { MetricResult, TestInfo } from '@mastra/core/eval';
import type { MastraMessageV1, StorageThreadType } from '@mastra/core/memory';
import {
  MastraStorage,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_TRACES,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_EVALS,
} from '@mastra/core/storage';
import type {
  EvalRow,
  StorageColumn,
  StorageGetMessagesArg,
  TABLE_NAMES,
  WorkflowRun,
  WorkflowRuns,
} from '@mastra/core/storage';
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

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    const result = await this.client.execute({
      sql: `SELECT * FROM ${TABLE_THREADS} WHERE resourceId = ?`,
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
    await this.client.execute({
      sql: `DELETE FROM ${TABLE_THREADS} WHERE id = ?`,
      args: [threadId],
    });
    // Messages will be automatically deleted due to CASCADE constraint
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
    } as MastraMessageV2;
    if (row.type && row.type !== `v2`) result.type = row.type;
    return result;
  }

  public async getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
  public async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  public async getMessages({
    threadId,
    selectBy,
    format,
  }: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    try {
      const messages: MastraMessageV2[] = [];
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
        FROM "${TABLE_MESSAGES}"
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

      const list = new MessageList().add(messages, 'memory');
      if (format === `v2`) return list.get.all.v2();
      return list.get.all.v1();
    } catch (error) {
      this.logger.error('Error getting messages:', error as Error);
      throw error;
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

  // TODO: add types
  async getTraces(
    {
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
    } = {
      page: 0,
      perPage: 100,
    },
  ): Promise<any[]> {
    const limit = perPage;
    const offset = page * perPage;

    const args: (string | number)[] = [];

    const conditions: string[] = [];
    if (name) {
      conditions.push("name LIKE CONCAT(?, '%')");
    }
    if (scope) {
      conditions.push('scope = ?');
    }
    if (attributes) {
      Object.keys(attributes).forEach(key => {
        conditions.push(`attributes->>'$.${key}' = ?`);
      });
    }

    if (filters) {
      Object.entries(filters).forEach(([key, _value]) => {
        conditions.push(`${key} = ?`);
      });
    }

    if (fromDate) {
      conditions.push('createdAt >= ?');
    }

    if (toDate) {
      conditions.push('createdAt <= ?');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    if (name) {
      args.push(name);
    }

    if (scope) {
      args.push(scope);
    }

    if (attributes) {
      for (const [, value] of Object.entries(attributes)) {
        args.push(value);
      }
    }

    if (filters) {
      for (const [, value] of Object.entries(filters)) {
        args.push(value);
      }
    }

    if (fromDate) {
      args.push(fromDate.toISOString());
    }

    if (toDate) {
      args.push(toDate.toISOString());
    }

    args.push(limit, offset);

    const result = await this.client.execute({
      sql: `SELECT * FROM ${TABLE_TRACES} ${whereClause} ORDER BY "startTime" DESC LIMIT ? OFFSET ?`,
      args,
    });

    if (!result.rows) {
      return [];
    }

    return result.rows.map(row => ({
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
    })) as any;
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
