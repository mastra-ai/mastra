import { DuckDBInstance } from '@duckdb/node-api';
import type { DuckDBValue } from '@duckdb/node-api';
import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import { createVectorErrorId } from '@mastra/core/storage';
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
import { buildFilterClause } from './filter-builder.js';
import type { DuckDBVectorConfig, DuckDBVectorFilter } from './types.js';

/**
 * DuckDB vector store implementation for Mastra.
 *
 * Provides embedded high-performance vector storage with HNSW indexing
 * using the DuckDB VSS extension for vector similarity search.
 *
 * Key features:
 * - Embedded database (no server required)
 * - HNSW indexing for fast similarity search
 * - SQL interface for metadata filtering
 * - Native Parquet support
 */
export class DuckDBVector extends MastraVector<DuckDBVectorFilter> {
  private config: DuckDBVectorConfig;
  private instance: DuckDBInstance | null = null;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor(config: DuckDBVectorConfig) {
    super({ id: config.id });
    this.config = {
      path: ':memory:',
      dimensions: 1536,
      metric: 'cosine',
      ...config,
    };
  }

  /**
   * Initialize the database connection and load required extensions.
   */
  private async initialize(): Promise<void> {
    if (this.initialized && this.instance) return;

    // If there's an existing initPromise, wait for it, but verify instance exists
    if (this.initPromise) {
      await this.initPromise;
      // If instance was closed while initializing, reset and retry
      if (!this.instance) {
        this.initPromise = null;
        this.initialized = false;
      } else {
        return;
      }
    }

    this.initPromise = (async () => {
      try {
        // Create DuckDB instance
        this.instance = await DuckDBInstance.create(this.config.path!);
        const connection = await this.instance.connect();

        try {
          // Install and load the VSS extension for vector operations
          await connection.run('INSTALL vss;');
          await connection.run('LOAD vss;');
        } catch {
          // VSS might already be installed, try just loading it
          try {
            await connection.run('LOAD vss;');
          } catch {
            // Continue without VSS - will use basic array operations
            this.logger.warn('VSS extension not available, using basic array operations');
          }
        }

        this.initialized = true;
      } catch (error) {
        // Reset state on error to allow retry
        this.instance = null;
        this.initialized = false;
        this.initPromise = null;
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Get a database connection.
   */
  private async getConnection() {
    await this.initialize();
    if (!this.instance) {
      throw new Error('DuckDB instance not initialized');
    }
    return this.instance.connect();
  }

  /**
   * Execute a SQL query and return results.
   */
  private async runQuery<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const connection = await this.getConnection();
    try {
      // Replace ? placeholders with $1, $2, etc. for DuckDB
      let paramIndex = 0;
      const preparedSql = sql.replace(/\?/g, () => `$${++paramIndex}`);

      const stmt = await connection.prepare(preparedSql);
      // Bind parameters as array - DuckDB Node API bind() accepts array
      stmt.bind(params as DuckDBValue[]);
      const result = await stmt.run();
      const rows = await result.getRows();

      // Convert rows to objects
      const columns = result.columnNames();
      return rows.map(row => {
        const obj: Record<string, unknown> = {};
        columns.forEach((col, i) => {
          obj[col] = row[i];
        });
        return obj as T;
      });
    } finally {
      // Connection cleanup is automatic in @duckdb/node-api
    }
  }

  /**
   * Execute a SQL statement without returning results.
   */
  private async runStatement(sql: string, params: unknown[] = []): Promise<void> {
    const connection = await this.getConnection();
    try {
      if (params.length === 0) {
        await connection.run(sql);
      } else {
        // Replace ? placeholders with $1, $2, etc. for DuckDB
        let paramIndex = 0;
        const preparedSql = sql.replace(/\?/g, () => `$${++paramIndex}`);

        const stmt = await connection.prepare(preparedSql);
        // Bind parameters as array - DuckDB Node API bind() accepts array
        stmt.bind(params as DuckDBValue[]);
        await stmt.run();
      }
    } finally {
      // Connection cleanup is automatic
    }
  }

  /**
   * Validate and escape a SQL identifier (table name, column name).
   */
  private escapeIdentifier(name: string): string {
    // Validate identifier format
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw new Error(`Invalid identifier: ${name}. Only alphanumeric characters and underscores are allowed.`);
    }
    return `"${name}"`;
  }

  /**
   * Get the distance function for the configured metric.
   */
  private getDistanceFunction(): string {
    switch (this.config.metric) {
      case 'cosine':
        return 'array_cosine_distance';
      case 'euclidean':
        return 'array_distance';
      case 'dotproduct':
        return 'array_inner_product';
      default:
        return 'array_cosine_distance';
    }
  }

  async query(params: QueryVectorParams<DuckDBVectorFilter>): Promise<QueryResult[]> {
    await this.initialize();

    const { indexName, queryVector, topK = 10, filter, includeVector = false } = params;

    if (!queryVector) {
      throw new MastraError({
        id: createVectorErrorId('DUCKDB', 'QUERY', 'MISSING_VECTOR'),
        text: 'queryVector is required for DuckDB queries. Metadata-only queries are not supported by this vector store.',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    // Validate topK parameter
    validateTopK('DUCKDB', topK);

    const tableName = this.escapeIdentifier(indexName);
    const distanceFunc = this.getDistanceFunction();

    // Build the vector literal
    const vectorLiteral = `[${queryVector.join(', ')}]::FLOAT[${queryVector.length}]`;

    // Build filter clause
    const { clause: filterClause } = filter ? buildFilterClause(filter) : { clause: '' };

    // Build query
    const selectCols = includeVector ? 'id, vector, metadata, distance' : 'id, metadata, distance';

    const sql = `
      SELECT ${selectCols}
      FROM (
        SELECT 
          id,
          ${includeVector ? 'vector,' : ''}
          metadata,
          ${distanceFunc}(vector, ${vectorLiteral}) as distance
        FROM ${tableName}
        ${filterClause ? `WHERE ${filterClause}` : ''}
      ) subq
      ORDER BY distance ${this.config.metric === 'dotproduct' ? 'DESC' : 'ASC'}
      LIMIT ${topK}
    `;

    const connection = await this.getConnection();
    const result = await connection.run(sql);
    const rows = await result.getRows();
    const columns = result.columnNames();

    return rows.map(row => {
      const rowObj: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        rowObj[col] = row[i];
      });

      const distance = rowObj.distance as number;
      const score =
        this.config.metric === 'cosine'
          ? 1 - distance
          : this.config.metric === 'euclidean'
            ? 1 / (1 + distance)
            : distance;

      const metadata = typeof rowObj.metadata === 'string' ? JSON.parse(rowObj.metadata as string) : rowObj.metadata;

      const queryResult: QueryResult = {
        id: rowObj.id as string,
        score,
        metadata: metadata as Record<string, unknown>,
      };

      if (includeVector && rowObj.vector) {
        queryResult.vector = Array.isArray(rowObj.vector)
          ? (rowObj.vector as number[])
          : JSON.parse(rowObj.vector as string);
      }

      return queryResult;
    });
  }

  async upsert(params: UpsertVectorParams): Promise<string[]> {
    await this.initialize();

    const { indexName, vectors, metadata, ids } = params;

    // Validate input parameters
    validateUpsertInput('DUCKDB', vectors, metadata, ids);

    const tableName = this.escapeIdentifier(indexName);

    // Generate IDs if not provided
    const vectorIds = ids || vectors.map(() => crypto.randomUUID());

    // Insert each vector using parameterized queries for IDs
    for (let i = 0; i < vectors.length; i++) {
      const id = vectorIds[i]!;
      const vector = vectors[i]!;
      const meta = metadata?.[i] || {};

      const vectorLiteral = `[${vector.join(', ')}]::FLOAT[${vector.length}]`;
      const metadataJson = JSON.stringify(meta);

      // Use INSERT OR REPLACE for upsert behavior with parameterized ID
      const sql = `
        INSERT OR REPLACE INTO ${tableName} (id, vector, metadata)
        VALUES (?, ${vectorLiteral}, '${metadataJson.replace(/'/g, "''")}')
      `;

      await this.runStatement(sql, [id]);
    }

    return vectorIds;
  }

  async createIndex(params: CreateIndexParams): Promise<void> {
    await this.initialize();

    const { indexName, dimension, metric } = params;
    const tableName = this.escapeIdentifier(indexName);

    // Store the metric for this index if provided
    if (metric) {
      this.config.metric = metric;
    }

    const connection = await this.getConnection();

    // Create table with vector column
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id VARCHAR PRIMARY KEY,
        vector FLOAT[${dimension}],
        metadata JSON
      )
    `;

    await connection.run(createTableSql);

    // Create HNSW index for fast similarity search
    try {
      const indexNameStr = `${indexName}_hnsw_idx`;
      const createIndexSql = `
        CREATE INDEX IF NOT EXISTS "${indexNameStr}"
        ON ${tableName}
        USING HNSW (vector)
      `;
      await connection.run(createIndexSql);
    } catch {
      // HNSW index creation might fail if not supported, continue without it
      this.logger.warn(`Could not create HNSW index for ${indexName}, falling back to linear scan`);
    }
  }

  async listIndexes(): Promise<string[]> {
    await this.initialize();

    const connection = await this.getConnection();
    const result = await connection.run(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'main'
        AND table_type = 'BASE TABLE'
    `);

    const rows = await result.getRows();
    return rows.map(row => row[0] as string);
  }

  async describeIndex(params: DescribeIndexParams): Promise<IndexStats> {
    await this.initialize();

    const { indexName } = params;
    const tableName = this.escapeIdentifier(indexName);

    const connection = await this.getConnection();

    // Get vector dimension from table schema
    const schemaResult = await connection.run(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name = '${indexName}' AND column_name = 'vector'
    `);

    const schemaRows = await schemaResult.getRows();

    if (schemaRows.length === 0) {
      throw new Error(`Index "${indexName}" not found`);
    }

    // Parse dimension from type like "FLOAT[1536]"
    const dataType = schemaRows[0]![0] as string;
    const dimensionMatch = dataType.match(/\[(\d+)\]/);
    const dimension = dimensionMatch ? parseInt(dimensionMatch[1]!, 10) : 0;

    // Get row count
    const countResult = await connection.run(`SELECT COUNT(*) as count FROM ${tableName}`);
    const countRows = await countResult.getRows();
    const count = Number(countRows[0]?.[0] || 0);

    return {
      dimension,
      count,
      metric: this.config.metric || 'cosine',
    };
  }

  async deleteIndex(params: DeleteIndexParams): Promise<void> {
    await this.initialize();

    const { indexName } = params;
    const tableName = this.escapeIdentifier(indexName);

    const connection = await this.getConnection();
    await connection.run(`DROP TABLE IF EXISTS ${tableName}`);
  }

  async updateVector(params: UpdateVectorParams<DuckDBVectorFilter>): Promise<void> {
    await this.initialize();

    const { indexName, update } = params;
    const tableName = this.escapeIdentifier(indexName);

    if (!update.vector && !update.metadata) {
      throw new Error('No updates provided');
    }

    const hasId = 'id' in params && params.id;
    const hasFilter = 'filter' in params && params.filter;

    // Check for mutual exclusivity
    if (hasId && hasFilter) {
      throw new Error('id and filter are mutually exclusive - provide only one');
    }

    if (!hasId && !hasFilter) {
      throw new Error('Either id or filter must be provided');
    }

    const updates: string[] = [];

    if (update.vector) {
      updates.push(`vector = [${update.vector.join(', ')}]::FLOAT[${update.vector.length}]`);
    }

    if (update.metadata) {
      const metadataJson = JSON.stringify(update.metadata).replace(/'/g, "''");
      updates.push(`metadata = '${metadataJson}'`);
    }

    if (hasId) {
      // Update by ID with parameterized query
      const sql = `UPDATE ${tableName} SET ${updates.join(', ')} WHERE id = ?`;
      await this.runStatement(sql, [params.id]);
    } else if (hasFilter) {
      // Update by filter - check for empty filter
      const filter = params.filter!;
      if (Object.keys(filter).length === 0) {
        throw new Error('Cannot update with empty filter');
      }

      const { clause } = buildFilterClause(filter);
      // Update ALL matching vectors, not just the first one
      await this.runStatement(`UPDATE ${tableName} SET ${updates.join(', ')} WHERE ${clause}`);
    }
  }

  async deleteVector(params: DeleteVectorParams): Promise<void> {
    await this.initialize();

    const { indexName, id } = params;
    const tableName = this.escapeIdentifier(indexName);

    // Use parameterized query for ID
    const sql = `DELETE FROM ${tableName} WHERE id = ?`;
    await this.runStatement(sql, [id]);
  }

  async deleteVectors(params: DeleteVectorsParams<DuckDBVectorFilter>): Promise<void> {
    await this.initialize();

    const { indexName, ids, filter } = params;
    const tableName = this.escapeIdentifier(indexName);

    if (!ids && !filter) {
      throw new Error('Either filter or ids must be provided');
    }

    if (ids && filter) {
      throw new Error('ids and filter are mutually exclusive - provide only one');
    }

    if (ids) {
      // Delete by IDs with parameterized query
      if (ids.length === 0) {
        throw new Error('Cannot delete with empty ids array');
      }

      // Create placeholders for each ID
      const placeholders = ids.map(() => '?').join(', ');
      const sql = `DELETE FROM ${tableName} WHERE id IN (${placeholders})`;
      await this.runStatement(sql, ids);
    } else if (filter) {
      // Delete by filter - check for empty filter
      if (Object.keys(filter).length === 0) {
        throw new Error('Cannot delete with empty filter');
      }

      const { clause } = buildFilterClause(filter);
      await this.runStatement(`DELETE FROM ${tableName} WHERE ${clause}`);
    }
  }

  /**
   * Close the database connection.
   * After closing, the vector store can be reused by calling methods that require initialization.
   */
  async close(): Promise<void> {
    if (this.instance) {
      // DuckDBInstance doesn't have a close method - just reset the reference
      // The garbage collector will handle cleanup
      this.instance = null;
      this.initialized = false;
      this.initPromise = null; // Reset initPromise to allow re-initialization
    }
  }
}
