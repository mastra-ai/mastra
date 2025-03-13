import type { StorageThreadType, MessageType } from '@mastra/core/memory';
import {
  MastraStorage,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_EVALS,
  TABLE_TRACES,
} from '@mastra/core/storage';
import type { TABLE_NAMES, StorageColumn, StorageGetMessagesArg, EvalRow } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import Cloudflare from 'cloudflare';
import type { D1Database } from '@cloudflare/workers-types';
import { createSqlBuilder } from './sql-builder';
import type { SqlParam } from './sql-builder';

/**
 * Interface for SQL query options with generic type support
 */
export interface SqlQueryOptions {
  /** SQL query to execute */
  sql: string;
  /** Parameters to bind to the query */
  params?: SqlParam[];
  /** Whether to return only the first result */
  first?: boolean;
  /** Optional type transformation function to apply to the results */
  transform?: (row: Record<string, any>) => Record<string, any>;
}

/**
 * Interface for transaction operations with generic type support
 */
export interface Transaction {
  /** Execute a query within the transaction and return multiple results */
  executeQuery(options: SqlQueryOptions): Promise<Record<string, any>[]>;
  /** Execute a query within the transaction and return a single result */
  executeQuerySingle(options: SqlQueryOptions): Promise<Record<string, any> | null>;
  /** Commit the transaction */
  commit(): Promise<void>;
  /** Rollback the transaction */
  rollback(): Promise<void>;
}

/**
 * Configuration for D1 using the REST API
 */
export interface D1Config {
  /** Cloudflare account ID */
  accountId: string;
  /** Cloudflare API token with D1 access */
  apiToken: string;
  /** D1 database ID */
  databaseId: string;
  /** Optional prefix for table names */
  tablePrefix?: string;
}

/**
 * Configuration for D1 using the Workers Binding API
 */
export interface D1WorkersConfig {
  /** D1 database binding from Workers environment */
  binding: D1Database; // D1Database binding from Workers
  /** Optional prefix for table names */
  tablePrefix?: string;
}

/**
 * Combined configuration type supporting both REST API and Workers Binding API
 */
export type D1StoreConfig = D1Config | D1WorkersConfig;

function isArrayOfRecords(value: any): value is Record<string, any>[] {
  return value && Array.isArray(value) && value.length > 0;
}

export class D1Store extends MastraStorage {
  private client?: Cloudflare;
  private accountId?: string;
  private databaseId?: string;
  private binding?: D1Database; // D1Database binding
  private tablePrefix: string;

  /**
   * Creates a new D1Store instance
   * @param config Configuration for D1 access (either REST API or Workers Binding API)
   */
  constructor(config: D1StoreConfig) {
    super({ name: 'D1' });

    this.tablePrefix = config.tablePrefix || '';

    // Determine which API to use based on provided config
    if ('binding' in config) {
      if (!config.binding) {
        throw new Error('D1 binding is required when using Workers Binding API');
      }
      this.binding = config.binding;
      this.logger.info('Using D1 Workers Binding API');
    } else {
      if (!config.accountId || !config.databaseId || !config.apiToken) {
        throw new Error('accountId, databaseId, and apiToken are required when using REST API');
      }
      this.accountId = config.accountId;
      this.databaseId = config.databaseId;
      this.client = new Cloudflare({
        apiToken: config.apiToken,
      });
      this.logger.info('Using D1 REST API');
    }
  }

  // Helper method to get the full table name with prefix
  private getTableName(tableName: TABLE_NAMES): string {
    return `${this.tablePrefix}${tableName}`;
  }

  private formatSqlParams(params: SqlParam[]): string[] {
    return params.map(p => (p === undefined || p === null ? null : p) as string);
  }

