import { randomUUID } from 'node:crypto';
import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraMessageV1, MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import {
  MemoryStorage,
  normalizePerPage,
  calculatePagination,
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_THREADS,
  TABLE_SCHEMAS,
  createStorageErrorId,
} from '@mastra/core/storage';

/**
 * Local constant for the observational memory table name.
 * Defined locally to avoid a static import that crashes on older @mastra/core
 * versions that don't export TABLE_OBSERVATIONAL_MEMORY.
 */
const OM_TABLE = 'mastra_observational_memory' as const;

/**
 * Try to import the OM schema statically. On older @mastra/core versions that
 * don't export OBSERVATIONAL_MEMORY_TABLE_SCHEMA this will be undefined,
 * and getExportDDL / init() will simply skip the OM table.
 */
let _omTableSchema: Record<string, Record<string, any>> | undefined;
try {
  const storage = require('@mastra/core/storage');
  _omTableSchema = storage.OBSERVATIONAL_MEMORY_TABLE_SCHEMA;
} catch {
  // OM not available in this version of core
}
import type {
  StorageResourceType,
  StorageListMessagesInput,
  StorageListMessagesByResourceIdInput,
  StorageListMessagesOutput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
  CreateIndexOptions,
  StorageCloneThreadInput,
  StorageCloneThreadOutput,
  ThreadCloneMetadata,
  ObservationalMemoryRecord,
  BufferedObservationChunk,
  CreateObservationalMemoryInput,
  UpdateActiveObservationsInput,
  UpdateBufferedObservationsInput,
  SwapBufferedToActiveInput,
  SwapBufferedToActiveResult,
  UpdateBufferedReflectionInput,
  SwapBufferedReflectionToActiveInput,
  CreateReflectionGenerationInput,
} from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';
import {
  PgDB,
  resolvePgConfig,
  generateTableSQL,
  generateIndexSQL,
  getSchemaName as dbGetSchemaName,
  getTableName as dbGetTableName,
} from '../../db';
import type { PgDomainConfig } from '../../db';

// Database row type that includes timezone-aware columns
type MessageRowFromDB = {
  id: string;
  content: string | any;
  role: string;
  type?: string;
  createdAt: Date | string;
  createdAtZ?: Date | string;
  threadId: string;
  resourceId: string;
};

function getSchemaName(schema?: string) {
  return schema ? `"${schema}"` : '"public"';
}

function getTableName({ indexName, schemaName }: { indexName: string; schemaName?: string }) {
  const quotedIndexName = `"${indexName}"`;
  return schemaName ? `${schemaName}.${quotedIndexName}` : quotedIndexName;
}

/**
 * Generate SQL placeholder string for IN clauses.
 * @param count - Number of placeholders to generate
 * @param startIndex - Starting index for placeholders (default: 1)
 * @returns Comma-separated placeholder string, e.g. "$1, $2, $3"
 */
function inPlaceholders(count: number, startIndex = 1): string {
  return Array.from({ length: count }, (_, i) => `$${i + startIndex}`).join(', ');
}

export class MemoryPG extends MemoryStorage {
  readonly supportsObservationalMemory = true;

  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  /** Tables managed by this domain */
  static readonly MANAGED_TABLES = [TABLE_THREADS, TABLE_MESSAGES, TABLE_RESOURCES, OM_TABLE] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    // Filter indexes to only those for tables managed by this domain
    this.#indexes = indexes?.filter(idx => (MemoryPG.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_THREADS, schema: TABLE_SCHEMAS[TABLE_THREADS] });
    await this.#db.createTable({ tableName: TABLE_MESSAGES, schema: TABLE_SCHEMAS[TABLE_MESSAGES] });
    await this.#db.createTable({ tableName: TABLE_RESOURCES, schema: TABLE_SCHEMAS[TABLE_RESOURCES] });

    // Dynamically import OM schema to avoid breaking older @mastra/core versions
    let omSchema: Record<string, any> | undefined;
    try {
      const { OBSERVATIONAL_MEMORY_TABLE_SCHEMA } = await import('@mastra/core/storage');
      omSchema = OBSERVATIONAL_MEMORY_TABLE_SCHEMA?.[OM_TABLE];
    } catch {
      // OM not available in this version of core
    }

