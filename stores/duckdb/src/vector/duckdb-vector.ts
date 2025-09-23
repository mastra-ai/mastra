/**
 * DuckDB Vector Store Implementation
 */

import { MastraVector } from '@mastra/core';
import type {
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  QueryResult,
  UpdateVectorParams,
  DeleteVectorParams,
  DeleteIndexParams,
  DescribeIndexParams,
  IndexStats,
} from '@mastra/core';

import duckdb from 'duckdb';
import { Mutex } from 'async-mutex';
import * as crypto from 'crypto';
import type {
  DuckDBVectorConfig,
  DuckDBConnectionOptions,
  DuckDBIndexOptions,
  DuckDBQueryOptions,
  DuckDBIndexStats,
  ParquetImportOptions,
} from './types';
import { DuckDBFilterBuilder } from './filter-builder';
import { validateVector, normalizeVector } from './utils';

/**
 * DuckDB vector database provider for Mastra
 * Provides embedded vector similarity search using DuckDB's VSS extension
 */
export class DuckDBVector extends MastraVector {
  private config: Required<DuckDBVectorConfig>;
  private db: duckdb.Database | null = null;
  private connectionPool: duckdb.Connection[] = [];
  private connectionWaitQueue: Array<{
    resolve: (conn: duckdb.Connection) => void;
    reject: (error: Error) => void;
  }> = [];
  private mutex = new Mutex();
  private initialized = false;

  constructor(config: DuckDBVectorConfig = {}) {
    super();

    this.config = {
      path: config.path || ':memory:',
      dimensions: config.dimensions || 512,
      metric: config.metric || 'cosine',
      poolSize: config.poolSize || 5,
      memoryLimit: config.memoryLimit || '2GB',
      threads: config.threads || 4,
      readOnly: config.readOnly || false,
      extensions: config.extensions || ['vss'],
    };
  }

  /**
   * Initialize DuckDB connection and VSS extension
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    return this.mutex.runExclusive(async () => {
      if (this.initialized) return;

      try {
        // Create DuckDB instance - simplified constructor
        this.db = new duckdb.Database(this.config.path);

        // Set configuration options after creation
        const conn = this.db.connect();
        await this.execute(conn, `SET memory_limit='${this.config.memoryLimit}'`);
        await this.execute(conn, `SET threads=${this.config.threads}`);
        conn.close();

        // Install and load extensions using a temporary connection
        const initConn = this.db.connect();
        for (const ext of this.config.extensions) {
          await this.execute(initConn, `INSTALL ${ext};`);
          await this.execute(initConn, `LOAD ${ext};`);
        }

        // Create default tables
        await this.createDefaultTables(initConn);
        initConn.close();

        // Create connection pool after initialization
        for (let i = 0; i < this.config.poolSize; i++) {
          const poolConn = this.db.connect();
          this.connectionPool.push(poolConn);
        }

        this.initialized = true;
      } catch (error) {
        throw this.handleError(error, 'Failed to initialize DuckDB');
      }
    });
  }

  /**
   * Get a connection from the pool with retry and queue management
   */
  private async getConnection(): Promise<duckdb.Connection> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Try to get a connection immediately
    const conn = this.connectionPool.pop();
    if (conn) {
      return conn;
    }

