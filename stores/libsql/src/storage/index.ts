import { createClient } from '@libsql/client';
import type { Client, InValue } from '@libsql/client';
import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2, MastraMessageV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MetricResult, TestInfo, ScoreRowData } from '@mastra/core/eval';
import type { MastraMessageV1, StorageThreadType } from '@mastra/core/memory';
import {
  MastraStorage,
  TABLE_EVALS,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_RESOURCES,

} from '@mastra/core/storage';
import type {
  EvalRow,
  PaginationArgs,
  PaginationInfo,
  StorageColumn,
  StorageGetMessagesArg,
  StorageResourceType,
  TABLE_NAMES,
  WorkflowRun,
  WorkflowRuns,
  StoragePagination,
  StorageGetTracesArg,
} from '@mastra/core/storage';

import type { Trace } from '@mastra/core/telemetry';
import { parseSqlIdentifier } from '@mastra/core/utils';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { StoreOperationsLibSQL } from './domains/operations';
import { ScoresLibSQL } from './domains/scores';
import { TracesLibSQL } from './domains/traces';
import { WorkflowsLibSQL } from './domains/workflows';

export type LibSQLConfig =
  | {
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
  | {
    client: Client;
    maxRetries?: number;
    initialBackoffMs?: number;
  };

type StorageDomains = {
  operations: StoreOperationsLibSQL;
  scores: ScoresLibSQL;
  traces: TracesLibSQL;
  workflows: WorkflowsLibSQL;
};

export class LibSQLStore extends MastraStorage {
  private client: Client;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;

  stores: StorageDomains;

  constructor(config: LibSQLConfig) {
    super({ name: `LibSQLStore` });

    this.maxRetries = config.maxRetries ?? 5;
    this.initialBackoffMs = config.initialBackoffMs ?? 100;

    if ('url' in config) {
      // need to re-init every time for in memory dbs or the tables might not exist
      if (config.url.endsWith(':memory:')) {
        this.shouldCacheInit = false;
      }

      this.client = createClient({ url: config.url });

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
    } else {
      this.client = config.client;
    }

    const operations = new StoreOperationsLibSQL({
      client: this.client,
      maxRetries: this.maxRetries,
      initialBackoffMs: this.initialBackoffMs,
    });

    const scores = new ScoresLibSQL({ client: this.client, operations });
    const traces = new TracesLibSQL({ client: this.client, operations });
    const workflows = new WorkflowsLibSQL({ client: this.client, operations });

    this.stores = {
      operations,
      scores,
      traces,
      workflows,
    };
  }

  public get supports(): {
    selectByIncludeResourceScope: boolean;
    resourceWorkingMemory: boolean;
  } {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
    };
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    await this.stores.operations.createTable({ tableName, schema });
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
    await this.stores.operations.alterTable({ tableName, schema, ifNotExists });
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    await this.stores.operations.clearTable({ tableName });
  }

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    await this.stores.operations.dropTable({ tableName });
  }

  public insert(args: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    return this.stores.operations.insert(args);
  }

  public batchInsert(args: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    return this.stores.operations.batchInsert(args);
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    return this.stores.operations.load({ tableName, keys });
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    try {
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
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_GET_THREAD_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
    }
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
      const mastraError = new MastraError(
        {
          id: 'LIBSQL_STORE_GET_THREADS_BY_RESOURCE_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
        },
        error,
      );
      this.logger?.trackException?.(mastraError);
      this.logger?.error?.(mastraError.toString());
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
      const mastraError = new MastraError(
        {
          id: 'LIBSQL_STORE_GET_THREADS_BY_RESOURCE_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
        },
        error,
      );
      this.logger?.trackException?.(mastraError);
      this.logger?.error?.(mastraError.toString());
      return { threads: [], total: 0, page, perPage, hasMore: false };
    }
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    try {
      await this.insert({
        tableName: TABLE_THREADS,
        record: {
          ...thread,
          metadata: JSON.stringify(thread.metadata),
        },
      });

      return thread;
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'LIBSQL_STORE_SAVE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: thread.id },
        },
        error,
      );
      this.logger?.trackException?.(mastraError);
      this.logger?.error?.(mastraError.toString());
      throw mastraError;
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
    const thread = await this.getThreadById({ threadId: id });
    if (!thread) {
      throw new MastraError({
        id: 'LIBSQL_STORE_UPDATE_THREAD_FAILED_THREAD_NOT_FOUND',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Thread ${id} not found`,
        details: {
          status: 404,
          threadId: id,
        },
      });
    }

    const updatedThread = {
      ...thread,
      title,
      metadata: {
        ...thread.metadata,
        ...metadata,
      },
    };

    try {
      await this.client.execute({
        sql: `UPDATE ${TABLE_THREADS} SET title = ?, metadata = ? WHERE id = ?`,
        args: [title, JSON.stringify(updatedThread.metadata), id],
      });

      return updatedThread;
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_UPDATE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to update thread ${id}`,
          details: { threadId: id },
        },
        error,
      );
    }
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    // Delete messages for this thread (manual step)
    try {
      await this.client.execute({
        sql: `DELETE FROM ${TABLE_MESSAGES} WHERE thread_id = ?`,
        args: [threadId],
      });
      await this.client.execute({
        sql: `DELETE FROM ${TABLE_THREADS} WHERE id = ?`,
        args: [threadId],
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_DELETE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
    }
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

  private async _getIncludedMessages({
    threadId,
    selectBy,
  }: {
    threadId: string;
    selectBy: StorageGetMessagesArg['selectBy'];
  }) {
    const include = selectBy?.include;
    if (!include) return null;

    const unionQueries: string[] = [];
    const params: any[] = [];

    for (const inc of include) {
      const { id, withPreviousMessages = 0, withNextMessages = 0 } = inc;
      // if threadId is provided, use it, otherwise use threadId from args
      const searchId = inc.threadId || threadId;
      unionQueries.push(
        `
            SELECT * FROM (
              WITH numbered_messages AS (
                SELECT
                  id, content, role, type, "createdAt", thread_id, "resourceId",
                  ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) as row_num
                FROM "${TABLE_MESSAGES}"
                WHERE thread_id = ?
              ),
              target_positions AS (
                SELECT row_num as target_pos
                FROM numbered_messages
                WHERE id = ?
              )
              SELECT DISTINCT m.*
              FROM numbered_messages m
              CROSS JOIN target_positions t
              WHERE m.row_num BETWEEN (t.target_pos - ?) AND (t.target_pos + ?)
            ) 
            `, // Keep ASC for final sorting after fetching context
      );
      params.push(searchId, id, withPreviousMessages, withNextMessages);
    }
    const finalQuery = unionQueries.join(' UNION ALL ') + ' ORDER BY "createdAt" ASC';
    const includedResult = await this.client.execute({ sql: finalQuery, args: params });
    const includedRows = includedResult.rows?.map(row => this.parseRow(row));
    const seen = new Set<string>();
    const dedupedRows = includedRows.filter(row => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
    return dedupedRows;
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
      const limit = this.resolveMessageLimit({ last: selectBy?.last, defaultLimit: 40 });
      if (selectBy?.include?.length) {
        const includeMessages = await this._getIncludedMessages({ threadId, selectBy });
        if (includeMessages) {
          messages.push(...includeMessages);
        }
      }

      const excludeIds = messages.map(m => m.id);
      const remainingSql = `
        SELECT 
          id, 
          content, 
          role, 
          type,
          "createdAt", 
          thread_id,
          "resourceId"
        FROM "${TABLE_MESSAGES}"
        WHERE thread_id = ?
        ${excludeIds.length ? `AND id NOT IN (${excludeIds.map(() => '?').join(', ')})` : ''}
        ORDER BY "createdAt" DESC
        LIMIT ?
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
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_GET_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
    }
  }

  public async getMessagesPaginated(
    args: StorageGetMessagesArg & {
      format?: 'v1' | 'v2';
    },
  ): Promise<PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }> {
    const { threadId, format, selectBy } = args;
    const { page = 0, perPage: perPageInput, dateRange } = selectBy?.pagination || {};
    const perPage =
      perPageInput !== undefined ? perPageInput : this.resolveMessageLimit({ last: selectBy?.last, defaultLimit: 40 });
    const fromDate = dateRange?.start;
    const toDate = dateRange?.end;

    const messages: MastraMessageV2[] = [];

    if (selectBy?.include?.length) {
      try {
        const includeMessages = await this._getIncludedMessages({ threadId, selectBy });
        if (includeMessages) {
          messages.push(...includeMessages);
        }
      } catch (error) {
        throw new MastraError(
          {
            id: 'LIBSQL_STORE_GET_MESSAGES_PAGINATED_GET_INCLUDE_MESSAGES_FAILED',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.THIRD_PARTY,
            details: { threadId },
          },
          error,
        );
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

      if (total === 0 && messages.length === 0) {
        return {
          messages: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      const excludeIds = messages.map(m => m.id);
      const excludeIdsParam = excludeIds.map((_, idx) => `$${idx + queryParams.length + 1}`).join(', ');

      const dataResult = await this.client.execute({
        sql: `SELECT id, content, role, type, "createdAt", "resourceId", "thread_id" FROM ${TABLE_MESSAGES} ${whereClause} ${excludeIds.length ? `AND id NOT IN (${excludeIdsParam})` : ''} ORDER BY "createdAt" DESC LIMIT ? OFFSET ?`,
        args: [...queryParams, ...excludeIds, perPage, currentOffset],
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
      const mastraError = new MastraError(
        {
          id: 'LIBSQL_STORE_GET_MESSAGES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
      this.logger?.trackException?.(mastraError);
      this.logger?.error?.(mastraError.toString());
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
        if (!message.threadId) {
          throw new Error(
            `Expected to find a threadId for message, but couldn't find one. An unexpected error has occurred.`,
          );
        }
        if (!message.resourceId) {
          throw new Error(
            `Expected to find a resourceId for message, but couldn't find one. An unexpected error has occurred.`,
          );
        }
        return {
          sql: `INSERT INTO ${TABLE_MESSAGES} (id, thread_id, content, role, type, createdAt, resourceId) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  thread_id=excluded.thread_id,
                  content=excluded.content,
                  role=excluded.role,
                  type=excluded.type,
                  resourceId=excluded.resourceId
              `,
          args: [
            message.id,
            message.threadId!,
            typeof message.content === 'object' ? JSON.stringify(message.content) : message.content,
            message.role,
            message.type || 'v2',
            time instanceof Date ? time.toISOString() : time,
            message.resourceId,
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
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_SAVE_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async updateMessages({
    messages,
  }: {
    messages: (Partial<Omit<MastraMessageV2, 'createdAt'>> & {
      id: string;
      content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
    })[];
  }): Promise<MastraMessageV2[]> {
    if (messages.length === 0) {
      return [];
    }

    const messageIds = messages.map(m => m.id);
    const placeholders = messageIds.map(() => '?').join(',');

    const selectSql = `SELECT * FROM ${TABLE_MESSAGES} WHERE id IN (${placeholders})`;
    const existingResult = await this.client.execute({ sql: selectSql, args: messageIds });
    const existingMessages: MastraMessageV2[] = existingResult.rows.map(row => this.parseRow(row));

    if (existingMessages.length === 0) {
      return [];
    }

    const batchStatements = [];
    const threadIdsToUpdate = new Set<string>();
    const columnMapping: Record<string, string> = {
      threadId: 'thread_id',
    };

    for (const existingMessage of existingMessages) {
      const updatePayload = messages.find(m => m.id === existingMessage.id);
      if (!updatePayload) continue;

      const { id, ...fieldsToUpdate } = updatePayload;
      if (Object.keys(fieldsToUpdate).length === 0) continue;

      threadIdsToUpdate.add(existingMessage.threadId!);
      if (updatePayload.threadId && updatePayload.threadId !== existingMessage.threadId) {
        threadIdsToUpdate.add(updatePayload.threadId);
      }

      const setClauses = [];
      const args: InValue[] = [];
      const updatableFields = { ...fieldsToUpdate };

      // Special handling for the 'content' field to merge instead of overwrite
      if (updatableFields.content) {
        const newContent = {
          ...existingMessage.content,
          ...updatableFields.content,
          // Deep merge metadata if it exists on both
          ...(existingMessage.content?.metadata && updatableFields.content.metadata
            ? {
              metadata: {
                ...existingMessage.content.metadata,
                ...updatableFields.content.metadata,
              },
            }
            : {}),
        };
        setClauses.push(`${parseSqlIdentifier('content', 'column name')} = ?`);
        args.push(JSON.stringify(newContent));
        delete updatableFields.content;
      }

      for (const key in updatableFields) {
        if (Object.prototype.hasOwnProperty.call(updatableFields, key)) {
          const dbKey = columnMapping[key] || key;
          setClauses.push(`${parseSqlIdentifier(dbKey, 'column name')} = ?`);
          let value = updatableFields[key as keyof typeof updatableFields];

          if (typeof value === 'object' && value !== null) {
            value = JSON.stringify(value);
          }
          args.push(value as InValue);
        }
      }

      if (setClauses.length === 0) continue;

      args.push(id);

      const sql = `UPDATE ${TABLE_MESSAGES} SET ${setClauses.join(', ')} WHERE id = ?`;
      batchStatements.push({ sql, args });
    }

    if (batchStatements.length === 0) {
      return existingMessages;
    }

    const now = new Date().toISOString();
    for (const threadId of threadIdsToUpdate) {
      if (threadId) {
        batchStatements.push({
          sql: `UPDATE ${TABLE_THREADS} SET updatedAt = ? WHERE id = ?`,
          args: [now, threadId],
        });
      }
    }

    await this.client.batch(batchStatements, 'write');

    const updatedResult = await this.client.execute({ sql: selectSql, args: messageIds });
    return updatedResult.rows.map(row => this.parseRow(row));
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
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_GET_EVALS_BY_AGENT_NAME_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentName },
        },
        error,
      );
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

    try {
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
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_GET_EVALS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    return this.stores.scores.getScoreById({ id });
  }

  async saveScore(score: Omit<ScoreRowData, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ score: ScoreRowData }> {
    return this.stores.scores.saveScore(score);
  }

  async getScoresByScorerId({
    scorerId,
    entityId,
    entityType,
    pagination,
  }: {
    scorerId: string;
    entityId?: string;
    entityType?: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.stores.scores.getScoresByScorerId({ scorerId, entityId, entityType, pagination });
  }

  async getScoresByRunId({
    runId,
    pagination,
  }: {
    runId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.stores.scores.getScoresByRunId({ runId, pagination });
  }

  async getScoresByEntityId({
    entityId,
    entityType,
    pagination,
  }: {
    pagination: StoragePagination;
    entityId: string;
    entityType: string;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.stores.scores.getScoresByEntityId({ entityId, entityType, pagination });
  }

  /**
   * TRACES
   */

  /**
   * @deprecated use getTracesPaginated instead.
   */
  async getTraces(args: StorageGetTracesArg): Promise<Trace[]> {
    return this.stores.traces.getTraces(args);
  }

  async getTracesPaginated(args: StorageGetTracesArg): Promise<PaginationInfo & { traces: Trace[]; }> {
    return this.stores.traces.getTracesPaginated(args);
  }

  async batchTraceInsert(args: { records: Record<string, any>[] }): Promise<void> {
    return this.stores.traces.batchTraceInsert(args);
  }

  /**
   * WORKFLOWS
   */

  async persistWorkflowSnapshot({
    workflowName,
    runId,
    snapshot,
  }: {
    workflowName: string;
    runId: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    return this.stores.workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot });
  }

  async loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    return this.stores.workflows.loadWorkflowSnapshot({ workflowName, runId });
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
    return this.stores.workflows.getWorkflowRuns({ workflowName, fromDate, toDate, limit, offset, resourceId });
  }

  async getWorkflowRunById({
    runId,
    workflowName,
  }: {
    runId: string;
    workflowName?: string;
  }): Promise<WorkflowRun | null> {
    return this.stores.workflows.getWorkflowRunById({ runId, workflowName });
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    const result = await this.load<StorageResourceType>({
      tableName: TABLE_RESOURCES,
      keys: { id: resourceId },
    });

    if (!result) {
      return null;
    }

    return {
      ...result,
      // Ensure workingMemory is always returned as a string, even if auto-parsed as JSON
      workingMemory:
        typeof result.workingMemory === 'object' ? JSON.stringify(result.workingMemory) : result.workingMemory,
      metadata: typeof result.metadata === 'string' ? JSON.parse(result.metadata) : result.metadata,
    };
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    await this.insert({
      tableName: TABLE_RESOURCES,
      record: {
        ...resource,
        metadata: JSON.stringify(resource.metadata),
      },
    });

    return resource;
  }

  async updateResource({
    resourceId,
    workingMemory,
    metadata,
  }: {
    resourceId: string;
    workingMemory?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageResourceType> {
    const existingResource = await this.getResourceById({ resourceId });

    if (!existingResource) {
      // Create new resource if it doesn't exist
      const newResource: StorageResourceType = {
        id: resourceId,
        workingMemory,
        metadata: metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return this.saveResource({ resource: newResource });
    }

    const updatedResource = {
      ...existingResource,
      workingMemory: workingMemory !== undefined ? workingMemory : existingResource.workingMemory,
      metadata: {
        ...existingResource.metadata,
        ...metadata,
      },
      updatedAt: new Date(),
    };

    const updates: string[] = [];
    const values: InValue[] = [];

    if (workingMemory !== undefined) {
      updates.push('workingMemory = ?');
      values.push(workingMemory);
    }

    if (metadata) {
      updates.push('metadata = ?');
      values.push(JSON.stringify(updatedResource.metadata));
    }

    updates.push('updatedAt = ?');
    values.push(updatedResource.updatedAt.toISOString());

    values.push(resourceId);

    await this.client.execute({
      sql: `UPDATE ${TABLE_RESOURCES} SET ${updates.join(', ')} WHERE id = ?`,
      args: values,
    });

    return updatedResource;
  }
}

export { LibSQLStore as DefaultStorage };