  // Helper method to create SQL indexes for better query performance
  private async createIndexIfNotExists(
    tableName: TABLE_NAMES,
    columnName: string,
    indexType: string = '',
  ): Promise<void> {
    const fullTableName = this.getTableName(tableName);
    const indexName = `idx_${tableName}_${columnName}`;

    try {
      // Check if index exists
      const checkQuery = createSqlBuilder().checkIndexExists(indexName, fullTableName);
      const { sql: checkSql, params: checkParams } = checkQuery.build();

      const indexExists = await this.executeQuery({
        sql: checkSql,
        params: checkParams,
        first: true,
      });

      if (!indexExists) {
        // Create the index if it doesn't exist
        const createQuery = createSqlBuilder().createIndex(indexName, fullTableName, columnName, indexType);
        const { sql: createSql, params: createParams } = createQuery.build();

        await this.executeQuery({ sql: createSql, params: createParams });
        this.logger.debug(`Created index ${indexName} on ${fullTableName}(${columnName})`);
      }
    } catch (error) {
      this.logger.error(`Error creating index on ${fullTableName}(${columnName}):`, { error });
      // Non-fatal error, continue execution
    }
  }

  private async executeWorkersBindingQuery({
    sql,
    params = [],
    first = false,
    transform,
  }: SqlQueryOptions): Promise<Record<string, any>[] | Record<string, any> | null> {
    // Ensure binding is defined
    if (!this.binding) {
      throw new Error('Workers binding is not configured');
    }

    try {
      const statement = this.binding.prepare(sql);
      const formattedParams = this.formatSqlParams(params);

      // Bind parameters if any
      let result;
      if (formattedParams.length > 0) {
        if (first) {
          result = await statement.bind(...formattedParams).first();
          if (!result) return null;

          // Apply transformation if provided
          if (transform && typeof transform === 'function') {
            return transform(result);
          }

          return result;
        } else {
          result = await statement.bind(...formattedParams).all();
          const results = result.results || [];

          // Include metadata for debugging if available
          if (result.meta) {
            this.logger.debug('Query metadata', { meta: result.meta });
          }

          // Apply transformation if provided
          if (transform && typeof transform === 'function') {
            return results.map(row => transform(row));
          }

          return results;
        }
      } else {
        if (first) {
          result = await statement.first();
          if (!result) return null;

          // Apply transformation if provided
          if (transform && typeof transform === 'function') {
            return transform(result);
          }

          return result;
        } else {
          result = await statement.all();
          const results = result.results || [];

          // Include metadata for debugging if available
          if (result.meta) {
            this.logger.debug('Query metadata', { meta: result.meta });
          }

          // Apply transformation if provided
          if (transform && typeof transform === 'function') {
            return results.map(row => transform(row));
          }

          return results;
        }
      }
    } catch (workerError: any) {
      this.logger.error('Workers Binding API error', { error: workerError, sql });
      throw new Error(`D1 Workers API error: ${workerError.message}`);
    }
  }

  private async executeRestQuery({
    sql,
    params = [],
    first = false,
    transform,
  }: SqlQueryOptions): Promise<Record<string, any>[] | Record<string, any> | null> {
    // Ensure required properties are defined
    if (!this.client || !this.accountId || !this.databaseId) {
      throw new Error('Missing required REST API configuration');
    }

    try {
      const response = await this.client.d1.database.query(this.databaseId, {
        account_id: this.accountId,
        sql: sql,
        params: this.formatSqlParams(params),
      });

      const results = response.result || [];

      // If first=true, return only the first result
      if (first) {
        const firstResult = isArrayOfRecords(results) && results.length > 0 ? results[0] : null;
        if (!firstResult) return null;

        // Apply transformation if provided
        if (transform && typeof transform === 'function') {
          return transform(firstResult);
        }

        return firstResult;
      }

      // Apply transformation if provided
      if (transform && typeof transform === 'function') {
        return results.map(row => transform(row));
      }

      return results;
    } catch (restError: any) {
      this.logger.error('REST API error', { error: restError, sql });
      throw new Error(`D1 REST API error: ${restError.message}`);
    }
  }

