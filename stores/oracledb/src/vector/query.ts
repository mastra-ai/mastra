import { ErrorCategory, MastraError } from '@mastra/core/error';
import { validateTopK } from '@mastra/core/vector';
import type { QueryResult } from '@mastra/core/vector';

import type { ObjectRow } from '../shared/connection';
import { asBindParameters, executeOptions, rows } from '../shared/connection';
import type { IndexRegistry, WithConnection } from './ddl';
import { buildMetadataWhereClause } from './filter';
import { metricToken, validateAccuracy } from './sql';
import type { OracleMetric, OracleQueryVectorParams, OracleVectorFormat } from './types';
import { STORE_NAME, asMastraError, validateVectorForIndex, validateVectors, vectorBind } from './upsert';

// Handles exact and approximate vector search, including the metadata-only recall path and the
// min-score post-filter that Oracle distance scores need for parity with other Mastra providers.
export async function query(
  registry: IndexRegistry,
  withConnection: WithConnection,
  {
    indexName,
    queryVector,
    topK = 10,
    filter,
    includeVector = false,
    minScore = -1,
    sparseVector,
    queryMode,
    targetAccuracy,
  }: OracleQueryVectorParams,
): Promise<QueryResult[]> {
  try {
    if (sparseVector !== undefined) {
      throw new Error('OracleVector does not support sparseVector queries yet; use dense queryVector search');
    }
    validateTopK(STORE_NAME, topK);
    if (queryVector !== undefined) {
      validateVectors([queryVector]);
    } else if (!filter || Object.keys(filter).length === 0) {
      throw new Error('Either queryVector or filter must be provided');
    }
    if (!Number.isFinite(minScore)) {
      throw new Error('minScore must be a finite number');
    }
    if (targetAccuracy !== undefined) {
      validateAccuracy(targetAccuracy);
    }
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw asMastraError('QUERY', 'INVALID_INPUT', { indexName }, error, ErrorCategory.USER);
  }

  return withConnection(async connection => {
    const indexInfo = await registry.getIndexMetadata(connection, indexName);
    if (queryVector !== undefined) {
      validateVectorForIndex(queryVector, indexInfo, indexName);
    }

    const metadataFilter = buildMetadataWhereClause(filter);
    const vectorColumn = includeVector ? ', embedding AS "vector"' : '';

    if (queryVector === undefined) {
      // Metadata-only queries preserve provider parity for filtered recalls without a query embedding.
      const sql = `
        SELECT
          vector_id AS "id",
          0 AS "score",
          metadata AS "metadata"
          ${vectorColumn}
        FROM ${indexInfo.qualifiedTableName}
        ${metadataFilter.sql}
        ORDER BY vector_id
        FETCH FIRST ${topK} ROWS ONLY`;

      const result = await connection.execute<ObjectRow>(sql, asBindParameters(metadataFilter.binds), executeOptions());
      return rows(result).map(row => rowToQueryResult(row, indexInfo.vectorFormat, indexInfo.dimension));
    }

    const distance = `VECTOR_DISTANCE(embedding, :queryVector, ${metricToken(indexInfo.metric)})`;
    const score = scoreExpression(distance, indexInfo.metric);
    const fetchMode = normalizeQueryMode(queryMode ?? (indexInfo.indexType === 'none' ? 'exact' : 'approx'));
    // Oracle applies approximate index search only when ORDER BY and FETCH are in the same query block.
    const targetAccuracyClause =
      fetchMode === 'approx' && targetAccuracy !== undefined ? ` WITH TARGET ACCURACY ${targetAccuracy}` : '';
    if (canSkipMinScoreFilter(indexInfo.metric, minScore)) {
      const sql = `
        SELECT
          vector_id AS "id",
          ${score} AS "score",
          metadata AS "metadata"
          ${vectorColumn}
        FROM ${indexInfo.qualifiedTableName}
        ${metadataFilter.sql}
        ORDER BY ${distance}
        FETCH ${fetchMode.toUpperCase()} FIRST ${topK} ROWS ONLY${targetAccuracyClause}`;

      const result = await connection.execute<ObjectRow>(
        sql,
        {
          ...metadataFilter.binds,
          queryVector: vectorBind(queryVector, indexInfo.vectorFormat),
        },
        executeOptions(),
      );

      return rows(result).map(row => rowToQueryResult(row, indexInfo.vectorFormat, indexInfo.dimension));
    }

    const sql = `
      WITH vector_scores AS (
        SELECT
          vector_id AS "id",
          ${score} AS "score",
          metadata AS "metadata"
          ${vectorColumn}
        FROM ${indexInfo.qualifiedTableName}
        ${metadataFilter.sql}
        ORDER BY ${distance}
        FETCH ${fetchMode.toUpperCase()} FIRST ${topK} ROWS ONLY${targetAccuracyClause}
      )
      SELECT
        "id",
        "score",
        "metadata"
        ${includeVector ? ', "vector"' : ''}
      FROM vector_scores
      WHERE "score" >= :minScore
      ORDER BY "score" DESC`;

    const result = await connection.execute<ObjectRow>(
      sql,
      {
        ...metadataFilter.binds,
        queryVector: vectorBind(queryVector, indexInfo.vectorFormat),
        minScore,
      },
      executeOptions(),
    );

    return rows(result).map(row => rowToQueryResult(row, indexInfo.vectorFormat, indexInfo.dimension));
  }).catch(error => {
    if (error instanceof MastraError) throw error;
    throw asMastraError('QUERY', 'FAILED', { indexName }, error);
  });
}

