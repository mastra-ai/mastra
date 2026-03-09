import { createClient } from '@libsql/client';
import type { Client as TursoClient, InValue } from '@libsql/client';

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createVectorErrorId } from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';
import { MastraVector, validateUpsertInput, validateTopK } from '@mastra/core/vector';
import type {
  IndexStats,
  QueryResult,
  QueryVectorParams,
  CreateIndexParams,
  UpsertVectorParams,
  DescribeIndexParams,
  DeleteIndexParams,
  DeleteVectorParams,
  UpdateVectorParams,
  DeleteVectorsParams,
} from '@mastra/core/vector';
import type { LibSQLVectorFilter } from './filter';
import { LibSQLFilterTranslator } from './filter';
import { buildFilterQuery } from './sql-builder';

interface LibSQLQueryVectorParams extends QueryVectorParams<LibSQLVectorFilter> {
  minScore?: number;
}

export interface LibSQLVectorConfig {
  /**
   * The URL of the LibSQL database.
   * Examples: 'file:./dev.db', 'file::memory:', 'libsql://your-db.turso.io'
   */
  url: string;
  authToken?: string;
  syncUrl?: string;
  syncInterval?: number;
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

export class LibSQLVector extends MastraVector<LibSQLVectorFilter> {
  private turso: TursoClient;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;

  constructor({
    url,
    authToken,
    syncUrl,
    syncInterval,
    maxRetries = 5,
    initialBackoffMs = 100,
    id,
  }: LibSQLVectorConfig & { id: string }) {
    super({ id });

    this.turso = createClient({
      url,
      syncUrl,
      authToken,
      syncInterval,
    });
    this.maxRetries = maxRetries;
    this.initialBackoffMs = initialBackoffMs;

    if (url.includes(`file:`) || url.includes(`:memory:`)) {
      this.turso
        .execute('PRAGMA journal_mode=WAL;')
        .then(() => this.logger.debug('LibSQLStore: PRAGMA journal_mode=WAL set.'))
        .catch(err => this.logger.warn('LibSQLStore: Failed to set PRAGMA journal_mode=WAL.', err));
      this.turso
        .execute('PRAGMA busy_timeout = 5000;')
        .then(() => this.logger.debug('LibSQLStore: PRAGMA busy_timeout=5000 set.'))
        .catch(err => this.logger.warn('LibSQLStore: Failed to set PRAGMA busy_timeout=5000.', err));
    }
  }

  private async executeWriteOperationWithRetry<T>(operation: () => Promise<T>, isTransaction = false): Promise<T> {
    let attempts = 0;
    let backoff = this.initialBackoffMs;
    while (attempts < this.maxRetries) {
      try {
        return await operation();
      } catch (error: any) {
        if (
          error.code === 'SQLITE_BUSY' ||
          error.code === 'SQLITE_LOCKED' ||
          error.code === 'SQLITE_LOCKED_SHAREDCACHE' ||
          (error.message && error.message.toLowerCase().includes('database is locked')) ||
          (error.message && error.message.toLowerCase().includes('database table is locked'))
        ) {
          attempts++;
          if (attempts >= this.maxRetries) {
            this.logger.error(
              `LibSQLVector: Operation failed after ${this.maxRetries} attempts due to: ${error.message}`,
              error,
            );
            throw error;
          }
          this.logger.warn(
            `LibSQLVector: Attempt ${attempts} failed due to ${isTransaction ? 'transaction ' : ''}database lock. Retrying in ${backoff}ms...`,
          );
          await new Promise(resolve => setTimeout(resolve, backoff));
          backoff *= 2;
        } else {
          throw error;
        }
      }
    }
    throw new Error('LibSQLVector: Max retries reached, but no error was re-thrown from the loop.');
  }

  transformFilter(filter?: LibSQLVectorFilter) {
    const translator = new LibSQLFilterTranslator();
    return translator.translate(filter);
  }