  /**
   * Execute a SQL query against the D1 database
   * @param options Query options including SQL, parameters, and whether to return only the first result
   * @returns Query results as an array or a single object if first=true
   */
  private async executeQuery(options: SqlQueryOptions): Promise<Record<string, any>[] | Record<string, any> | null> {
    const { sql, params = [], first = false, transform } = options;

    try {
      this.logger.debug('Executing SQL query', { sql, params, first });

      if (this.binding) {
        // Use Workers Binding API
        return this.executeWorkersBindingQuery({ sql, params, first, transform });
      } else if (this.client && this.accountId && this.databaseId) {
        // Use REST API
        return this.executeRestQuery({ sql, params, first, transform });
      } else {
        throw new Error('No valid D1 configuration provided');
      }
    } catch (error: any) {
      this.logger.error('Error executing SQL query', { error, sql, params, first });
      throw new Error(`D1 query error: ${error.message}`);
    }
  }

  /**
   * Begin a new transaction
   * @returns A transaction object that can be used to execute queries within the transaction
   */
  async beginTransaction(): Promise<Transaction> {
    try {
      const beginQuery = createSqlBuilder().beginTransaction();
      const { sql: beginSql, params: beginParams } = beginQuery.build();
      await this.executeQuery({ sql: beginSql, params: beginParams });

      // Return a transaction object with methods to execute queries, commit, or rollback
      return {
        executeQuery: async (options: SqlQueryOptions): Promise<Record<string, any>[]> => {
          const result = await this.executeQuery({
            ...options,
            first: false, // Ensure we get an array of results
          });
          return result as Record<string, any>[];
        },
        executeQuerySingle: async (options: SqlQueryOptions): Promise<Record<string, any> | null> => {
          // Use a type assertion to handle the potential undefined return type
          const result = await this.executeQuery({
            ...options,
            first: true, // Ensure we get a single result
          });

          // The result could be an array or a single item, ensure we return a single item or null
          if (isArrayOfRecords(result)) {
            return result[0] || null;
          }
          return result;
        },
        commit: async (): Promise<void> => {
          const commitQuery = createSqlBuilder().commitTransaction();
          const { sql: commitSql, params: commitParams } = commitQuery.build();
          await this.executeQuery({ sql: commitSql, params: commitParams });
          this.logger.debug('Transaction committed');
        },
        rollback: async (): Promise<void> => {
          const rollbackQuery = createSqlBuilder().rollbackTransaction();
          const { sql: rollbackSql, params: rollbackParams } = rollbackQuery.build();
          await this.executeQuery({ sql: rollbackSql, params: rollbackParams });
          this.logger.debug('Transaction rolled back');
        },
      };
    } catch (error: any) {
      this.logger.error('Error beginning transaction:', { error });
      throw new Error(`Failed to begin transaction: ${error.message}`);
    }
  }

  /**
   * Execute a function within a transaction
   * @param fn Function to execute within the transaction
   * @returns The result of the function
   */
  async withTransaction<T>(fn: (transaction: Transaction) => Promise<T>): Promise<T> {
    const transaction = await this.beginTransaction();

    try {
      // Execute the function with the transaction
      const result = await fn(transaction);

      // Commit the transaction if successful
      await transaction.commit();

      return result;
    } catch (error) {
      // Rollback the transaction on error
      await transaction.rollback();
      throw error;
    }
  }

  // Helper to convert storage type to SQL type
  private getSqlType(type: string): string {
    switch (type) {
      case 'text':
        return 'TEXT';
      case 'timestamp':
        return 'TIMESTAMP';
      case 'integer':
        return 'INTEGER';
      case 'bigint':
        return 'INTEGER'; // SQLite doesn't have a separate BIGINT type
      case 'jsonb':
        return 'TEXT'; // Store JSON as TEXT in SQLite
      default:
        return 'TEXT';
    }
  }

  private ensureDate(date: Date | string | undefined): Date | undefined {
    if (!date) return undefined;
    return date instanceof Date ? date : new Date(date);
  }

  private serializeDate(date: Date | string | undefined): string | undefined {
    if (!date) return undefined;
    const dateObj = this.ensureDate(date);
    return dateObj?.toISOString();
  }

