import { createClient, type Client as TursoClient, type InValue } from '@libsql/client';
import { MastraVector, type IndexStats, type QueryResult } from '@mastra/core';

import { Filter, FILTER_OPERATORS, FilterResult, isValidOperator } from './filter';

export class LibSQLVector extends MastraVector {
  private turso: TursoClient;

  constructor({
    connectionUrl,
    authToken,
    syncUrl,
    syncInterval,
  }: {
    connectionUrl: string;
    authToken?: string;
    syncUrl?: string;
    syncInterval?: number;
  }) {
    super();

    this.turso = createClient({
      url: connectionUrl,
      syncUrl: syncUrl,
      authToken,
      syncInterval,
    });
  }

  async query(
    indexName: string,
    queryVector: number[],
    topK: number = 10,
    filter?: Filter,
    includeVector: boolean = false,
    minScore: number = 0, // Optional minimum score threshold
  ): Promise<QueryResult[]> {
    try {
      const vectorStr = `[${queryVector.join(',')}]`;

      const buildCondition = (key: string, value: any): FilterResult => {
        // Handle logical operators ($and/$or)
        if (key === '$and' || key === '$or') {
          const values: InValue[] = [];
          const joinOperator = key === '$or' ? 'OR' : 'AND';
          const conditions = value.map((f: Filter) => {
            // Check if the first key is a logical operator for nested conditions
            const [firstKey, firstValue] = Object.entries(f)[0] || [];
            if (firstKey === '$and' || firstKey === '$or') {
              const result = buildCondition(firstKey, firstValue);
              values.push(...result.values);
              return result.sql;
            }

            const subConditions = Object.entries(f).map(([k, v]) => {
              const result = buildCondition(k, v);
              values.push(...result.values);
              return result.sql;
            });

            return subConditions.join(` ${joinOperator} `);
          });

          const operatorFn = FILTER_OPERATORS[key];
          return {
            sql: operatorFn(conditions.join(` ${joinOperator} `)).sql,
            values,
          };
        }

        // If condition is not a FilterCondition object, assume it's an equality check
        if (!value || typeof value !== 'object') {
          return {
            sql: `json_extract(metadata, '$."${key.replace(/\./g, '"."')}"') = ?`,
            values: [value],
          };
        }

        // Handle operator conditions
        const [[operator, operatorValue] = []] = Object.entries(value);
        if (!operator || value === undefined) {
          throw new Error(`Invalid operator or value for key: ${key}`);
        }
        if (!isValidOperator(operator)) {
          throw new Error(`Unsupported operator: ${operator}`);
        }

        const operatorFn = FILTER_OPERATORS[operator];
        const operatorResult = operatorFn(key);

        if (!operatorResult.needsValue) {
          return { sql: operatorResult.sql, values: [] };
        }

        const transformed = operatorResult.transformValue
          ? operatorResult.transformValue(operatorValue)
          : operatorValue;

        // Handle case where transformValue returns { sql, values }
        if (transformed && typeof transformed === 'object' && 'sql' in transformed) {
          return {
            sql: transformed.sql,
            values: transformed.values,
          };
        }

        return {
          sql: operatorResult.sql,
          values: [transformed],
        };
      };

      const buildFilterQuery = (filter: Filter | undefined): FilterResult => {
        if (!filter) {
          return { sql: '', values: [] };
        }

        const values: InValue[] = [];
        const conditions = Object.entries(filter)
          .map(([key, value]) => {
            const condition = buildCondition(key, value);
            values.push(...condition.values);
            return condition.sql;
          })
          .join(' AND ');

        return {
          sql: conditions ? `WHERE ${conditions}` : '',
          values,
        };
      };

      const { sql: filterQuery, values: filterValues } = buildFilterQuery(filter);
      filterValues.push(minScore);

      const query = `
        WITH vector_scores AS (
          SELECT
            vector_id as id,
            (1-vector_distance_cos(embedding, '${vectorStr}')) as score,
            metadata
            ${includeVector ? ', vector_extract(embedding) as embedding' : ''}
          FROM ${indexName}
          ${filterQuery}
        )
        SELECT *
        FROM vector_scores
        WHERE score > ?
        ORDER BY score DESC
        LIMIT ${topK}`;

      const result = await this.turso.execute({
        sql: query,
        args: filterValues,
      });

      return result.rows.map(({ id, score, metadata, embedding }) => ({
        id: id as string,
        score: score as number,
        metadata: JSON.parse((metadata as string) ?? '{}'),
        ...(includeVector && embedding && { vector: JSON.parse(embedding as string) }),
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

        // console.log('INSERTQ', query, [
        //   vectorIds[i] as InValue,
        //   JSON.stringify(vectors[i]),
        //   JSON.stringify(metadata?.[i] || {}),
        //   JSON.stringify(vectors[i]),
        //   JSON.stringify(metadata?.[i] || {}),
        // ]);
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
