import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { parseSqlIdentifier } from '@mastra/core/utils';
import { MastraVector } from '@mastra/core/vector';
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
} from '@mastra/core/vector';
import { Mutex } from 'async-mutex';
import * as pg from 'pg';
import xxhash from 'xxhash-wasm';

import { validateConfig, isCloudSqlConfig, isConnectionStringConfig, isHostConfig } from '../shared/config';
import type { PgVectorConfig } from '../shared/config';
import { PGFilterTranslator } from './filter';
import type { PGVectorFilter } from './filter';
import { buildFilterQuery } from './sql-builder';
import type { IndexConfig, IndexType } from './types';

export interface PGIndexStats extends IndexStats {
  type: IndexType;
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
}

interface PgDefineIndexParams {
  indexName: string;
  metric: 'cosine' | 'euclidean' | 'dotproduct';
  indexConfig: IndexConfig;
}

export class PgVector extends MastraVector<PGVectorFilter> {
  public pool: pg.Pool;
  private describeIndexCache: Map<string, PGIndexStats> = new Map();
  private createdIndexes = new Map<string, number>();
  private mutexesByName = new Map<string, Mutex>();
  private schema?: string;
  private setupSchemaPromise: Promise<void> | null = null;
  private installVectorExtensionPromise: Promise<void> | null = null;
  private vectorExtensionInstalled: boolean | undefined = undefined;
  private vectorExtensionSchema: string | null = null;
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
          max: config.max ?? 20,
          idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
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
              });
              this.createdIndexes.set(indexName, key);
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
          id: 'MASTRA_STORAGE_PG_VECTOR_INITIALIZATION_FAILED',
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
   * Detects which schema contains the vector extension
   */
  private async detectVectorExtensionSchema(client: pg.PoolClient): Promise<string | null> {
    try {
      const result = await client.query(`
        SELECT n.nspname as schema_name
        FROM pg_extension e
        JOIN pg_namespace n ON e.extnamespace = n.oid
        WHERE e.extname = 'vector'
        LIMIT 1;
      `);

      if (result.rows.length > 0) {
        this.vectorExtensionSchema = result.rows[0].schema_name;
        this.logger.debug('Vector extension found in schema', { schema: this.vectorExtensionSchema });
        return this.vectorExtensionSchema;
      }

      return null;
    } catch (error) {
      this.logger.debug('Could not detect vector extension schema', { error });
      return null;
    }
  }

  /**
   * Gets the properly qualified vector type name
   */
  private getVectorTypeName(): string {
    // If we know where the extension is, use that
    if (this.vectorExtensionSchema) {
      // If it's in pg_catalog, return vector
      if (this.vectorExtensionSchema === 'pg_catalog') {
        return 'vector';
      }
      // If it's in the current schema, return vector
      if (this.vectorExtensionSchema === (this.schema || 'public')) {
        return 'vector';
      }
      // Otherwise, qualify it with the schema where vector extension is installed
      const validatedSchema = parseSqlIdentifier(this.vectorExtensionSchema, 'vector extension schema');
      return `${validatedSchema}.vector`;
    }

    // Fallback to unqualified (will use search_path)
    return 'vector';
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
      if (!Number.isInteger(topK) || topK <= 0) {
        throw new Error('topK must be a positive integer');
      }
      if (!Array.isArray(queryVector) || !queryVector.every(x => typeof x === 'number' && Number.isFinite(x))) {
        throw new Error('queryVector must be an array of finite numbers');
      }
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_VECTOR_QUERY_INVALID_INPUT',
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

      // Get the properly qualified vector type
      const vectorType = this.getVectorTypeName();

      const query = `
        WITH vector_scores AS (
          SELECT
            vector_id as id,
            1 - (embedding <=> '${vectorStr}'::${vectorType}) as score,
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
          id: 'MASTRA_STORAGE_PG_VECTOR_QUERY_FAILED',
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

  async upsert({ indexName, vectors, metadata, ids }: UpsertVectorParams): Promise<string[]> {
    const { tableName } = this.getTableName(indexName);

    // Start a transaction
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const vectorIds = ids || vectors.map(() => crypto.randomUUID());

      // Get the properly qualified vector type
      const vectorType = this.getVectorTypeName();

      for (let i = 0; i < vectors.length; i++) {
        const query = `
          INSERT INTO ${tableName} (vector_id, embedding, metadata)
          VALUES ($1, $2::${vectorType}, $3::jsonb)
          ON CONFLICT (vector_id)
          DO UPDATE SET
            embedding = $2::${vectorType},
            metadata = $3::jsonb
          RETURNING embedding::text
        `;

        await client.query(query, [vectorIds[i], `[${vectors[i]?.join(',')}]`, JSON.stringify(metadata?.[i] || {})]);
      }

      await client.query('COMMIT');
      return vectorIds;
    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof Error && error.message?.includes('expected') && error.message?.includes('dimensions')) {
        const match = error.message.match(/expected (\d+) dimensions, not (\d+)/);
        if (match) {
          const [, expected, actual] = match;
          const mastraError = new MastraError(
            {
              id: 'MASTRA_STORAGE_PG_VECTOR_UPSERT_INVALID_INPUT',
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
          id: 'MASTRA_STORAGE_PG_VECTOR_UPSERT_FAILED',
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
  }: CreateIndexParams & { type: IndexType | undefined }) {
    const input = indexName + dimension + metric + (type || 'ivfflat'); // ivfflat is default
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
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_VECTOR_CREATE_INDEX_INVALID_INPUT',
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

    const indexCacheKey = await this.getIndexCacheKey({ indexName, dimension, type: indexConfig.type, metric });
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

          // Set search path to include both schemas if needed
          if (
            this.schema &&
            this.vectorExtensionSchema &&
            this.schema !== this.vectorExtensionSchema &&
            this.vectorExtensionSchema !== 'pg_catalog'
          ) {
            await client.query(`SET search_path TO ${this.getSchemaName()}, "${this.vectorExtensionSchema}"`);
          }

          // Use the properly qualified vector type
          const vectorType = this.getVectorTypeName();

          await client.query(`
          CREATE TABLE IF NOT EXISTS ${tableName} (
            id SERIAL PRIMARY KEY,
            vector_id TEXT UNIQUE NOT NULL,
            embedding ${vectorType}(${dimension}),
            metadata JSONB DEFAULT '{}'::jsonb
          );
        `);
          this.createdIndexes.set(indexName, indexCacheKey);

          if (buildIndex) {
            await this.setupIndex({ indexName, metric, indexConfig }, client);
          }
        } catch (error: any) {
          this.createdIndexes.delete(indexName);
          throw error;
        } finally {
          client.release();
        }
      })
      .catch(error => {
        const mastraError = new MastraError(
          {
            id: 'MASTRA_STORAGE_PG_VECTOR_CREATE_INDEX_FAILED',
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
          id: 'MASTRA_STORAGE_PG_VECTOR_BUILD_INDEX_FAILED',
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

  private async setupIndex({ indexName, metric, indexConfig }: PgDefineIndexParams, client: pg.PoolClient) {
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
            });
            this.createdIndexes.set(indexName, cacheKey);
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
          });
          this.createdIndexes.set(indexName, cacheKey);
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

      const metricOp =
        metric === 'cosine' ? 'vector_cosine_ops' : metric === 'euclidean' ? 'vector_l2_ops' : 'vector_ip_ops';

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
      // Must have: vector_id (TEXT), embedding (vector), metadata (JSONB)
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
          AND c.udt_name = 'vector'
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
          id: 'MASTRA_STORAGE_PG_VECTOR_LIST_INDEXES_FAILED',
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

      // Check if table exists with a vector column
      const tableExistsQuery = `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
          AND udt_name = 'vector'
        LIMIT 1;
      `;
      const tableExists = await client.query(tableExistsQuery, [this.schema || 'public', indexName]);

      if (tableExists.rows.length === 0) {
        throw new Error(`Vector table ${tableName} does not exist`);
      }

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
        config,
      };
    } catch (e: any) {
      await client.query('ROLLBACK');
      const mastraError = new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_VECTOR_DESCRIBE_INDEX_FAILED',
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
    } catch (error: any) {
      await client.query('ROLLBACK');
      const mastraError = new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_VECTOR_DELETE_INDEX_FAILED',
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
          id: 'MASTRA_STORAGE_PG_VECTOR_TRUNCATE_INDEX_FAILED',
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
  async updateVector({ indexName, id, update }: UpdateVectorParams): Promise<void> {
    let client;
    try {
      if (!update.vector && !update.metadata) {
        throw new Error('No updates provided');
      }

      client = await this.pool.connect();
      let updateParts = [];
      let values = [id];
      let valueIndex = 2;

      // Get the properly qualified vector type
      const vectorType = this.getVectorTypeName();

      if (update.vector) {
        updateParts.push(`embedding = $${valueIndex}::${vectorType}`);
        values.push(`[${update.vector.join(',')}]`);
        valueIndex++;
      }

      if (update.metadata) {
        updateParts.push(`metadata = $${valueIndex}::jsonb`);
        values.push(JSON.stringify(update.metadata));
      }

      if (updateParts.length === 0) {
        return;
      }

      const { tableName } = this.getTableName(indexName);

      // query looks like this:
      // UPDATE table SET embedding = $2::vector, metadata = $3::jsonb WHERE id = $1
      const query = `
        UPDATE ${tableName}
        SET ${updateParts.join(', ')}
        WHERE vector_id = $1
      `;

      await client.query(query, values);
    } catch (error: any) {
      const mastraError = new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_VECTOR_UPDATE_VECTOR_FAILED',
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
          id: 'MASTRA_STORAGE_PG_VECTOR_DELETE_VECTOR_FAILED',
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
}