  // Helper to serialize objects to JSON strings
  private serializeValue(value: any): any {
    if (value === null || value === undefined) return null;

    if (value instanceof Date) {
      return this.serializeDate(value);
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return value;
  }

  // Helper to deserialize JSON strings to objects
  private deserializeValue(value: any, type?: string): any {
    if (value === null || value === undefined) return null;

    if (type === 'date' && typeof value === 'string') {
      return new Date(value);
    }

    if (type === 'jsonb' && typeof value === 'string') {
      try {
        return JSON.parse(value) as Record<string, any>;
      } catch (e) {
        return value;
      }
    }

    if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
      try {
        return JSON.parse(value) as Record<string, any>;
      } catch (e) {
        return value;
      }
    }

    return value;
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    const fullTableName = this.getTableName(tableName);

    // Build SQL columns from schema
    const columnDefinitions = Object.entries(schema).map(([colName, colDef]) => {
      const type = this.getSqlType(colDef.type);
      const nullable = colDef.nullable === false ? 'NOT NULL' : '';
      const primaryKey = colDef.primaryKey ? 'PRIMARY KEY' : '';
      return `${colName} ${type} ${nullable} ${primaryKey}`.trim();
    });

    const query = createSqlBuilder().createTable(fullTableName, columnDefinitions);

    const { sql, params } = query.build();

    try {
      await this.executeQuery({ sql, params });
      this.logger.debug(`Created table ${fullTableName}`);
    } catch (error) {
      this.logger.error(`Error creating table ${fullTableName}:`, { error });
      throw new Error(`Failed to create table ${fullTableName}: ${error}`);
    }
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    const fullTableName = this.getTableName(tableName);

    try {
      const query = createSqlBuilder().delete(fullTableName);

      const { sql, params } = query.build();
      await this.executeQuery({ sql, params });
      this.logger.debug(`Cleared table ${fullTableName}`);
    } catch (error) {
      this.logger.error(`Error clearing table ${fullTableName}:`, { error });
      throw new Error(`Failed to clear table ${fullTableName}: ${error}`);
    }
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    const fullTableName = this.getTableName(tableName);

    // Process record for SQL insertion
    const processedRecord: Record<string, any> = {};
    for (const [key, value] of Object.entries(record)) {
      processedRecord[key] = this.serializeValue(value);
    }

    // Extract columns and values
    const columns = Object.keys(processedRecord);
    const values = Object.values(processedRecord);

    // Build the INSERT query
    const query = createSqlBuilder().insert(fullTableName, columns, values);

    const { sql, params } = query.build();

    try {
      await this.executeQuery({ sql, params });
    } catch (error) {
      this.logger.error(`Error inserting into ${fullTableName}:`, { error });
      throw new Error(`Failed to insert into ${fullTableName}: ${error}`);
    }
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    const fullTableName = this.getTableName(tableName);

    const query = createSqlBuilder().select('*').from(fullTableName);

    // Add WHERE conditions for each key
    let firstKey = true;
    for (const [key, value] of Object.entries(keys)) {
      if (firstKey) {
        query.where(`${key} = ?`, value);
        firstKey = false;
      } else {
        query.andWhere(`${key} = ?`, value);
      }
    }

    query.limit(1);
    const { sql, params } = query.build();

    try {
      const result = await this.executeQuery({ sql, params, first: true });

      if (!result) return null;

      // Process result to handle JSON fields
      const processedResult: Record<string, any> = {};

      for (const [key, value] of Object.entries(result)) {
        processedResult[key] = this.deserializeValue(value);
      }

      return processedResult as R;
    } catch (error) {
      this.logger.error(`Error loading from ${fullTableName}:`, { error });
      return null;
    }
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    const thread = await this.load<StorageThreadType>({
      tableName: TABLE_THREADS,
      keys: { id: threadId },
    });

    if (!thread) return null;

    try {
      return {
        ...thread,
        createdAt: this.ensureDate(thread.createdAt) as Date,
        updatedAt: this.ensureDate(thread.updatedAt) as Date,
        metadata:
          typeof thread.metadata === 'string'
            ? (JSON.parse(thread.metadata || '{}') as Record<string, any>)
            : thread.metadata || {},
      };
    } catch (error) {
      this.logger.error(`Error processing thread ${threadId}:`, { error });
      return null;
    }
  }

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    const fullTableName = this.getTableName(TABLE_THREADS);

