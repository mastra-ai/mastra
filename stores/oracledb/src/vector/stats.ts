import { ErrorCategory, MastraError } from '@mastra/core/error';
import { validateTopK } from '@mastra/core/vector';
import type { DescribeIndexParams, IndexStats } from '@mastra/core/vector';
import type { Connection } from 'oracledb';
import type oracledb from 'oracledb';

import type { ObjectRow } from '../shared/connection';
import { executeOptions, rows } from '../shared/connection';
import type { IndexInfo, IndexRegistry, WithConnection } from './ddl';
import { normalizeIdentifier, normalizeLogicalIndexName, indexNameForTable } from './identifiers';
import { validateAccuracy } from './sql';
import type { OracleConfigureVectorMemoryParams, OracleIndexAccuracyParams, OracleIndexStatusParams } from './types';
import { STORE_NAME, asMastraError, validateVectorForIndex, vectorBind, withCause } from './upsert';

type BindParameters = oracledb.BindParameters;

// Read-only diagnostics (describe/list/status/accuracy) plus the Vector Pool sizing helper.

export async function listIndexes(registry: IndexRegistry, withConnection: WithConnection): Promise<string[]> {
  return withConnection(async connection => {
    await registry.ensureRegistry(connection);
    const result = await connection.execute<ObjectRow>(
      `SELECT index_name AS "indexName" FROM ${registry.qualifiedRegistryTable()} ORDER BY index_name`,
      {},
      executeOptions(),
    );

    return rows(result).map(row => String(row.indexName));
  }).catch(error => {
    if (error instanceof MastraError) throw error;
    throw asMastraError('LIST_INDEXES', 'FAILED', {}, error);
  });
}

export async function describeIndex(
  registry: IndexRegistry,
  withConnection: WithConnection,
  { indexName }: DescribeIndexParams,
): Promise<IndexStats> {
  return withConnection(async connection => getIndexInfo(registry, connection, indexName) as unknown as IndexStats).catch(error => {
    if (error instanceof MastraError) throw error;
    throw asMastraError('DESCRIBE_INDEX', 'FAILED', { indexName }, error);
  });
}

export async function getIndexStatus(
  registry: IndexRegistry,
  withConnection: WithConnection,
  { indexName, ownerName }: OracleIndexStatusParams,
): Promise<string> {
  return withConnection(async connection => {
    const logicalIndexName = normalizeLogicalIndexName(indexName);
    const indexInfo = await registry.getIndexMetadata(connection, logicalIndexName);
    if (indexInfo.indexType === 'none') return 'NONE';

    const indexObjectName = indexNameForTable(indexInfo.tableName, 'VECTOR_IDX');
    const owner = ownerName ? normalizeIdentifier(ownerName, 'index owner name') : registry.schemaName;
    const ownerPredicate = owner ? ':ownerName' : "SYS_CONTEXT('USERENV','CURRENT_SCHEMA')";
    const binds: BindParameters = owner ? { ownerName: owner, indexName: indexObjectName } : { indexName: indexObjectName };
    const result = await connection.execute<ObjectRow>(
      `
      SELECT
        status AS "status",
        index_type AS "indexType",
        domidx_status AS "domainStatus"
      FROM all_indexes
      WHERE owner = ${ownerPredicate}
        AND index_name = :indexName
      FETCH FIRST 1 ROWS ONLY`,
      binds,
      executeOptions(),
    );

    const row = rows(result)[0];
    if (!row) return 'NOT_FOUND';

    const status = String(row.status ?? 'UNKNOWN');
    const indexType = row.indexType ? `type=${String(row.indexType)}` : '';
    const domainStatus = row.domainStatus ? `domain=${String(row.domainStatus)}` : '';
    return [status, indexType, domainStatus].filter(Boolean).join(' ');
  }).catch(error => {
    if (error instanceof MastraError) throw error;
    throw asMastraError('GET_INDEX_STATUS', 'FAILED', { indexName }, error);
  });
}

