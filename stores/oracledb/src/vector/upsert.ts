import { randomUUID } from 'node:crypto';

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createVectorErrorId } from '@mastra/core/storage';
import { validateUpsertInput } from '@mastra/core/vector';
import type {
  DeleteVectorParams,
  DeleteVectorsParams,
  UpdateVectorParams,
  UpsertVectorParams,
} from '@mastra/core/vector';
import oracledb from 'oracledb';

import { asBindParameters, jsonBind, jsonBindText, rollbackQuietly } from '../shared/connection';
import type { IndexRegistry, WithConnection } from './ddl';
import { buildMetadataWhereClause } from './filter';
import type { OracleIndexStats, OracleVectorFilter, OracleVectorFormat } from './types';

export const VECTOR_ID_DELETE_CHUNK_SIZE = 900;
export const DEFAULT_VECTOR_UPSERT_BATCH_SIZE = 200;

// This module is the dependency-free base for the vector store split: it owns every operation that
// writes vector rows (upsert/update/delete), the vector-format encode/decode + validation helpers
// shared with query.ts and stats.ts, and the generic MastraError-wrapping helper every sibling
// module uses. Its only import from ddl.ts is type-only (erased at build time), so there is no
// runtime circular dependency even though ddl.ts imports asMastraError/withCause from here.
export const STORE_NAME = 'ORACLE';

type BindParameters = oracledb.BindParameters;

export async function upsert(
  registry: IndexRegistry,
  withConnection: WithConnection,
  upsertBatchSize: number,
  { indexName, vectors, metadata, ids, sparseVectors, deleteFilter }: UpsertVectorParams,
): Promise<string[]> {
  try {
    if (sparseVectors !== undefined) {
      throw new Error('OracleVector does not support sparseVectors yet; use dense vector types');
    }
    validateUpsertInput(STORE_NAME, vectors, metadata, ids);
    validateVectors(vectors);
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw asMastraError('UPSERT', 'INVALID_INPUT', { indexName }, error, ErrorCategory.USER);
  }

  const vectorIds = ids ?? vectors.map(() => randomUUID());

  return withConnection(async connection => {
    const indexInfo = await registry.getIndexMetadata(connection, indexName);

    try {
      // deleteFilter + upsert is treated as one transaction to avoid partially refreshed indexes.
      if (deleteFilter && Object.keys(deleteFilter).length > 0) {
        const filter = buildMetadataWhereClause(deleteFilter);
        await connection.execute(`DELETE FROM ${indexInfo.qualifiedTableName} ${filter.sql}`, asBindParameters(filter.binds));
      }

      const mergeSql = `
        MERGE INTO ${indexInfo.qualifiedTableName} target
        USING (
          SELECT
            :vector_id AS vector_id,
            :embedding AS embedding,
            :metadata AS metadata
          FROM dual
        ) source
        ON (target.vector_id = source.vector_id)
        WHEN MATCHED THEN UPDATE SET
          target.embedding = source.embedding,
          target.metadata = source.metadata,
          target.updated_at = SYSTIMESTAMP
        WHEN NOT MATCHED THEN INSERT (
          vector_id,
          embedding,
          metadata,
          created_at,
          updated_at
        ) VALUES (
          source.vector_id,
          source.embedding,
          source.metadata,
          SYSTIMESTAMP,
          SYSTIMESTAMP
        )`;

      const executeManyOptions: oracledb.ExecuteManyOptions = {
        bindDefs: {
          vector_id: { type: oracledb.STRING, maxSize: 512 },
          embedding: { type: oracledb.DB_TYPE_VECTOR },
          // JSON bound as text (see jsonBindText): server-side OSON encoding keeps the rows
          // readable by JDBC-based tools (DBeaver/DataGrip/SQL Developer). See ../shared/connection.
          metadata: { type: oracledb.DB_TYPE_CLOB },
        },
      };
      const upsertBinds = vectors.map((vector, i) => {
        validateVectorForIndex(vector, indexInfo, indexName);

        return {
          vector_id: vectorIds[i]!,
          embedding: vectorValue(vector, indexInfo.vectorFormat),
          metadata: jsonBindText(metadata?.[i] ?? {}),
        };
      });

      // Execute in chunks to avoid very large bind arrays while still using Oracle array DML.
      for (const chunk of chunkArray(upsertBinds, upsertBatchSize)) {
        await connection.executeMany(mergeSql, chunk as BindParameters[], executeManyOptions);
      }

      await connection.commit();
      return vectorIds;
    } catch (error) {
      await rollbackQuietly(connection);
      throw error;
    }
  }).catch(error => {
    if (error instanceof MastraError) throw error;
    throw asMastraError('UPSERT', 'FAILED', { indexName }, error);
  });
}