    if (omSchema) {
      await this.#db.createTable({
        tableName: OM_TABLE as any,
        schema: omSchema,
      });
      // Add new OM columns for backwards compatibility with existing databases
      await this.#db.alterTable({
        tableName: OM_TABLE as any,
        schema: omSchema,
        ifNotExists: [
          'observedMessageIds',
          'observedTimezone',
          'bufferedObservations',
          'bufferedObservationTokens',
          'bufferedMessageIds',
          'bufferedReflection',
          'bufferedReflectionTokens',
          'bufferedReflectionInputTokens',
          'bufferedObservationChunks',
          'isBufferingObservation',
          'isBufferingReflection',
          'lastBufferedAtTokens',
          'lastBufferedAtTime',
        ],
      });
    }
    await this.#db.alterTable({
      tableName: TABLE_MESSAGES,
      schema: TABLE_SCHEMAS[TABLE_MESSAGES],
      ifNotExists: ['resourceId'],
    });
    if (omSchema) {
      // Create index on lookupKey for efficient OM queries
      const omTableName = getTableName({
        indexName: OM_TABLE,
        schemaName: getSchemaName(this.#schema),
      });
      await this.#db.client.none(`CREATE INDEX IF NOT EXISTS idx_om_lookup_key ON ${omTableName} ("lookupKey")`);
    }
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  /**
   * Returns default index definitions for the memory domain tables.
   * @param schemaPrefix - Prefix for index names (e.g. "my_schema_" or "")
   */
  static getDefaultIndexDefs(schemaPrefix: string): CreateIndexOptions[] {
    return [
      {
        name: `${schemaPrefix}mastra_threads_resourceid_createdat_idx`,
        table: TABLE_THREADS,
        columns: ['resourceId', 'createdAt DESC'],
      },
      {
        name: `${schemaPrefix}mastra_messages_thread_id_createdat_idx`,
        table: TABLE_MESSAGES,
        columns: ['thread_id', 'createdAt DESC'],
      },
    ];
  }

  /**
   * Returns all DDL statements for this domain: tables (threads, messages, resources, OM), indexes.
   * Used by exportSchemas to produce a complete, reproducible schema export.
   */
  static getExportDDL(schemaName?: string): string[] {
    const statements: string[] = [];
    const parsedSchema = schemaName ? parseSqlIdentifier(schemaName, 'schema name') : '';
    const schemaPrefix = parsedSchema && parsedSchema !== 'public' ? `${parsedSchema}_` : '';
    const quotedSchemaName = dbGetSchemaName(schemaName);

    // Tables: threads, messages, resources
    for (const tableName of [TABLE_THREADS, TABLE_MESSAGES, TABLE_RESOURCES] as const) {
      statements.push(
        generateTableSQL({
          tableName,
          schema: TABLE_SCHEMAS[tableName],
          schemaName,
          includeAllConstraints: true,
        }),
      );
    }

    // Observational memory table (if schema available in this version of core)
    const omSchema = _omTableSchema?.[OM_TABLE];
    if (omSchema) {
      statements.push(
        generateTableSQL({
          tableName: OM_TABLE as any,
          schema: omSchema,
          schemaName,
          includeAllConstraints: true,
        }),
      );
      // idx_om_lookup_key index
      const fullOmTableName = dbGetTableName({ indexName: OM_TABLE, schemaName: quotedSchemaName });
      const idxPrefix = schemaPrefix ? `${schemaPrefix}` : '';
      statements.push(
        `CREATE INDEX IF NOT EXISTS "${idxPrefix}idx_om_lookup_key" ON ${fullOmTableName} ("lookupKey");`,
      );
    }

    // Default indexes
    for (const idx of MemoryPG.getDefaultIndexDefs(schemaPrefix)) {
      statements.push(generateIndexSQL(idx, schemaName));
    }

    return statements;
  }

  /**
   * Returns default index definitions for this instance's schema.
   */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    const schemaPrefix = this.#schema !== 'public' ? `${this.#schema}_` : '';
    return MemoryPG.getDefaultIndexDefs(schemaPrefix);
  }

  /**
   * Creates default indexes for optimal query performance.
   */
  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) {
      return;
    }

    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        // Log but continue - indexes are performance optimizations
        this.logger?.warn?.(`Failed to create index ${indexDef.name}:`, error);
      }
    }
  }

  /**
   * Creates custom user-defined indexes for this domain's tables.
   */
  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) {
      return;
    }

    for (const indexDef of this.#indexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        // Log but continue - indexes are performance optimizations
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_MESSAGES });
    await this.#db.clearTable({ tableName: TABLE_THREADS });
    await this.#db.clearTable({ tableName: TABLE_RESOURCES });
  }

  /**
   * Normalizes message row from database by applying createdAtZ fallback
   */
  private normalizeMessageRow(row: MessageRowFromDB): Omit<MessageRowFromDB, 'createdAtZ'> {
    return {
      id: row.id,
      content: row.content,
      role: row.role,
      type: row.type,
      createdAt: row.createdAtZ || row.createdAt,
      threadId: row.threadId,
      resourceId: row.resourceId,
    };
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    try {
      const tableName = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.#schema) });

      const thread = await this.#db.client.oneOrNone<StorageThreadType & { createdAtZ: Date; updatedAtZ: Date }>(
        `SELECT * FROM ${tableName} WHERE id = $1`,
        [threadId],
      );

      if (!thread) {
        return null;
      }

      return {
        id: thread.id,
        resourceId: thread.resourceId,
        title: thread.title,
        metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
        createdAt: thread.createdAtZ || thread.createdAt,
        updatedAt: thread.updatedAtZ || thread.updatedAt,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_THREAD_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId,
          },
        },
        error,
      );
    }
  }

  public async listThreads(args: StorageListThreadsInput): Promise<StorageListThreadsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, filter } = args;

    try {
      // Validate pagination input before normalization
      // This ensures page === 0 when perPageInput === false
      this.validatePaginationInput(page, perPageInput ?? 100);
    } catch (error) {
      throw new MastraError({
        id: createStorageErrorId('PG', 'LIST_THREADS', 'INVALID_PAGE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: error instanceof Error ? error.message : 'Invalid pagination parameters',
        details: { page, ...(perPageInput !== undefined && { perPage: perPageInput }) },
      });
    }

    const perPage = normalizePerPage(perPageInput, 100);

    // Validate metadata keys to prevent SQL injection
    try {
      this.validateMetadataKeys(filter?.metadata);
    } catch (error) {
      throw new MastraError({
        id: createStorageErrorId('PG', 'LIST_THREADS', 'INVALID_METADATA_KEY'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: error instanceof Error ? error.message : 'Invalid metadata key',
        details: { metadataKeys: filter?.metadata ? Object.keys(filter.metadata).join(', ') : '' },
      });
    }

    const { field, direction } = this.parseOrderBy(orderBy);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      const tableName = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.#schema) });
      const whereClauses: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      // Add resourceId filter if provided
      if (filter?.resourceId) {
        whereClauses.push(`"resourceId" = $${paramIndex}`);
        queryParams.push(filter.resourceId);
        paramIndex++;
      }

      // Add metadata filters if provided (AND logic)
      // Uses JSONB containment (@>) to avoid SQL injection and correctly match all value types including null
      // metadata column is TEXT type storing JSON, so we need to cast to jsonb first
      if (filter?.metadata && Object.keys(filter.metadata).length > 0) {
        for (const [key, value] of Object.entries(filter.metadata)) {
          // Use JSONB containment operator - no key interpolation needed
          whereClauses.push(`metadata::jsonb @> $${paramIndex}::jsonb`);
          // Build a small JSON object for each key-value pair
          queryParams.push(JSON.stringify({ [key]: value }));
          paramIndex++;
        }
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const baseQuery = `FROM ${tableName} ${whereClause}`;

      const countQuery = `SELECT COUNT(*) ${baseQuery}`;
      const countResult = await this.#db.client.one(countQuery, queryParams);
      const total = parseInt(countResult.count, 10);

      if (total === 0) {
        return {
          threads: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      const limitValue = perPageInput === false ? total : perPage;
      // Select both standard and timezone-aware columns (*Z) for proper UTC timestamp handling
      const dataQuery = `SELECT id, "resourceId", title, metadata, "createdAt", "createdAtZ", "updatedAt", "updatedAtZ" ${baseQuery} ORDER BY "${field}" ${direction} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      const rows = await this.#db.client.manyOrNone<StorageThreadType & { createdAtZ: Date; updatedAtZ: Date }>(
        dataQuery,
        [...queryParams, limitValue, offset],
      );

      const threads = (rows || []).map(thread => ({
        id: thread.id,
        resourceId: thread.resourceId,
        title: thread.title,
        metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
        // Use timezone-aware columns (*Z) for correct UTC timestamps, with fallback for legacy data
        createdAt: thread.createdAtZ || thread.createdAt,
        updatedAt: thread.updatedAtZ || thread.updatedAt,
      }));

      return {
        threads,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_THREADS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            ...(filter?.resourceId && { resourceId: filter.resourceId }),
            hasMetadataFilter: !!filter?.metadata,
            page,
          },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException(mastraError);
      return {
        threads: [],
        total: 0,
        page,
        perPage: perPageForResponse,
        hasMore: false,
      };
    }
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    try {
      const tableName = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.#schema) });
      await this.#db.client.none(
        `INSERT INTO ${tableName} (
          id,
          "resourceId",
          title,
          metadata,
          "createdAt",
          "createdAtZ",
          "updatedAt",
          "updatedAtZ"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          "resourceId" = EXCLUDED."resourceId",
          title = EXCLUDED.title,
          metadata = EXCLUDED.metadata,
          "createdAt" = EXCLUDED."createdAt",
          "createdAtZ" = EXCLUDED."createdAtZ",
          "updatedAt" = EXCLUDED."updatedAt",
          "updatedAtZ" = EXCLUDED."updatedAtZ"`,
        [
          thread.id,
          thread.resourceId,
          thread.title,
          thread.metadata ? JSON.stringify(thread.metadata) : null,
          thread.createdAt,
          thread.createdAt,
          thread.updatedAt,
          thread.updatedAt,
        ],
      );

      return thread;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'SAVE_THREAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId: thread.id,
          },
        },
        error,
      );
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
    const threadTableName = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.#schema) });
    const existingThread = await this.getThreadById({ threadId: id });
    if (!existingThread) {
      throw new MastraError({
        id: createStorageErrorId('PG', 'UPDATE_THREAD', 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Thread ${id} not found`,
        details: {
          threadId: id,
          title,
        },
      });
    }

    const mergedMetadata = {
      ...existingThread.metadata,
      ...metadata,
    };

    try {
      const now = new Date().toISOString();
      const thread = await this.#db.client.one<StorageThreadType & { createdAtZ: Date; updatedAtZ: Date }>(
        `UPDATE ${threadTableName}
                    SET
                        title = $1,
                        metadata = $2,
                        "updatedAt" = $3,
                        "updatedAtZ" = $4
                    WHERE id = $5
                    RETURNING *
                `,
        [title, mergedMetadata, now, now, id],
      );

      return {
        id: thread.id,
        resourceId: thread.resourceId,
        title: thread.title,
        metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
        createdAt: thread.createdAtZ || thread.createdAt,
        updatedAt: thread.updatedAtZ || thread.updatedAt,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UPDATE_THREAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId: id,
            title,
          },
        },
        error,
      );
    }
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    try {
      const tableName = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.#schema) });
      const threadTableName = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.#schema) });
      await this.#db.client.tx(async t => {
        await t.none(`DELETE FROM ${tableName} WHERE thread_id = $1`, [threadId]);

        const schemaName = this.#schema || 'public';
        const vectorTables = await t.manyOrNone<{ tablename: string }>(
          `
          SELECT tablename
          FROM pg_tables
          WHERE schemaname = $1
          AND (tablename = 'memory_messages' OR tablename LIKE 'memory_messages_%')
        `,
          [schemaName],
        );

        for (const { tablename } of vectorTables) {
          const vectorTableName = getTableName({ indexName: tablename, schemaName: getSchemaName(this.#schema) });
          await t.none(`DELETE FROM ${vectorTableName} WHERE metadata->>'thread_id' = $1`, [threadId]);
        }

        await t.none(`DELETE FROM ${threadTableName} WHERE id = $1`, [threadId]);
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_THREAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId,
          },
        },
        error,
      );
    }
  }

  /**
   * Fetches messages around target messages using cursor-based pagination.
   *
   * This replaces the previous ROW_NUMBER() approach which caused severe performance
   * issues on large tables (see GitHub issue #11150). The old approach required
   * scanning and sorting ALL messages in a thread to assign row numbers.
   *
   * The new approach uses the existing (thread_id, createdAt) index to efficiently
   * fetch only the messages needed by using createdAt as a cursor.
   */
  private async _getIncludedMessages({ include }: { include: StorageListMessagesInput['include'] }) {
    if (!include || include.length === 0) return null;

    const tableName = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.#schema) });
    const selectColumns = `id, content, role, type, "createdAt", "createdAtZ", thread_id AS "threadId", "resourceId"`;

    // Build a single efficient query that fetches context for all target messages
    // For each target message, we fetch:
    // 1. The target message itself plus any previous messages (createdAt <= target)
    // 2. Any next messages after the target (createdAt > target)
    // Each subquery is wrapped in parentheses to allow ORDER BY within UNION ALL
    const unionQueries: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    for (const inc of include) {
      const { id, withPreviousMessages = 0, withNextMessages = 0 } = inc;

      // Always fetch the target message, plus any requested previous messages
      // Uses createdAt <= target's createdAt, ordered DESC, limited to withPreviousMessages + 1
      // The +1 ensures we always get the target message itself
      unionQueries.push(`(
        SELECT ${selectColumns}
        FROM ${tableName} m
        WHERE m.thread_id = (SELECT thread_id FROM ${tableName} WHERE id = $${paramIdx})
          AND COALESCE(m."createdAtZ", m."createdAt") <= (SELECT COALESCE("createdAtZ", "createdAt") FROM ${tableName} WHERE id = $${paramIdx})
        ORDER BY COALESCE(m."createdAtZ", m."createdAt") DESC
        LIMIT $${paramIdx + 1}
      )`);
      params.push(id, withPreviousMessages + 1); // +1 to include the target message itself
      paramIdx += 2;

      // Query for messages after the target (only if requested)
      // Uses createdAt > target's createdAt, ordered ASC, limited to withNextMessages
      if (withNextMessages > 0) {
        unionQueries.push(`(
          SELECT ${selectColumns}
          FROM ${tableName} m
          WHERE m.thread_id = (SELECT thread_id FROM ${tableName} WHERE id = $${paramIdx})
            AND COALESCE(m."createdAtZ", m."createdAt") > (SELECT COALESCE("createdAtZ", "createdAt") FROM ${tableName} WHERE id = $${paramIdx})
          ORDER BY COALESCE(m."createdAtZ", m."createdAt") ASC
          LIMIT $${paramIdx + 1}
        )`);
        params.push(id, withNextMessages);
        paramIdx += 2;
      }
    }

    if (unionQueries.length === 0) return null;

    // When there's only one subquery, we don't need UNION ALL or an outer ORDER BY
    // (the subquery already has its own ORDER BY)
    // When there are multiple subqueries, we join them and sort the combined result
    let finalQuery: string;
    if (unionQueries.length === 1) {
      // Single query - just use it directly (remove outer parentheses for cleaner SQL)
      finalQuery = unionQueries[0]!.slice(1, -1); // Remove ( and )
    } else {
      // Multiple queries - UNION ALL and sort the result
      finalQuery = `SELECT * FROM (${unionQueries.join(' UNION ALL ')}) AS combined ORDER BY "createdAt" ASC`;
    }
    const includedRows = await this.#db.client.manyOrNone(finalQuery, params);

    // Deduplicate results (messages may appear in multiple context windows)
    const seen = new Set<string>();
    const dedupedRows = includedRows.filter(row => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
    return dedupedRows;
  }

  private parseRow(row: MessageRowFromDB): MastraDBMessage {
    const normalized = this.normalizeMessageRow(row);
    let content = normalized.content;
    try {
      content = JSON.parse(normalized.content);
    } catch {
      // use content as is if it's not JSON
    }
    return {
      id: normalized.id,
      content,
      role: normalized.role as MastraDBMessage['role'],
      createdAt: new Date(normalized.createdAt as string),
      threadId: normalized.threadId,
      resourceId: normalized.resourceId,
      ...(normalized.type && normalized.type !== 'v2' ? { type: normalized.type } : {}),
    } satisfies MastraDBMessage;
  }

  public async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (messageIds.length === 0) return { messages: [] };
    const selectStatement = `SELECT id, content, role, type, "createdAt", "createdAtZ", thread_id AS "threadId", "resourceId"`;

    try {
      const tableName = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.#schema) });
      const query = `
        ${selectStatement} FROM ${tableName}
        WHERE id IN (${inPlaceholders(messageIds.length)})
        ORDER BY "createdAt" DESC
      `;
      const resultRows = await this.#db.client.manyOrNone(query, messageIds);

      const list = new MessageList().add(
        resultRows.map(row => this.parseRow(row)) as (MastraMessageV1 | MastraDBMessage)[],
        'memory',
      );
      return { messages: list.get.all.db() };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_MESSAGES_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            messageIds: JSON.stringify(messageIds),
          },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException(mastraError);
      return { messages: [] };
    }
  }

  public async listMessages(args: StorageListMessagesInput): Promise<StorageListMessagesOutput> {
    const { threadId, resourceId, include, filter, perPage: perPageInput, page = 0, orderBy } = args;

    const threadIds = (Array.isArray(threadId) ? threadId : [threadId]).filter(
      (id): id is string => typeof id === 'string',
    );

    if (threadIds.length === 0 || threadIds.some(id => !id.trim())) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_MESSAGES', 'INVALID_THREAD_ID'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: Array.isArray(threadId) ? String(threadId) : String(threadId) },
        },
        new Error('threadId must be a non-empty string or array of non-empty strings'),
      );
    }

    if (page < 0) {
      throw new MastraError({
        id: createStorageErrorId('PG', 'LIST_MESSAGES', 'INVALID_PAGE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Page number must be non-negative',
        details: {
          threadId: Array.isArray(threadId) ? threadId.join(',') : threadId,
          page,
        },
      });
    }

    const perPage = normalizePerPage(perPageInput, 40);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      const { field, direction } = this.parseOrderBy(orderBy, 'ASC');
      const orderByStatement = `ORDER BY "${field}" ${direction}`;

      const selectStatement = `SELECT id, content, role, type, "createdAt", "createdAtZ", thread_id AS "threadId", "resourceId"`;
      const tableName = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.#schema) });

      const conditions: string[] = [`thread_id IN (${inPlaceholders(threadIds.length)})`];
      const queryParams: any[] = [...threadIds];
      let paramIndex = threadIds.length + 1;

      if (resourceId) {
        conditions.push(`"resourceId" = $${paramIndex++}`);
        queryParams.push(resourceId);
      }

      if (filter?.dateRange?.start) {
        const startOp = filter.dateRange.startExclusive ? '>' : '>=';
        conditions.push(`COALESCE("createdAtZ", "createdAt") ${startOp} $${paramIndex++}`);
        queryParams.push(filter.dateRange.start);
      }

      if (filter?.dateRange?.end) {
        const endOp = filter.dateRange.endExclusive ? '<' : '<=';
        conditions.push(`COALESCE("createdAtZ", "createdAt") ${endOp} $${paramIndex++}`);
        queryParams.push(filter.dateRange.end);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countQuery = `SELECT COUNT(*) FROM ${tableName} ${whereClause}`;
      const countResult = await this.#db.client.one(countQuery, queryParams);
      const total = parseInt(countResult.count, 10);

      const limitValue = perPageInput === false ? total : perPage;
      const dataQuery = `${selectStatement} FROM ${tableName} ${whereClause} ${orderByStatement} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      const rows = await this.#db.client.manyOrNone(dataQuery, [...queryParams, limitValue, offset]);
      const messages: MessageRowFromDB[] = [...(rows || [])];

      if (total === 0 && messages.length === 0 && (!include || include.length === 0)) {
        return {
          messages: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      const messageIds = new Set(messages.map(m => m.id));
      if (include && include.length > 0) {
        const includeMessages = await this._getIncludedMessages({ include });
        if (includeMessages) {
          for (const includeMsg of includeMessages) {
            if (!messageIds.has(includeMsg.id)) {
              messages.push(includeMsg);
              messageIds.add(includeMsg.id);
            }
          }
        }
      }

      const messagesWithParsedContent = messages.map(row => this.parseRow(row));

      const list = new MessageList().add(messagesWithParsedContent, 'memory');
      let finalMessages = list.get.all.db();

      finalMessages = finalMessages.sort((a, b) => {
        const aValue = field === 'createdAt' ? new Date(a.createdAt).getTime() : (a as any)[field];
        const bValue = field === 'createdAt' ? new Date(b.createdAt).getTime() : (b as any)[field];

        if (aValue == null && bValue == null) return a.id.localeCompare(b.id);
        if (aValue == null) return 1;
        if (bValue == null) return -1;

        if (aValue === bValue) {
          return a.id.localeCompare(b.id);
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return direction === 'ASC' ? aValue - bValue : bValue - aValue;
        }
        return direction === 'ASC'
          ? String(aValue).localeCompare(String(bValue))
          : String(bValue).localeCompare(String(aValue));
      });

      const threadIdSet = new Set(threadIds);
      const returnedThreadMessageIds = new Set(
        finalMessages.filter(m => m.threadId && threadIdSet.has(m.threadId)).map(m => m.id),
      );
      const allThreadMessagesReturned = returnedThreadMessageIds.size >= total;
      const hasMore = perPageInput !== false && !allThreadMessagesReturned && offset + perPage < total;

      return {
        messages: finalMessages,
        total,
        page,
        perPage: perPageForResponse,
        hasMore,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId: Array.isArray(threadId) ? threadId.join(',') : threadId,
            resourceId: resourceId ?? '',
          },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException(mastraError);
      return {
        messages: [],
        total: 0,
        page,
        perPage: perPageForResponse,
        hasMore: false,
      };
    }
  }

  public async listMessagesByResourceId(
    args: StorageListMessagesByResourceIdInput,
  ): Promise<StorageListMessagesOutput> {
    const { resourceId, include, filter, perPage: perPageInput, page = 0, orderBy } = args;

    // Validate that resourceId is provided
    const hasResourceId = resourceId !== undefined && resourceId !== null && resourceId.trim() !== '';
    if (!hasResourceId) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_MESSAGES_BY_RESOURCE_ID', 'INVALID_QUERY'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: {
            resourceId: resourceId ?? '',
          },
        },
        new Error('resourceId is required'),
      );
    }

    // Validate page parameter
    if (page < 0) {
      throw new MastraError({
        id: createStorageErrorId('PG', 'LIST_MESSAGES_BY_RESOURCE_ID', 'INVALID_PAGE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Page number must be non-negative',
        details: {
          resourceId,
          page,
        },
      });
    }

    const perPage = normalizePerPage(perPageInput, 40);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      const { field, direction } = this.parseOrderBy(orderBy, 'ASC');
      const orderByStatement = `ORDER BY "${field}" ${direction}`;

      const selectStatement = `SELECT id, content, role, type, "createdAt", "createdAtZ", thread_id AS "threadId", "resourceId"`;
      const tableName = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.#schema) });

      // Build WHERE conditions
      const conditions: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      // Add resourceId filter
      conditions.push(`"resourceId" = $${paramIndex++}`);
      queryParams.push(resourceId);

      if (filter?.dateRange?.start) {
        const startOp = filter.dateRange.startExclusive ? '>' : '>=';
        conditions.push(`"createdAt" ${startOp} $${paramIndex++}`);
        queryParams.push(filter.dateRange.start);
      }

      if (filter?.dateRange?.end) {
        const endOp = filter.dateRange.endExclusive ? '<' : '<=';
        conditions.push(`"createdAt" ${endOp} $${paramIndex++}`);
        queryParams.push(filter.dateRange.end);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countQuery = `SELECT COUNT(*) FROM ${tableName} ${whereClause}`;
      const countResult = await this.#db.client.one(countQuery, queryParams);
      const total = parseInt(countResult.count, 10);

      const limitValue = perPageInput === false ? total : perPage;
      const dataQuery = `${selectStatement} FROM ${tableName} ${whereClause} ${orderByStatement} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      const rows = await this.#db.client.manyOrNone(dataQuery, [...queryParams, limitValue, offset]);
      const messages: MessageRowFromDB[] = [...(rows || [])];

      if (total === 0 && messages.length === 0 && (!include || include.length === 0)) {
        return {
          messages: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      const messageIds = new Set(messages.map(m => m.id));
      if (include && include.length > 0) {
        const includeMessages = await this._getIncludedMessages({ include });
        if (includeMessages) {
          for (const includeMsg of includeMessages) {
            if (!messageIds.has(includeMsg.id)) {
              messages.push(includeMsg);
              messageIds.add(includeMsg.id);
            }
          }
        }
      }

      const messagesWithParsedContent = messages.map(row => this.parseRow(row));

      const list = new MessageList().add(messagesWithParsedContent, 'memory');
      let finalMessages = list.get.all.db();

      finalMessages = finalMessages.sort((a, b) => {
        const aValue = field === 'createdAt' ? new Date(a.createdAt).getTime() : (a as any)[field];
        const bValue = field === 'createdAt' ? new Date(b.createdAt).getTime() : (b as any)[field];

        if (aValue == null && bValue == null) return a.id.localeCompare(b.id);
        if (aValue == null) return 1;
        if (bValue == null) return -1;

        if (aValue === bValue) {
          return a.id.localeCompare(b.id);
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return direction === 'ASC' ? aValue - bValue : bValue - aValue;
        }
        return direction === 'ASC'
          ? String(aValue).localeCompare(String(bValue))
          : String(bValue).localeCompare(String(aValue));
      });

      const hasMore = perPageInput !== false && offset + perPage < total;

      return {
        messages: finalMessages,
        total,
        page,
        perPage: perPageForResponse,
        hasMore,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_MESSAGES_BY_RESOURCE_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            resourceId: resourceId ?? '',
          },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException(mastraError);
      return {
        messages: [],
        total: 0,
        page,
        perPage: perPageForResponse,
        hasMore: false,
      };
    }
  }

  async saveMessages({ messages }: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (messages.length === 0) return { messages: [] };

    const threadId = messages[0]?.threadId;
    if (!threadId) {
      throw new MastraError({
        id: createStorageErrorId('PG', 'SAVE_MESSAGES', 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        text: `Thread ID is required`,
      });
    }

    const thread = await this.getThreadById({ threadId });
    if (!thread) {
      throw new MastraError({
        id: createStorageErrorId('PG', 'SAVE_MESSAGES', 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        text: `Thread ${threadId} not found`,
        details: {
          threadId,
        },
      });
    }

    try {
      const tableName = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.#schema) });
      await this.#db.client.tx(async t => {
        const messageInserts = messages.map(message => {
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
          return t.none(
            `INSERT INTO ${tableName} (id, thread_id, content, "createdAt", "createdAtZ", role, type, "resourceId")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET
              thread_id = EXCLUDED.thread_id,
              content = EXCLUDED.content,
              role = EXCLUDED.role,
              type = EXCLUDED.type,
              "resourceId" = EXCLUDED."resourceId"`,
            [
              message.id,
              message.threadId,
              typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
              message.createdAt || new Date().toISOString(),
              message.createdAt || new Date().toISOString(),
              message.role,
              message.type || 'v2',
              message.resourceId,
            ],
          );
        });

        const threadTableName = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.#schema) });
        const nowStr = new Date().toISOString();
        const threadUpdate = t.none(
          `UPDATE ${threadTableName}
                        SET
                            "updatedAt" = $1,
                            "updatedAtZ" = $2
                        WHERE id = $3
                    `,
          [nowStr, nowStr, threadId],
        );

        await Promise.all([...messageInserts, threadUpdate]);
      });

      const messagesWithParsedContent = messages.map(message => {
        if (typeof message.content === 'string') {
          try {
            return { ...message, content: JSON.parse(message.content) };
          } catch {
            return message;
          }
        }
        return message;
      });

      const list = new MessageList().add(messagesWithParsedContent as (MastraMessageV1 | MastraDBMessage)[], 'memory');
      return { messages: list.get.all.db() };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'SAVE_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId,
          },
        },
        error,
      );
    }
  }

  async updateMessages({
    messages,
  }: {
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & {
      id: string;
      content?: {
        metadata?: MastraMessageContentV2['metadata'];
        content?: MastraMessageContentV2['content'];
      };
    })[];
  }): Promise<MastraDBMessage[]> {
    if (messages.length === 0) {
      return [];
    }

    const messageIds = messages.map(m => m.id);

    const selectQuery = `SELECT id, content, role, type, "createdAt", "createdAtZ", thread_id AS "threadId", "resourceId" FROM ${getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.#schema) })} WHERE id IN (${inPlaceholders(messageIds.length)})`;

    const existingMessagesDb = await this.#db.client.manyOrNone(selectQuery, messageIds);

    if (existingMessagesDb.length === 0) {
      return [];
    }

    const existingMessages: MastraDBMessage[] = existingMessagesDb.map(msg => {
      if (typeof msg.content === 'string') {
        try {
          msg.content = JSON.parse(msg.content);
        } catch {
          // ignore if not valid json
        }
      }
      return msg as MastraDBMessage;
    });

    const threadIdsToUpdate = new Set<string>();

    await this.#db.client.tx(async t => {
      const queries = [];
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

        const setClauses: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        const updatableFields = { ...fieldsToUpdate };

        if (updatableFields.content) {
          const newContent = {
            ...existingMessage.content,
            ...updatableFields.content,
            ...(existingMessage.content?.metadata && updatableFields.content.metadata
              ? {
                  metadata: {
                    ...existingMessage.content.metadata,
                    ...updatableFields.content.metadata,
                  },
                }
              : {}),
          };
          setClauses.push(`content = $${paramIndex++}`);
          values.push(newContent);
          delete updatableFields.content;
        }

        for (const key in updatableFields) {
          if (Object.prototype.hasOwnProperty.call(updatableFields, key)) {
            const dbColumn = columnMapping[key] || key;
            setClauses.push(`"${dbColumn}" = $${paramIndex++}`);
            values.push(updatableFields[key as keyof typeof updatableFields]);
          }
        }

        if (setClauses.length > 0) {
          values.push(id);
          const sql = `UPDATE ${getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.#schema) })} SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`;
          queries.push(t.none(sql, values));
        }
      }

      if (threadIdsToUpdate.size > 0) {
        const threadIds = Array.from(threadIdsToUpdate);
        queries.push(
          t.none(
            `UPDATE ${getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.#schema) })} SET "updatedAt" = NOW(), "updatedAtZ" = NOW() WHERE id IN (${inPlaceholders(threadIds.length)})`,
            threadIds,
          ),
        );
      }

      if (queries.length > 0) {
        await t.batch(queries);
      }
    });

    const updatedMessages = await this.#db.client.manyOrNone<MessageRowFromDB>(selectQuery, messageIds);

    return (updatedMessages || []).map((row: MessageRowFromDB) => {
      const message = this.normalizeMessageRow(row);
      if (typeof message.content === 'string') {
        try {
          return { ...message, content: JSON.parse(message.content) } as MastraDBMessage;
        } catch {
          /* ignore */
        }
      }
      return message as MastraDBMessage;
    });
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    if (!messageIds || messageIds.length === 0) {
      return;
    }

    try {
      const messageTableName = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.#schema) });
      const threadTableName = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.#schema) });

      await this.#db.client.tx(async t => {
        const placeholders = messageIds.map((_, idx) => `$${idx + 1}`).join(',');
        const messages = await t.manyOrNone(
          `SELECT DISTINCT thread_id FROM ${messageTableName} WHERE id IN (${placeholders})`,
          messageIds,
        );

        const threadIds = messages?.map(msg => msg.thread_id).filter(Boolean) || [];

        await t.none(`DELETE FROM ${messageTableName} WHERE id IN (${placeholders})`, messageIds);

        if (threadIds.length > 0) {
          const updatePromises = threadIds.map(threadId =>
            t.none(`UPDATE ${threadTableName} SET "updatedAt" = NOW(), "updatedAtZ" = NOW() WHERE id = $1`, [threadId]),
          );
          await Promise.all(updatePromises);
        }
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_MESSAGES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { messageIds: messageIds.join(', ') },
        },
        error,
      );
    }
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    const tableName = getTableName({ indexName: TABLE_RESOURCES, schemaName: getSchemaName(this.#schema) });
    const result = await this.#db.client.oneOrNone<StorageResourceType & { createdAtZ: Date; updatedAtZ: Date }>(
      `SELECT * FROM ${tableName} WHERE id = $1`,
      [resourceId],
    );

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      createdAt: result.createdAtZ || result.createdAt,
      updatedAt: result.updatedAtZ || result.updatedAt,
      workingMemory: result.workingMemory,
      metadata: typeof result.metadata === 'string' ? JSON.parse(result.metadata) : result.metadata,
    };
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    await this.#db.insert({
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

    const tableName = getTableName({ indexName: TABLE_RESOURCES, schemaName: getSchemaName(this.#schema) });

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (workingMemory !== undefined) {
      updates.push(`"workingMemory" = $${paramIndex}`);
      values.push(workingMemory);
      paramIndex++;
    }

    if (metadata) {
      updates.push(`metadata = $${paramIndex}`);
      values.push(JSON.stringify(updatedResource.metadata));
      paramIndex++;
    }

    const updatedAtStr = updatedResource.updatedAt.toISOString();
    updates.push(`"updatedAt" = $${paramIndex++}`);
    values.push(updatedAtStr);
    updates.push(`"updatedAtZ" = $${paramIndex++}`);
    values.push(updatedAtStr);

    values.push(resourceId);

    await this.#db.client.none(`UPDATE ${tableName} SET ${updates.join(', ')} WHERE id = $${paramIndex}`, values);

    return updatedResource;
  }

  async cloneThread(args: StorageCloneThreadInput): Promise<StorageCloneThreadOutput> {
    const { sourceThreadId, newThreadId: providedThreadId, resourceId, title, metadata, options } = args;

    // Get the source thread
    const sourceThread = await this.getThreadById({ threadId: sourceThreadId });
    if (!sourceThread) {
      throw new MastraError({
        id: createStorageErrorId('PG', 'CLONE_THREAD', 'SOURCE_NOT_FOUND'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Source thread with id ${sourceThreadId} not found`,
        details: { sourceThreadId },
      });
    }

    // Use provided ID or generate a new one
    const newThreadId = providedThreadId || crypto.randomUUID();

    // Check if the new thread ID already exists
    const existingThread = await this.getThreadById({ threadId: newThreadId });
    if (existingThread) {
      throw new MastraError({
        id: createStorageErrorId('PG', 'CLONE_THREAD', 'THREAD_EXISTS'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Thread with id ${newThreadId} already exists`,
        details: { newThreadId },
      });
    }

    const threadTableName = getTableName({ indexName: TABLE_THREADS, schemaName: getSchemaName(this.#schema) });
    const messageTableName = getTableName({ indexName: TABLE_MESSAGES, schemaName: getSchemaName(this.#schema) });

    try {
      return await this.#db.client.tx(async t => {
        // Build message query with filters
        let messageQuery = `SELECT id, content, role, type, "createdAt", "createdAtZ", thread_id AS "threadId", "resourceId"
                            FROM ${messageTableName} WHERE thread_id = $1`;
        const messageParams: any[] = [sourceThreadId];
        let paramIndex = 2;

        // Apply date filters
        if (options?.messageFilter?.startDate) {
          messageQuery += ` AND COALESCE("createdAtZ", "createdAt") >= $${paramIndex++}`;
          messageParams.push(options.messageFilter.startDate);
        }
        if (options?.messageFilter?.endDate) {
          messageQuery += ` AND COALESCE("createdAtZ", "createdAt") <= $${paramIndex++}`;
          messageParams.push(options.messageFilter.endDate);
        }

        // Apply message ID filter
        if (options?.messageFilter?.messageIds && options.messageFilter.messageIds.length > 0) {
          messageQuery += ` AND id IN (${options.messageFilter.messageIds.map(() => `$${paramIndex++}`).join(', ')})`;
          messageParams.push(...options.messageFilter.messageIds);
        }

        messageQuery += ` ORDER BY "createdAt" ASC`;

        // Apply message limit (from most recent, so we need to reverse order for limit then sort back)
        if (options?.messageLimit && options.messageLimit > 0) {
          // Get messages ordered DESC to get most recent, limited, then we'll reverse
          const limitQuery = `SELECT * FROM (${messageQuery.replace('ORDER BY "createdAt" ASC', 'ORDER BY "createdAt" DESC')} LIMIT $${paramIndex}) AS limited ORDER BY "createdAt" ASC`;
          messageParams.push(options.messageLimit);
          messageQuery = limitQuery;
        }

        const sourceMessages = await t.manyOrNone<MessageRowFromDB>(messageQuery, messageParams);

        const now = new Date();

        // Determine the last message ID for clone metadata
        const lastMessageId = sourceMessages.length > 0 ? sourceMessages[sourceMessages.length - 1]!.id : undefined;

        // Create clone metadata
        const cloneMetadata: ThreadCloneMetadata = {
          sourceThreadId,
          clonedAt: now,
          ...(lastMessageId && { lastMessageId }),
        };

        // Create the new thread
        const newThread: StorageThreadType = {
          id: newThreadId,
          resourceId: resourceId || sourceThread.resourceId,
          title: title || (sourceThread.title ? `Clone of ${sourceThread.title}` : ''),
          metadata: {
            ...metadata,
            clone: cloneMetadata,
          },
          createdAt: now,
          updatedAt: now,
        };

        // Insert the new thread
        await t.none(
          `INSERT INTO ${threadTableName} (
            id,
            "resourceId",
            title,
            metadata,
            "createdAt",
            "createdAtZ",
            "updatedAt",
            "updatedAtZ"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            newThread.id,
            newThread.resourceId,
            newThread.title,
            newThread.metadata ? JSON.stringify(newThread.metadata) : null,
            now,
            now,
            now,
            now,
          ],
        );

        // Clone messages with new IDs
        const clonedMessages: MastraDBMessage[] = [];
        const targetResourceId = resourceId || sourceThread.resourceId;

        for (const sourceMsg of sourceMessages) {
          const newMessageId = crypto.randomUUID();
          const normalizedMsg = this.normalizeMessageRow(sourceMsg);
          let parsedContent = normalizedMsg.content;
          try {
            parsedContent = JSON.parse(normalizedMsg.content);
          } catch {
            // use content as is
          }

          await t.none(
            `INSERT INTO ${messageTableName} (id, thread_id, content, "createdAt", "createdAtZ", role, type, "resourceId")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              newMessageId,
              newThreadId,
              typeof normalizedMsg.content === 'string' ? normalizedMsg.content : JSON.stringify(normalizedMsg.content),
              normalizedMsg.createdAt,
              normalizedMsg.createdAt,
              normalizedMsg.role,
              normalizedMsg.type || 'v2',
              targetResourceId,
            ],
          );

          clonedMessages.push({
            id: newMessageId,
            threadId: newThreadId,
            content: parsedContent,
            role: normalizedMsg.role as MastraDBMessage['role'],
            type: normalizedMsg.type,
            createdAt: new Date(normalizedMsg.createdAt as string),
            resourceId: targetResourceId,
          });
        }

        return {
          thread: newThread,
          clonedMessages,
        };
      });
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'CLONE_THREAD', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { sourceThreadId, newThreadId },
        },
        error,
      );
    }
  }

  // ============================================
  // Observational Memory Methods
  // ============================================

  private getOMKey(threadId: string | null, resourceId: string): string {
    return threadId ? `thread:${threadId}` : `resource:${resourceId}`;
  }

  private parseOMRow(row: any): ObservationalMemoryRecord {
    // OM is a new table - use timezone-aware columns (*Z) directly (no legacy fallback needed)
    return {
      id: row.id,
      scope: row.scope,
      threadId: row.threadId || null,
      resourceId: row.resourceId,
      createdAt: new Date(row.createdAtZ),
      updatedAt: new Date(row.updatedAtZ),
      lastObservedAt: row.lastObservedAtZ ? new Date(row.lastObservedAtZ) : undefined,
      originType: row.originType || 'initial',
      generationCount: Number(row.generationCount || 0),
      activeObservations: row.activeObservations || '',
      // Handle new chunk-based structure
      bufferedObservationChunks: row.bufferedObservationChunks
        ? typeof row.bufferedObservationChunks === 'string'
          ? JSON.parse(row.bufferedObservationChunks)
          : row.bufferedObservationChunks
        : undefined,
      // Deprecated fields (for backward compatibility)
      bufferedObservations: row.activeObservationsPendingUpdate || undefined,
      bufferedObservationTokens: row.bufferedObservationTokens ? Number(row.bufferedObservationTokens) : undefined,
      bufferedMessageIds: undefined, // Use bufferedObservationChunks instead
      bufferedReflection: row.bufferedReflection || undefined,
      bufferedReflectionTokens: row.bufferedReflectionTokens ? Number(row.bufferedReflectionTokens) : undefined,
      bufferedReflectionInputTokens: row.bufferedReflectionInputTokens
        ? Number(row.bufferedReflectionInputTokens)
        : undefined,
      reflectedObservationLineCount: row.reflectedObservationLineCount
        ? Number(row.reflectedObservationLineCount)
        : undefined,
      totalTokensObserved: Number(row.totalTokensObserved || 0),
      observationTokenCount: Number(row.observationTokenCount || 0),
      pendingMessageTokens: Number(row.pendingMessageTokens || 0),
      isReflecting: Boolean(row.isReflecting),
      isObserving: Boolean(row.isObserving),
      isBufferingObservation: row.isBufferingObservation === true || row.isBufferingObservation === 'true',
      isBufferingReflection: row.isBufferingReflection === true || row.isBufferingReflection === 'true',
      lastBufferedAtTokens:
        typeof row.lastBufferedAtTokens === 'number'
          ? row.lastBufferedAtTokens
          : parseInt(String(row.lastBufferedAtTokens ?? '0'), 10) || 0,
      lastBufferedAtTime: row.lastBufferedAtTime ? new Date(String(row.lastBufferedAtTime)) : null,
      config: row.config ? (typeof row.config === 'string' ? JSON.parse(row.config) : row.config) : {},
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : undefined,
      observedMessageIds: row.observedMessageIds
        ? typeof row.observedMessageIds === 'string'
          ? JSON.parse(row.observedMessageIds)
          : row.observedMessageIds
        : undefined,
      observedTimezone: row.observedTimezone || undefined,
    };
  }

  async getObservationalMemory(threadId: string | null, resourceId: string): Promise<ObservationalMemoryRecord | null> {
    try {
      const lookupKey = this.getOMKey(threadId, resourceId);
      const tableName = getTableName({
        indexName: OM_TABLE,
        schemaName: getSchemaName(this.#schema),
      });
      const result = await this.#db.client.oneOrNone(
        `SELECT * FROM ${tableName} WHERE "lookupKey" = $1 ORDER BY "generationCount" DESC LIMIT 1`,
        [lookupKey],
      );
      if (!result) return null;
      return this.parseOMRow(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_OBSERVATIONAL_MEMORY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId, resourceId },
        },
        error,
      );
    }
  }

  async getObservationalMemoryHistory(
    threadId: string | null,
    resourceId: string,
    limit: number = 10,
  ): Promise<ObservationalMemoryRecord[]> {
    try {
      const lookupKey = this.getOMKey(threadId, resourceId);
      const tableName = getTableName({
        indexName: OM_TABLE,
        schemaName: getSchemaName(this.#schema),
      });
      const result = await this.#db.client.manyOrNone(
        `SELECT * FROM ${tableName} WHERE "lookupKey" = $1 ORDER BY "generationCount" DESC LIMIT $2`,
        [lookupKey, limit],
      );
      if (!result) return [];
      return result.map(row => this.parseOMRow(row));
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_OBSERVATIONAL_MEMORY_HISTORY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId, resourceId, limit },
        },
        error,
      );
    }
  }

  async initializeObservationalMemory(input: CreateObservationalMemoryInput): Promise<ObservationalMemoryRecord> {
    try {
      const id = crypto.randomUUID();
      const now = new Date();
      const lookupKey = this.getOMKey(input.threadId, input.resourceId);

      const record: ObservationalMemoryRecord = {
        id,
        scope: input.scope,
        threadId: input.threadId,
        resourceId: input.resourceId,
        createdAt: now,
        updatedAt: now,
        lastObservedAt: undefined,
        originType: 'initial',
        generationCount: 0,
        activeObservations: '',
        totalTokensObserved: 0,
        observationTokenCount: 0,
        pendingMessageTokens: 0,
        isReflecting: false,
        isObserving: false,
        isBufferingObservation: false,
        isBufferingReflection: false,
        lastBufferedAtTokens: 0,
        lastBufferedAtTime: null,
        config: input.config,
        observedTimezone: input.observedTimezone,
      };

      const tableName = getTableName({
        indexName: OM_TABLE,
        schemaName: getSchemaName(this.#schema),
      });
      const nowStr = now.toISOString();
      await this.#db.client.none(
        `INSERT INTO ${tableName} (
          id, "lookupKey", scope, "resourceId", "threadId",
          "activeObservations", "activeObservationsPendingUpdate",
          "originType", config, "generationCount", "lastObservedAt", "lastObservedAtZ", "lastReflectionAt", "lastReflectionAtZ",
          "pendingMessageTokens", "totalTokensObserved", "observationTokenCount",
          "isObserving", "isReflecting", "isBufferingObservation", "isBufferingReflection", "lastBufferedAtTokens", "lastBufferedAtTime",
          "observedTimezone", "createdAt", "createdAtZ", "updatedAt", "updatedAtZ"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)`,
        [
          id,
          lookupKey,
          input.scope,
          input.resourceId,
          input.threadId || null,
          '',
          null,
          'initial',
          JSON.stringify(input.config),
          0,
          null, // lastObservedAt
          null, // lastObservedAtZ
          null, // lastReflectionAt
          null, // lastReflectionAtZ
          0,
          0,
          0,
          false,
          false,
          false, // isBufferingObservation
          false, // isBufferingReflection
          0, // lastBufferedAtTokens
          null, // lastBufferedAtTime
          input.observedTimezone || null,
          nowStr, // createdAt
          nowStr, // createdAtZ
          nowStr, // updatedAt
          nowStr, // updatedAtZ
        ],
      );

      return record;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'INITIALIZE_OBSERVATIONAL_MEMORY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId: input.threadId, resourceId: input.resourceId },
        },
        error,
      );
    }
  }

  async updateActiveObservations(input: UpdateActiveObservationsInput): Promise<void> {
    try {
      const now = new Date();
      const tableName = getTableName({
        indexName: OM_TABLE,
        schemaName: getSchemaName(this.#schema),
      });

      const lastObservedAtStr = input.lastObservedAt.toISOString();
      const nowStr = now.toISOString();
      const observedMessageIdsJson = input.observedMessageIds ? JSON.stringify(input.observedMessageIds) : null;
      const result = await this.#db.client.query(
        `UPDATE ${tableName} SET
          "activeObservations" = $1,
          "lastObservedAt" = $2,
          "lastObservedAtZ" = $3,
          "pendingMessageTokens" = 0,
          "observationTokenCount" = $4,
          "totalTokensObserved" = "totalTokensObserved" + $5,
          "observedMessageIds" = $6,
          "updatedAt" = $7,
          "updatedAtZ" = $8
        WHERE id = $9`,
        [
          input.observations,
          lastObservedAtStr,
          lastObservedAtStr,
          Math.round(input.tokenCount),
          Math.round(input.tokenCount),
          observedMessageIdsJson,
          nowStr,
          nowStr,
          input.id,
        ],
      );

      if (result.rowCount === 0) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'UPDATE_ACTIVE_OBSERVATIONS', 'NOT_FOUND'),
          text: `Observational memory record not found: ${input.id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        });
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UPDATE_ACTIVE_OBSERVATIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        },
        error,
      );
    }
  }

  async createReflectionGeneration(input: CreateReflectionGenerationInput): Promise<ObservationalMemoryRecord> {
    try {
      const id = crypto.randomUUID();
      const now = new Date();
      const lookupKey = this.getOMKey(input.currentRecord.threadId, input.currentRecord.resourceId);

      const record: ObservationalMemoryRecord = {
        id,
        scope: input.currentRecord.scope,
        threadId: input.currentRecord.threadId,
        resourceId: input.currentRecord.resourceId,
        createdAt: now,
        updatedAt: now,
        lastObservedAt: input.currentRecord.lastObservedAt,
        originType: 'reflection',
        generationCount: input.currentRecord.generationCount + 1,
        activeObservations: input.reflection,
        totalTokensObserved: input.currentRecord.totalTokensObserved,
        observationTokenCount: input.tokenCount,
        pendingMessageTokens: 0,
        isReflecting: false,
        isObserving: false,
        isBufferingObservation: false,
        isBufferingReflection: false,
        lastBufferedAtTokens: 0,
        lastBufferedAtTime: null,
        config: input.currentRecord.config,
        metadata: input.currentRecord.metadata,
        observedTimezone: input.currentRecord.observedTimezone,
      };

      const tableName = getTableName({
        indexName: OM_TABLE,
        schemaName: getSchemaName(this.#schema),
      });
      const nowStr = now.toISOString();
      const lastObservedAtStr = record.lastObservedAt?.toISOString() || null;
      await this.#db.client.none(
        `INSERT INTO ${tableName} (
          id, "lookupKey", scope, "resourceId", "threadId",
          "activeObservations", "activeObservationsPendingUpdate",
          "originType", config, "generationCount", "lastObservedAt", "lastObservedAtZ", "lastReflectionAt", "lastReflectionAtZ",
          "pendingMessageTokens", "totalTokensObserved", "observationTokenCount",
          "isObserving", "isReflecting", "isBufferingObservation", "isBufferingReflection", "lastBufferedAtTokens", "lastBufferedAtTime",
          "observedTimezone", "createdAt", "createdAtZ", "updatedAt", "updatedAtZ"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)`,
        [
          id,
          lookupKey,
          record.scope,
          record.resourceId,
          record.threadId || null,
          input.reflection,
          null,
          'reflection',
          JSON.stringify(record.config),
          input.currentRecord.generationCount + 1,
          lastObservedAtStr, // lastObservedAt
          lastObservedAtStr, // lastObservedAtZ
          nowStr, // lastReflectionAt
          nowStr, // lastReflectionAtZ
          record.pendingMessageTokens,
          Math.round(record.totalTokensObserved),
          Math.round(record.observationTokenCount),
          false, // isObserving
          false, // isReflecting
          false, // isBufferingObservation
          false, // isBufferingReflection
          0, // lastBufferedAtTokens
          null, // lastBufferedAtTime
          record.observedTimezone || null,
          nowStr, // createdAt
          nowStr, // createdAtZ
          nowStr, // updatedAt
          nowStr, // updatedAtZ
        ],
      );

      return record;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'CREATE_REFLECTION_GENERATION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { currentRecordId: input.currentRecord.id },
        },
        error,
      );
    }
  }

  async setReflectingFlag(id: string, isReflecting: boolean): Promise<void> {
    try {
      const tableName = getTableName({
        indexName: OM_TABLE,
        schemaName: getSchemaName(this.#schema),
      });
      const nowStr = new Date().toISOString();
      const result = await this.#db.client.query(
        `UPDATE ${tableName} SET "isReflecting" = $1, "updatedAt" = $2, "updatedAtZ" = $3 WHERE id = $4`,
        [isReflecting, nowStr, nowStr, id],
      );

      if (result.rowCount === 0) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'SET_REFLECTING_FLAG', 'NOT_FOUND'),
          text: `Observational memory record not found: ${id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, isReflecting },
        });
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'SET_REFLECTING_FLAG', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, isReflecting },
        },
        error,
      );
    }
  }

  async setObservingFlag(id: string, isObserving: boolean): Promise<void> {
    try {
      const tableName = getTableName({
        indexName: OM_TABLE,
        schemaName: getSchemaName(this.#schema),
      });
      const nowStr = new Date().toISOString();
      const result = await this.#db.client.query(
        `UPDATE ${tableName} SET "isObserving" = $1, "updatedAt" = $2, "updatedAtZ" = $3 WHERE id = $4`,
        [isObserving, nowStr, nowStr, id],
      );

      if (result.rowCount === 0) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'SET_OBSERVING_FLAG', 'NOT_FOUND'),
          text: `Observational memory record not found: ${id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, isObserving },
        });
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'SET_OBSERVING_FLAG', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, isObserving },
        },
        error,
      );
    }
  }

  async setBufferingObservationFlag(id: string, isBuffering: boolean, lastBufferedAtTokens?: number): Promise<void> {
    try {
      const tableName = getTableName({
        indexName: OM_TABLE,
        schemaName: getSchemaName(this.#schema),
      });
      const nowStr = new Date().toISOString();

      let query: string;
      let values: any[];

      if (lastBufferedAtTokens !== undefined) {
        query = `UPDATE ${tableName} SET "isBufferingObservation" = $1, "lastBufferedAtTokens" = $2, "updatedAt" = $3, "updatedAtZ" = $4 WHERE id = $5`;
        values = [isBuffering, Math.round(lastBufferedAtTokens), nowStr, nowStr, id];
      } else {
        query = `UPDATE ${tableName} SET "isBufferingObservation" = $1, "updatedAt" = $2, "updatedAtZ" = $3 WHERE id = $4`;
        values = [isBuffering, nowStr, nowStr, id];
      }

      const result = await this.#db.client.query(query, values);

      if (result.rowCount === 0) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'SET_BUFFERING_OBSERVATION_FLAG', 'NOT_FOUND'),
          text: `Observational memory record not found: ${id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, isBuffering, lastBufferedAtTokens: lastBufferedAtTokens ?? null },
        });
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'SET_BUFFERING_OBSERVATION_FLAG', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, isBuffering, lastBufferedAtTokens: lastBufferedAtTokens ?? null },
        },
        error,
      );
    }
  }

  async setBufferingReflectionFlag(id: string, isBuffering: boolean): Promise<void> {
    try {
      const tableName = getTableName({
        indexName: OM_TABLE,
        schemaName: getSchemaName(this.#schema),
      });
      const nowStr = new Date().toISOString();
      const result = await this.#db.client.query(
        `UPDATE ${tableName} SET "isBufferingReflection" = $1, "updatedAt" = $2, "updatedAtZ" = $3 WHERE id = $4`,
        [isBuffering, nowStr, nowStr, id],
      );

      if (result.rowCount === 0) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'SET_BUFFERING_REFLECTION_FLAG', 'NOT_FOUND'),
          text: `Observational memory record not found: ${id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, isBuffering },
        });
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'SET_BUFFERING_REFLECTION_FLAG', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, isBuffering },
        },
        error,
      );
    }
  }

  async clearObservationalMemory(threadId: string | null, resourceId: string): Promise<void> {
    try {
      const lookupKey = this.getOMKey(threadId, resourceId);
      const tableName = getTableName({
        indexName: OM_TABLE,
        schemaName: getSchemaName(this.#schema),
      });
      await this.#db.client.none(`DELETE FROM ${tableName} WHERE "lookupKey" = $1`, [lookupKey]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'CLEAR_OBSERVATIONAL_MEMORY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId, resourceId },
        },
        error,
      );
    }
  }

  async setPendingMessageTokens(id: string, tokenCount: number): Promise<void> {
    try {
      const tableName = getTableName({
        indexName: OM_TABLE,
        schemaName: getSchemaName(this.#schema),
      });
      const nowStr = new Date().toISOString();
      const result = await this.#db.client.query(
        `UPDATE ${tableName} SET 
          "pendingMessageTokens" = $1, 
          "updatedAt" = $2,
          "updatedAtZ" = $3
        WHERE id = $4`,
        [Math.round(tokenCount), nowStr, nowStr, id],
      );

      if (result.rowCount === 0) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'SET_PENDING_MESSAGE_TOKENS', 'NOT_FOUND'),
          text: `Observational memory record not found: ${id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, tokenCount },
        });
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'SET_PENDING_MESSAGE_TOKENS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id, tokenCount },
        },
        error,
      );
    }
  }

  // ============================================
  // Async Buffering Methods
  // ============================================

  async updateBufferedObservations(input: UpdateBufferedObservationsInput): Promise<void> {
    try {
      const tableName = getTableName({
        indexName: OM_TABLE,
        schemaName: getSchemaName(this.#schema),
      });
      const nowStr = new Date().toISOString();

      // Create new chunk with ID and timestamp
      const newChunk: BufferedObservationChunk = {
        id: `ombuf-${randomUUID()}`,
        cycleId: input.chunk.cycleId,
        observations: input.chunk.observations,
        tokenCount: Math.round(input.chunk.tokenCount),
        messageIds: input.chunk.messageIds,
        messageTokens: Math.round(input.chunk.messageTokens ?? 0),
        lastObservedAt: input.chunk.lastObservedAt,
        createdAt: new Date(),
        suggestedContinuation: input.chunk.suggestedContinuation,
        currentTask: input.chunk.currentTask,
      };

      // Append chunk to existing array using JSONB concatenation
      const lastBufferedAtTime = input.lastBufferedAtTime ? input.lastBufferedAtTime.toISOString() : null;
      const result = await this.#db.client.query(
        `UPDATE ${tableName} SET
          "bufferedObservationChunks" = COALESCE("bufferedObservationChunks", '[]'::jsonb) || $1::jsonb,
          "lastBufferedAtTime" = COALESCE($2, "lastBufferedAtTime"),
          "updatedAt" = $3,
          "updatedAtZ" = $4
        WHERE id = $5`,
        [JSON.stringify([newChunk]), lastBufferedAtTime, nowStr, nowStr, input.id],
      );

      if (result.rowCount === 0) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'UPDATE_BUFFERED_OBSERVATIONS', 'NOT_FOUND'),
          text: `Observational memory record not found: ${input.id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        });
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UPDATE_BUFFERED_OBSERVATIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        },
        error,
      );
    }
  }

  async swapBufferedToActive(input: SwapBufferedToActiveInput): Promise<SwapBufferedToActiveResult> {
    try {
      const tableName = getTableName({
        indexName: OM_TABLE,
        schemaName: getSchemaName(this.#schema),
      });
      const nowStr = new Date().toISOString();

      // Get current record
      const record = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE id = $1`, [input.id]);
      if (!record) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'SWAP_BUFFERED_TO_ACTIVE', 'NOT_FOUND'),
          text: `Observational memory record not found: ${input.id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        });
      }

      // Parse buffered chunks
      let chunks: BufferedObservationChunk[] = [];
      if (record.bufferedObservationChunks) {
        try {
          const parsed =
            typeof record.bufferedObservationChunks === 'string'
              ? JSON.parse(record.bufferedObservationChunks)
              : record.bufferedObservationChunks;
          chunks = Array.isArray(parsed) ? parsed : [];
        } catch {
          chunks = [];
        }
      }

      if (chunks.length === 0) {
        return {
          chunksActivated: 0,
          messageTokensActivated: 0,
          observationTokensActivated: 0,
          messagesActivated: 0,
          activatedCycleIds: [],
          activatedMessageIds: [],
        };
      }

      // Calculate target message tokens to activate based on new formula:
      // retentionFloor = threshold * (1 - ratio) represents tokens to keep as raw messages
      // targetMessageTokens = max(0, currentPending - retentionFloor) represents tokens to activate
      const retentionFloor = input.messageTokensThreshold * (1 - input.activationRatio);
      const targetMessageTokens = Math.max(0, input.currentPendingTokens - retentionFloor);

      // Find the closest chunk boundary to the target, biased over (prefer removing
      // slightly more than the target so remaining context lands at or below retentionFloor).
      // Track both best-over and best-under boundaries so we can fall back to under
      // if the over boundary would overshoot by too much.
      let cumulativeMessageTokens = 0;
      let chunksToActivate = 0;
      let bestOverBoundary = 0;
      let bestOverTokens = 0;
      let bestUnderBoundary = 0;
      let bestUnderTokens = 0;

      for (let i = 0; i < chunks.length; i++) {
        cumulativeMessageTokens += chunks[i]!.messageTokens ?? 0;
        const boundary = i + 1;

        if (cumulativeMessageTokens >= targetMessageTokens) {
          // Over or equal — track the closest (lowest) over boundary
          if (bestOverBoundary === 0 || cumulativeMessageTokens < bestOverTokens) {
            bestOverBoundary = boundary;
            bestOverTokens = cumulativeMessageTokens;
          }
        } else {
          // Under — track the closest (highest) under boundary
          if (cumulativeMessageTokens > bestUnderTokens) {
            bestUnderBoundary = boundary;
            bestUnderTokens = cumulativeMessageTokens;
          }
        }
      }

      // Safeguard: if the over boundary would eat into more than 95% of the
      // retention floor, fall back to the best under boundary instead.
      // This prevents edge cases where a large chunk overshoots dramatically.
      // When forceMaxActivation is set (above blockAfter), still prefer the over
      // boundary, but never if it would leave fewer than the smaller of 1000
      // tokens or the retention floor remaining.
      const maxOvershoot = retentionFloor * 0.95;
      const overshoot = bestOverTokens - targetMessageTokens;
      const remainingAfterOver = input.currentPendingTokens - bestOverTokens;
      const remainingAfterUnder = input.currentPendingTokens - bestUnderTokens;
      // When activationRatio ≈ 1.0, retentionFloor is 0 and minRemaining becomes 0 — intentional for "activate everything" configs.
      const minRemaining = Math.min(1000, retentionFloor);

      if (input.forceMaxActivation && bestOverBoundary > 0 && remainingAfterOver >= minRemaining) {
        chunksToActivate = bestOverBoundary;
      } else if (bestOverBoundary > 0 && overshoot <= maxOvershoot && remainingAfterOver >= minRemaining) {
        chunksToActivate = bestOverBoundary;
      } else if (bestUnderBoundary > 0 && remainingAfterUnder >= minRemaining) {
        chunksToActivate = bestUnderBoundary;
      } else if (bestOverBoundary > 0) {
        // All boundaries are over and exceed the safeguard — still activate
        // the closest over boundary (better than nothing)
        chunksToActivate = bestOverBoundary;
      } else {
        chunksToActivate = 1;
      }

      // Split chunks
      const activatedChunks = chunks.slice(0, chunksToActivate);
      const remainingChunks = chunks.slice(chunksToActivate);

      // Combine activated observations
      const activatedContent = activatedChunks.map(c => c.observations).join('\n\n');
      const activatedTokens = Math.round(activatedChunks.reduce((sum, c) => sum + c.tokenCount, 0));
      const activatedMessageTokens = Math.round(activatedChunks.reduce((sum, c) => sum + (c.messageTokens ?? 0), 0));
      const activatedMessageCount = activatedChunks.reduce((sum, c) => sum + c.messageIds.length, 0);
      const activatedCycleIds = activatedChunks.map(c => c.cycleId).filter((id): id is string => !!id);
      const activatedMessageIds = activatedChunks.flatMap(c => c.messageIds ?? []);

      // Derive lastObservedAt from the latest activated chunk, or use provided value
      const latestChunk = activatedChunks[activatedChunks.length - 1];
      const lastObservedAt =
        input.lastObservedAt ?? (latestChunk?.lastObservedAt ? new Date(latestChunk.lastObservedAt) : new Date());
      const lastObservedAtStr = lastObservedAt.toISOString();

      // NOTE: We intentionally do NOT add message IDs to observedMessageIds during buffered activation.
      // Buffered chunks represent observations of messages as they were at buffering time.
      // With streaming, messages grow after buffering, so we rely on lastObservedAt for filtering.
      // New content after lastObservedAt will be picked up in subsequent observations.

      // Atomic update
      await this.#db.client.query(
        `UPDATE ${tableName} SET
          "activeObservations" = CASE 
            WHEN "activeObservations" IS NOT NULL AND "activeObservations" != '' 
            THEN "activeObservations" || E'\\n\\n' || $1
            ELSE $1
          END,
          "observationTokenCount" = COALESCE("observationTokenCount", 0) + $2,
          "pendingMessageTokens" = GREATEST(0, COALESCE("pendingMessageTokens", 0) - $3),
          "bufferedObservationChunks" = $4,
          "lastObservedAt" = $5,
          "lastObservedAtZ" = $6,
          "updatedAt" = $7,
          "updatedAtZ" = $8
        WHERE id = $9`,
        [
          activatedContent,
          activatedTokens,
          activatedMessageTokens,
          remainingChunks.length > 0 ? JSON.stringify(remainingChunks) : null,
          lastObservedAtStr,
          lastObservedAtStr,
          nowStr,
          nowStr,
          input.id,
        ],
      );

      // Use hints from the most recent activated chunk only — stale hints from older chunks are discarded
      const latestChunkHints = activatedChunks[activatedChunks.length - 1];

      return {
        chunksActivated: activatedChunks.length,
        messageTokensActivated: activatedMessageTokens,
        observationTokensActivated: activatedTokens,
        messagesActivated: activatedMessageCount,
        activatedCycleIds,
        activatedMessageIds,
        observations: activatedContent,
        perChunk: activatedChunks.map(c => ({
          cycleId: c.cycleId ?? '',
          messageTokens: c.messageTokens ?? 0,
          observationTokens: c.tokenCount,
          messageCount: c.messageIds.length,
          observations: c.observations,
        })),
        suggestedContinuation: latestChunkHints?.suggestedContinuation ?? undefined,
        currentTask: latestChunkHints?.currentTask ?? undefined,
      };
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'SWAP_BUFFERED_TO_ACTIVE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        },
        error,
      );
    }
  }

  async updateBufferedReflection(input: UpdateBufferedReflectionInput): Promise<void> {
    try {
      const tableName = getTableName({
        indexName: OM_TABLE,
        schemaName: getSchemaName(this.#schema),
      });
      const nowStr = new Date().toISOString();

      // Append reflection to existing buffered content
      const result = await this.#db.client.query(
        `UPDATE ${tableName} SET
          "bufferedReflection" = CASE 
            WHEN "bufferedReflection" IS NOT NULL AND "bufferedReflection" != '' 
            THEN "bufferedReflection" || E'\\n\\n' || $1
            ELSE $1
          END,
          "bufferedReflectionTokens" = COALESCE("bufferedReflectionTokens", 0) + $2,
          "bufferedReflectionInputTokens" = COALESCE("bufferedReflectionInputTokens", 0) + $3,
          "reflectedObservationLineCount" = $4,
          "updatedAt" = $5,
          "updatedAtZ" = $6
        WHERE id = $7`,
        [
          input.reflection,
          Math.round(input.tokenCount),
          Math.round(input.inputTokenCount),
          input.reflectedObservationLineCount,
          nowStr,
          nowStr,
          input.id,
        ],
      );

      if (result.rowCount === 0) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'UPDATE_BUFFERED_REFLECTION', 'NOT_FOUND'),
          text: `Observational memory record not found: ${input.id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        });
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UPDATE_BUFFERED_REFLECTION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        },
        error,
      );
    }
  }

  async swapBufferedReflectionToActive(input: SwapBufferedReflectionToActiveInput): Promise<ObservationalMemoryRecord> {
    try {
      const tableName = getTableName({
        indexName: OM_TABLE,
        schemaName: getSchemaName(this.#schema),
      });

      // Get current record to calculate split
      const record = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE id = $1`, [
        input.currentRecord.id,
      ]);
      if (!record) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'SWAP_BUFFERED_REFLECTION_TO_ACTIVE', 'NOT_FOUND'),
          text: `Observational memory record not found: ${input.currentRecord.id}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.currentRecord.id },
        });
      }

      const bufferedReflection = record.bufferedReflection || '';
      const reflectedLineCount = Number(record.reflectedObservationLineCount || 0);

      if (!bufferedReflection) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'SWAP_BUFFERED_REFLECTION_TO_ACTIVE', 'NO_CONTENT'),
          text: 'No buffered reflection to swap',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { id: input.currentRecord.id },
        });
      }

      // Split current activeObservations by the recorded boundary.
      // Lines 0..reflectedLineCount were reflected on → replaced by bufferedReflection.
      // Lines after reflectedLineCount were added after reflection started → kept as-is.
      const currentObservations = (record.activeObservations as string) || '';
      const allLines = currentObservations.split('\n');
      const unreflectedLines = allLines.slice(reflectedLineCount);
      const unreflectedContent = unreflectedLines.join('\n').trim();

      // New activeObservations = bufferedReflection + unreflected observations
      const newObservations = unreflectedContent
        ? `${bufferedReflection}\n\n${unreflectedContent}`
        : bufferedReflection;

      // Create new generation with the merged content.
      // tokenCount is computed by the processor using its token counter on the combined content.
      const newRecord = await this.createReflectionGeneration({
        currentRecord: input.currentRecord,
        reflection: newObservations,
        tokenCount: input.tokenCount,
      });

      // Clear buffered state on old record
      const nowStr = new Date().toISOString();
      await this.#db.client.query(
        `UPDATE ${tableName} SET
          "bufferedReflection" = NULL,
          "bufferedReflectionTokens" = NULL,
          "bufferedReflectionInputTokens" = NULL,
          "reflectedObservationLineCount" = NULL,
          "updatedAt" = $1,
          "updatedAtZ" = $2
        WHERE id = $3`,
        [nowStr, nowStr, input.currentRecord.id],
      );

      return newRecord;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'SWAP_BUFFERED_REFLECTION_TO_ACTIVE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.currentRecord.id },
        },
        error,
      );
    }
  }
}
