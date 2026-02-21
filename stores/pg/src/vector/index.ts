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
  DeleteVectorsParams,
  UpdateVectorParams,
} from '@mastra/core/vector';
import { Mutex } from 'async-mutex';
import * as pg from 'pg';
import xxhash from 'xxhash-wasm';

import { validateConfig, isCloudSqlConfig, isConnectionStringConfig, isHostConfig } from '../shared/config';
import type { PgVectorConfig } from '../shared/config';
import { PGFilterTranslator } from './filter';
import type { PGVectorFilter } from './filter';
import { buildFilterQuery, buildDeleteFilterQuery } from './sql-builder';
import type { IndexConfig, IndexType, VectorType } from './types';

export interface PGIndexStats extends IndexStats {
  type: IndexType;
  /**
   * The pgvector storage type used for this index.
   * - 'vector': Full precision (4 bytes per dimension)
   * - 'halfvec': Half precision (2 bytes per dimension)
   */
  vectorType: VectorType;
  config: {
    m?: number;
    efConstruction?: number;
    lists?: number;
    probes?: number;
  };
}

interface PgQueryVectorParams extends QueryVectorParams<PGVectorFilter> {
  minScore?: number;
  /**
   * HNSW search parameter. Controls the size of the dynamic candidate
   * list during search. Higher values improve accuracy at the cost of speed.
   */
  ef?: number;
  /**
   * IVFFlat probe parameter. Number of cells to visit during search.
   * Higher values improve accuracy at the cost of speed.
   */
  probes?: number;
}

interface PgCreateIndexParams extends CreateIndexParams {
  indexConfig?: IndexConfig;
  buildIndex?: boolean;
  /**
   * The pgvector storage type for embeddings.
   * - 'vector': Full precision (4 bytes per dimension), max 2000 dimensions for indexes (default)
   * - 'halfvec': Half precision (2 bytes per dimension), max 4000 dimensions for indexes
   *
   * Use 'halfvec' for large dimension models like text-embedding-3-large (3072 dimensions)
   */
  vectorType?: VectorType;
}

interface PgDefineIndexParams {
  indexName: string;
  metric: 'cosine' | 'euclidean' | 'dotproduct';
  indexConfig: IndexConfig;
  vectorType?: VectorType;
}

export class PgVector extends MastraVector<PGVectorFilter> {
  public pool: pg.Pool;
  private describeIndexCache: Map<string, PGIndexStats> = new Map();
  private createdIndexes = new Map<string, number>();
  private indexVectorTypes = new Map<string, VectorType>();
  private mutexesByName = new Map<string, Mutex>();
  private schema?: string;
  private setupSchemaPromise: Promise<void> | null = null;
  private installVectorExtensionPromise: Promise<void> | null = null;
  private vectorExtensionInstalled: boolean | undefined = undefined;
  private vectorExtensionSchema: string | null = null;
  private vectorExtensionVersion: string | null = null;
  private schemaSetupComplete: boolean | undefined = undefined;
  private cacheWarmupPromise: Promise<void> | null = null;