export async function updateVector(
  registry: IndexRegistry,
  withConnection: WithConnection,
  { indexName, id, filter, update }: UpdateVectorParams<OracleVectorFilter>,
): Promise<void> {
  try {
    if (!update.vector && !update.metadata) {
      throw new Error('No updates provided');
    }
    if (!id && !filter) {
      throw new Error('Either id or filter must be provided');
    }
    if (id && filter) {
      throw new Error('id and filter are mutually exclusive');
    }
    if (update.vector) {
      validateVectors([update.vector]);
    }
  } catch (error) {
    throw asMastraError('UPDATE_VECTOR', 'INVALID_INPUT', { indexName, id: id ?? '' }, error, ErrorCategory.USER);
  }

  return withConnection(async connection => {
    const indexInfo = await registry.getIndexMetadata(connection, indexName);
    if (update.vector) {
      validateVectorForIndex(update.vector, indexInfo, indexName);
    }

    const setParts: string[] = ['updated_at = SYSTIMESTAMP'];
    const binds: BindParameters = {};
    if (update.vector) {
      setParts.unshift('embedding = :embedding');
      binds.embedding = vectorBind(update.vector, indexInfo.vectorFormat);
    }
    if (update.metadata) {
      setParts.unshift('metadata = :metadata');
      binds.metadata = jsonBind(update.metadata);
    }

    const where = id ? { sql: 'WHERE vector_id = :id', binds: { id } } : buildMetadataWhereClause(filter);
    if (!where.sql) {
      throw asMastraError(
        'UPDATE_VECTOR',
        'EMPTY_FILTER',
        { indexName },
        new Error('Cannot update with an empty filter'),
        ErrorCategory.USER,
      );
    }

    try {
      await connection.execute(
        `
        UPDATE ${indexInfo.qualifiedTableName}
        SET ${setParts.join(', ')}
        ${where.sql}`,
        asBindParameters({ ...binds, ...where.binds }),
        { autoCommit: true },
      );
    } catch (error) {
      await rollbackQuietly(connection);
      throw error;
    }
  }).catch(error => {
    if (error instanceof MastraError) throw error;
    throw asMastraError('UPDATE_VECTOR', 'FAILED', { indexName, id: id ?? '' }, error);
  });
}

export async function deleteVector(
  registry: IndexRegistry,
  withConnection: WithConnection,
  { indexName, id }: DeleteVectorParams,
): Promise<void> {
  return withConnection(async connection => {
    const indexInfo = await registry.getIndexMetadata(connection, indexName);
    try {
      await connection.execute(`DELETE FROM ${indexInfo.qualifiedTableName} WHERE vector_id = :id`, { id }, { autoCommit: true });
    } catch (error) {
      await rollbackQuietly(connection);
      throw error;
    }
  }).catch(error => {
    if (error instanceof MastraError) throw error;
    throw asMastraError('DELETE_VECTOR', 'FAILED', { indexName, id }, error);
  });
}

export async function deleteVectors(
  registry: IndexRegistry,
  withConnection: WithConnection,
  { indexName, ids, filter }: DeleteVectorsParams<OracleVectorFilter>,
): Promise<void> {
  try {
    const hasFilter = filter !== undefined && filter !== null;
    if (ids !== undefined && hasFilter) {
      throw new Error('ids and filter are mutually exclusive');
    }
    if (ids !== undefined && ids.length === 0) {
      throw new Error('empty ids array');
    }
    if (hasFilter && Object.keys(filter).length === 0) {
      throw new Error('empty filter');
    }
    if (ids === undefined && !hasFilter) {
      throw new Error('Either filter or ids must be provided');
    }
  } catch (error) {
    throw asMastraError('DELETE_VECTORS', 'INVALID_INPUT', { indexName }, error, ErrorCategory.USER);
  }

  return withConnection(async connection => {
    const indexInfo = await registry.getIndexMetadata(connection, indexName);
    try {
      if (ids?.length) {
        for (const idChunk of chunkArray(ids, VECTOR_ID_DELETE_CHUNK_SIZE)) {
          await connection.executeMany(
            `DELETE FROM ${indexInfo.qualifiedTableName} WHERE vector_id = :id`,
            idChunk.map(id => ({ id })) as BindParameters[],
            {
              bindDefs: {
                id: { type: oracledb.STRING, maxSize: 512 },
              },
            },
          );
        }
      } else {
        const metadataFilter = buildMetadataWhereClause(filter);
        await connection.execute(
          `DELETE FROM ${indexInfo.qualifiedTableName} ${metadataFilter.sql}`,
          asBindParameters(metadataFilter.binds),
        );
      }
      await connection.commit();
    } catch (error) {
      await rollbackQuietly(connection);
      throw error;
    }
  }).catch(error => {
    if (error instanceof MastraError) throw error;
    throw asMastraError('DELETE_VECTORS', 'FAILED', { indexName }, error);
  });
}