    // No connection available, add to wait queue
    return new Promise<duckdb.Connection>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const index = this.connectionWaitQueue.findIndex(w => w.resolve === resolve);
        if (index !== -1) {
          this.connectionWaitQueue.splice(index, 1);
        }
        reject(new Error('Timeout waiting for connection from pool'));
      }, 30000); // 30 second timeout

      this.connectionWaitQueue.push({
        resolve: (conn: duckdb.Connection) => {
          clearTimeout(timeoutId);
          resolve(conn);
        },
        reject,
      });
    });
  }

  /**
   * Release a connection back to the pool and notify waiting requests
   */
  private releaseConnection(conn: duckdb.Connection): void {
    // If there are waiting requests, give the connection to the first one
    const waiter = this.connectionWaitQueue.shift();
    if (waiter) {
      waiter.resolve(conn);
    } else {
      // Otherwise, return it to the pool
      this.connectionPool.push(conn);
    }
  }

  /**
   * Execute a SQL query
   */
  private async execute(conn: duckdb.Connection, sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      // DuckDB expects parameters as separate arguments, not an array
      const callback = (err: Error | null, result: any[]) => {
        if (err) reject(err);
        else resolve(result || []);
      };

      // Spread the params array as individual arguments
      conn.all(sql, ...params, callback);
    });
  }

  /**
   * Create default tables and indexes
   */
  private async createDefaultTables(conn: duckdb.Connection): Promise<void> {
    // Create indexes table
    await this.execute(
      conn,
      `
      CREATE TABLE IF NOT EXISTS vector_indexes (
        name VARCHAR PRIMARY KEY,
        dimension INTEGER NOT NULL,
        metric VARCHAR NOT NULL,
        total_vectors INTEGER DEFAULT 0,
        m INTEGER DEFAULT 16,
        ef_construction INTEGER DEFAULT 128,
        ef_search INTEGER DEFAULT 64,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    );
  }

  /**
   * Create a new vector index
   */
  async createIndex(params: CreateIndexParams): Promise<void> {
    const conn = await this.getConnection();

    try {
      const { indexName, dimension, metric = this.config.metric } = params;

      // Validate index name to prevent SQL injection
      this.validateIdentifier(indexName, 'Index name');

      // Validate index doesn't exist
      const existing = await this.execute(conn, 'SELECT name FROM vector_indexes WHERE name = ?', [indexName]);

      if (existing.length > 0) {
        throw new Error(`Index "${indexName}" already exists`);
      }

      // Create index metadata
      await this.execute(
        conn,
        `
        INSERT INTO vector_indexes (name, dimension, metric)
        VALUES (?, ?, ?)
      `,
        [indexName, dimension, metric],
      );

      // Create vector table for this index
      const tableName = `vectors_${indexName.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      const escapedTableName = this.escapeIdentifier(tableName);
      await this.execute(
        conn,
        `
        CREATE TABLE IF NOT EXISTS ${escapedTableName} (
          id VARCHAR PRIMARY KEY,
          vector FLOAT[${dimension}],
          content TEXT,
          metadata JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
      );

      // Create HNSW index
      const metricMap: Record<string, string> = {
        cosine: 'cosine',
        euclidean: 'l2sq',
        dotproduct: 'ip',
        dot: 'ip',
      };

      const hnswIndexName = `idx_${tableName}_hnsw`;
      const escapedIndexName = this.escapeIdentifier(hnswIndexName);
      await this.execute(
        conn,
        `
        CREATE INDEX ${escapedIndexName}
        ON ${escapedTableName}
        USING HNSW (vector)
        WITH (metric = '${metricMap[metric] || 'cosine'}', M = 16, ef_construction = 128)
      `,
      );

      // Create FTS index for hybrid search - Install FTS extension and create virtual table
      try {
        await this.execute(conn, `INSTALL fts;`);
        await this.execute(conn, `LOAD fts;`);
        await this.execute(
          conn,
          `
          PRAGMA create_fts_index('${tableName}', 'id', 'content');
        `,
        );
      } catch (error) {
        // FTS might not be available, ignore for now
        console.warn('FTS extension not available for hybrid search:', error);
      }
    } finally {
      this.releaseConnection(conn);
    }
  }

  /**
   * Upsert vectors to an index
   */
  async upsert(params: UpsertVectorParams): Promise<string[]> {
    const conn = await this.getConnection();

    try {
      const { indexName, vectors, metadata = [], ids } = params;

      // Validate index name
      this.validateIdentifier(indexName, 'Index name');

      const tableName = this.getTableName(indexName);
      const escapedTableName = this.escapeIdentifier(tableName);

      // Generate IDs if not provided
      const vectorIds = ids || vectors.map(() => crypto.randomUUID());

      // Start transaction for batch insert
      await this.execute(conn, 'BEGIN TRANSACTION');

      for (let i = 0; i < vectors.length; i++) {
        const vectorData = vectors[i];
        const metadataObj = metadata[i] || {};
        const vectorId = vectorIds[i];

        // Validate vector dimensions
        if (!vectorData) {
          throw new Error(`Vector at index ${i} is undefined`);
        }
        validateVector(vectorData, this.config.dimensions);

        // Normalize vector if using cosine similarity
        const normalizedVector = this.config.metric === 'cosine' ? normalizeVector(vectorData) : vectorData;

        // Upsert vector
        await this.execute(
          conn,
          `
          INSERT INTO ${escapedTableName} (id, vector, content, metadata, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO UPDATE SET
            vector = EXCLUDED.vector,
            metadata = EXCLUDED.metadata,
            updated_at = EXCLUDED.updated_at
        `,
          [vectorId, `[${normalizedVector.join(',')}]`, metadataObj.content || '', JSON.stringify(metadataObj)],
        );
      }

      // Update vector count
      await this.execute(
        conn,
        `
        UPDATE vector_indexes
        SET total_vectors = (SELECT COUNT(*) FROM ${escapedTableName}),
            updated_at = CURRENT_TIMESTAMP
        WHERE name = ?
      `,
        [indexName],
      );

      await this.execute(conn, 'COMMIT');
      return vectorIds;
    } catch (error) {
      await this.execute(conn, 'ROLLBACK');
      throw this.handleError(error, 'Failed to upsert vectors');
    } finally {
      this.releaseConnection(conn);
    }
  }

  /**
   * Query similar vectors
   */
  async query(params: QueryVectorParams): Promise<QueryResult[]> {
    const conn = await this.getConnection();

    try {
      const { indexName, queryVector, topK = 10, filter, includeVector = false } = params;

      // Validate index name
      this.validateIdentifier(indexName, 'Index name');

      const tableName = this.getTableName(indexName);
      const escapedTableName = this.escapeIdentifier(tableName);

      // Validate and normalize query vector
      validateVector(queryVector, this.config.dimensions);
      const normalizedQuery = this.config.metric === 'cosine' ? normalizeVector(queryVector) : queryVector;

      // Build filter SQL
      const filterBuilder = new DuckDBFilterBuilder();
      let whereClause = '';
      const filterParams: any[] = [];

      if (filter) {
        const filterSql = filterBuilder.build(filter);
        if (filterSql.sql) {
          whereClause = `WHERE ${filterSql.sql}`;
          filterParams.push(...filterSql.params);
        }
      }

      // Get similarity function based on metric
      const similarityFunc = this.getSimilarityFunction();

      // For euclidean distance, smaller is better, so we order ASC
      const orderDirection = this.config.metric === 'euclidean' ? 'ASC' : 'DESC';

      // Query similar vectors
      const sql = `
        SELECT
          id,
          ${includeVector ? 'vector,' : ''}
          metadata,
          content,
          ${similarityFunc}(vector, ?::FLOAT[${this.config.dimensions}]) as score
        FROM ${escapedTableName}
        ${whereClause}
        ORDER BY score ${orderDirection}
        LIMIT ?
      `;

      const queryParams = [`[${normalizedQuery.join(',')}]`, ...filterParams, topK];

      const results = await this.execute(conn, sql, queryParams);

      return results.map(row => {
        const result: QueryResult = {
          id: row.id,
          score: row.score,
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        };
        if (includeVector && row.vector) {
          result.vector = JSON.parse(row.vector);
        }
        return result;
      });
    } finally {
      this.releaseConnection(conn);
    }
  }

  /**
   * List all indexes
   */
  async listIndexes(): Promise<string[]> {
    const conn = await this.getConnection();

    try {
      const results = await this.execute(conn, 'SELECT name FROM vector_indexes ORDER BY name');
      return results.map(row => row.name);
    } finally {
      this.releaseConnection(conn);
    }
  }

  /**
   * Get index statistics
   */
  async describeIndex(params: DescribeIndexParams): Promise<IndexStats> {
    const conn = await this.getConnection();

    try {
      const { indexName } = params;

      const results = await this.execute(
        conn,
        `
        SELECT * FROM vector_indexes WHERE name = ?
      `,
        [indexName],
      );

      if (results.length === 0) {
        throw new Error(`Index "${indexName}" not found`);
      }

      const index = results[0];

      return {
        dimension: index.dimension,
        count: index.total_vectors,
        metric: index.metric as 'cosine' | 'euclidean' | 'dotproduct',
      };
    } finally {
      this.releaseConnection(conn);
    }
  }

  /**
   * Delete an index and all its vectors
   */
  async deleteIndex(params: DeleteIndexParams): Promise<void> {
    const conn = await this.getConnection();

    try {
      const { indexName } = params;

      // Validate index name
      this.validateIdentifier(indexName, 'Index name');

      const tableName = this.getTableName(indexName);
      const escapedTableName = this.escapeIdentifier(tableName);

      // Drop table and index
      await this.execute(conn, `DROP TABLE IF EXISTS ${escapedTableName}`);

      // Remove from indexes table
      await this.execute(conn, 'DELETE FROM vector_indexes WHERE name = ?', [indexName]);
    } finally {
      this.releaseConnection(conn);
    }
  }

  /**
   * Update a vector's metadata
   */
  async updateVector(params: UpdateVectorParams): Promise<void> {
    const conn = await this.getConnection();

    try {
      const { indexName, id, update } = params;
      const { metadata, vector } = update;

      // Validate index name
      this.validateIdentifier(indexName, 'Index name');

      const tableName = this.getTableName(indexName);
      const escapedTableName = this.escapeIdentifier(tableName);

      const updates: string[] = [];
      const updateParams: any[] = [];

      if (vector) {
        validateVector(vector, this.config.dimensions);
        const normalizedVector = this.config.metric === 'cosine' ? normalizeVector(vector) : vector;
        updates.push('vector = ?');
        updateParams.push(`[${normalizedVector.join(',')}]`);
      }

      if (metadata) {
        updates.push('metadata = ?');
        updateParams.push(JSON.stringify(metadata));
      }

      if (updates.length === 0) return;

      updates.push('updated_at = CURRENT_TIMESTAMP');
      updateParams.push(id);

      await this.execute(
        conn,
        `
        UPDATE ${escapedTableName}
        SET ${updates.join(', ')}
        WHERE id = ?
      `,
        updateParams,
      );
    } finally {
      this.releaseConnection(conn);
    }
  }

  /**
   * Delete vectors by ID
   */
  async deleteVector(params: DeleteVectorParams): Promise<void> {
    const conn = await this.getConnection();

    try {
      const { indexName, id } = params;

      // Validate index name
      this.validateIdentifier(indexName, 'Index name');

      const tableName = this.getTableName(indexName);
      const escapedTableName = this.escapeIdentifier(tableName);

      // Handle both single ID and array of IDs
      const ids = Array.isArray(id) ? id : [id];
      const placeholders = ids.map(() => '?').join(',');

      await this.execute(
        conn,
        `
        DELETE FROM ${escapedTableName}
        WHERE id IN (${placeholders})
      `,
        ids,
      );

      // Update vector count
      await this.execute(
        conn,
        `
        UPDATE vector_indexes
        SET total_vectors = (SELECT COUNT(*) FROM ${escapedTableName}),
            updated_at = CURRENT_TIMESTAMP
        WHERE name = ?
      `,
        [indexName],
      );
    } finally {
      this.releaseConnection(conn);
    }
  }

  /**
   * Import vectors from Parquet file (Enhanced DuckDB-specific feature)
   */
  async importFromParquet(indexName: string, options: ParquetImportOptions): Promise<number> {
    const conn = await this.getConnection();

    try {
      // Validate index name
      this.validateIdentifier(indexName, 'Index name');

      const tableName = this.getTableName(indexName);
      const escapedTableName = this.escapeIdentifier(tableName);
      const { source, mapping = {}, filter, batchSize = 10000 } = options;

      // Build column mapping
      const idCol = mapping.id || 'id';
      const vectorCol = mapping.vector || 'embedding';
      const contentCol = mapping.content || 'content';
      const metadataCol = mapping.metadata || 'metadata';

      // Build filter clause
      const whereClause = filter ? `WHERE ${filter}` : '';

      // Import from Parquet
      const sql = `
        INSERT INTO ${escapedTableName} (id, vector, content, metadata)
        SELECT
          ${idCol} as id,
          ${vectorCol} as vector,
          ${contentCol} as content,
          ${metadataCol} as metadata
        FROM read_parquet('${source}')
        ${whereClause}
      `;

      const result = await this.execute(conn, sql);

      // Update vector count
      await this.execute(
        conn,
        `
        UPDATE vector_indexes
        SET total_vectors = (SELECT COUNT(*) FROM ${escapedTableName}),
            updated_at = CURRENT_TIMESTAMP
        WHERE name = ?
      `,
        [indexName],
      );

      return result.length;
    } finally {
      this.releaseConnection(conn);
    }
  }

  /**
   * Perform hybrid search (vector + text) - Enhanced DuckDB-specific feature
   */
  async hybridSearch(
    indexName: string,
    queryVector: number[],
    textQuery: string,
    options: DuckDBQueryOptions = {},
  ): Promise<QueryResult[]> {
    const conn = await this.getConnection();

    try {
      // Validate index name
      this.validateIdentifier(indexName, 'Index name');

      const { vectorWeight = 0.7 } = options;

      const tableName = this.getTableName(indexName);
      const escapedTableName = this.escapeIdentifier(tableName);
      const textWeight = 1 - vectorWeight;

      // Validate and normalize query vector
      validateVector(queryVector, this.config.dimensions);
      const normalizedQuery = this.config.metric === 'cosine' ? normalizeVector(queryVector) : queryVector;

      // Get similarity function
      const similarityFunc = this.getSimilarityFunction();

      // Try hybrid search with FTS first, fall back to vector-only if FTS not available
      let results;
      try {
        // Hybrid search query with FTS
        const sql = `
          WITH vector_scores AS (
            SELECT
              id,
              ${similarityFunc}(vector, ?::FLOAT[${this.config.dimensions}]) as vector_score
            FROM ${escapedTableName}
          ),
          text_scores AS (
            SELECT
              id,
              fts_main_${tableName}.score as text_score
            FROM fts_main_${tableName}(?)
          ),
          combined_scores AS (
            SELECT
              COALESCE(v.id, t.id) as id,
              COALESCE(v.vector_score * ?, 0) + COALESCE(t.text_score * ?, 0) as final_score
            FROM vector_scores v
            FULL OUTER JOIN text_scores t ON v.id = t.id
          )
          SELECT
            c.id,
            vec.metadata,
            vec.content,
            c.final_score as score
          FROM combined_scores c
          JOIN ${escapedTableName} vec ON c.id = vec.id
          ORDER BY c.final_score DESC
          LIMIT ${options.topK || 10}
        `;

        const queryParams = [`[${normalizedQuery.join(',')}]`, textQuery, vectorWeight, textWeight];
        results = await this.execute(conn, sql, queryParams);
      } catch (error: any) {
        // FTS not available, fall back to vector search only
        console.warn('FTS not available, falling back to vector search only');
        const sql = `
          SELECT
            id,
            metadata,
            content,
            ${similarityFunc}(vector, ?::FLOAT[${this.config.dimensions}]) as score
          FROM ${escapedTableName}
          ORDER BY score DESC
          LIMIT ${options.topK || 10}
        `;

        const queryParams = [`[${normalizedQuery.join(',')}]`];
        results = await this.execute(conn, sql, queryParams);
      }

      return results.map(row => ({
        id: row.id,
        score: row.score,
        metadata: JSON.parse(row.metadata || '{}'),
      }));
    } finally {
      this.releaseConnection(conn);
    }
  }

  /**
   * Close all connections and cleanup
   */
  async close(): Promise<void> {
    return this.mutex.runExclusive(async () => {
      // Close all connections
      for (const conn of this.connectionPool) {
        conn.close();
      }
      this.connectionPool = [];

      // Close database
      if (this.db) {
        this.db.close();
        this.db = null;
      }

      this.initialized = false;
    });
  }

  /**
   * Get table name for an index
   */
  private getTableName(indexName: string): string {
    return `vectors_${indexName.replace(/[^a-zA-Z0-9_]/g, '_')}`;
  }

  /**
   * Escape SQL identifier to prevent SQL injection
   * DuckDB uses double quotes for identifiers, and escapes internal quotes by doubling
   */
  private escapeIdentifier(identifier: string): string {
    // Replace any double quotes with doubled quotes, then wrap in double quotes
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  /**
   * Validate identifier to prevent SQL injection attacks
   */
  private validateIdentifier(identifier: string, type: string = 'Identifier'): void {
    if (!identifier || typeof identifier !== 'string') {
      throw new Error(`${type} must be a non-empty string`);
    }

    // Check for common SQL injection patterns
    const dangerousPatterns = [
      /;/,           // SQL statement separator
      /--/,          // SQL comment
      /\/\*/,        // SQL block comment start
      /\*\//,        // SQL block comment end
      /\bDROP\b/i,   // DROP statement
      /\bTRUNCATE\b/i, // TRUNCATE statement
      /\bDELETE\b/i,   // DELETE statement (when not expected)
      /\bEXEC\b/i,     // EXEC statement
      /\bEXECUTE\b/i,  // EXECUTE statement
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(identifier)) {
        throw new Error(`${type} contains potentially dangerous characters or keywords`);
      }
    }

    // Enforce reasonable length limits
    if (identifier.length > 128) {
      throw new Error(`${type} must be 128 characters or less`);
    }
  }

  /**
   * Get similarity function based on metric
   */
  private getSimilarityFunction(): string {
    const functions: Record<string, string> = {
      cosine: 'array_cosine_similarity',
      euclidean: 'array_distance',
      dot: 'array_dot_product',
      dotproduct: 'array_dot_product',
    };
    return functions[this.config.metric] || 'array_cosine_similarity';
  }

  /**
   * Handle and transform errors
   */
  private handleError(error: unknown, context: string): Error {
    if (error instanceof Error) {
      return new Error(`${context}: ${error.message}`);
    }
    return new Error(`${context}: ${String(error)}`);
  }
}
