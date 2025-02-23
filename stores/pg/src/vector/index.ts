import type { Filter } from '@mastra/core/filter';
import { type IndexStats, type QueryResult, MastraVector } from '@mastra/core/vector';
import pg from 'pg';

import { PGFilterTranslator } from './filter';
import { buildFilterQuery } from './sql-builder';
import { type IndexConfig, type IndexType } from './types';

export interface PGIndexStats extends IndexStats {
  type: IndexType;
  config: {
    m?: number;
    efConstruction?: number;
    lists?: number;
    probes?: number;
  };
}

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

  transformFilter(filter?: Filter) {
    const pgFilter = new PGFilterTranslator();
    const translatedFilter = pgFilter.translate(filter ?? {});
    return translatedFilter;
  }

  async getIndexInfo(indexName: string): Promise<PGIndexStats> {
    if (!this.indexCache.has(indexName)) {
      this.indexCache.set(indexName, await this.describeIndex(indexName));
    }
    return this.indexCache.get(indexName)!;
  }

  async query(
    indexName: string,
    queryVector: number[],
    topK: number = 10,
    filter?: Filter,
    includeVector: boolean = false,
    minScore: number = 0, // Optional minimum score threshold
    options?: {
      ef?: number; // For HNSW
      probes?: number; // For IVF
    },
  ): Promise<QueryResult[]> {
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
        const calculatedEf = options?.ef ?? Math.max(topK, (indexInfo?.config?.m ?? 16) * topK);
        const searchEf = Math.min(1000, Math.max(1, calculatedEf));
        await client.query(`SET LOCAL hnsw.ef_search = ${searchEf}`);
      }

      if (indexInfo.type === 'ivfflat' && options?.probes) {
        await client.query(`SET LOCAL ivfflat.probes = ${options.probes}`);
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

  async upsert(
    indexName: string,
    vectors: number[][],
    metadata?: Record<string, any>[],
    ids?: string[],
  ): Promise<string[]> {
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
      throw error;
    } finally {
      client.release();
    }
  }

  async createIndex(
    indexName: string,
    dimension: number,
    metric: 'cosine' | 'euclidean' | 'dotproduct' = 'cosine',
    indexConfig: IndexConfig = {},
    defineIndex: boolean = true,
  ): Promise<void> {
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

      if (defineIndex) {
        await this.defineIndex(indexName, metric, indexConfig);
      }
    } catch (error: any) {
      console.error('Failed to create vector table:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async defineIndex(
    indexName: string,
    metric: 'cosine' | 'euclidean' | 'dotproduct' = 'cosine',
    indexConfig: IndexConfig,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`DROP INDEX IF EXISTS ${indexName}_vector_idx`);

      if (indexConfig.type === 'flat') return;

      const metricOp =
        metric === 'cosine' ? 'vector_cosine_ops' : metric === 'euclidean' ? 'vector_l2_ops' : 'vector_ip_ops';

      let indexSQL: string;
      if (indexConfig.type === 'hnsw') {
        const m = indexConfig.hnsw?.m ?? 8;
        const efConstruction = indexConfig.hnsw?.efConstruction ?? 32;

        indexSQL = `
          CREATE INDEX ${indexName}_vector_idx 
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
          CREATE INDEX ${indexName}_vector_idx
          ON ${indexName}
          USING ivfflat (embedding ${metricOp})
          WITH (lists = ${lists});
        `;
      }

      await client.query(indexSQL);
      this.indexCache.delete(indexName);
    } finally {
      client.release();
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

  async bulkUpsert(indexName: string, vectors: number[][], metadata?: any[], ids?: string[]) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const vectorIds = ids || vectors.map(() => crypto.randomUUID());

      // Same query structure as upsert, just using unnest for bulk operation
      const query = `
        INSERT INTO ${indexName} (vector_id, embedding, metadata)
        SELECT * FROM unnest(
          $1::text[],
          $2::vector[],
          $3::jsonb[]
        )
        ON CONFLICT (vector_id)
        DO UPDATE SET
          embedding = EXCLUDED.embedding,
          metadata = EXCLUDED.metadata
        RETURNING embedding::text
      `;

      // Same parameter structure as upsert, just as arrays
      await client.query(query, [
        vectorIds,
        vectors.map(v => `[${v.join(',')}]`),
        (metadata || vectors.map(() => ({}))).map(m => JSON.stringify(m)),
      ]);
      await client.query('COMMIT');
      return vectorIds;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