export function validateVectors(vectors: number[][]): void {
  for (let vectorIndex = 0; vectorIndex < vectors.length; vectorIndex += 1) {
    const vector = vectors[vectorIndex];
    if (!Array.isArray(vector) || vector.length === 0) {
      throw new Error(`Vector at index ${vectorIndex} must be a non-empty number array`);
    }
    for (let componentIndex = 0; componentIndex < vector.length; componentIndex += 1) {
      const value = vector[componentIndex];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`Vector at index ${vectorIndex} has a non-finite value at component ${componentIndex}`);
      }
    }
  }
}

function validateVectorDimension(vector: number[], dimension: number, indexName: string): void {
  if (vector.length !== dimension) {
    throw asMastraError(
      'UPSERT',
      'INVALID_INPUT',
      { indexName, expected: String(dimension), actual: String(vector.length) },
      new Error(`Vector dimension mismatch: expected ${dimension}, received ${vector.length}`),
      ErrorCategory.USER,
    );
  }
}

export function validateVectorForIndex(
  vector: number[],
  indexInfo: Pick<OracleIndexStats, 'dimension' | 'vectorFormat'>,
  indexName: string,
): void {
  validateVectorDimension(vector, indexInfo.dimension, indexName);

  if (indexInfo.vectorFormat === 'bit') {
    for (const [index, value] of vector.entries()) {
      if (value !== 0 && value !== 1) {
        throw asMastraError(
          'VECTOR_FORMAT',
          'INVALID_BIT_VALUE',
          { indexName, index, value },
          new Error('bit vectors must contain only 0 or 1 values'),
          ErrorCategory.USER,
        );
      }
    }
  }

  if (indexInfo.vectorFormat === 'int8') {
    for (const [index, value] of vector.entries()) {
      if (!Number.isInteger(value) || value < -128 || value > 127) {
        throw asMastraError(
          'VECTOR_FORMAT',
          'INVALID_INT8_VALUE',
          { indexName, index, value },
          new Error('int8 vectors must contain integers from -128 to 127'),
          ErrorCategory.USER,
        );
      }
    }
  }
}

export function vectorBind(vector: number[], vectorFormat: OracleVectorFormat): oracledb.BindParameter {
  return { type: oracledb.DB_TYPE_VECTOR, val: vectorValue(vector, vectorFormat) };
}

export function vectorValue(vector: number[], vectorFormat: OracleVectorFormat): Float32Array | Int8Array | Uint8Array {
  // node-oracledb binds VECTOR columns through typed arrays, with bit vectors packed by byte.
  switch (vectorFormat) {
    case 'bit':
      return packBitVector(vector);
    case 'int8':
      return Int8Array.from(vector);
    case 'vector':
    default:
      return Float32Array.from(vector);
  }
}

function packBitVector(vector: number[]): Uint8Array {
  // Oracle BINARY vectors store eight user-facing 0/1 dimensions per byte.
  const bytes = new Uint8Array(vector.length / 8);
  for (let i = 0; i < vector.length; i += 1) {
    if (vector[i]) {
      const byteIndex = Math.floor(i / 8);
      bytes[byteIndex] = (bytes[byteIndex] ?? 0) | (1 << (7 - (i % 8)));
    }
  }
  return bytes;
}

export function chunkArray<T>(values: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }
  return chunks;
}

export function withCause(error: Error, cause: unknown): Error {
  (error as Error & { cause?: unknown }).cause = cause;
  return error;
}

export function asMastraError(
  operation: string,
  reason: string,
  details: Record<string, string | number | boolean | undefined>,
  cause: unknown,
  category: ErrorCategory = ErrorCategory.THIRD_PARTY,
): MastraError {
  const safeDetails = Object.fromEntries(
    Object.entries(details).filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined),
  );

  return new MastraError(
    {
      id: createVectorErrorId(STORE_NAME, operation, reason),
      domain: ErrorDomain.MASTRA_VECTOR,
      category,
      details: safeDetails,
    },
    cause,
  );
}
