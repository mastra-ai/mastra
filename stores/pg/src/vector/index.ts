import { createHash } from 'crypto';
import { MastraVector } from '@mastra/core/vector';
import type {
  IndexStats,
  QueryResult,
  QueryVectorParams,
  CreateIndexParams,
  UpsertVectorParams,
  ParamsToArgs,
  QueryVectorArgs,
  CreateIndexArgs,
} from '@mastra/core/vector';
import type { VectorFilter } from '@mastra/core/vector/filter';
import pg from 'pg';

import { PGFilterTranslator } from './filter';
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

interface PgQueryVectorParams extends QueryVectorParams {
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

type PgQueryVectorArgs = [...QueryVectorArgs, number?, number?, number?];

interface PgCreateIndexParams extends CreateIndexParams {
  indexConfig?: IndexConfig;
  buildIndex?: boolean;
}

type PgCreateIndexArgs = [...CreateIndexArgs, IndexConfig?, boolean?];

interface PgDefineIndexParams {
  indexName: string;
  metric: 'cosine' | 'euclidean' | 'dotproduct';
  indexConfig: IndexConfig;
}

type PgDefineIndexArgs = [string, 'cosine' | 'euclidean' | 'dotproduct', IndexConfig];

export class PgVector extends MastraVector {
  private pool: pg.Pool;
  private indexCache: Map<string, PGIndexStats> = new Map();

  constructor(connectionString: string) {
    super();

    const basePool = new pg.Pool({
      connectionString,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
      connectionTimeoutMillis: 2000, // Fail fast if can't connect
    });

    const telemetry = this.__getTelemetry();

    this.pool =
      telemetry?.traceClass(basePool, {
        spanNamePrefix: 'pg-vector',
        attributes: {
          'vector.type': 'postgres',
        },
      }) ?? basePool;
  }

  transformFilter(filter?: VectorFilter) {
    const translator = new PGFilterTranslator();
    return translator.translate(filter);
  }

  async getIndexInfo(indexName: string): Promise<PGIndexStats> {
    if (!this.indexCache.has(indexName)) {
      this.indexCache.set(indexName, await this.describeIndex(indexName));
    }
    return this.indexCache.get(indexName)!;
  }

  async query(...args: ParamsToArgs<PgQueryVectorParams> | PgQueryVectorArgs): Promise<QueryResult[]> {
    const params = this.normalizeArgs<PgQueryVectorParams, PgQueryVectorArgs>('query', args, [
      'minScore',
      'ef',
      'probes',
    ]);
    const { indexName, queryVector, topK = 10, filter, includeVector = false, minScore = 0, ef, probes } = params;

    const client = await this.pool.connect();
    try {
      const vectorStr = `[${queryVector.join(',')}]`;
      const translatedFilter = this.transformFilter(filter);
      const { sql: filterQuery, values: filterValues } = buildFilterQuery(translatedFilter, minScore);

      // Get index type and configuration
      const indexInfo = await this.getIndexInfo(indexName);

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

      const query = `
        WITH vector_scores AS (
          SELECT
            vector_id as id,
            1 - (embedding <=> '${vectorStr}'::vector) as score,
            metadata
            ${includeVector ? ', embedding' : ''}
          FROM ${indexName}
          ${filterQuery}
        )
        SELECT *
        FROM vector_scores
        WHERE score > $1
        ORDER BY score DESC
        LIMIT ${topK}`;
      const result = await client.query(query, filterValues);

      return result.rows.map(({ id, score, metadata, embedding }) => ({
        id,
        score,
        metadata,
        ...(includeVector && embedding && { vector: JSON.parse(embedding) }),
      }));
    } finally {
      client.release();
    }
  }

