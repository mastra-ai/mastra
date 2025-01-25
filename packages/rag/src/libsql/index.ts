import { createClient, type Client as TursoClient, type InValue } from '@libsql/client';
import { MastraVector, type IndexStats, type QueryResult } from '@mastra/core';

export class LibSQLVector extends MastraVector {
  private turso: TursoClient;

  constructor(connectionUrl: string) {
    super();

    this.turso = createClient({
      url: connectionUrl,
      // syncUrl: process.env.TURSO_DATABASE_URL,
      // authToken: process.env.TURSO_AUTH_TOKEN,
      // syncInterval: 60000,
    });
  }

  async query(
    indexName: string,
    queryVector: number[],
    topK: number = 10,
    filter?: Record<string, any>,
    includeVectors: boolean = false,
    minScore: number = 0, // Optional minimum score threshold
  ): Promise<QueryResult[]> {
    try {
      let filterQuery = '';
      let filterValues: InValue[] = [minScore];
      const vectorStr = `[${queryVector.join(',')}]`;

      if (filter) {
        const conditions = Object.entries(filter).map(([key, value]) => {
          filterValues.push(value);
          return `metadata->>'${key}' = ?`; // +2 because $1 is minScore
        });
        if (conditions.length > 0) {
          filterQuery = 'AND ' + conditions.join(' AND ');
        }
      }

      const query = `
            WITH vector_scores AS (
                SELECT
                    vector_id as id,
                    1 - (embedding <=> '${vectorStr}'::vector) as score,
                    metadata
                    ${includeVectors ? ', embedding' : ''}
                FROM ${indexName}
                WHERE true ${filterQuery}
            )
            SELECT *
            FROM vector_scores
            WHERE score > ?
            ORDER BY score DESC
            LIMIT ${topK};
        `;
      const result = await this.turso.execute({
        sql: query,
        args: filterValues,
      });

      return result.rows.map(row => ({
        id: row.id as string,
        score: row.score as number,
        metadata: JSON.parse((row.metadata as string) ?? '{}'),
      }));
    } finally {
      // client.release()
    }
  }

  async upsert(
    indexName: string,
    vectors: number[][],
    metadata?: Record<string, any>[],
    ids?: string[],
  ): Promise<string[]> {
    const tx = await this.turso.transaction('write');

    try {
      const vectorIds = ids || vectors.map(() => crypto.randomUUID());

      for (let i = 0; i < vectors.length; i++) {
        const query = `
            INSERT INTO ${indexName} (vector_id, embedding, metadata)
            VALUES (:vec_id, :embed, :metadata)
            ON CONFLICT (vector_id)
            DO UPDATE SET
                embedding = :embed,
                metadata = :metadata
            RETURNING embedding::text
        `;

        await tx.execute({
          sql: query,
          args: {
            vec_id: vectorIds[i] as InValue,
            embedding: `[${vectors[i]?.join(',')}]`,
            metadata: JSON.stringify(metadata?.[i] || {}),
          },
        });
      }
      return vectorIds;
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally {
      // client.release()
    }
  }

  async createIndex(
    indexName: string,
    dimension: number,
    _metric: 'cosine' | 'euclidean' | 'dotproduct' = 'cosine',
  ): Promise<void> {
    try {
      // Validate inputs
      if (!indexName.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
        throw new Error('Invalid index name format');
      }
      if (!Number.isInteger(dimension) || dimension <= 0) {
        throw new Error('Dimension must be a positive integer');
      }

      // Create the table with explicit schema
      await this.turso.execute({
        sql: `
        CREATE TABLE IF NOT EXISTS ${indexName} (
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
        CREATE INDEX IF NOT EXISTS ${indexName}_vector_idx
        ON ${indexName} (libsql_vector_idx(embedding))
      `,
        args: [],
      });
    } catch (error: any) {
      console.error('Failed to create vector table:', error);
      throw error;
    } finally {
      // client.release()
    }
  }

  async deleteIndex(indexName: string): Promise<void> {
    try {
      // Drop the table
      await this.turso.execute({
        sql: `DROP TABLE IF EXISTS ${indexName} CASCADE`,
        args: [],
      });
    } catch (error: any) {
      throw new Error(`Failed to delete vector table: ${error.message}`);
    } finally {
      // client.release()
    }
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
      throw new Error(`Failed to list vector tables: ${error.message}`);
    }
  }

  async describeIndex(indexName: string): Promise<IndexStats> {
    try {
      // Get table info including column info
      const tableInfoQuery = `
        SELECT sql 
        FROM sqlite_master 
        WHERE type='table' 
        AND name = ?;
      `;
      const tableInfo = await this.turso.execute({
        sql: tableInfoQuery,
        args: [indexName],
      });

      if (!tableInfo.rows[0]?.sql) {
        throw new Error(`Table ${indexName} not found`);
      }

      // Extract dimension from F32_BLOB definition
      const dimension = parseInt((tableInfo.rows[0].sql as string).match(/F32_BLOB\((\d+)\)/)?.[1] || '0');

      // Get row count
      const countQuery = `
        SELECT COUNT(*) as count
        FROM ${indexName};
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
      throw new Error(`Failed to describe vector table: ${e.message}`);
    }
  }
}