    try {
      const query = createSqlBuilder().select('*').from(fullTableName).where('resourceId = ?', resourceId);

      const { sql, params } = query.build();
      const results = await this.executeQuery({ sql, params });

      return (isArrayOfRecords(results) ? results : []).map((thread: any) => ({
        ...thread,
        createdAt: this.ensureDate(thread.createdAt) as Date,
        updatedAt: this.ensureDate(thread.updatedAt) as Date,
        metadata:
          typeof thread.metadata === 'string'
            ? (JSON.parse(thread.metadata || '{}') as Record<string, any>)
            : thread.metadata || {},
      }));
    } catch (error) {
      this.logger.error(`Error getting threads by resourceId ${resourceId}:`, { error });
      return [];
    }
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    const now = new Date();
    const threadToSave = {
      ...thread,
      createdAt: thread.createdAt || now,
      updatedAt: now,
      metadata: thread.metadata || ({} as Record<string, any>),
    };

    await this.insert({
      tableName: TABLE_THREADS,
      record: threadToSave as Record<string, any>,
    });
    return threadToSave;
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
        ...(thread.metadata as Record<string, any>),
        ...(metadata as Record<string, any>),
      },
      updatedAt: new Date(),
    };
    await this.insert({
      tableName: TABLE_THREADS,
      record: updatedThread,
    });
    return updatedThread;
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    const fullTableName = this.getTableName(TABLE_THREADS);

    try {
      // Delete the thread
      const deleteThreadQuery = createSqlBuilder().delete(fullTableName).where('id = ?', threadId);

      const { sql: threadSql, params: threadParams } = deleteThreadQuery.build();
      await this.executeQuery({ sql: threadSql, params: threadParams });

      // Also delete associated messages
      const messagesTableName = this.getTableName(TABLE_MESSAGES);
      const deleteMessagesQuery = createSqlBuilder().delete(messagesTableName).where('thread_id = ?', threadId);

      const { sql: messagesSql, params: messagesParams } = deleteMessagesQuery.build();
      await this.executeQuery({ sql: messagesSql, params: messagesParams });
    } catch (error) {
      this.logger.error(`Error deleting thread ${threadId}:`, { error });
      throw new Error(`Failed to delete thread ${threadId}: ${error}`);
    }
  }

  // Thread and message management methods

  async saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    if (messages.length === 0) return [];

    try {
      const now = new Date();
      const fullTableName = this.getTableName(TABLE_MESSAGES);

      // Group messages by thread for better organization
      const messagesByThread = new Map<string, MessageType[]>();

      // Process and save each message
      for (const message of messages) {
        // Ensure timestamps are set
        const messageToSave = {
          ...message,
          thread_id: message.threadId,
          createdAt: message.createdAt || now,
          updatedAt: now,
        };

        // Group by thread for later processing
        if (!messagesByThread.has(message.threadId)) {
          messagesByThread.set(message.threadId, []);
        }
        messagesByThread.get(message.threadId)!.push(messageToSave);

        // Save the message to the database
        await this.insert({
          tableName: TABLE_MESSAGES,
          record: messageToSave as Record<string, any>,
        });
      }

      // Update thread metadata to reflect the latest message
      await Promise.all(
        Array.from(messagesByThread.entries()).map(async ([threadId, threadMessages]) => {
          try {
            // Get the thread to update its metadata
            const thread = await this.getThreadById({ threadId });
            if (thread) {
              // Find the latest message in this batch
              if (threadMessages.length > 0) {
                // Sort messages by creation time and get the latest one
                const sortedMessages = [...threadMessages].sort((a, b) => {
                  const timeA = new Date(a.createdAt || 0).getTime();
                  const timeB = new Date(b.createdAt || 0).getTime();
                  return timeB - timeA; // Descending order (newest first)
                });

                const latestMessage = sortedMessages[0]; // This is safer than using reduce

                // Ensure latestMessage is defined before proceeding
                if (latestMessage) {
                  // Ensure we have valid values for the thread metadata
                  const createdAt = latestMessage.createdAt || new Date().toISOString();
                  const messageId = latestMessage.id || '';

                  if (messageId) {
                    // Update thread with latest message info
                    await this.updateThread({
                      id: threadId,
                      title: thread.title || '', // Ensure title is never undefined
                      metadata: {
                        ...thread.metadata,
                        lastMessageAt: createdAt,
                        lastMessageId: messageId,
                        messageCount: ((thread.metadata as any)?.messageCount || 0) + threadMessages.length,
                      },
                    });
                  }
                }
              }
            }
          } catch (error) {
            this.logger.error(`Error updating thread ${threadId} metadata:`, { error });
          }
        }),
      );

      this.logger.debug(`Saved ${messages.length} messages across ${messagesByThread.size} threads`);
      return messages;
    } catch (error) {
      this.logger.error('Error saving messages:', { error });
      throw error;
    }
  }

  async getMessages<T = MessageType>({ threadId, selectBy }: StorageGetMessagesArg): Promise<T[]> {
    const limit = typeof selectBy?.last === 'number' ? selectBy.last : 40;
    const fullTableName = this.getTableName(TABLE_MESSAGES);

    if (limit === 0 && !selectBy?.include) {
      return [];
    }

    try {
      // We'll collect all message IDs we need to fetch
      const messageIdsToFetch = new Set<string>();

      // Handle specifically included messages and their context
      if (selectBy?.include?.length) {
        this.logger.debug('Including specific messages with context', { include: selectBy.include });

        for (const item of selectBy.include) {
          messageIdsToFetch.add(item.id);

          // If we need context (previous/next messages)
          if (item.withPreviousMessages || item.withNextMessages) {
            // First, get the current message's position (using created_at as the ordering)
            const sqlBuilder = createSqlBuilder();

            // Build position query
            sqlBuilder
              .select('created_at')
              .from(fullTableName)
              .where('thread_id = ?', threadId)
              .andWhere('id = ?', item.id)
              .limit(1);

            const { sql: positionQuery, params: positionParams } = sqlBuilder.build();
            const positionResult = await this.executeQuery({
              sql: positionQuery,
              params: positionParams,
              first: true,
            });

            if (positionResult && 'created_at' in positionResult) {
              const messageTimestamp = positionResult.created_at;

              // Get previous messages if requested
              if (item.withPreviousMessages && item.withPreviousMessages > 0) {
                sqlBuilder
                  .reset()
                  .select('id')
                  .from(fullTableName)
                  .where('thread_id = ?', threadId)
                  .andWhere('created_at < ?', messageTimestamp)
                  .orderBy('created_at', 'DESC')
                  .limit(item.withPreviousMessages);

                const { sql: prevQuery, params: prevParams } = sqlBuilder.build();
                const prevResults = await this.executeQuery({
                  sql: prevQuery,
                  params: prevParams,
                });

                if (isArrayOfRecords(prevResults)) {
                  for (const row of prevResults) {
                    messageIdsToFetch.add(row.id);
                  }
                }

                // Get next messages if requested
                if (item.withNextMessages && item.withNextMessages > 0) {
                  sqlBuilder
                    .reset()
                    .select('id')
                    .from(fullTableName)
                    .where('thread_id = ?', threadId)
                    .andWhere('created_at > ?', messageTimestamp)
                    .orderBy('created_at', 'ASC')
                    .limit(item.withNextMessages);

                  const { sql: nextQuery, params: nextParams } = sqlBuilder.build();
                  const nextResults = await this.executeQuery({
                    sql: nextQuery,
                    params: nextParams,
                  });

                  if (isArrayOfRecords(nextResults)) {
                    for (const row of nextResults) {
                      messageIdsToFetch.add(row.id);
                    }
                  }
                }
              }
            }
          }
        }
      }

      // If we need the most recent messages
      if (limit > 0) {
        let limitQuery = `
          SELECT id FROM ${fullTableName} 
          WHERE thread_id = ? 
          ORDER BY created_at DESC 
          LIMIT ?
        `;
        const limitParams = [threadId, limit];

        const latestResults = await this.executeQuery({
          sql: limitQuery,
          params: limitParams,
        });

        if (isArrayOfRecords(latestResults)) {
          for (const row of latestResults) {
            messageIdsToFetch.add(row.id);
          }
        }
      }

      let query = createSqlBuilder().select('*').from(fullTableName);

      if (messageIdsToFetch.size > 0) {
        const messageIds = Array.from(messageIdsToFetch);
        // Create placeholders for the IN clause
        const placeholders = messageIds.map(() => '?').join(',');

        query
          .where('thread_id = ?', threadId)
          .andWhere(`id IN (${placeholders})`, ...messageIds)
          .orderBy('created_at', 'ASC');
      } else {
        // Fallback to getting the latest messages
        query
          .where('thread_id = ?', threadId)
          .orderBy('created_at', 'ASC')
          .limit(limit > 0 ? limit : 40);
      }

      const { sql, params } = query.build();
      const results = await this.executeQuery({
        sql,
        params,
      });

      // Process messages
      const messages = isArrayOfRecords(results)
        ? results.map((msg: Record<string, any>) => {
            const processedMsg: Record<string, any> = {};

            for (const [key, value] of Object.entries(msg)) {
              processedMsg[key] = this.deserializeValue(value);
            }

            return processedMsg as T;
          })
        : [];

      // Sort by creation time to ensure proper order
      messages.sort((a, b) => {
        const aRecord = a as Record<string, any>;
        const bRecord = b as Record<string, any>;
        const timeA = new Date((aRecord.created_at as string) || (aRecord.createdAt as string)).getTime();
        const timeB = new Date((bRecord.created_at as string) || (bRecord.createdAt as string)).getTime();
        return timeA - timeB;
      });

      this.logger.debug(`Retrieved ${messages.length} messages for thread ${threadId}`);
      return messages;
    } catch (error) {
      this.logger.error(`Error retrieving messages for thread ${threadId}:`, { error });
      return [];
    }
  }

  async persistWorkflowSnapshot(params: {
    namespace: string;
    workflowName: string;
    runId: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    const { namespace, workflowName, runId, snapshot } = params;

    const data = {
      namespace,
      workflow_name: workflowName,
      run_id: runId,
      snapshot: snapshot as Record<string, any>,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.logger.debug('Persisting workflow snapshot', { workflowName, runId });

    await this.insert({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      record: data,
    });
  }

  async loadWorkflowSnapshot(params: {
    namespace: string;
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    const { namespace, workflowName, runId } = params;

    this.logger.debug('Loading workflow snapshot', { workflowName, runId });

    const d = await this.load<{ snapshot: unknown }>({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      keys: {
        namespace,
        workflow_name: workflowName,
        run_id: runId,
      },
    });

    return d ? (d.snapshot as WorkflowRunState) : null;
  }

  /**
   * Insert multiple records in a batch operation
   * @param tableName The table to insert into
   * @param records The records to insert
   */
  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    if (records.length === 0) return;

    const fullTableName = this.getTableName(tableName);

    // Use the withTransaction helper to manage the transaction
    return this.withTransaction(async transaction => {
      try {
        // Process records in batches for better performance
        const batchSize = 50; // Adjust based on performance testing

        for (let i = 0; i < records.length; i += batchSize) {
          const batch = records.slice(i, i + batchSize);

          // Prepare all records with timestamps
          const now = new Date();
          const recordsToInsert = batch.map(record => ({
            ...record,
            createdAt: record.createdAt || now,
            updatedAt: record.updatedAt || now,
          }));

          // For bulk insert, we need to determine the columns from the first record
          if (recordsToInsert.length > 0) {
            const firstRecord = recordsToInsert[0];
            // Ensure firstRecord is not undefined before calling Object.keys
            const columns = Object.keys(firstRecord || {});

            // Create a bulk insert statement
            // For D1, we'll use multiple single inserts in one transaction as a workaround
            // since it doesn't support true bulk inserts like some other databases
            for (const record of recordsToInsert) {
              // Use type-safe approach to extract values
              const values = columns.map(col => {
                if (!record) return null;
                // Safely access the record properties
                const value = typeof col === 'string' ? record[col as keyof typeof record] : null;
                return this.serializeValue(value);
              });

              const query = createSqlBuilder().insert(fullTableName, columns, values);

              const { sql, params } = query.build();
              await transaction.executeQuery({ sql, params });
            }
          }

          this.logger.debug(
            `Processed batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(records.length / batchSize)}`,
          );
        }

        this.logger.debug(`Successfully batch inserted ${records.length} records into ${tableName}`);
      } catch (error) {
        this.logger.error(`Error batch inserting into ${tableName}:`, { error });
        throw new Error(`Failed to batch insert into ${tableName}: ${error}`);
      }
    });
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
  }): Promise<Record<string, any>[]> {
    const fullTableName = this.getTableName(TABLE_TRACES);

    try {
      const query = createSqlBuilder().select('*').from(fullTableName).where('1=1');

      if (name) {
        query.andWhere('name = ?', name);
      }

      if (scope) {
        query.andWhere('scope = ?', scope);
      }

      if (attributes && Object.keys(attributes).length > 0) {
        // Handle JSON attribute filtering
        for (const [key, value] of Object.entries(attributes)) {
          query.jsonLike('attributes', key, value);
        }
      }

      query
        .orderBy('startTime', 'DESC')
        .limit(perPage)
        .offset((page - 1) * perPage);

      const { sql, params } = query.build();
      const results = await this.executeQuery({ sql, params });

      return isArrayOfRecords(results)
        ? results.map((trace: Record<string, any>) => ({
            ...trace,
            attributes: this.deserializeValue(trace.attributes, 'jsonb'),
            status: this.deserializeValue(trace.status, 'jsonb'),
            events: this.deserializeValue(trace.events, 'jsonb'),
            links: this.deserializeValue(trace.links, 'jsonb'),
          }))
        : [];
    } catch (error) {
      this.logger.error('Error getting traces:', { error });
      return [];
    }
  }

  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    const fullTableName = this.getTableName(TABLE_EVALS);

    try {
      let query = createSqlBuilder().select('*').from(fullTableName).where('agent_name = ?', agentName);

      // Match LibSQL implementation for type filtering
      if (type === 'test') {
        // For 'test' type: test_info must exist and have a testPath property
        query = query.andWhere("test_info IS NOT NULL AND json_extract(test_info, '$.testPath') IS NOT NULL");
      } else if (type === 'live') {
        // For 'live' type: test_info is NULL or doesn't have a testPath property
        query = query.andWhere("(test_info IS NULL OR json_extract(test_info, '$.testPath') IS NULL)");
      }

      query.orderBy('created_at', 'DESC');

      const { sql, params } = query.build();
      const results = await this.executeQuery({ sql, params });

      return isArrayOfRecords(results)
        ? results.map((row: Record<string, any>) => {
            // Convert snake_case to camelCase for the response
            const result = this.deserializeValue(row.result);
            const testInfo = row.test_info ? this.deserializeValue(row.test_info) : undefined;

            return {
              input: row.input || '',
              output: row.output || '',
              result,
              agentName: row.agent_name || '',
              metricName: row.metric_name || '',
              instructions: row.instructions || '',
              runId: row.run_id || '',
              globalRunId: row.global_run_id || '',
              createdAt: row.created_at || '',
              testInfo,
            };
          })
        : [];
    } catch (error) {
      this.logger.error(`Error getting evals for agent ${agentName}:`, { error });
      return [];
    }
  }

  /**
   * Close the database connection
   * No explicit cleanup needed for D1 in either REST or Workers Binding mode
   */
  async close(): Promise<void> {
    this.logger.debug('Closing D1 connection');
    // No explicit cleanup needed for D1
  }
}