export async function indexAccuracyQuery(
  registry: IndexRegistry,
  withConnection: WithConnection,
  { indexName, queryVector, topK, targetAccuracy }: OracleIndexAccuracyParams,
): Promise<string> {
  return withConnection(async connection => {
    validateTopK(STORE_NAME, topK);
    if (targetAccuracy !== undefined) validateAccuracy(targetAccuracy);

    const logicalIndexName = normalizeLogicalIndexName(indexName);
    const indexInfo = await registry.getIndexMetadata(connection, logicalIndexName);
    validateVectorForIndex(queryVector, indexInfo, indexName);
    const indexObjectName = indexNameForTable(indexInfo.tableName, 'VECTOR_IDX');
    const ownerExpression = registry.schemaName ? ':ownerName' : "SYS_CONTEXT('USERENV','CURRENT_SCHEMA')";
    const result = await connection.execute<ObjectRow>(
      `SELECT DBMS_VECTOR.INDEX_ACCURACY_QUERY(
        ${ownerExpression},
        :indexName,
        :queryVector,
        :topK,
        :targetAccuracy
      ) AS "accuracy"
      FROM dual`,
      {
        ...(registry.schemaName ? { ownerName: registry.schemaName } : {}),
        indexName: indexObjectName,
        queryVector: vectorBind(queryVector, indexInfo.vectorFormat),
        topK,
        targetAccuracy: targetAccuracy ?? indexInfo.accuracy ?? 95,
      },
      executeOptions(),
    );

    return String(rows(result)[0]?.accuracy ?? '');
  }).catch(error => {
    if (error instanceof MastraError) throw error;
    throw asMastraError('INDEX_ACCURACY_QUERY', 'FAILED', { indexName }, error);
  });
}

export async function configureVectorMemory(
  withConnection: WithConnection,
  { size, scope = 'MEMORY' }: OracleConfigureVectorMemoryParams,
): Promise<void> {
  const normalizedSize = normalizeVectorMemorySize(size);
  const normalizedScope = normalizeVectorMemoryScope(scope);

  return withConnection(async connection => {
    // HNSW uses Oracle's Vector Pool; local/dev users can size it through this privileged helper.
    await connection.execute(`ALTER SYSTEM SET VECTOR_MEMORY_SIZE = ${normalizedSize} SCOPE=${normalizedScope}`);
  }).catch(error => {
    if (error instanceof MastraError) throw error;
    throw asMastraError(
      'CONFIGURE_VECTOR_MEMORY',
      'FAILED',
      { size: normalizedSize, scope: normalizedScope },
      createVectorMemoryConfigurationError(normalizedSize, normalizedScope, error),
      ErrorCategory.USER,
    );
  });
}

async function getIndexInfo(registry: IndexRegistry, connection: Connection, indexName: string): Promise<IndexInfo> {
  const indexInfo = await registry.getIndexMetadata(connection, indexName);

  // describeIndex reports live row count, so read it from the physical vector table each time.
  const countResult = await connection.execute<ObjectRow>(
    `SELECT COUNT(*) AS "count" FROM ${indexInfo.qualifiedTableName}`,
    {},
    executeOptions(),
  );
  const count = Number(rows(countResult)[0]?.count ?? 0);

  return {
    ...indexInfo,
    count,
  };
}

function normalizeVectorMemorySize(size: string): string {
  const normalized = size.trim().toUpperCase();
  if (!/^\d+(?:[KMG])?$/.test(normalized)) {
    throw new Error('vector memory size must be an integer optionally followed by K, M, or G, for example "512M"');
  }
  return normalized;
}

function normalizeVectorMemoryScope(scope: string): 'MEMORY' | 'SPFILE' | 'BOTH' {
  const normalized = scope.trim().toUpperCase();
  if (normalized !== 'MEMORY' && normalized !== 'SPFILE' && normalized !== 'BOTH') {
    throw new Error('vector memory scope must be one of "MEMORY", "SPFILE", or "BOTH"');
  }
  return normalized;
}

function createVectorMemoryConfigurationError(size: string, scope: string, cause: unknown): Error {
  return withCause(
    new Error(
      `Unable to set Oracle VECTOR_MEMORY_SIZE=${size} SCOPE=${scope}. ` +
        'Run this with a DBA-capable user such as SYSTEM for local Docker databases, or ask your DBA to size the Vector Pool before building HNSW indexes.',
    ),
    cause,
  );
}