function normalizeQueryMode(queryMode: string): 'approx' | 'exact' {
  const normalized = queryMode.toLowerCase();
  if (normalized !== 'approx' && normalized !== 'exact') {
    throw new Error('queryMode must be one of "approx" or "exact"');
  }
  return normalized;
}

function scoreExpression(distanceExpression: string, metric: OracleMetric): string {
  // Mastra expects higher scores to be better, while Oracle distance is lower-is-better.
  switch (metric) {
    case 'euclidean':
    case 'hamming':
      return `1 / (1 + ${distanceExpression})`;
    case 'dotproduct':
      return `-1 * ${distanceExpression}`;
    case 'jaccard':
    case 'cosine':
    default:
      return `1 - ${distanceExpression}`;
  }
}

function canSkipMinScoreFilter(metric: OracleMetric, minScore: number): boolean {
  // The default threshold is non-restrictive for Oracle distance-derived scores except dotproduct,
  // whose score range is data-dependent.
  return minScore <= -1 && metric !== 'dotproduct';
}

function rowToQueryResult(row: ObjectRow, vectorFormat: OracleVectorFormat, dimension: number): QueryResult {
  const result: QueryResult = {
    id: String(row.id),
    score: Number(row.score),
    metadata: parseJson(row.metadata),
  };

  if (row.vector !== undefined && row.vector !== null) {
    result.vector = parseVector(row.vector, vectorFormat, dimension);
  }

  return result;
}

function parseJson(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  if (typeof value === 'string') return JSON.parse(value) as Record<string, unknown>;
  if (Buffer.isBuffer(value)) return JSON.parse(value.toString('utf8')) as Record<string, unknown>;
  if (typeof value === 'object') return value as Record<string, unknown>;
  return {};
}

function parseVector(value: unknown, vectorFormat: OracleVectorFormat, dimension: number): number[] {
  // Oracle clients may return VECTOR values as arrays, typed arrays, or JSON strings depending on mode.
  if (Array.isArray(value)) {
    const values = value.map(Number);
    return vectorFormat === 'bit' && values.length !== dimension ? unpackBitVector(values, dimension) : values;
  }
  if (ArrayBuffer.isView(value)) {
    const values = Array.from(value as unknown as ArrayLike<number>).map(Number);
    return vectorFormat === 'bit' ? unpackBitVector(values, dimension) : values;
  }
  if (typeof value === 'string') {
    const values = (JSON.parse(value) as number[]).map(Number);
    return vectorFormat === 'bit' && values.length !== dimension ? unpackBitVector(values, dimension) : values;
  }
  return [];
}

function unpackBitVector(bytes: ArrayLike<number>, dimension: number): number[] {
  const vector: number[] = [];
  for (let i = 0; i < dimension; i += 1) {
    const byte = bytes[Math.floor(i / 8)] ?? 0;
    vector.push((byte & (1 << (7 - (i % 8)))) === 0 ? 0 : 1);
  }
  return vector;
}
