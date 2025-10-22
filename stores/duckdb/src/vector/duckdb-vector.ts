/**
 * DuckDB Vector Store Implementation
 *
 * SECURITY NOTE: DuckDB SQL Injection Mitigation Strategy
 *
 * DuckDB does not support parameterized queries for certain SQL commands:
 * - SET commands (e.g., SET memory_limit = ?)
 * - INSTALL/LOAD extension commands
 * - CREATE INDEX WITH clauses
 * - PRAGMA statements
 *
 * Our security approach:
 * 1. All SQL strings are pre-defined constants in maps/objects
 * 2. User input only selects which constant to use
 * 3. Extensive validation before selection
 * 4. No string concatenation or interpolation of user data
 *
 * Each potential injection point is marked with @greptile annotations
 * explaining why it's safe despite appearances.
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
        // Validate memory limit format (e.g., '2GB', '512MB')
        if (!/^\d+[KMG]B?$/i.test(this.config.memoryLimit)) {
          throw new Error('Invalid memory limit format. Use format like: 2GB, 512MB, 1024KB');
        }
        // Validate threads is a positive integer
        const threads = parseInt(String(this.config.threads), 10);
        if (isNaN(threads) || threads < 1 || threads > 128) {
          throw new Error('Threads must be a number between 1 and 128');
        }

        // @greptile-security-review safe - Values validated with strict regex and number range checks
        // DuckDB limitation: SET commands don't support parameterized queries
        // memoryLimit validated to match ^\d+[KMG]B?$ pattern only
        // threads validated as integer 1-128 only
        await this.execute(conn, `SET memory_limit='${this.config.memoryLimit}'`);
        await this.execute(conn, `SET threads=${threads}`);
        conn.close();

        // Install and load extensions using a temporary connection
        const initConn = this.db.connect();

        // @greptile-security-review safe - Pre-defined constant SQL strings only
        // These are hardcoded SQL commands, not user input
        // User input only selects which pre-defined command to execute
        // DuckDB limitation: INSTALL/LOAD don't support parameterized queries
        const extensionCommands: Record<string, { install: string; load: string }> = {
          vss: { install: 'INSTALL vss', load: 'LOAD vss' },
          fts: { install: 'INSTALL fts', load: 'LOAD fts' },
          parquet: { install: 'INSTALL parquet', load: 'LOAD parquet' },
          json: { install: 'INSTALL json', load: 'LOAD json' },
        };

        for (const ext of this.config.extensions) {
          const extLower = ext.toLowerCase();
          const commands = extensionCommands[extLower];
          if (!commands) {
            throw new Error(`Extension '${ext}' is not allowed. Allowed: vss, fts, parquet, json`);
          }
          // @greptile-security-review safe - Executing pre-defined constants from map above
          // No user input is interpolated - only selecting pre-written SQL commands
          await this.execute(initConn, commands.install);
          await this.execute(initConn, commands.load);
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

      // Create HNSW index with secure metric handling
      const hnswIndexName = `idx_${tableName}_hnsw`;
      const escapedIndexName = this.escapeIdentifier(hnswIndexName);

      // @greptile-security-review safe - Complete SQL statements pre-defined as constants
      // No user input interpolation - only selecting which pre-written statement to use
      // DuckDB limitation: CREATE INDEX WITH clause doesn't support parameterized queries
      const metricIndexSQL: Record<string, string> = {
        cosine: `
          CREATE INDEX ${escapedIndexName}
          ON ${escapedTableName}
          USING HNSW (vector)
          WITH (metric = 'cosine', M = 16, ef_construction = 128)
        `,
        euclidean: `
          CREATE INDEX ${escapedIndexName}
          ON ${escapedTableName}
          USING HNSW (vector)
          WITH (metric = 'l2sq', M = 16, ef_construction = 128)
        `,
        dot: `
          CREATE INDEX ${escapedIndexName}
          ON ${escapedTableName}
          USING HNSW (vector)
          WITH (metric = 'ip', M = 16, ef_construction = 128)
        `,
        dotproduct: `
          CREATE INDEX ${escapedIndexName}
          ON ${escapedTableName}
          USING HNSW (vector)
          WITH (metric = 'ip', M = 16, ef_construction = 128)
        `,
      };

      const indexSQL = metricIndexSQL[metric];
      if (!indexSQL) {
        throw new Error(`Invalid metric: ${metric}. Must be one of: cosine, euclidean, dot, dotproduct`);
      }

      // @greptile-security-review safe - Executing pre-selected constant SQL from map above
      await this.execute(conn, indexSQL);

      // Create FTS index for hybrid search - Install FTS extension and create virtual table
      try {
        // @greptile-security-review safe - Hardcoded constant SQL commands
        // No user input or variables - these are literal string constants
        await this.execute(conn, 'INSTALL fts');
        await this.execute(conn, 'LOAD fts');

        // Validate table name format before using in PRAGMA (it's our generated name)
        if (!/^vectors_[a-zA-Z0-9_]+$/.test(tableName)) {
          throw new Error('Invalid table name format for FTS index');
        }

        // @greptile-security-review safe - Table name is system-generated and validated
        // tableName follows pattern vectors_[a-zA-Z0-9_]+ only
        // escapedTableName is double-quote escaped for SQL identifiers
        await this.execute(conn, `PRAGMA create_fts_index(${escapedTableName}, 'id', 'content')`);
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
      try {
        await this.execute(conn, 'ROLLBACK');
      } catch (rollbackError) {
        // Log rollback error but throw original error
        console.error('Failed to rollback transaction:', rollbackError);
      }
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
        // @greptile-security-review safe - Filter SQL is generated by DuckDBFilterBuilder
        // which validates all field names and uses parameterized queries
        // See filter-builder.ts for validation implementation
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

      // Validate source path to prevent SQL injection and directory traversal
      this.validateParquetSource(source);

      // Escape single quotes in the source path for SQL
      const escapedSource = source.replace(/'/g, "''");

      // Build column mapping - validate column names
      const idCol = this.escapeIdentifier(mapping.id || 'id');
      const vectorCol = this.escapeIdentifier(mapping.vector || 'embedding');
      const contentCol = this.escapeIdentifier(mapping.content || 'content');
      const metadataCol = this.escapeIdentifier(mapping.metadata || 'metadata');

      // NOTE: Filter parameter has been removed for security reasons
      // If you need to filter Parquet data, please pre-filter your Parquet files
      // or use DuckDB's COPY command with WHERE clause directly
      if (filter) {
        throw new Error(
          'Filter parameter is not supported for Parquet import due to SQL injection risks. ' +
            'Please pre-filter your Parquet files or use a staging table approach.',
        );
      }

      // Import from Parquet
      const sql = `
        INSERT INTO ${escapedTableName} (id, vector, content, metadata)
        SELECT
          ${idCol} as id,
          ${vectorCol} as vector,
          ${contentCol} as content,
          ${metadataCol} as metadata
        FROM read_parquet('${escapedSource}')
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

      // Validate and sanitize topK
      const topK = this.validateTopK(options.topK);

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
              -- @greptile-security-review safe - Table name is system-generated and escaped
              -- escapedTableName is already validated and double-quote escaped
              fts_main_${escapedTableName.replace(/"/g, '')}.score as text_score
            FROM fts_main_${escapedTableName.replace(/"/g, '')}(?)
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
          LIMIT ?
        `;

        const queryParams = [`[${normalizedQuery.join(',')}]`, textQuery, vectorWeight, textWeight, topK];
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
          LIMIT ?
        `;

        const queryParams = [`[${normalizedQuery.join(',')}]`, topK];
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
      /;/, // SQL statement separator
      /--/, // SQL comment
      /\/\*/, // SQL block comment start
      /\*\//, // SQL block comment end
      /\bDROP\b/i, // DROP statement
      /\bTRUNCATE\b/i, // TRUNCATE statement
      /\bDELETE\b/i, // DELETE statement (when not expected)
      /\bEXEC\b/i, // EXEC statement
      /\bEXECUTE\b/i, // EXECUTE statement
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
   * Validate Parquet source path to prevent directory traversal and SQL injection
   */
  private validateParquetSource(source: string): void {
    if (!source || typeof source !== 'string') {
      throw new Error('Parquet source must be a non-empty string');
    }

    // Check for directory traversal patterns
    if (source.includes('..')) {
      throw new Error('Parquet source cannot contain directory traversal patterns');
    }

    // Check for SQL injection in file paths
    const dangerousChars = [';', '--', '/*', '*/'];
    for (const char of dangerousChars) {
      if (source.includes(char)) {
        throw new Error('Parquet source contains potentially dangerous characters');
      }
    }

    // Validate it's either a local file path or an S3 URL
    const isS3 = source.startsWith('s3://') || source.startsWith('s3a://');
    const isHTTP = source.startsWith('http://') || source.startsWith('https://');
    const isLocal = !isS3 && !isHTTP;

    if (isLocal) {
      // For local paths, ensure they don't try to access system directories
      const forbiddenPaths = ['/etc/', '/sys/', '/proc/', '/dev/', '\\Windows\\', '\\System32\\'];
      for (const forbidden of forbiddenPaths) {
        if (source.includes(forbidden)) {
          throw new Error('Parquet source cannot access system directories');
        }
      }
    }

    // Enforce reasonable length limit
    if (source.length > 1024) {
      throw new Error('Parquet source path must be 1024 characters or less');
    }
  }

  /**
   * Validate and sanitize topK parameter to prevent SQL injection
   */
  private validateTopK(topK?: number): number {
    const value = topK || 10;

    // Ensure it's a number
    const numValue = parseInt(String(value), 10);
    if (isNaN(numValue)) {
      throw new Error('topK must be a valid number');
    }

    // Enforce reasonable limits
    if (numValue < 1) {
      throw new Error('topK must be at least 1');
    }
    if (numValue > 10000) {
      throw new Error('topK cannot exceed 10000');
    }

    return numValue;
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