  async query({
    indexName,
    queryVector,
    topK = 10,
    filter,
    includeVector = false,
    minScore = -1, // Default to -1 to include all results (cosine similarity ranges from -1 to 1)
  }: LibSQLQueryVectorParams): Promise<QueryResult[]> {
    // Validate topK parameter - throws MastraError directly
    validateTopK('LIBSQL', topK);

    if (!queryVector) {
      throw new MastraError({
        id: createVectorErrorId('LIBSQL', 'QUERY', 'MISSING_VECTOR'),
        text: 'queryVector is required for LibSQL queries. Metadata-only queries are not supported by this vector store.',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    if (!Array.isArray(queryVector) || !queryVector.every(x => typeof x === 'number' && Number.isFinite(x))) {
      throw new MastraError({
        id: createVectorErrorId('LIBSQL', 'QUERY', 'INVALID_ARGS'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { message: 'queryVector must be an array of finite numbers' },
      });
    }

    try {
      const parsedIndexName = parseSqlIdentifier(indexName, 'index name');

      const vectorStr = `[${queryVector.join(',')}]`;

      const translatedFilter = this.transformFilter(filter);
      const { sql: filterQuery, values: filterValues } = buildFilterQuery(translatedFilter);
      filterValues.push(minScore);
      filterValues.push(topK);

      const query = `
      WITH vector_scores AS (
        SELECT
          vector_id as id,
          (1-vector_distance_cos(embedding, '${vectorStr}')) as score,
          metadata
          ${includeVector ? ', vector_extract(embedding) as embedding' : ''}
        FROM ${parsedIndexName}
        ${filterQuery}
      )
      SELECT *
      FROM vector_scores
      WHERE score > ?
      ORDER BY score DESC
      LIMIT ?`;

      const result = await this.turso.execute({
        sql: query,
        args: filterValues,
      });

      return result.rows.map(({ id, score, metadata, embedding }) => ({
        id: id as string,
        score: score as number,
        metadata: JSON.parse((metadata as string) ?? '{}'),
        ...(includeVector && embedding && { vector: JSON.parse(embedding as string) }),
      }));
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('LIBSQL', 'QUERY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  public upsert(args: UpsertVectorParams): Promise<string[]> {
    try {
      return this.executeWriteOperationWithRetry(() => this.doUpsert(args), true);
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('LIBSQL', 'UPSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  private async doUpsert({ indexName, vectors, metadata, ids }: UpsertVectorParams): Promise<string[]> {
    // Validate input parameters
    validateUpsertInput('LIBSQL', vectors, metadata, ids);

    const tx = await this.turso.transaction('write');
    try {
      const parsedIndexName = parseSqlIdentifier(indexName, 'index name');
      const vectorIds = ids || vectors.map(() => crypto.randomUUID());

      for (let i = 0; i < vectors.length; i++) {
        const query = `
            INSERT INTO ${parsedIndexName} (vector_id, embedding, metadata)
            VALUES (?, vector32(?), ?)
            ON CONFLICT(vector_id) DO UPDATE SET
              embedding = vector32(?),
              metadata = ?
          `;
        await tx.execute({
          sql: query,
          args: [
            vectorIds[i] as InValue,
            JSON.stringify(vectors[i]),
            JSON.stringify(metadata?.[i] || {}),
            JSON.stringify(vectors[i]),
            JSON.stringify(metadata?.[i] || {}),
          ],
        });
      }
      await tx.commit();
      return vectorIds;
    } catch (error) {
      !tx.closed && (await tx.rollback());
      if (error instanceof Error && error.message?.includes('dimensions are different')) {
        const match = error.message.match(/dimensions are different: (\d+) != (\d+)/);
        if (match) {
          const [, actual, expected] = match;
          throw new Error(
            `Vector dimension mismatch: Index "${indexName}" expects ${expected} dimensions but got ${actual} dimensions. ` +
              `Either use a matching embedding model or delete and recreate the index with the new dimension.`,
          );
        }
      }
      throw error;
    }
  }

  public createIndex(args: CreateIndexParams): Promise<void> {
    try {
      return this.executeWriteOperationWithRetry(() => this.doCreateIndex(args));
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('LIBSQL', 'CREATE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName: args.indexName, dimension: args.dimension },
        },
        error,
      );
    }
  }

  private async doCreateIndex({ indexName, dimension }: CreateIndexParams): Promise<void> {
    if (!Number.isInteger(dimension) || dimension <= 0) {
      throw new Error('Dimension must be a positive integer');
    }
    const parsedIndexName = parseSqlIdentifier(indexName, 'index name');
    await this.turso.execute({
      sql: `
          CREATE TABLE IF NOT EXISTS ${parsedIndexName} (
            id SERIAL PRIMARY KEY,
            vector_id TEXT UNIQUE NOT NULL,
            embedding F32_BLOB(${dimension}),
            metadata TEXT DEFAULT '{}'
          );
        `,
      args: [],
    });
    await this.turso.execute({
      sql: `
          CREATE INDEX IF NOT EXISTS ${parsedIndexName}_vector_idx
          ON ${parsedIndexName} (libsql_vector_idx(embedding))
        `,
      args: [],
    });
  }

  public deleteIndex(args: DeleteIndexParams): Promise<void> {
    try {
      return this.executeWriteOperationWithRetry(() => this.doDeleteIndex(args));
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('LIBSQL', 'DELETE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName: args.indexName },
        },
        error,
      );
    }
  }

  private async doDeleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    const parsedIndexName = parseSqlIdentifier(indexName, 'index name');
    await this.turso.execute({
      sql: `DROP TABLE IF EXISTS ${parsedIndexName}`,
      args: [],
    });
  }

  async listIndexes(): Promise<string[]> {
    try {
      const vectorTablesQuery = `
        SELECT name FROM sqlite_master 
        WHERE type='table' 
        AND sql LIKE '%F32_BLOB%';
      `;
      const result = await this.turso.execute({
        sql: vectorTablesQuery,
        args: [],
      });
      return result.rows.map(row => row.name as string);
    } catch (error: any) {
      throw new MastraError(
        {
          id: createVectorErrorId('LIBSQL', 'LIST_INDEXES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * Retrieves statistics about a vector index.
   *
   * @param {string} indexName - The name of the index to describe
   * @returns A promise that resolves to the index statistics including dimension, count and metric
   */
  async describeIndex({ indexName }: DescribeIndexParams): Promise<IndexStats> {
    try {
      const parsedIndexName = parseSqlIdentifier(indexName, 'index name');
      // Get table info including column info
      const tableInfoQuery = `
        SELECT sql 
        FROM sqlite_master 
        WHERE type='table' 
        AND name = ?;
      `;
      const tableInfo = await this.turso.execute({
        sql: tableInfoQuery,
        args: [parsedIndexName],
      });

      if (!tableInfo.rows[0]?.sql) {
        throw new Error(`Table ${parsedIndexName} not found`);
      }

      // Extract dimension from F32_BLOB definition
      const dimension = parseInt((tableInfo.rows[0].sql as string).match(/F32_BLOB\((\d+)\)/)?.[1] || '0');

      // Get row count
      const countQuery = `
        SELECT COUNT(*) as count
        FROM ${parsedIndexName};
      `;
      const countResult = await this.turso.execute({
        sql: countQuery,
        args: [],
      });

      // LibSQL only supports cosine similarity currently
      const metric: 'cosine' | 'euclidean' | 'dotproduct' = 'cosine';

      return {
        dimension,
        count: (countResult?.rows?.[0]?.count as number) ?? 0,
        metric,
      };
    } catch (e: any) {
      throw new MastraError(
        {
          id: createVectorErrorId('LIBSQL', 'DESCRIBE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        e,
      );
    }
  }

  /**
   * Updates a vector by its ID with the provided vector and/or metadata.
   *
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to update.
   * @param update - An object containing the vector and/or metadata to update.
   * @param update.vector - An optional array of numbers representing the new vector.
   * @param update.metadata - An optional record containing the new metadata.
   * @returns A promise that resolves when the update is complete.
   * @throws Will throw an error if no updates are provided or if the update operation fails.
   */
  public updateVector(args: UpdateVectorParams<LibSQLVectorFilter>): Promise<void> {
    return this.executeWriteOperationWithRetry(() => this.doUpdateVector(args));
  }

  private async doUpdateVector(params: UpdateVectorParams<LibSQLVectorFilter>): Promise<void> {
    const { indexName, update } = params;
    const parsedIndexName = parseSqlIdentifier(indexName, 'index name');

    // Validate that both id and filter are not provided at the same time
    if ('id' in params && params.id && 'filter' in params && params.filter) {
      throw new MastraError({
        id: createVectorErrorId('LIBSQL', 'UPDATE_VECTOR', 'MUTUALLY_EXCLUSIVE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
        text: 'id and filter are mutually exclusive - provide only one',
      });
    }

    if (!update.vector && !update.metadata) {
      throw new MastraError({
        id: createVectorErrorId('LIBSQL', 'UPDATE_VECTOR', 'NO_PAYLOAD'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
        text: 'No updates provided',
      });
    }

    const updates: string[] = [];
    const args: InValue[] = [];

    if (update.vector) {
      updates.push('embedding = vector32(?)');
      args.push(JSON.stringify(update.vector));
    }

    if (update.metadata) {
      updates.push('metadata = ?');
      args.push(JSON.stringify(update.metadata));
    }

    if (updates.length === 0) {
      return;
    }

    let whereClause: string;
    let whereValues: InValue[];

    // Type narrowing: check if updating by id or by filter
    if ('id' in params && params.id) {
      // Update by ID
      whereClause = 'vector_id = ?';
      whereValues = [params.id];
    } else if ('filter' in params && params.filter) {
      // Update by filter
      const filter = params.filter;

      if (!filter || Object.keys(filter).length === 0) {
        throw new MastraError({
          id: createVectorErrorId('LIBSQL', 'UPDATE_VECTOR', 'EMPTY_FILTER'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
          text: 'Cannot update with empty filter',
        });
      }

      const translatedFilter = this.transformFilter(filter);
      const { sql: filterSql, values: filterValues } = buildFilterQuery(translatedFilter);

      if (!filterSql || filterSql.trim() === '') {
        throw new MastraError({
          id: createVectorErrorId('LIBSQL', 'UPDATE_VECTOR', 'INVALID_FILTER'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
          text: 'Filter produced empty WHERE clause',
        });
      }

      // Guard against match-all patterns that would update all vectors
      // Normalize SQL by removing WHERE prefix and extra whitespace for pattern matching
      const normalizedCondition = filterSql
        .replace(/^\s*WHERE\s+/i, '')
        .trim()
        .toLowerCase();
      const matchAllPatterns = ['true', '1 = 1', '1=1'];

      if (matchAllPatterns.includes(normalizedCondition)) {
        throw new MastraError({
          id: createVectorErrorId('LIBSQL', 'UPDATE_VECTOR', 'MATCH_ALL_FILTER'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName, filterSql: normalizedCondition },
          text: 'Filter matches all vectors. Provide a specific filter to update targeted vectors.',
        });
      }

      // buildFilterQuery already includes "WHERE" in the SQL, so we need to extract just the condition
      whereClause = filterSql.replace(/^WHERE\s+/i, '');
      whereValues = filterValues;
    } else {
      throw new MastraError({
        id: createVectorErrorId('LIBSQL', 'UPDATE_VECTOR', 'NO_TARGET'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
        text: 'Either id or filter must be provided',
      });
    }

    const query = `
      UPDATE ${parsedIndexName}
      SET ${updates.join(', ')}
      WHERE ${whereClause};
    `;

    try {
      await this.turso.execute({
        sql: query,
        args: [...args, ...whereValues],
      });
    } catch (error) {
      const errorDetails: Record<string, any> = { indexName };

      if ('id' in params && params.id) {
        errorDetails.id = params.id;
      }

      if ('filter' in params && params.filter) {
        errorDetails.filter = JSON.stringify(params.filter);
      }

      throw new MastraError(
        {
          id: createVectorErrorId('LIBSQL', 'UPDATE_VECTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: errorDetails,
        },
        error,
      );
    }
  }

  /**
   * Deletes a vector by its ID.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to delete.
   * @returns A promise that resolves when the deletion is complete.
   * @throws Will throw an error if the deletion operation fails.
   */
  public deleteVector(args: DeleteVectorParams): Promise<void> {
    try {
      return this.executeWriteOperationWithRetry(() => this.doDeleteVector(args));
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('LIBSQL', 'DELETE_VECTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName: args.indexName,
            ...(args.id && { id: args.id }),
          },
        },
        error,
      );
    }
  }

  private async doDeleteVector({ indexName, id }: DeleteVectorParams): Promise<void> {
    const parsedIndexName = parseSqlIdentifier(indexName, 'index name');
    await this.turso.execute({
      sql: `DELETE FROM ${parsedIndexName} WHERE vector_id = ?`,
      args: [id],
    });
  }

  public deleteVectors(args: DeleteVectorsParams<LibSQLVectorFilter>): Promise<void> {
    return this.executeWriteOperationWithRetry(() => this.doDeleteVectors(args));
  }

  private async doDeleteVectors({ indexName, filter, ids }: DeleteVectorsParams<LibSQLVectorFilter>): Promise<void> {
    const parsedIndexName = parseSqlIdentifier(indexName, 'index name');

    // Validate that exactly one of filter or ids is provided
    if (!filter && !ids) {
      throw new MastraError({
        id: createVectorErrorId('LIBSQL', 'DELETE_VECTORS', 'NO_TARGET'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
        text: 'Either filter or ids must be provided',
      });
    }

    if (filter && ids) {
      throw new MastraError({
        id: createVectorErrorId('LIBSQL', 'DELETE_VECTORS', 'MUTUALLY_EXCLUSIVE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
        text: 'Cannot provide both filter and ids - they are mutually exclusive',
      });
    }

    let query: string;
    let values: InValue[];

    if (ids) {
      // Delete by IDs
      if (ids.length === 0) {
        throw new MastraError({
          id: createVectorErrorId('LIBSQL', 'DELETE_VECTORS', 'EMPTY_IDS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
          text: 'Cannot delete with empty ids array',
        });
      }

      const placeholders = ids.map(() => '?').join(', ');
      query = `DELETE FROM ${parsedIndexName} WHERE vector_id IN (${placeholders})`;
      values = ids;
    } else {
      // Delete by filter
      // Safety check: Don't allow empty filters to prevent accidental deletion of all vectors
      if (!filter || Object.keys(filter).length === 0) {
        throw new MastraError({
          id: createVectorErrorId('LIBSQL', 'DELETE_VECTORS', 'EMPTY_FILTER'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
          text: 'Cannot delete with empty filter. Use deleteIndex to delete all vectors.',
        });
      }

      const translatedFilter = this.transformFilter(filter);
      const { sql: filterSql, values: filterValues } = buildFilterQuery(translatedFilter);

      if (!filterSql || filterSql.trim() === '') {
        throw new MastraError({
          id: createVectorErrorId('LIBSQL', 'DELETE_VECTORS', 'INVALID_FILTER'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
          text: 'Filter produced empty WHERE clause',
        });
      }

      // Guard against match-all patterns that would delete all vectors
      // Normalize SQL by removing WHERE prefix and extra whitespace for pattern matching
      const normalizedCondition = filterSql
        .replace(/^\s*WHERE\s+/i, '')
        .trim()
        .toLowerCase();
      const matchAllPatterns = ['true', '1 = 1', '1=1'];

      if (matchAllPatterns.includes(normalizedCondition)) {
        throw new MastraError({
          id: createVectorErrorId('LIBSQL', 'DELETE_VECTORS', 'MATCH_ALL_FILTER'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName, filterSql: normalizedCondition },
          text: 'Filter matches all vectors. Use deleteIndex to delete all vectors from an index.',
        });
      }

      // buildFilterQuery already includes "WHERE" in the SQL
      query = `DELETE FROM ${parsedIndexName} ${filterSql}`;
      values = filterValues;
    }

    try {
      await this.turso.execute({
        sql: query,
        args: values,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('LIBSQL', 'DELETE_VECTORS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            ...(filter && { filter: JSON.stringify(filter) }),
            ...(ids && { idsCount: ids.length }),
          },
        },
        error,
      );
    }
  }

  public truncateIndex(args: DeleteIndexParams): Promise<void> {
    try {
      return this.executeWriteOperationWithRetry(() => this._doTruncateIndex(args));
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('LIBSQL', 'TRUNCATE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName: args.indexName },
        },
        error,
      );
    }
  }

  private async _doTruncateIndex({ indexName }: DeleteIndexParams): Promise<void> {
    await this.turso.execute({
      sql: `DELETE FROM ${parseSqlIdentifier(indexName, 'index name')}`,
      args: [],
    });
  }
}