  constructor(config: PgVectorConfig & { id: string }) {
    try {
      validateConfig('PgVector', config);
      super({ id: config.id });

      this.schema = config.schemaName;

      let poolConfig: pg.PoolConfig;

      if (isConnectionStringConfig(config)) {
        poolConfig = {
          connectionString: config.connectionString,
          ssl: config.ssl,
          max: config.max ?? 20,
          idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
          connectionTimeoutMillis: 2000,
          ...config.pgPoolOptions,
        };
      } else if (isCloudSqlConfig(config)) {
        poolConfig = {
          ...config,
          max: config.pgPoolOptions?.max ?? 20,
          idleTimeoutMillis: config.pgPoolOptions?.idleTimeoutMillis ?? 30000,
          connectionTimeoutMillis: 2000,
          ...config.pgPoolOptions,
        } as pg.PoolConfig;
      } else if (isHostConfig(config)) {
        poolConfig = {
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.user,
          password: config.password,
          ssl: config.ssl,
          max: config.max ?? 20,
          idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
          connectionTimeoutMillis: 2000,
          ...config.pgPoolOptions,
        };
      } else {
        throw new Error('PgVector: invalid configuration provided');
      }

      this.pool = new pg.Pool(poolConfig);

      // Warm the created indexes cache in background so we don't need to check if indexes exist every time
      // Store the promise so we can wait for it during disconnect to avoid "pool already closed" errors
      this.cacheWarmupPromise = (async () => {
        try {
          const existingIndexes = await this.listIndexes();
          await Promise.all(
            existingIndexes.map(async indexName => {
              const info = await this.getIndexInfo({ indexName });
              const key = await this.getIndexCacheKey({
                indexName,
                metric: info.metric,
                dimension: info.dimension,
                type: info.type,
                vectorType: info.vectorType,
              });
              this.createdIndexes.set(indexName, key);
              this.indexVectorTypes.set(indexName, info.vectorType);
            }),
          );
        } catch (error) {
          // Don't throw - cache warming is optional optimization
          // If it fails (e.g., pool closed early), just log and continue
          this.logger?.debug('Cache warming skipped or failed', { error });
        }
      })();
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('PG', 'INITIALIZATION', 'FAILED'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            schemaName: 'schemaName' in config ? (config.schemaName ?? '') : '',
          },
        },
        error,
      );
    }
  }

  private getMutexByName(indexName: string) {
    if (!this.mutexesByName.has(indexName)) this.mutexesByName.set(indexName, new Mutex());
    return this.mutexesByName.get(indexName)!;
  }

  /**
   * Detects which schema contains the vector extension and its version
   */
  private async detectVectorExtensionSchema(client: pg.PoolClient): Promise<string | null> {
    try {
      const result = await client.query(`
        SELECT n.nspname as schema_name, e.extversion as version
        FROM pg_extension e
        JOIN pg_namespace n ON e.extnamespace = n.oid
        WHERE e.extname = 'vector'
        LIMIT 1;
      `);

      if (result.rows.length > 0) {
        this.vectorExtensionSchema = result.rows[0].schema_name;
        this.vectorExtensionVersion = result.rows[0].version;
        this.logger.debug('Vector extension found', {
          schema: this.vectorExtensionSchema,
          version: this.vectorExtensionVersion,
        });
        return this.vectorExtensionSchema;
      }

      return null;
    } catch (error) {
      this.logger.debug('Could not detect vector extension schema', { error });
      return null;
    }
  }

  /**
   * Checks if the installed pgvector version supports halfvec type.
   * halfvec was introduced in pgvector 0.7.0.
   */
  private supportsHalfvec(): boolean {
    if (!this.vectorExtensionVersion) {
      return false;
    }
    // Parse version string, handling non-numeric suffixes (e.g., "0.7.0-beta", "0.8.0+build")
    const parts = this.vectorExtensionVersion.split('.');
    const major = parseInt(parts[0] ?? '', 10);
    const minor = parseInt(parts[1] ?? '', 10);
    // If parsing failed (NaN), assume version doesn't support halfvec
    if (isNaN(major) || isNaN(minor)) {
      return false;
    }
    // halfvec was introduced in pgvector 0.7.0
    return major > 0 || (major === 0 && minor >= 7);
  }

  /**
   * Gets the properly qualified vector type name
   * @param vectorType - The type of vector storage ('vector' or 'halfvec')
   */
  private getVectorTypeName(vectorType: VectorType = 'vector'): string {
    // If we know where the extension is, use that
    if (this.vectorExtensionSchema) {
      // If it's in pg_catalog, return the type directly
      if (this.vectorExtensionSchema === 'pg_catalog') {
        return vectorType;
      }
      // Issue #10061: Always qualify with schema where vector extension is installed
      // This ensures the type is found regardless of the session's search_path
      const validatedSchema = parseSqlIdentifier(this.vectorExtensionSchema, 'vector extension schema');
      return `${validatedSchema}.${vectorType}`;
    }

    // Fallback to unqualified (will use search_path)
    return vectorType;
  }

  /**
   * Gets the operator class for index creation based on metric and vector type.
   * pgvector uses different operator classes for vector vs halfvec types.
   */
  private getMetricOperatorClass(metric: 'cosine' | 'euclidean' | 'dotproduct', vectorType: VectorType): string {
    const prefix = vectorType === 'halfvec' ? 'halfvec' : 'vector';
    switch (metric) {
      case 'cosine':
        return `${prefix}_cosine_ops`;
      case 'euclidean':
        return `${prefix}_l2_ops`;
      case 'dotproduct':
        return `${prefix}_ip_ops`;
      default:
        return `${prefix}_cosine_ops`;
    }
  }

  private getTableName(indexName: string) {
    const parsedIndexName = parseSqlIdentifier(indexName, 'index name');
    const quotedIndexName = `"${parsedIndexName}"`;
    const quotedSchemaName = this.getSchemaName();
    const quotedVectorName = `"${parsedIndexName}_vector_idx"`;
    return {
      tableName: quotedSchemaName ? `${quotedSchemaName}.${quotedIndexName}` : quotedIndexName,
      vectorIndexName: quotedVectorName,
    };
  }

  private getSchemaName() {
    return this.schema ? `"${parseSqlIdentifier(this.schema, 'schema name')}"` : undefined;
  }

  transformFilter(filter?: PGVectorFilter) {
    const translator = new PGFilterTranslator();
    return translator.translate(filter);
  }

  async getIndexInfo({ indexName }: DescribeIndexParams): Promise<PGIndexStats> {
    if (!this.describeIndexCache.has(indexName)) {
      this.describeIndexCache.set(indexName, await this.describeIndex({ indexName }));
    }
    return this.describeIndexCache.get(indexName)!;
  }

  async query({
    indexName,
    queryVector,
    topK = 10,
    filter,
    includeVector = false,
    minScore = -1,
    ef,
    probes,
  }: PgQueryVectorParams): Promise<QueryResult[]> {
    try {
      // Validate topK parameter
      validateTopK('PG', topK);
      if (queryVector !== undefined) {
        if (!Array.isArray(queryVector) || !queryVector.every(x => typeof x === 'number' && Number.isFinite(x))) {
          throw new Error('queryVector must be an array of finite numbers');
        }
      } else if (!filter || Object.keys(filter).length === 0) {
        throw new Error('Either queryVector or filter must be provided');
      }
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createVectorErrorId('PG', 'QUERY', 'INVALID_INPUT'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.USER,
          details: {
            indexName,
          },
        },
        error,
      );
      this.logger?.trackException(mastraError);
      throw mastraError;
    }

    // Metadata-only query: filter without vector similarity
    if (queryVector === undefined) {
      const client = await this.pool.connect();
      try {
        const translatedFilter = this.transformFilter(filter);
        const { sql: filterQuery, values: filterValues } = buildDeleteFilterQuery(translatedFilter);
        const { tableName } = this.getTableName(indexName);

        const query = `
          SELECT
            vector_id as id,
            metadata
            ${includeVector ? ', embedding' : ''}
          FROM ${tableName}
          ${filterQuery}
          ORDER BY vector_id
          LIMIT $${filterValues.length + 1}`;
        const result = await client.query(query, [...filterValues, topK]);

        return result.rows.map(({ id, metadata, embedding }: { id: string; metadata: any; embedding?: string }) => ({
          id,
          score: 0,
          metadata,
          ...(includeVector && embedding && { vector: JSON.parse(embedding) }),
        }));
      } catch (error) {
        const mastraError = new MastraError(
          {
            id: createVectorErrorId('PG', 'QUERY', 'FAILED'),
            domain: ErrorDomain.MASTRA_VECTOR,
            category: ErrorCategory.THIRD_PARTY,
            details: {
              indexName,
            },
          },
          error,
        );
        this.logger?.trackException(mastraError);
        throw mastraError;
      } finally {
        client.release();
      }
    }

    // Vector similarity query
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const vectorStr = `[${queryVector.join(',')}]`;
      const translatedFilter = this.transformFilter(filter);
      const { sql: filterQuery, values: filterValues } = buildFilterQuery(translatedFilter, minScore, topK);

      // Get index type and configuration
      const indexInfo = await this.getIndexInfo({ indexName });

      // Set HNSW search parameter if applicable
      if (indexInfo.type === 'hnsw') {
        // Calculate ef and clamp between 1 and 1000
        const calculatedEf = ef ?? Math.max(topK, (indexInfo?.config?.m ?? 16) * topK);
        const searchEf = Math.min(1000, Math.max(1, calculatedEf));
        await client.query(`SET LOCAL hnsw.ef_search = ${searchEf}`);
      }

      if (indexInfo.type === 'ivfflat' && probes) {
        await client.query(`SET LOCAL ivfflat.probes = ${probes}`);
      }

      const { tableName } = this.getTableName(indexName);

      // Get the properly qualified vector type based on the index's vector type
      const qualifiedVectorType = this.getVectorTypeName(indexInfo.vectorType);

      const query = `
        WITH vector_scores AS (
          SELECT
            vector_id as id,
            1 - (embedding <=> '${vectorStr}'::${qualifiedVectorType}) as score,
            metadata
            ${includeVector ? ', embedding' : ''}
          FROM ${tableName}
          ${filterQuery}
        )
        SELECT *
        FROM vector_scores
        WHERE score > $1
        ORDER BY score DESC
        LIMIT $2`;
      const result = await client.query(query, filterValues);
      await client.query('COMMIT');

      return result.rows.map(({ id, score, metadata, embedding }) => ({
        id,
        score,
        metadata,
        ...(includeVector && embedding && { vector: JSON.parse(embedding) }),
      }));
    } catch (error) {
      await client.query('ROLLBACK');
      const mastraError = new MastraError(
        {
          id: createVectorErrorId('PG', 'QUERY', 'FAILED'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
          },
        },
        error,
      );
      this.logger?.trackException(mastraError);
      throw mastraError;
    } finally {
      client.release();
    }
  }

  async upsert({
    indexName,
    vectors,
    metadata,
    ids,
    deleteFilter,
  }: UpsertVectorParams<PGVectorFilter>): Promise<string[]> {
    // Validate input parameters
    validateUpsertInput('PG', vectors, metadata, ids);

    const { tableName } = this.getTableName(indexName);

    // Start a transaction
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Step 1: If deleteFilter is provided, delete matching vectors first
      if (deleteFilter) {
        this.logger?.debug(`Deleting vectors matching filter before upsert`, { indexName, deleteFilter });

        // Reuse the filter translation logic
        const translatedFilter = this.transformFilter(deleteFilter);
        const { sql: filterQuery, values: filterValues } = buildDeleteFilterQuery(translatedFilter);

        const whereClause = filterQuery.trim().replace(/^WHERE\s+/i, '');
        if (whereClause) {
          const deleteQuery = `DELETE FROM ${tableName} WHERE ${whereClause}`;
          const result = await client.query(deleteQuery, filterValues);
          this.logger?.debug(`Deleted ${result.rowCount || 0} vectors before upsert`, {
            indexName,
            deletedCount: result.rowCount || 0,
          });
        }
      }

      // Step 2: Insert/update new vectors
      const vectorIds = ids || vectors.map(() => crypto.randomUUID());

      // Get the properly qualified vector type for this index
      const indexInfo = await this.getIndexInfo({ indexName });
      const qualifiedVectorType = this.getVectorTypeName(indexInfo.vectorType);

      for (let i = 0; i < vectors.length; i++) {
        const query = `
          INSERT INTO ${tableName} (vector_id, embedding, metadata)
          VALUES ($1, $2::${qualifiedVectorType}, $3::jsonb)
          ON CONFLICT (vector_id)
          DO UPDATE SET
            embedding = $2::${qualifiedVectorType},
            metadata = $3::jsonb
          RETURNING embedding::text
        `;

        await client.query(query, [vectorIds[i], `[${vectors[i]?.join(',')}]`, JSON.stringify(metadata?.[i] || {})]);
      }

      await client.query('COMMIT');

      this.logger?.debug(`Upserted ${vectors.length} vectors to ${indexName}`, {
        indexName,
        vectorCount: vectors.length,
        hadDeleteFilter: !!deleteFilter,
      });

      return vectorIds;
    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof Error && error.message?.includes('expected') && error.message?.includes('dimensions')) {
        const match = error.message.match(/expected (\d+) dimensions, not (\d+)/);
        if (match) {
          const [, expected, actual] = match;
          const mastraError = new MastraError(
            {
              id: createVectorErrorId('PG', 'UPSERT', 'INVALID_INPUT'),
              domain: ErrorDomain.MASTRA_VECTOR,
              category: ErrorCategory.USER,
              text:
                `Vector dimension mismatch: Index "${indexName}" expects ${expected} dimensions but got ${actual} dimensions. ` +
                `Either use a matching embedding model or delete and recreate the index with the new dimension.`,
              details: {
                indexName,
                expected: expected ?? '',
                actual: actual ?? '',
              },
            },
            error,
          );
          this.logger?.trackException(mastraError);
          throw mastraError;
        }
      }

      const mastraError = new MastraError(
        {
          id: createVectorErrorId('PG', 'UPSERT', 'FAILED'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
          },
        },
        error,
      );
      this.logger?.trackException(mastraError);
      throw mastraError;
    } finally {
      client.release();
    }
  }

  private hasher = xxhash();
  private async getIndexCacheKey({
    indexName,
    dimension,
    metric,
    type,
    vectorType = 'vector',
  }: CreateIndexParams & { type: IndexType | undefined; vectorType?: VectorType }) {
    const input = indexName + dimension + metric + (type || 'ivfflat') + vectorType; // ivfflat is default
    return (await this.hasher).h32(input);
  }
  private cachedIndexExists(indexName: string, newKey: number) {
    const existingIndexCacheKey = this.createdIndexes.get(indexName);
    return existingIndexCacheKey && existingIndexCacheKey === newKey;
  }
  private async setupSchema(client: pg.PoolClient) {
    if (!this.schema || this.schemaSetupComplete) {
      return;
    }

    if (!this.setupSchemaPromise) {
      this.setupSchemaPromise = (async () => {
        try {
          // First check if schema exists and we have usage permission
          const schemaCheck = await client.query(
            `
            SELECT EXISTS (
              SELECT 1 FROM information_schema.schemata
              WHERE schema_name = $1
            )
          `,
            [this.schema],
          );

          const schemaExists = schemaCheck.rows[0].exists;

          if (!schemaExists) {
            try {
              await client.query(`CREATE SCHEMA IF NOT EXISTS ${this.getSchemaName()}`);
              this.logger.info(`Schema "${this.schema}" created successfully`);
            } catch (error) {
              this.logger.error(`Failed to create schema "${this.schema}"`, { error });
              throw new Error(
                `Unable to create schema "${this.schema}". This requires CREATE privilege on the database. ` +
                  `Either create the schema manually or grant CREATE privilege to the user.`,
              );
            }
          }

          // If we got here, schema exists and we can use it
          this.schemaSetupComplete = true;
          this.logger.debug(`Schema "${this.schema}" is ready for use`);
        } catch (error) {
          // Reset flags so we can retry
          this.schemaSetupComplete = undefined;
          this.setupSchemaPromise = null;
          throw error;
        } finally {
          this.setupSchemaPromise = null;
        }
      })();
    }

    await this.setupSchemaPromise;
  }

  async createIndex({
    indexName,
    dimension,
    metric = 'cosine',
    indexConfig = {},
    buildIndex = true,
    vectorType = 'vector',
  }: PgCreateIndexParams): Promise<void> {
    const { tableName } = this.getTableName(indexName);

    // Validate inputs
    try {
      if (!indexName.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
        throw new Error('Invalid index name format');
      }
      if (!Number.isInteger(dimension) || dimension <= 0) {
        throw new Error('Dimension must be a positive integer');
      }
      if (vectorType !== 'vector' && vectorType !== 'halfvec') {
        throw new Error('vectorType must be "vector" or "halfvec"');
      }
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createVectorErrorId('PG', 'CREATE_INDEX', 'INVALID_INPUT'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.USER,
          details: {
            indexName,
          },
        },
        error,
      );
      this.logger?.trackException(mastraError);
      throw mastraError;
    }

    const indexCacheKey = await this.getIndexCacheKey({
      indexName,
      dimension,
      type: indexConfig.type,
      metric,
      vectorType,
    });
    if (this.cachedIndexExists(indexName, indexCacheKey)) {
      // we already saw this index get created since the process started, no need to recreate it
      return;
    }

    const mutex = this.getMutexByName(`create-${indexName}`);
    // Use async-mutex instead of advisory lock for perf (over 2x as fast)
    await mutex
      .runExclusive(async () => {
        if (this.cachedIndexExists(indexName, indexCacheKey)) {
          // this may have been created while we were waiting to acquire a lock
          return;
        }

        const client = await this.pool.connect();

        try {
          // Setup schema if needed
          await this.setupSchema(client);

          // Install vector extension and detect where it is
          await this.installVectorExtension(client);

          // Check if halfvec is supported when requested
          if (vectorType === 'halfvec' && !this.supportsHalfvec()) {
            throw new MastraError({
              id: createVectorErrorId('PG', 'CREATE_INDEX', 'HALFVEC_NOT_SUPPORTED'),
              text:
                `halfvec type requires pgvector >= 0.7.0, but version ${this.vectorExtensionVersion || 'unknown'} is installed. ` +
                `Either upgrade pgvector or use vectorType: 'vector' (which supports up to 2000 dimensions for indexes).`,
              domain: ErrorDomain.MASTRA_VECTOR,
              category: ErrorCategory.USER,
              details: {
                indexName,
                requestedVectorType: vectorType,
                pgvectorVersion: this.vectorExtensionVersion || 'unknown',
                requiredVersion: '0.7.0',
              },
            });
          }

          // Set search path to include both schemas if needed
          if (
            this.schema &&
            this.vectorExtensionSchema &&
            this.schema !== this.vectorExtensionSchema &&
            this.vectorExtensionSchema !== 'pg_catalog'
          ) {
            await client.query(`SET search_path TO ${this.getSchemaName()}, "${this.vectorExtensionSchema}"`);
          }

          // Use the properly qualified vector type (vector or halfvec)
          const qualifiedVectorType = this.getVectorTypeName(vectorType);

          await client.query(`
          CREATE TABLE IF NOT EXISTS ${tableName} (
            id SERIAL PRIMARY KEY,
            vector_id TEXT UNIQUE NOT NULL,
            embedding ${qualifiedVectorType}(${dimension}),
            metadata JSONB DEFAULT '{}'::jsonb
          );
        `);
          this.createdIndexes.set(indexName, indexCacheKey);
          this.indexVectorTypes.set(indexName, vectorType);

          if (buildIndex) {
            await this.setupIndex({ indexName, metric, indexConfig, vectorType }, client);
          }
        } catch (error: any) {
          this.createdIndexes.delete(indexName);
          this.indexVectorTypes.delete(indexName);
          throw error;
        } finally {
          client.release();
        }
      })
      .catch(error => {
        const mastraError = new MastraError(
          {
            id: createVectorErrorId('PG', 'CREATE_INDEX', 'FAILED'),
            domain: ErrorDomain.MASTRA_VECTOR,
            category: ErrorCategory.THIRD_PARTY,
            details: {
              indexName,
            },
          },
          error,
        );
        this.logger?.trackException(mastraError);
        throw mastraError;
      });
  }

  async buildIndex({ indexName, metric = 'cosine', indexConfig }: PgDefineIndexParams): Promise<void> {
    const client = await this.pool.connect();
    try {
      await this.setupIndex({ indexName, metric, indexConfig }, client);
    } catch (error: any) {
      const mastraError = new MastraError(
        {
          id: createVectorErrorId('PG', 'BUILD_INDEX', 'FAILED'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
          },
        },
        error,
      );
      this.logger?.trackException(mastraError);
      throw mastraError;
    } finally {
      client.release();
    }
  }

  private async setupIndex(
    { indexName, metric, indexConfig, vectorType = 'vector' }: PgDefineIndexParams,
    client: pg.PoolClient,
  ) {
    const mutex = this.getMutexByName(`build-${indexName}`);
    // Use async-mutex instead of advisory lock for perf (over 2x as fast)
    await mutex.runExclusive(async () => {
      // Check if the index config is empty
      const isConfigEmpty =
        !indexConfig ||
        Object.keys(indexConfig).length === 0 ||
        (!indexConfig.type && !indexConfig.ivf && !indexConfig.hnsw);
      // Determine index type - use defaults if no config provided
      const indexType = isConfigEmpty ? 'ivfflat' : indexConfig.type || 'ivfflat';

      const { tableName, vectorIndexName } = this.getTableName(indexName);

      // Try to get existing index info to check if configuration has changed
      let existingIndexInfo: PGIndexStats | null = null;
      let dimension = 0;
      try {
        existingIndexInfo = await this.getIndexInfo({ indexName });
        dimension = existingIndexInfo.dimension;

        if (isConfigEmpty && existingIndexInfo.metric === metric) {
          if (existingIndexInfo.type === 'flat') {
            // No index exists - create the default ivfflat
            this.logger?.debug(`No index exists for ${vectorIndexName}, will create default ivfflat index`);
          } else {
            // Preserve existing non-flat index
            this.logger?.debug(
              `Index ${vectorIndexName} already exists (type: ${existingIndexInfo.type}, metric: ${existingIndexInfo.metric}), preserving existing configuration`,
            );
            const cacheKey = await this.getIndexCacheKey({
              indexName,
              dimension,
              type: existingIndexInfo.type,
              metric: existingIndexInfo.metric,
              vectorType: existingIndexInfo.vectorType,
            });
            this.createdIndexes.set(indexName, cacheKey);
            this.indexVectorTypes.set(indexName, existingIndexInfo.vectorType);
            return;
          }
        }

        // If config was empty but metric didn't match, OR config was provided, check for changes
        let configMatches = existingIndexInfo.metric === metric && existingIndexInfo.type === indexType;
        if (indexType === 'hnsw') {
          configMatches =
            configMatches &&
            existingIndexInfo.config.m === (indexConfig.hnsw?.m ?? 8) &&
            existingIndexInfo.config.efConstruction === (indexConfig.hnsw?.efConstruction ?? 32);
        } else if (indexType === 'flat') {
          configMatches = configMatches && existingIndexInfo.type === 'flat';
        } else if (indexType === 'ivfflat' && indexConfig.ivf?.lists) {
          configMatches = configMatches && existingIndexInfo.config.lists === indexConfig.ivf?.lists;
        }

        if (configMatches) {
          this.logger?.debug(`Index ${vectorIndexName} already exists with same configuration, skipping recreation`);
          // Update cache with the existing configuration
          const cacheKey = await this.getIndexCacheKey({
            indexName,
            dimension,
            type: existingIndexInfo.type,
            metric: existingIndexInfo.metric,
            vectorType: existingIndexInfo.vectorType,
          });
          this.createdIndexes.set(indexName, cacheKey);
          this.indexVectorTypes.set(indexName, existingIndexInfo.vectorType);
          return;
        }

        // Configuration changed, need to rebuild
        this.logger?.info(`Index ${vectorIndexName} configuration changed, rebuilding index`);
        await client.query(`DROP INDEX IF EXISTS ${vectorIndexName}`);
        this.describeIndexCache.delete(indexName);
      } catch {
        this.logger?.debug(`Index ${indexName} doesn't exist yet, will create it`);
      }

      if (indexType === 'flat') {
        this.describeIndexCache.delete(indexName);
        return;
      }

      // Get the operator class based on vector type and metric
      // pgvector uses different operator classes for vector vs halfvec
      // Use the detected vectorType from existing table if available, otherwise use the parameter
      const effectiveVectorType = existingIndexInfo?.vectorType ?? vectorType;
      const metricOp = this.getMetricOperatorClass(metric, effectiveVectorType);

      let indexSQL: string;
      if (indexType === 'hnsw') {
        const m = indexConfig.hnsw?.m ?? 8;
        const efConstruction = indexConfig.hnsw?.efConstruction ?? 32;

        indexSQL = `
          CREATE INDEX IF NOT EXISTS ${vectorIndexName}
          ON ${tableName}
          USING hnsw (embedding ${metricOp})
          WITH (
            m = ${m},
            ef_construction = ${efConstruction}
          )
        `;
      } else {
        let lists: number;
        if (indexConfig.ivf?.lists) {
          lists = indexConfig.ivf.lists;
        } else {
          const size = (await client.query(`SELECT COUNT(*) FROM ${tableName}`)).rows[0].count;
          lists = Math.max(100, Math.min(4000, Math.floor(Math.sqrt(size) * 2)));
        }
        indexSQL = `
          CREATE INDEX IF NOT EXISTS ${vectorIndexName}
          ON ${tableName}
          USING ivfflat (embedding ${metricOp})
          WITH (lists = ${lists});
        `;
      }

      await client.query(indexSQL);
    });
  }

  private async installVectorExtension(client: pg.PoolClient) {
    // If we've already successfully installed, no need to do anything
    if (this.vectorExtensionInstalled) {
      return;
    }

    // If there's no existing installation attempt or the previous one failed
    if (!this.installVectorExtensionPromise) {
      this.installVectorExtensionPromise = (async () => {
        try {
          // First, detect if and where the extension is already installed
          const existingSchema = await this.detectVectorExtensionSchema(client);

          if (existingSchema) {
            this.vectorExtensionInstalled = true;
            this.vectorExtensionSchema = existingSchema;
            this.logger.info(`Vector extension already installed in schema: ${existingSchema}`);
            return;
          }

          // Try to install the extension
          try {
            // First try to install in the custom schema if provided
            if (this.schema && this.schema !== 'public') {
              try {
                await client.query(`CREATE EXTENSION IF NOT EXISTS vector SCHEMA ${this.getSchemaName()}`);
                // Re-detect to get the version info (needed for halfvec support check)
                const installedSchema = await this.detectVectorExtensionSchema(client);
                if (installedSchema) {
                  this.vectorExtensionInstalled = true;
                  this.logger.info(`Vector extension installed in schema: ${installedSchema}`);
                  return;
                }
                // Fallback if detection failed but install succeeded
                this.vectorExtensionInstalled = true;
                this.vectorExtensionSchema = this.schema;
                this.logger.info(`Vector extension installed in schema: ${this.schema}`);
                return;
              } catch (schemaError) {
                this.logger.debug(`Could not install vector extension in schema ${this.schema}, trying public schema`, {
                  error: schemaError,
                });
              }
            }

            // Fall back to installing in public schema (or default)
            await client.query('CREATE EXTENSION IF NOT EXISTS vector');

            // Detect where it was actually installed
            const installedSchema = await this.detectVectorExtensionSchema(client);
            if (installedSchema) {
              this.vectorExtensionInstalled = true;
              this.vectorExtensionSchema = installedSchema;
              this.logger.info(`Vector extension installed in schema: ${installedSchema}`);
            }
          } catch (error) {
            this.logger.warn(
              'Could not install vector extension. This requires superuser privileges. ' +
                'If the extension is already installed, you can ignore this warning.',
              { error },
            );

            // Even if installation failed, check if it exists somewhere
            const existingSchema = await this.detectVectorExtensionSchema(client);
            if (existingSchema) {
              this.vectorExtensionInstalled = true;
              this.vectorExtensionSchema = existingSchema;
              this.logger.info(`Vector extension found in schema: ${existingSchema}`);
            }
          }
        } catch (error) {
          this.logger.error('Error setting up vector extension', { error });
          this.vectorExtensionInstalled = undefined;
          this.installVectorExtensionPromise = null;
          throw error;
        } finally {
          this.installVectorExtensionPromise = null;
        }
      })();
    }

    await this.installVectorExtensionPromise;
  }

  async listIndexes(): Promise<string[]> {
    const client = await this.pool.connect();
    try {
      // Query for tables that match the exact Mastra PgVector table structure:
      // Must have: vector_id (TEXT), embedding (vector or halfvec), metadata (JSONB)
      const mastraTablesQuery = `
        SELECT DISTINCT t.table_name
        FROM information_schema.tables t
        WHERE t.table_schema = $1
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns c
          WHERE c.table_schema = t.table_schema
          AND c.table_name = t.table_name
          AND c.column_name = 'vector_id'
          AND c.data_type = 'text'
        )
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns c
          WHERE c.table_schema = t.table_schema
          AND c.table_name = t.table_name
          AND c.column_name = 'embedding'
          AND c.udt_name IN ('vector', 'halfvec')
        )
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns c
          WHERE c.table_schema = t.table_schema
          AND c.table_name = t.table_name
          AND c.column_name = 'metadata'
          AND c.data_type = 'jsonb'
        );
      `;
      const mastraTables = await client.query(mastraTablesQuery, [this.schema || 'public']);
      return mastraTables.rows.map(row => row.table_name);
    } catch (e) {
      const mastraError = new MastraError(
        {
          id: createVectorErrorId('PG', 'LIST_INDEXES', 'FAILED'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
        },
        e,
      );
      this.logger?.trackException(mastraError);
      throw mastraError;
    } finally {
      client.release();
    }
  }

  /**
   * Retrieves statistics about a vector index.
   *
   * @param {string} indexName - The name of the index to describe
   * @returns A promise that resolves to the index statistics including dimension, count and metric
   */
  async describeIndex({ indexName }: DescribeIndexParams): Promise<PGIndexStats> {
    const client = await this.pool.connect();
    try {
      const { tableName } = this.getTableName(indexName);

      // Check if table exists with a vector or halfvec column
      const tableExistsQuery = `
        SELECT udt_name
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
          AND udt_name IN ('vector', 'halfvec')
        LIMIT 1;
      `;
      const tableExists = await client.query(tableExistsQuery, [this.schema || 'public', indexName]);

      if (tableExists.rows.length === 0) {
        throw new Error(`Vector table ${tableName} does not exist`);
      }

      // Determine the vector type from the column
      const vectorType: VectorType = tableExists.rows[0].udt_name === 'halfvec' ? 'halfvec' : 'vector';

      // Get vector dimension
      const dimensionQuery = `
                SELECT atttypmod as dimension
                FROM pg_attribute
                WHERE attrelid = $1::regclass
                AND attname = 'embedding';
            `;

      // Get row count
      const countQuery = `
                SELECT COUNT(*) as count
                FROM ${tableName};
            `;

      // Get index metric type
      const indexQuery = `
            SELECT
                am.amname as index_method,
                pg_get_indexdef(i.indexrelid) as index_def,
                opclass.opcname as operator_class
            FROM pg_index i
            JOIN pg_class c ON i.indexrelid = c.oid
            JOIN pg_am am ON c.relam = am.oid
            JOIN pg_opclass opclass ON i.indclass[0] = opclass.oid
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE c.relname = $1
            AND n.nspname = $2;
            `;

      const [dimResult, countResult, indexResult] = await Promise.all([
        client.query(dimensionQuery, [tableName]),
        client.query(countQuery),
        client.query(indexQuery, [`${indexName}_vector_idx`, this.schema || 'public']),
      ]);

      const { index_method, index_def, operator_class } = indexResult.rows[0] || {
        index_method: 'flat',
        index_def: '',
        operator_class: 'cosine',
      };

      // Convert pg_vector index method to our metric type
      const metric = operator_class.includes('l2')
        ? 'euclidean'
        : operator_class.includes('ip')
          ? 'dotproduct'
          : 'cosine';

      // Parse index configuration
      const config: { m?: number; efConstruction?: number; lists?: number } = {};

      if (index_method === 'hnsw') {
        const m = index_def.match(/m\s*=\s*'?(\d+)'?/)?.[1];
        const efConstruction = index_def.match(/ef_construction\s*=\s*'?(\d+)'?/)?.[1];
        if (m) config.m = parseInt(m);
        if (efConstruction) config.efConstruction = parseInt(efConstruction);
      } else if (index_method === 'ivfflat') {
        const lists = index_def.match(/lists\s*=\s*'?(\d+)'?/)?.[1];
        if (lists) config.lists = parseInt(lists);
      }

      return {
        dimension: dimResult.rows[0].dimension,
        count: parseInt(countResult.rows[0].count),
        metric,
        type: index_method as 'flat' | 'hnsw' | 'ivfflat',
        vectorType,
        config,
      };
    } catch (e: any) {
      await client.query('ROLLBACK');
      const mastraError = new MastraError(
        {
          id: createVectorErrorId('PG', 'DESCRIBE_INDEX', 'FAILED'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
          },
        },
        e,
      );
      this.logger?.trackException(mastraError);
      throw mastraError;
    } finally {
      client.release();
    }
  }

  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    const client = await this.pool.connect();
    try {
      const { tableName } = this.getTableName(indexName);
      // Drop the table
      await client.query(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
      this.createdIndexes.delete(indexName);
      this.indexVectorTypes.delete(indexName);
      this.describeIndexCache.delete(indexName);
    } catch (error: any) {
      await client.query('ROLLBACK');
      const mastraError = new MastraError(
        {
          id: createVectorErrorId('PG', 'DELETE_INDEX', 'FAILED'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
          },
        },
        error,
      );
      this.logger?.trackException(mastraError);
      throw mastraError;
    } finally {
      client.release();
    }
  }

  async truncateIndex({ indexName }: DeleteIndexParams): Promise<void> {
    const client = await this.pool.connect();
    try {
      const { tableName } = this.getTableName(indexName);
      await client.query(`TRUNCATE ${tableName}`);
    } catch (e: any) {
      await client.query('ROLLBACK');
      const mastraError = new MastraError(
        {
          id: createVectorErrorId('PG', 'TRUNCATE_INDEX', 'FAILED'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
          },
        },
        e,
      );
      this.logger?.trackException(mastraError);
      throw mastraError;
    } finally {
      client.release();
    }
  }

  async disconnect() {
    // Wait for cache warmup to complete before closing pool
    // This prevents "Cannot use a pool after calling end on the pool" errors
    if (this.cacheWarmupPromise) {
      try {
        await this.cacheWarmupPromise;
      } catch {
        // Ignore errors - we're shutting down anyway
      }
    }

    await this.pool.end();
  }

  /**
   * Updates a vector by its ID with the provided vector and/or metadata.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to update.
   * @param update - An object containing the vector and/or metadata to update.
   * @param update.vector - An optional array of numbers representing the new vector.
   * @param update.metadata - An optional record containing the new metadata.
   * @returns A promise that resolves when the update is complete.
   * @throws Will throw an error if no updates are provided or if the update operation fails.
   */
  async updateVector({ indexName, id, filter, update }: UpdateVectorParams<PGVectorFilter>): Promise<void> {
    let client;
    try {
      if (!update.vector && !update.metadata) {
        throw new Error('No updates provided');
      }

      // Validate that exactly one of id or filter is provided
      if (!id && !filter) {
        throw new MastraError({
          id: createVectorErrorId('PG', 'UPDATE_VECTOR', 'NO_TARGET'),
          text: 'Either id or filter must be provided',
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.USER,
          details: { indexName },
        });
      }

      if (id && filter) {
        throw new MastraError({
          id: createVectorErrorId('PG', 'UPDATE_VECTOR', 'MUTUALLY_EXCLUSIVE'),
          text: 'Cannot provide both id and filter - they are mutually exclusive',
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.USER,
          details: { indexName },
        });
      }

      client = await this.pool.connect();
      const { tableName } = this.getTableName(indexName);

      // Get the properly qualified vector type for this index
      const indexInfo = await this.getIndexInfo({ indexName });
      const qualifiedVectorType = this.getVectorTypeName(indexInfo.vectorType);

      let updateParts = [];
      let values: any[] = [];
      let valueIndex = 1;

      // Build SET clause
      if (update.vector) {
        updateParts.push(`embedding = $${valueIndex}::${qualifiedVectorType}`);
        values.push(`[${update.vector.join(',')}]`);
        valueIndex++;
      }

      if (update.metadata) {
        updateParts.push(`metadata = $${valueIndex}::jsonb`);
        values.push(JSON.stringify(update.metadata));
        valueIndex++;
      }

      if (updateParts.length === 0) {
        return;
      }

      let whereClause: string;
      let whereValues: any[];

      if (id) {
        // Update by ID
        whereClause = `vector_id = $${valueIndex}`;
        whereValues = [id];
      } else {
        // Update by filter
        if (!filter || Object.keys(filter).length === 0) {
          throw new MastraError({
            id: createVectorErrorId('PG', 'UPDATE_VECTOR', 'EMPTY_FILTER'),
            text: 'Cannot update with empty filter',
            domain: ErrorDomain.MASTRA_VECTOR,
            category: ErrorCategory.USER,
            details: { indexName },
          });
        }

        const translatedFilter = this.transformFilter(filter);
        const { sql: filterQuery, values: filterValues } = buildDeleteFilterQuery(translatedFilter);

        // Extract WHERE clause (remove "WHERE" prefix if present)
        whereClause = filterQuery.trim().replace(/^WHERE\s+/i, '');

        if (!whereClause) {
          throw new MastraError({
            id: createVectorErrorId('PG', 'UPDATE_VECTOR', 'INVALID_FILTER'),
            text: 'Filter produced empty WHERE clause',
            domain: ErrorDomain.MASTRA_VECTOR,
            category: ErrorCategory.USER,
            details: { indexName, filter: JSON.stringify(filter) },
          });
        }

        // Adjust parameter indices for filter values
        whereClause = whereClause.replace(/\$(\d+)/g, (match, num) => {
          const newIndex = parseInt(num) + valueIndex - 1;
          return `$${newIndex}`;
        });
        whereValues = filterValues;
      }

      const query = `
        UPDATE ${tableName}
        SET ${updateParts.join(', ')}
        WHERE ${whereClause}
      `;

      const result = await client.query(query, [...values, ...whereValues]);

      this.logger?.info(`Updated ${result.rowCount || 0} vectors in ${indexName}`, {
        indexName,
        id: id ? id : undefined,
        filter: filter ? filter : undefined,
        updatedCount: result.rowCount || 0,
      });
    } catch (error: any) {
      if (error instanceof MastraError) {
        throw error;
      }

      const mastraError = new MastraError(
        {
          id: createVectorErrorId('PG', 'UPDATE_VECTOR', 'FAILED'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            ...(id && { id }),
            ...(filter && { filter: JSON.stringify(filter) }),
          },
        },
        error,
      );
      this.logger?.trackException(mastraError);
      throw mastraError;
    } finally {
      client?.release();
    }
  }

  /**
   * Deletes a vector by its ID.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to delete.
   * @returns A promise that resolves when the deletion is complete.
   * @throws Will throw an error if the deletion operation fails.
   */
  async deleteVector({ indexName, id }: DeleteVectorParams): Promise<void> {
    let client;
    try {
      client = await this.pool.connect();
      const { tableName } = this.getTableName(indexName);
      const query = `
        DELETE FROM ${tableName}
        WHERE vector_id = $1
      `;
      await client.query(query, [id]);
    } catch (error: any) {
      const mastraError = new MastraError(
        {
          id: createVectorErrorId('PG', 'DELETE_VECTOR', 'FAILED'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            id,
          },
        },
        error,
      );
      this.logger?.trackException(mastraError);
      throw mastraError;
    } finally {
      client?.release();
    }
  }

  /**
   * Delete vectors matching a metadata filter.
   * @param indexName - The name of the index containing the vectors.
   * @param filter - The filter to match vectors for deletion.
   * @returns A promise that resolves when the deletion is complete.
   * @throws Will throw an error if the deletion operation fails.
   */
  async deleteVectors({ indexName, filter, ids }: DeleteVectorsParams<PGVectorFilter>): Promise<void> {
    let client;
    try {
      client = await this.pool.connect();
      const { tableName } = this.getTableName(indexName);

      // Validate that exactly one of filter or ids is provided
      if (!filter && !ids) {
        throw new MastraError({
          id: createVectorErrorId('PG', 'DELETE_VECTORS', 'NO_TARGET'),
          text: 'Either filter or ids must be provided',
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.USER,
          details: { indexName },
        });
      }

      if (filter && ids) {
        throw new MastraError({
          id: createVectorErrorId('PG', 'DELETE_VECTORS', 'MUTUALLY_EXCLUSIVE'),
          text: 'Cannot provide both filter and ids - they are mutually exclusive',
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.USER,
          details: { indexName },
        });
      }

      let query: string;
      let values: any[];

      if (ids) {
        // Delete by IDs
        if (ids.length === 0) {
          throw new MastraError({
            id: createVectorErrorId('PG', 'DELETE_VECTORS', 'EMPTY_IDS'),
            text: 'Cannot delete with empty ids array',
            domain: ErrorDomain.MASTRA_VECTOR,
            category: ErrorCategory.USER,
            details: { indexName },
          });
        }

        const placeholders = ids.map((_: string, i: number) => `$${i + 1}`).join(', ');
        query = `DELETE FROM ${tableName} WHERE vector_id IN (${placeholders})`;
        values = ids;
      } else {
        // Delete by filter
        // Safety check: Don't allow empty filters to prevent accidental deletion of all vectors
        if (!filter || Object.keys(filter).length === 0) {
          throw new MastraError({
            id: createVectorErrorId('PG', 'DELETE_VECTORS', 'EMPTY_FILTER'),
            text: 'Cannot delete with empty filter. Use deleteIndex to delete all vectors.',
            domain: ErrorDomain.MASTRA_VECTOR,
            category: ErrorCategory.USER,
            details: { indexName },
          });
        }

        // Translate filter using existing infrastructure
        const translatedFilter = this.transformFilter(filter);
        const { sql: filterQuery, values: filterValues } = buildDeleteFilterQuery(translatedFilter);

        // Extract WHERE clause (remove "WHERE" prefix if present)
        const whereClause = filterQuery.trim().replace(/^WHERE\s+/i, '');

        if (!whereClause) {
          throw new MastraError({
            id: createVectorErrorId('PG', 'DELETE_VECTORS', 'INVALID_FILTER'),
            text: 'Filter produced empty WHERE clause',
            domain: ErrorDomain.MASTRA_VECTOR,
            category: ErrorCategory.USER,
            details: { indexName, filter: JSON.stringify(filter) },
          });
        }

        query = `DELETE FROM ${tableName} WHERE ${whereClause}`;
        values = filterValues;
      }

      // Execute the delete query
      const result = await client.query(query, values);

      this.logger?.info(`Deleted ${result.rowCount || 0} vectors from ${indexName}`, {
        indexName,
        filter: filter ? filter : undefined,
        ids: ids ? ids : undefined,
        deletedCount: result.rowCount || 0,
      });
    } catch (error: any) {
      // Re-throw MastraErrors as-is
      if (error instanceof MastraError) {
        throw error;
      }

      // Wrap other errors
      const mastraError = new MastraError(
        {
          id: createVectorErrorId('PG', 'DELETE_VECTORS', 'FAILED'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            ...(filter && { filter: JSON.stringify(filter) }),
            ...(ids && { idsCount: ids.length }),
          },
        },
        error,
      );
      this.logger?.trackException(mastraError);
      throw mastraError;
    } finally {
      client?.release();
    }
  }
}