  async upsert(...args: ParamsToArgs<UpsertVectorParams>): Promise<string[]> {
    const params = this.normalizeArgs<UpsertVectorParams>('upsert', args);

    const { indexName, vectors, metadata, ids } = params;

    // Start a transaction
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const vectorIds = ids || vectors.map(() => crypto.randomUUID());

      for (let i = 0; i < vectors.length; i++) {
        const query = `
          INSERT INTO ${indexName} (vector_id, embedding, metadata)
          VALUES ($1, $2::vector, $3::jsonb)
          ON CONFLICT (vector_id)
          DO UPDATE SET
            embedding = $2::vector,
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
          throw new Error(
            `Vector dimension mismatch: Index "${params.indexName}" expects ${expected} dimensions but got ${actual} dimensions. ` +
              `Either use a matching embedding model or delete and recreate the index with the new dimension.`,
          );
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async createIndex(...args: ParamsToArgs<PgCreateIndexParams> | PgCreateIndexArgs): Promise<void> {
    const params = this.normalizeArgs<PgCreateIndexParams, PgCreateIndexArgs>('createIndex', args, [
      'indexConfig',
      'buildIndex',
    ]);

    const { indexName, dimension, metric = 'cosine', indexConfig = {}, buildIndex = true } = params;

    const client = await this.pool.connect();
    try {
      // Validate inputs
      if (!indexName.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
        throw new Error('Invalid index name format');
      }
      if (!Number.isInteger(dimension) || dimension <= 0) {
        throw new Error('Dimension must be a positive integer');
      }

      // First check if vector extension is available
      const extensionCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_available_extensions WHERE name = 'vector'
        );
      `);

      if (!extensionCheck.rows[0].exists) {
        throw new Error('PostgreSQL vector extension is not available. Please install it first.');
      }

      // Get advisory lock using hash of index name
      const hash = createHash('sha256').update(indexName).digest('hex');
      const lockId = BigInt('0x' + hash.slice(0, 8)) % BigInt(2 ** 31); // Take first 8 chars and convert to number
      const acquired = await client.query('SELECT pg_try_advisory_lock($1)', [lockId]);

      if (!acquired.rows[0].pg_try_advisory_lock) {
        // Check if table already exists
        const exists = await client.query(
          `
          SELECT 1 FROM pg_class c 
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relname = $1 
          AND n.nspname = 'public'
        `,
          [indexName],
        );

        if (exists.rows.length > 0) {
          // Table exists so return early
          console.log(`Table ${indexName} already exists, skipping creation`);
          return;
        }

        // Table doesn't exist, wait for lock
        await client.query('SELECT pg_advisory_lock($1)', [lockId]);
      }

      try {
        // Try to create extension
        await client.query('CREATE EXTENSION IF NOT EXISTS vector');

        // Create the table with explicit schema
        await client.query(`
        CREATE TABLE IF NOT EXISTS ${indexName} (
          id SERIAL PRIMARY KEY,
          vector_id TEXT UNIQUE NOT NULL,
          embedding vector(${dimension}),
          metadata JSONB DEFAULT '{}'::jsonb
        );
      `);
      } finally {
        // Always release lock
        await client.query('SELECT pg_advisory_unlock($1)', [lockId]);
      }

      if (buildIndex) {
        await this.setupIndex({ indexName, metric, indexConfig }, client);
      }
    } catch (error: any) {
      console.error('Failed to create vector table:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * @deprecated This function is deprecated. Use buildIndex instead
   */
  async defineIndex(
    indexName: string,
    metric: 'cosine' | 'euclidean' | 'dotproduct' = 'cosine',
    indexConfig: IndexConfig,
  ): Promise<void> {
    return this.buildIndex({ indexName, metric, indexConfig });
  }

  async buildIndex(...args: ParamsToArgs<PgDefineIndexParams> | PgDefineIndexArgs): Promise<void> {
    const params = this.normalizeArgs<PgDefineIndexParams, PgDefineIndexArgs>('buildIndex', args, [
      'metric',
      'indexConfig',
    ]);

    const { indexName, metric = 'cosine', indexConfig } = params;

    const client = await this.pool.connect();
    try {
      await this.setupIndex({ indexName, metric, indexConfig }, client);
    } finally {
      client.release();
    }
  }

  private async setupIndex({ indexName, metric, indexConfig }: PgDefineIndexParams, client: pg.PoolClient) {
    // Use a different hash prefix for buildIndex locks to avoid conflicts with createIndex
    const hash = createHash('sha256')
      .update('build:' + indexName)
      .digest('hex');
    const lockId = BigInt('0x' + hash.slice(0, 8)) % BigInt(2 ** 31);
    const acquired = await client.query('SELECT pg_try_advisory_lock($1)', [lockId]);

    if (!acquired.rows[0].pg_try_advisory_lock) {
      // Check if index already exists
      const exists = await client.query(
        `
            SELECT 1 FROM pg_class c 
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = $1 
            AND n.nspname = 'public'
          `,
        [`${indexName}_vector_idx`],
      );

      if (exists.rows.length > 0) {
        console.log(`Index ${indexName}_vector_idx already exists, skipping creation`);
        this.indexCache.delete(indexName); // Still clear cache since we checked
        return;
      }

      // Index doesn't exist, wait for lock
      await client.query('SELECT pg_advisory_lock($1)', [lockId]);
    }

    try {
      await client.query(`DROP INDEX IF EXISTS ${indexName}_vector_idx`);

      if (indexConfig.type === 'flat') {
        this.indexCache.delete(indexName);
        return;
      }

      const metricOp =
        metric === 'cosine' ? 'vector_cosine_ops' : metric === 'euclidean' ? 'vector_l2_ops' : 'vector_ip_ops';

      let indexSQL: string;
      if (indexConfig.type === 'hnsw') {
        const m = indexConfig.hnsw?.m ?? 8;
        const efConstruction = indexConfig.hnsw?.efConstruction ?? 32;

        indexSQL = `
          CREATE INDEX IF NOT EXISTS ${indexName}_vector_idx 
          ON ${indexName} 
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
          const size = (await client.query(`SELECT COUNT(*) FROM ${indexName}`)).rows[0].count;
          lists = Math.max(100, Math.min(4000, Math.floor(Math.sqrt(size) * 2)));
        }
        indexSQL = `
          CREATE INDEX IF NOT EXISTS ${indexName}_vector_idx
          ON ${indexName}
          USING ivfflat (embedding ${metricOp})
          WITH (lists = ${lists});
        `;
      }

      await client.query(indexSQL);
      this.indexCache.delete(indexName);
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [lockId]);
    }
  }

  async listIndexes(): Promise<string[]> {
    const client = await this.pool.connect();
    try {
      // Then let's see which ones have vector columns
      const vectorTablesQuery = `
            SELECT DISTINCT table_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND udt_name = 'vector';
        `;
      const vectorTables = await client.query(vectorTablesQuery);
      return vectorTables.rows.map(row => row.table_name);
    } finally {
      client.release();
    }
  }

  async describeIndex(indexName: string): Promise<PGIndexStats> {
    const client = await this.pool.connect();
    try {
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
                FROM ${indexName};
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
            WHERE c.relname = '${indexName}_vector_idx';
            `;

      const [dimResult, countResult, indexResult] = await Promise.all([
        client.query(dimensionQuery, [indexName]),
        client.query(countQuery),
        client.query(indexQuery),
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
      throw new Error(`Failed to describe vector table: ${e.message}`);
    } finally {
      client.release();
    }
  }

  async deleteIndex(indexName: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Drop the table
      await client.query(`DROP TABLE IF EXISTS ${indexName} CASCADE`);
    } catch (error: any) {
      await client.query('ROLLBACK');
      throw new Error(`Failed to delete vector table: ${error.message}`);
    } finally {
      client.release();
    }
  }

  async truncateIndex(indexName: string) {
    const client = await this.pool.connect();
    try {
      await client.query(`TRUNCATE ${indexName}`);
    } catch (e: any) {
      await client.query('ROLLBACK');
      throw new Error(`Failed to truncate vector table: ${e.message}`);
    } finally {
      client.release();
    }
  }

  async disconnect() {
    await this.pool.end();
  }

  async updateIndexById(
    indexName: string,
    id: string,
    update: {
      vector?: number[];
      metadata?: Record<string, any>;
    },
  ): Promise<void> {
    if (!update.vector && !update.metadata) {
      throw new Error('No updates provided');
    }

    const client = await this.pool.connect();
    try {
      let updateParts = [];
      let values = [id];
      let valueIndex = 2;

      if (update.vector) {
        updateParts.push(`embedding = $${valueIndex}::vector`);
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

      // query looks like this:
      // UPDATE table SET embedding = $2::vector, metadata = $3::jsonb WHERE id = $1
      const query = `
        UPDATE ${indexName}
        SET ${updateParts.join(', ')}
        WHERE vector_id = $1
      `;

      await client.query(query, values);
    } finally {
      client.release();
    }
  }

  async deleteIndexById(indexName: string, id: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      const query = `
        DELETE FROM ${indexName}
        WHERE vector_id = $1
      `;
      await client.query(query, [id]);
    } finally {
      client.release();
    }
  }
}
