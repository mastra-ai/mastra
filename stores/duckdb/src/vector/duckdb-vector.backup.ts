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

import * as duckdb from 'duckdb';
import { Mutex } from 'async-mutex';
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
  private mutex = new Mutex();
  private initialized = false;

  constructor(config: DuckDBVectorConfig = {}) {
    super({
      provider: 'duckdb',
      name: 'DuckDB Vector Store',
    });

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
        // Create DuckDB instance
        const dbOptions: DuckDBConnectionOptions = {
          max_memory: this.config.memoryLimit,
          threads: this.config.threads,
          access_mode: this.config.readOnly ? 'read_only' : 'read_write',
        };

        this.db = new duckdb.Database(this.config.path, dbOptions);

        // Create connection pool
        for (let i = 0; i < this.config.poolSize; i++) {
          const conn = this.db.connect();
          this.connectionPool.push(conn);
        }

        // Install and load extensions
        const conn = await this.getConnection();
        for (const ext of this.config.extensions) {
          await this.execute(conn, `INSTALL ${ext};`);
          await this.execute(conn, `LOAD ${ext};`);
        }

        // Create default tables
        await this.createDefaultTables(conn);

        this.releaseConnection(conn);
        this.initialized = true;
      } catch (error) {
        throw this.handleError(error, 'Failed to initialize DuckDB');
      }
    });
  }

  /**
   * Get a connection from the pool
   */
  private async getConnection(): Promise<duckdb.Connection> {
    await this.initialize();

    return this.mutex.runExclusive(async () => {
      const conn = this.connectionPool.pop();
      if (!conn) {
        throw new Error('No available connections in pool');
      }
      return conn;
    });
  }

  /**
   * Release a connection back to the pool
   */
  private releaseConnection(conn: duckdb.Connection): void {
    this.connectionPool.push(conn);
  }

  /**
   * Execute a SQL query
   */
  private async execute(
    conn: duckdb.Connection,
    sql: string,
    params: any[] = []
  ): Promise<any[]> {
    return new Promise((resolve, reject) => {
      conn.all(sql, ...params, (err: Error | null, result: any[]) => {
        if (err) reject(err);
        else resolve(result || []);
      });
    });
  }

  /**
   * Create default tables and indexes
   */
  private async createDefaultTables(conn: duckdb.Connection): Promise<void> {
    // Create indexes table
    await this.execute(conn, `
      CREATE TABLE IF NOT EXISTS vector_indexes (
        name VARCHAR PRIMARY KEY,
        dimension INTEGER NOT NULL,
        metric VARCHAR NOT NULL,
        total_vectors INTEGER DEFAULT 0,
        m INTEGER DEFAULT 16,
        ef_construction INTEGER DEFAULT 128,
        ef_search INTEGER DEFAULT 64,
        created_at TIMESTAMP DEFAULT current_timestamp,
        updated_at TIMESTAMP DEFAULT current_timestamp
      )
    `);

    // Create template for vector tables (will be created per index)
    // Each index gets its own table for isolation
  }

  /**
   * Create a new vector index
   */
  async createIndex(params: CreateIndexParams): Promise<void> {
    const conn = await this.getConnection();

    try {
      const { name, dimension, metric = this.config.metric } = params;

      // Validate index doesn't exist
      const existing = await this.execute(
        conn,
        'SELECT name FROM vector_indexes WHERE name = ?',
        [name]
      );

      if (existing.length > 0) {
        throw new Error(`Index "${name}" already exists`);
      }

      // Create index metadata
      await this.execute(conn, `
        INSERT INTO vector_indexes (name, dimension, metric)
        VALUES (?, ?, ?)
      `, [name, dimension, metric]);

      // Create vector table for this index
      const tableName = `vectors_${name.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      await this.execute(conn, `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id VARCHAR PRIMARY KEY,
          vector FLOAT[${dimension}],
          content TEXT,
          metadata JSON,
          created_at TIMESTAMP DEFAULT current_timestamp,
          updated_at TIMESTAMP DEFAULT current_timestamp
        )
      `);

      // Create HNSW index
      const metricMap: Record<string, string> = {
        cosine: 'cosine',
        euclidean: 'l2sq',
        dot: 'ip',
      };

      await this.execute(conn, `
        CREATE INDEX idx_${tableName}_hnsw
        ON ${tableName}
        USING HNSW (vector)
        WITH (metric = '${metricMap[metric]}', M = 16, ef_construction = 128)
      `);

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
      const { indexName, vectors, namespace } = params;
      const tableName = this.getTableName(indexName);
      const insertedIds: string[] = [];

      // Start transaction for batch insert
      await this.execute(conn, 'BEGIN TRANSACTION');

      for (const vector of vectors) {
        const { id, values, metadata = {}, sparseValues } = vector;

        // Add namespace to metadata if provided
        const fullMetadata = namespace
          ? { ...metadata, namespace }
          : metadata;

        // Validate vector dimensions
        validateVector(values, this.config.dimensions);

        // Normalize vector if using cosine similarity
        const normalizedValues = this.config.metric === 'cosine'
          ? normalizeVector(values)
          : values;

        // Upsert vector
        await this.execute(conn, `
          INSERT INTO ${tableName} (id, vector, content, metadata)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET
            vector = EXCLUDED.vector,
            metadata = EXCLUDED.metadata,
            updated_at = current_timestamp
        `, [
          id,
          `[${normalizedValues.join(',')}]`,
          fullMetadata.content || '',
          JSON.stringify(fullMetadata),
        ]);

        insertedIds.push(id);
      }

      // Update vector count
      await this.execute(conn, `
        UPDATE vector_indexes
        SET total_vectors = (SELECT COUNT(*) FROM ${tableName}),
            updated_at = current_timestamp
        WHERE name = ?
      `, [indexName]);

      await this.execute(conn, 'COMMIT');
      return insertedIds;

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
      const {
        indexName,
        queryVector,
        topK = 10,
        filter,
        includeVectors = false,
        includeMetadata = true,
        namespace,
      } = params;

      const tableName = this.getTableName(indexName);

      // Validate and normalize query vector
      validateVector(queryVector, this.config.dimensions);
      const normalizedQuery = this.config.metric === 'cosine'
        ? normalizeVector(queryVector)
        : queryVector;

      // Build filter SQL
      const filterBuilder = new DuckDBFilterBuilder();
      let whereClause = '';
      const filterParams: any[] = [];

      if (filter || namespace) {
        const filterSql = filterBuilder.build(filter, namespace);
        if (filterSql.sql) {
          whereClause = `WHERE ${filterSql.sql}`;
          filterParams.push(...filterSql.params);
        }
      }

      // Get similarity function based on metric
      const similarityFunc = this.getSimilarityFunction();

      // Query similar vectors
      const sql = `
        SELECT
          id,
          ${includeVectors ? 'vector,' : ''}
          ${includeMetadata ? 'metadata,' : ''}
          content,
          ${similarityFunc}(vector, ?::FLOAT[${this.config.dimensions}]) as score
        FROM ${tableName}
        ${whereClause}
        ORDER BY score DESC
        LIMIT ?
      `;

      const queryParams = [
        `[${normalizedQuery.join(',')}]`,
        ...filterParams,
        topK,
      ];

      const results = await this.execute(conn, sql, queryParams);

      return results.map((row) => ({
        id: row.id,
        score: row.score,
        values: includeVectors ? JSON.parse(row.vector) : undefined,
        metadata: includeMetadata ? JSON.parse(row.metadata) : undefined,
        sparseValues: undefined, // DuckDB doesn't support sparse vectors natively
      }));

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
      const results = await this.execute(
        conn,
        'SELECT name FROM vector_indexes ORDER BY name'
      );
      return results.map((row) => row.name);
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

      const results = await this.execute(conn, `
        SELECT * FROM vector_indexes WHERE name = ?
      `, [indexName]);

      if (results.length === 0) {
        throw new Error(`Index "${indexName}" not found`);
      }

      const index = results[0];
      const tableName = this.getTableName(indexName);

      // Get table size
      const sizeResult = await this.execute(conn, `
        SELECT
          COUNT(*) as count,
          SUM(LENGTH(vector::VARCHAR)) as vector_size
        FROM ${tableName}
      `);

      return {
        dimension: index.dimension,
        count: index.total_vectors,
        metric: index.metric,
        status: 'ready',
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
      const tableName = this.getTableName(indexName);

      // Drop table and index
      await this.execute(conn, `DROP TABLE IF EXISTS ${tableName}`);

      // Remove from indexes table
      await this.execute(conn,
        'DELETE FROM vector_indexes WHERE name = ?',
        [indexName]
      );

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
      const { indexName, id, values, metadata, sparseValues } = params;
      const tableName = this.getTableName(indexName);

      const updates: string[] = [];
      const updateParams: any[] = [];

      if (values) {
        validateVector(values, this.config.dimensions);
        const normalizedValues = this.config.metric === 'cosine'
          ? normalizeVector(values)
          : values;
        updates.push('vector = ?');
        updateParams.push(`[${normalizedValues.join(',')}]`);
      }

      if (metadata) {
        updates.push('metadata = ?');
        updateParams.push(JSON.stringify(metadata));
      }

      if (updates.length === 0) return;

      updates.push('updated_at = current_timestamp');
      updateParams.push(id);

      await this.execute(conn, `
        UPDATE ${tableName}
        SET ${updates.join(', ')}
        WHERE id = ?
      `, updateParams);

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
      const tableName = this.getTableName(indexName);

      const ids = Array.isArray(id) ? id : [id];
      const placeholders = ids.map(() => '?').join(',');

      await this.execute(conn, `
        DELETE FROM ${tableName}
        WHERE id IN (${placeholders})
      `, ids);

      // Update vector count
      await this.execute(conn, `
        UPDATE vector_indexes
        SET total_vectors = (SELECT COUNT(*) FROM ${tableName}),
            updated_at = current_timestamp
        WHERE name = ?
      `, [indexName]);

    } finally {
      this.releaseConnection(conn);
    }
  }

  /**
   * Import vectors from Parquet file
   */
  async importFromParquet(
    indexName: string,
    options: ParquetImportOptions
  ): Promise<number> {
    const conn = await this.getConnection();

    try {
      const tableName = this.getTableName(indexName);
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
        INSERT INTO ${tableName} (id, vector, content, metadata)
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
      await this.execute(conn, `
        UPDATE vector_indexes
        SET total_vectors = (SELECT COUNT(*) FROM ${tableName}),
            updated_at = current_timestamp
        WHERE name = ?
      `, [indexName]);

      return result.length;

    } finally {
      this.releaseConnection(conn);
    }
  }

  /**
   * Perform hybrid search (vector + text)
   */
  async hybridSearch(
    indexName: string,
    queryVector: number[],
    textQuery: string,
    options: DuckDBQueryOptions = {}
  ): Promise<QueryResult[]> {
    const conn = await this.getConnection();

    try {
      const {
        vectorWeight = 0.7,
        topK = 10,
        filter,
        namespace,
      } = options;

      const tableName = this.getTableName(indexName);
      const textWeight = 1 - vectorWeight;

      // Validate and normalize query vector
      validateVector(queryVector, this.config.dimensions);
      const normalizedQuery = this.config.metric === 'cosine'
        ? normalizeVector(queryVector)
        : queryVector;

      // Build filter SQL
      const filterBuilder = new DuckDBFilterBuilder();
      let whereClause = '';
      const filterParams: any[] = [];

      if (filter || namespace) {
        const filterSql = filterBuilder.build(filter, namespace);
        if (filterSql.sql) {
          whereClause = `AND ${filterSql.sql}`;
          filterParams.push(...filterSql.params);
        }
      }

      // Get similarity function
      const similarityFunc = this.getSimilarityFunction();

      // Hybrid search query
      const sql = `
        WITH vector_scores AS (
          SELECT
            id,
            ${similarityFunc}(vector, ?::FLOAT[${this.config.dimensions}]) as vector_score
          FROM ${tableName}
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
          WHERE 1=1 ${whereClause}
        )
        SELECT
          c.id,
          vec.metadata,
          vec.content,
          c.final_score as score
        FROM combined_scores c
        JOIN ${tableName} vec ON c.id = vec.id
        ORDER BY c.final_score DESC
        LIMIT ?
      `;

      const queryParams = [
        `[${normalizedQuery.join(',')}]`,
        textQuery,
        vectorWeight,
        textWeight,
        ...filterParams,
        topK,
      ];

      const results = await this.execute(conn, sql, queryParams);

      return results.map((row) => ({
        id: row.id,
        score: row.score,
        metadata: JSON.parse(row.metadata),
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
   * Get similarity function based on metric
   */
  private getSimilarityFunction(): string {
    const functions: Record<string, string> = {
      cosine: 'array_cosine_similarity',
      euclidean: 'array_distance',
      dot: 'array_dot_product',
    };
    return functions[this.config.metric] || functions.cosine;
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