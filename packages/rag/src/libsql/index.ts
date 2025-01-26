import { createClient, type Client as TursoClient, type InValue } from '@libsql/client';
import { MastraVector, type IndexStats, type QueryResult } from '@mastra/core';

import { Filter, FILTER_OPERATORS, isValidOperator } from './filter';

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
    includeVector: boolean = false,
    minScore: number = 0, // Optional minimum score threshold
  ): Promise<QueryResult[]> {
    try {
      let filterQuery = '';
      let filterValues: InValue[] = [];
      const vectorStr = `[${queryVector.join(',')}]`;

      if (filter) {
        const conditions = Object.entries(filter).map(([key, condition]) => {
          // If condition is not a FilterCondition object, assume it's an equality check
          if (!condition || typeof condition !== 'object') {
            filterValues.push(condition);
            return `metadata->>'${key}' = ?`;
          }

          const [[operator, value] = []] = Object.entries(condition ?? {});
          if (!operator || value === undefined) {
            throw new Error(`Invalid operator or value for key: ${key}`);
          }
          if (!isValidOperator(operator)) {
            throw new Error(`Unsupported operator: ${operator}`);
          }
          // Get operation function
          if (operator === 'contains') {
            // If value is an array, we want to check if the metadata array contains any of these values
            if (Array.isArray(value)) {
              filterValues.push(JSON.stringify(value));
              return `(
                SELECT json_valid(json_extract(metadata, '$.${key}')) 
                AND json_type(json_extract(metadata, '$.${key}')) = 'array'
                AND EXISTS (
                  SELECT 1 
                  FROM json_each(json_extract(metadata, '$.${key}')) as m
                  WHERE m.value IN (SELECT value FROM json_each(?))
                )
              )`;
            }
            // If value is an object, handle nested object traversal
            else if (value && typeof value === 'object') {
              const paths: string[] = [];
              const values: any[] = [];

              function traverse(obj: any, path: string[] = []) {
                for (const [k, v] of Object.entries(obj)) {
                  const currentPath = [...path, k];
                  if (v && typeof v === 'object' && !Array.isArray(v)) {
                    traverse(v, currentPath);
                  } else {
                    paths.push(currentPath.join('.'));
                    values.push(v);
                  }
                }
              }

              traverse(value);
              const conditions = paths.map((path, i) => {
                filterValues.push(values[i]);
                return `json_extract(metadata, '$.${key}.${path}') = ?`;
              });

              return `(${conditions.join(' AND ')})`;
            }
            // If value is primitive
            else {
              filterValues.push(value as any);
              return `json_extract(metadata, '$.${key}') = ?`;
            }
          } else if (operator === 'in') {
            const ary = value as any[];
            for (const v of ary) {
              filterValues.push(v);
            }
            return `json_extract(metadata, '$.${key}') IN (${Array(ary.length).fill('?').join(',')})`;
          }
          const operatorFn = FILTER_OPERATORS[operator];

          const operatorResult = operatorFn(key);

          // Handle operator cases and check if value is needed
          if (operatorResult.needsValue) {
            // Transform value if needed
            const transformedValue = operatorResult.transformValue ? operatorResult.transformValue(value) : value;
            filterValues.push(transformedValue);
          }

          // return sql condition
          return operatorResult.sql;
        });
        if (conditions.length > 0) {
          filterQuery = 'AND ' + conditions.join(' AND ');
        }
      }
      const query = `
            WITH vector_scores AS (
                SELECT
                    vector_id as id,
                    (1-vector_distance_cos(embedding, '${vectorStr}')) as score,
                    metadata
                    ${includeVector ? ', vector_extract(embedding) as embedding' : ''}
                FROM ${indexName}
                WHERE true ${filterQuery}
            )
            SELECT *
            FROM vector_scores
            WHERE score > ?
            ORDER BY score DESC
            LIMIT ${topK};
        `;
      console.log(query, filterValues);
      filterValues.push(minScore);
      console.log(query);

      const result = await this.turso.execute({
        sql: query,
        args: filterValues,
      });
      console.log(`YO`, query, filterValues, result);

      return result.rows.map(row => ({
        id: row.id as string,
        score: row.score as number,
        metadata: JSON.parse((row.metadata as string) ?? '{}'),
        ...(includeVector && row.embedding && { vector: JSON.parse(row.embedding as string) }),
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
VALUES (?, vector32(?), ?)
ON CONFLICT(vector_id) DO UPDATE SET
  embedding = vector32(?),
  metadata = ?
`;

        console.log('INSERTQ', query, [
          vectorIds[i] as InValue,
          JSON.stringify(vectors[i]),
          JSON.stringify(metadata?.[i] || {}),
          JSON.stringify(vectors[i]),
          JSON.stringify(metadata?.[i] || {}),
        ]);
        await tx.execute({
          sql: query,
          // @ts-ignore
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
      await tx.rollback();
      throw error;
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
        sql: `DROP TABLE IF EXISTS ${indexName}`,
        args: [],
      });
    } catch (error: any) {
      console.error('Failed to delete vector table:', error);
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

  async truncateIndex(indexName: string) {
    await this.turso.execute({
      sql: `DELETE FROM ${indexName}`,
      args: [],
    });
  }
}
