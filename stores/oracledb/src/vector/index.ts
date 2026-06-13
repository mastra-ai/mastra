import { randomUUID } from 'node:crypto';

export type * from './types';

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createVectorErrorId } from '@mastra/core/storage';
import { MastraVector, validateTopK, validateUpsertInput } from '@mastra/core/vector';
import type {
  DeleteIndexParams,
  DeleteVectorParams,
  DeleteVectorsParams,
  DescribeIndexParams,
  IndexStats,
  QueryResult,
  UpdateVectorParams,
  UpsertVectorParams,
} from '@mastra/core/vector';
import oracledb from 'oracledb';
import type { Connection } from 'oracledb';

import {
  OraclePoolManager,
  asBindParameters,
  executeDdl as executeOracleDdl,
  executeOptions,
  isOracleErrorCode,
  jsonBind,
  normalizeBatchSize,
  rollbackQuietly,
  rows,
  safeJsonValue,
} from '../shared/connection';
import type { ObjectRow } from '../shared/connection';
import { buildMetadataWhereClause } from './filter';
import {
  assertJsonPath,
  indexNameForMetadataField,
  indexNameForTable,
  legacyCanonicalIndexName,
  normalizeIdentifier,
  normalizeLogicalIndexName,
  qualifyName,
  tableNameForIndex,
} from './identifiers';
import {
  buildVectorIndexParameterClause,
  defaultMetricForFormat,
  metricToken,
  normalizeMetric,
  normalizeVectorFormat,
  validateAccuracy,
  validateDimension,
  validateMetricForFormat,
  validateVectorFormatDimension,
  vectorFormatToken,
} from './sql';
import type {
  OracleBuildIndexParams,
  OracleConfigureVectorMemoryParams,
  OracleIndexAccuracyParams,
  OracleCreateIndexParams,
  OracleIndexStats,
  OracleIndexStatusParams,
  OracleMetric,
  OracleQueryVectorParams,
  OracleRebuildIndexParams,
  OracleVectorConfig,
  OracleVectorFilter,
  OracleVectorFormat,
  OracleVectorIndexConfig,
  OracleVectorIndexType,
} from './types';

const STORE_NAME = 'ORACLE';
const DEFAULT_TABLE_PREFIX = 'MASTRA_VEC';
const DEFAULT_REGISTRY_TABLE = 'MASTRA_VECTOR_INDEXES';
const DEFAULT_METADATA_INDEXES = ['thread_id', 'resource_id', 'message_id', 'source_id'];
const DEFAULT_VECTOR_FORMAT: OracleVectorFormat = 'vector';
const VECTOR_ID_DELETE_CHUNK_SIZE = 900;
const DEFAULT_VECTOR_UPSERT_BATCH_SIZE = 200;
const VECTOR_MEMORY_EXHAUSTED_CODES = [-51962];

type BindParameters = oracledb.BindParameters;

// Registry metadata is the source of truth for mapping logical indexes to Oracle objects.
interface IndexInfo extends OracleIndexStats {
  qualifiedTableName: string;
}

type CachedIndexInfo = Omit<IndexInfo, 'count'>;

// OracleVector keeps Mastra's vector API stable while using native Oracle VECTOR and JSON features.
export class OracleVector extends MastraVector<OracleVectorFilter> {
  private readonly poolManager: OraclePoolManager;
  private readonly ownsPoolManager: boolean;

  private readonly schemaName?: string;
  private readonly tablePrefix: string;
  private readonly registryTableName: string;
  private readonly defaultIndexConfig: OracleVectorIndexConfig;
  private readonly defaultMetadataIndexes: string[];
  private readonly defaultVectorFormat: OracleVectorFormat;
  private readonly upsertBatchSize: number;
  // One lock per logical index prevents two callers from creating/dropping the same Oracle objects at once.
  private readonly indexLocks = new Map<string, Promise<void>>();
  private readonly indexInfoCache = new Map<string, CachedIndexInfo>();
  private registryReady = false;
  private registryPromise?: Promise<void>;

  constructor(config: OracleVectorConfig) {
    try {
      super({ id: config.id });

      this.poolManager = config.poolManager ?? new OraclePoolManager(config);
      this.ownsPoolManager = !config.poolManager;
      this.schemaName = config.schemaName ? normalizeIdentifier(config.schemaName, 'schema name') : undefined;
      this.tablePrefix = normalizeIdentifier(config.tablePrefix ?? DEFAULT_TABLE_PREFIX, 'table prefix');
      this.registryTableName = normalizeIdentifier(
        config.registryTableName ?? DEFAULT_REGISTRY_TABLE,
        'registry table name',
      );
      this.defaultIndexConfig = { type: 'none', accuracy: 95, ...config.defaultIndexConfig };
      this.defaultMetadataIndexes = config.defaultMetadataIndexes ?? DEFAULT_METADATA_INDEXES;
      this.defaultVectorFormat = normalizeVectorFormat(config.defaultVectorFormat ?? DEFAULT_VECTOR_FORMAT);
      this.upsertBatchSize = normalizeBatchSize(config.upsertBatchSize, 'upsertBatchSize', DEFAULT_VECTOR_UPSERT_BATCH_SIZE);
    } catch (error) {
      throw asMastraError('INITIALIZATION', 'FAILED', { schemaName: config.schemaName ?? '' }, error);
    }
  }

  async createIndex({
    indexName,
    dimension,
    metric,
    vectorFormat,
    indexConfig,
    buildIndex = true,
    metadataIndexes,
  }: OracleCreateIndexParams): Promise<void> {
    try {
      const logicalIndexName = normalizeLogicalIndexName(indexName);
      const normalizedFormat = normalizeVectorFormat(vectorFormat ?? this.defaultVectorFormat);
      const normalizedMetric = normalizeMetric(metric ?? defaultMetricForFormat(normalizedFormat));
      const mergedConfig = this.mergeIndexConfig(indexConfig);
      validateDimension(dimension);
      validateVectorFormatDimension(normalizedFormat, dimension);
      validateMetricForFormat(normalizedMetric, normalizedFormat);

      await this.withIndexLock(logicalIndexName, () => this.withConnection(async connection => {
        await this.ensureRegistry(connection);
        const existing = await this.getRegistryEntry(connection, logicalIndexName);
        if (existing) {
          // Re-running createIndex is allowed when the existing table shape matches the requested shape.
          const tableExists = await this.vectorTableExists(connection, existing.tableName);
          const tableName = tableExists ? existing.tableName : tableNameForIndex(logicalIndexName, this.tablePrefix);
          if (tableExists) {
            this.assertCompatibleExistingIndex(existing, logicalIndexName, dimension, normalizedMetric, normalizedFormat);
          } else {
            await this.createVectorTable(connection, logicalIndexName, dimension, normalizedFormat);
            await this.upsertRegistry(connection, logicalIndexName, dimension, normalizedMetric, normalizedFormat, mergedConfig);
          }

          await this.createMetadataIndexes(
            connection,
            logicalIndexName,
            metadataIndexes ?? this.defaultMetadataIndexes,
            tableName,
          );

          if (buildIndex && mergedConfig.type !== 'none') {
            const createdIndex = await this.createVectorIndex(connection, logicalIndexName, normalizedMetric, mergedConfig, tableName);
            if (!createdIndex && !vectorIndexRegistryConfigMatches(existing, normalizedMetric, mergedConfig)) {
              throw vectorIndexAlreadyExistsError('CREATE_INDEX', logicalIndexName, existing);
            }
            if (createdIndex) {
              await this.updateRegistryIndexConfig(connection, logicalIndexName, normalizedMetric, mergedConfig);
            }
          }
          const finalInfo =
            buildIndex && mergedConfig.type !== 'none'
              ? {
                  ...existing,
                  tableName,
                  metric: normalizedMetric,
                  indexType: mergedConfig.type,
                  accuracy: mergedConfig.accuracy ?? 95,
                }
              : tableExists
                ? { ...existing, tableName }
                : {
                    indexName: logicalIndexName,
                    tableName,
                    dimension,
                    metric: normalizedMetric,
                    indexType: mergedConfig.type,
                    vectorFormat: normalizedFormat,
                    accuracy: mergedConfig.accuracy ?? 95,
                  };
          this.cacheIndexMetadata(logicalIndexName, {
            ...finalInfo,
            qualifiedTableName: qualifyName(tableName, this.schemaName),
          });
          return;
        }

        const tableName = tableNameForIndex(logicalIndexName, this.tablePrefix);
        if (await this.vectorTableExists(connection, tableName)) {
          // A physical table without registry metadata is unsafe because describe/query cannot validate dimensions.
          throw asMastraError(
            'CREATE_INDEX',
            'REGISTRY_MISSING',
            { indexName: logicalIndexName, tableName },
            new Error(
              `Oracle vector table "${tableName}" already exists, but registry metadata for "${logicalIndexName}" is missing. Delete the stale table or restore the registry entry before creating the index.`,
            ),
            ErrorCategory.USER,
          );
        }

        await this.createVectorTable(connection, logicalIndexName, dimension, normalizedFormat);
        await this.createMetadataIndexes(
          connection,
          logicalIndexName,
          metadataIndexes ?? this.defaultMetadataIndexes,
        );

        if (buildIndex && mergedConfig.type !== 'none') {
          const createdIndex = await this.createVectorIndex(connection, logicalIndexName, normalizedMetric, mergedConfig);
          if (!createdIndex) {
            throw vectorIndexAlreadyExistsError('CREATE_INDEX', logicalIndexName, {
              metric: normalizedMetric,
              indexType: mergedConfig.type,
            });
          }
        }
        await this.upsertRegistry(connection, logicalIndexName, dimension, normalizedMetric, normalizedFormat, mergedConfig);
        this.cacheIndexMetadata(logicalIndexName, {
          indexName: logicalIndexName,
          tableName,
          dimension,
          metric: normalizedMetric,
          indexType: mergedConfig.type,
          vectorFormat: normalizedFormat,
          accuracy: mergedConfig.accuracy ?? 95,
          qualifiedTableName: qualifyName(tableName, this.schemaName),
        });
      }));
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw asMastraError('CREATE_INDEX', 'FAILED', { indexName }, error);
    }
  }

  async buildIndex({ indexName, metric, indexConfig }: OracleBuildIndexParams): Promise<void> {
    return this.withConnection(async connection => {
      const logicalIndexName = normalizeLogicalIndexName(indexName);
      const indexInfo = await this.getIndexMetadata(connection, logicalIndexName);
      const mergedConfig = this.mergeIndexConfig(indexConfig ?? {
        type: indexInfo.indexType,
        accuracy: indexInfo.accuracy,
      });

      // `none` is a valid exact-search mode, so buildIndex becomes a no-op for those indexes.
      if (mergedConfig.type === 'none') return;

      const normalizedMetric = normalizeMetric(metric ?? indexInfo.metric);
      validateMetricForFormat(normalizedMetric, indexInfo.vectorFormat);
      const createdIndex = await this.createVectorIndex(connection, logicalIndexName, normalizedMetric, mergedConfig, indexInfo.tableName);
      if (!createdIndex) {
        const explicitlyRequestedConfig = metric !== undefined || indexConfig !== undefined;
        const registryConfigChanged = !vectorIndexRegistryConfigMatches(indexInfo, normalizedMetric, mergedConfig);
        if (explicitlyRequestedConfig || registryConfigChanged) {
          throw vectorIndexAlreadyExistsError('BUILD_INDEX', logicalIndexName, indexInfo);
        }
        return;
      }
      await this.updateRegistryIndexConfig(connection, logicalIndexName, normalizedMetric, mergedConfig);
      this.cacheIndexMetadata(logicalIndexName, {
        ...indexInfo,
        metric: normalizedMetric,
        indexType: mergedConfig.type,
        accuracy: mergedConfig.accuracy ?? 95,
      });
    }).catch(error => {
      if (error instanceof MastraError) throw error;
      throw asMastraError('BUILD_INDEX', 'FAILED', { indexName }, error);
    });
  }

  async rebuildIndex({ indexName, metric, indexConfig }: OracleRebuildIndexParams): Promise<void> {
    return this.withConnection(async connection => {
      const logicalIndexName = normalizeLogicalIndexName(indexName);
      const indexInfo = await this.getIndexMetadata(connection, logicalIndexName);
      const normalizedMetric = normalizeMetric(metric ?? indexInfo.metric);
      validateMetricForFormat(normalizedMetric, indexInfo.vectorFormat);
      const mergedConfig = this.mergeIndexConfig(indexConfig ?? {
        type: indexInfo.indexType,
        accuracy: indexInfo.accuracy,
      });

      if (mergedConfig.type === 'none') return;

      await this.dropVectorIndex(connection, logicalIndexName, indexInfo.tableName);
      await this.createVectorIndex(connection, logicalIndexName, normalizedMetric, mergedConfig, indexInfo.tableName);
      await this.updateRegistryIndexConfig(connection, logicalIndexName, normalizedMetric, mergedConfig);
      this.cacheIndexMetadata(logicalIndexName, {
        ...indexInfo,
        metric: normalizedMetric,
        indexType: mergedConfig.type,
        accuracy: mergedConfig.accuracy ?? 95,
      });
    }).catch(error => {
      if (error instanceof MastraError) throw error;
      throw asMastraError('REBUILD_INDEX', 'FAILED', { indexName }, error);
    });
  }

  async configureVectorMemory({ size, scope = 'MEMORY' }: OracleConfigureVectorMemoryParams): Promise<void> {
    const normalizedSize = normalizeVectorMemorySize(size);
    const normalizedScope = normalizeVectorMemoryScope(scope);

    return this.withConnection(async connection => {
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

  async getIndexStatus({ indexName, ownerName }: OracleIndexStatusParams): Promise<string> {
    return this.withConnection(async connection => {
      const logicalIndexName = normalizeLogicalIndexName(indexName);
      const indexInfo = await this.getIndexMetadata(connection, logicalIndexName);
      if (indexInfo.indexType === 'none') return 'NONE';

      const indexObjectName = indexNameForTable(indexInfo.tableName, 'VECTOR_IDX');
      const owner = ownerName ? normalizeIdentifier(ownerName, 'index owner name') : this.schemaName;
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

  async indexAccuracyQuery({
    indexName,
    queryVector,
    topK,
    targetAccuracy,
  }: OracleIndexAccuracyParams): Promise<string> {
    return this.withConnection(async connection => {
      validateTopK(STORE_NAME, topK);
      if (targetAccuracy !== undefined) validateAccuracy(targetAccuracy);

      const logicalIndexName = normalizeLogicalIndexName(indexName);
      const indexInfo = await this.getIndexMetadata(connection, logicalIndexName);
      validateVectorForIndex(queryVector, indexInfo, indexName);
      const indexObjectName = indexNameForTable(indexInfo.tableName, 'VECTOR_IDX');
      const ownerExpression = this.schemaName ? ':ownerName' : "SYS_CONTEXT('USERENV','CURRENT_SCHEMA')";
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
          ...(this.schemaName ? { ownerName: this.schemaName } : {}),
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

  async upsert({
    indexName,
    vectors,
    metadata,
    ids,
    sparseVectors,
    deleteFilter,
  }: UpsertVectorParams): Promise<string[]> {
    try {
      if (sparseVectors !== undefined) {
        throw new Error('OracleVector does not support sparseVectors yet; use dense vectors types');
      }
      validateUpsertInput(STORE_NAME, vectors, metadata, ids);
      validateVectors(vectors);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw asMastraError('UPSERT', 'INVALID_INPUT', { indexName }, error, ErrorCategory.USER);
    }

    const vectorIds = ids ?? vectors.map(() => randomUUID());

    return this.withConnection(async connection => {
      const indexInfo = await this.getIndexMetadata(connection, indexName);

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
            metadata: { type: oracledb.DB_TYPE_JSON },
          },
        };
        const upsertBinds = vectors.map((vector, i) => {
          validateVectorForIndex(vector, indexInfo, indexName);

          return {
            vector_id: vectorIds[i]!,
            embedding: vectorValue(vector, indexInfo.vectorFormat),
            metadata: safeJsonValue(metadata?.[i] ?? {}),
          };
        });

        // Execute in chunks to avoid very large bind arrays while still using Oracle array DML.
        for (const chunk of chunkArray(upsertBinds, this.upsertBatchSize)) {
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

  async query({
    indexName,
    queryVector,
    topK = 10,
    filter,
    includeVector = false,
    minScore = -1,
    sparseVector,
    queryMode,
    targetAccuracy,
  }: OracleQueryVectorParams): Promise<QueryResult[]> {
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

    return this.withConnection(async connection => {
      const indexInfo = await this.getIndexMetadata(connection, indexName);
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

  async listIndexes(): Promise<string[]> {
    return this.withConnection(async connection => {
      await this.ensureRegistry(connection);
      const result = await connection.execute<ObjectRow>(
        `SELECT index_name AS "indexName" FROM ${this.qualifiedRegistryTable()} ORDER BY index_name`,
        {},
        executeOptions(),
      );

      return rows(result).map(row => String(row.indexName));
    }).catch(error => {
      if (error instanceof MastraError) throw error;
      throw asMastraError('LIST_INDEXES', 'FAILED', {}, error);
    });
  }

  async describeIndex({ indexName }: DescribeIndexParams): Promise<IndexStats> {
    return this.withConnection(async connection => this.getIndexInfo(connection, indexName) as unknown as IndexStats).catch(error => {
      if (error instanceof MastraError) throw error;
      throw asMastraError('DESCRIBE_INDEX', 'FAILED', { indexName }, error);
    });
  }

  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    const logicalIndexName = normalizeLogicalIndexName(indexName);
    return this.withIndexLock(logicalIndexName, () => this.withConnection(async connection => {
      await this.ensureRegistry(connection);
      const registryRow = await this.getRegistryEntry(connection, logicalIndexName);
      const tableName = registryRow
        ? qualifyName(registryRow.tableName, this.schemaName)
        : this.qualifiedTableName(logicalIndexName);

      await executeOracleDdl(connection, `DROP TABLE ${tableName} CASCADE CONSTRAINTS PURGE`, [-942]);
      await connection.execute(
        `DELETE FROM ${this.qualifiedRegistryTable()} WHERE index_name IN (:indexName, :legacyIndexName)`,
        {
          indexName: logicalIndexName,
          legacyIndexName: safeLegacyCanonicalIndexName(logicalIndexName),
        },
      );
      await connection.commit();
      this.clearIndexMetadata(logicalIndexName);
    })).catch(error => {
      if (error instanceof MastraError) throw error;
      throw asMastraError('DELETE_INDEX', 'FAILED', { indexName }, error);
    });
  }

  async updateVector({ indexName, id, filter, update }: UpdateVectorParams<OracleVectorFilter>): Promise<void> {
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

    return this.withConnection(async connection => {
      const indexInfo = await this.getIndexMetadata(connection, indexName);
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

  async deleteVector({ indexName, id }: DeleteVectorParams): Promise<void> {
    return this.withConnection(async connection => {
      const indexInfo = await this.getIndexMetadata(connection, indexName);
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

  async deleteVectors({ indexName, ids, filter }: DeleteVectorsParams<OracleVectorFilter>): Promise<void> {
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

    return this.withConnection(async connection => {
      const indexInfo = await this.getIndexMetadata(connection, indexName);
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

  async disconnect(): Promise<void> {
    if (this.ownsPoolManager) {
      await this.poolManager.close();
    }
  }

  async close(): Promise<void> {
    await this.disconnect();
  }

  private async withConnection<T>(callback: (connection: Connection) => Promise<T>): Promise<T> {
    return this.poolManager.withConnection(callback);
  }

  private async withIndexLock<T>(indexName: string, callback: () => Promise<T>): Promise<T> {
    const previousLock = this.indexLocks.get(indexName) ?? Promise.resolve();
    let release!: () => void;
    const currentLock = new Promise<void>(resolve => {
      release = resolve;
    });

    this.indexLocks.set(indexName, currentLock);
    // Wait for the previous operation even if it failed, then let this caller surface its own result.
    await previousLock.catch(() => undefined);

    try {
      return await callback();
    } finally {
      release();
      if (this.indexLocks.get(indexName) === currentLock) {
        this.indexLocks.delete(indexName);
      }
    }
  }

  private async ensureRegistry(connection: Connection): Promise<void> {
    if (this.registryReady) return;
    if (!this.registryPromise) {
      this.registryPromise = (async () => {
        // ALTER keeps older registry tables compatible without forcing a migration step.
        await executeOracleDdl(
          connection,
          `
          CREATE TABLE ${this.qualifiedRegistryTable()} (
            index_name VARCHAR2(512) PRIMARY KEY,
            table_name VARCHAR2(128) NOT NULL,
            dimension NUMBER(10) NOT NULL,
            metric VARCHAR2(32) NOT NULL,
            index_type VARCHAR2(16) NOT NULL,
            vector_format VARCHAR2(16) DEFAULT 'vector' NOT NULL,
            accuracy NUMBER(3),
            created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
            updated_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
          )`,
          [-955],
        );
        await executeOracleDdl(
          connection,
          `ALTER TABLE ${this.qualifiedRegistryTable()} ADD vector_format VARCHAR2(16) DEFAULT 'vector' NOT NULL`,
          [-1430],
        );
        this.registryReady = true;
      })().catch(error => {
        this.registryPromise = undefined;
        throw error;
      });
    }
    await this.registryPromise;
  }

  private async createVectorTable(
    connection: Connection,
    indexName: string,
    dimension: number,
    vectorFormat: OracleVectorFormat,
  ): Promise<void> {
    // Each logical Mastra index owns a table because dimensions and vector formats are table-level choices.
    await executeOracleDdl(
      connection,
      `
      CREATE TABLE ${this.qualifiedTableName(indexName)} (
        vector_id VARCHAR2(512) PRIMARY KEY,
        embedding VECTOR(${dimension}, ${vectorFormatToken(vectorFormat)}) NOT NULL,
        metadata JSON NOT NULL,
        created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
      )`,
      [-955],
    );
  }

  private async upsertRegistry(
    connection: Connection,
    indexName: string,
    dimension: number,
    metric: OracleMetric,
    vectorFormat: OracleVectorFormat,
    indexConfig?: OracleVectorIndexConfig,
  ): Promise<void> {
    const tableName = tableNameForIndex(indexName, this.tablePrefix);
    const mergedConfig = this.mergeIndexConfig(indexConfig);

    // Registry writes are idempotent so createIndex can be safely retried by deployment scripts.
    await connection.execute(
      `
      MERGE INTO ${this.qualifiedRegistryTable()} target
      USING (
        SELECT
          :index_name AS index_name,
          :table_name AS table_name,
          :dimension AS dimension,
          :metric AS metric,
          :index_type AS index_type,
          :vector_format AS vector_format,
          :accuracy AS accuracy
        FROM dual
      ) source
      ON (target.index_name = source.index_name)
      WHEN MATCHED THEN UPDATE SET
        target.table_name = source.table_name,
        target.dimension = source.dimension,
        target.metric = source.metric,
        target.index_type = source.index_type,
        target.vector_format = source.vector_format,
        target.accuracy = source.accuracy,
        target.updated_at = SYSTIMESTAMP
      WHEN NOT MATCHED THEN INSERT (
        index_name,
        table_name,
        dimension,
        metric,
        index_type,
        vector_format,
        accuracy,
        created_at,
        updated_at
      ) VALUES (
        source.index_name,
        source.table_name,
        source.dimension,
        source.metric,
        source.index_type,
        source.vector_format,
        source.accuracy,
        SYSTIMESTAMP,
        SYSTIMESTAMP
      )`,
      {
        index_name: indexName,
        table_name: tableName,
        dimension,
        metric,
        index_type: mergedConfig.type ?? 'none',
        vector_format: vectorFormat,
        accuracy: mergedConfig.accuracy ?? 95,
      },
    );
    await connection.commit();
  }

  private async updateRegistryIndexConfig(
    connection: Connection,
    indexName: string,
    metric: OracleMetric,
    indexConfig: OracleVectorIndexConfig,
  ): Promise<void> {
    const mergedConfig = this.mergeIndexConfig(indexConfig);
    await connection.execute(
      `
      UPDATE ${this.qualifiedRegistryTable()}
      SET
        metric = :metric,
        index_type = :index_type,
        accuracy = :accuracy,
        updated_at = SYSTIMESTAMP
      WHERE index_name = :indexName`,
      {
        indexName,
        metric,
        index_type: mergedConfig.type ?? 'none',
        accuracy: mergedConfig.accuracy ?? 95,
      },
    );
    await connection.commit();
  }

  private async createVectorIndex(
    connection: Connection,
    indexName: string,
    metric: OracleMetric,
    indexConfig?: OracleVectorIndexConfig,
    tableNameOverride?: string,
  ): Promise<boolean> {
    const tableName = tableNameOverride ?? tableNameForIndex(indexName, this.tablePrefix);
    const indexObjectName = this.qualifiedIndexName(indexNameForTable(tableName, 'VECTOR_IDX'));
    const qualifiedTableName = qualifyName(tableName, this.schemaName);
    const mergedConfig = this.mergeIndexConfig(indexConfig);
    const accuracy = mergedConfig.accuracy ?? 95;
    validateAccuracy(accuracy);

    const organization =
      mergedConfig.type === 'ivf' ? 'ORGANIZATION NEIGHBOR PARTITIONS' : 'ORGANIZATION INMEMORY NEIGHBOR GRAPH';
    const parameterClause = buildVectorIndexParameterClause(mergedConfig);

    try {
      // Duplicate index errors are reported to callers so registry metadata is updated only when DDL actually ran.
      return await executeOracleDdl(
        connection,
        `
        CREATE VECTOR INDEX ${indexObjectName}
        ON ${qualifiedTableName} (embedding)
        ${organization}
        DISTANCE ${metricToken(metric)}
        WITH TARGET ACCURACY ${accuracy}
        ${parameterClause}`,
        [-955],
      );
    } catch (error) {
      if (isOracleErrorCode(error, VECTOR_MEMORY_EXHAUSTED_CODES)) {
        throw asMastraError(
          'CREATE_INDEX',
          'VECTOR_MEMORY_EXHAUSTED',
          {
            indexName,
            indexType: mergedConfig.type,
            accuracy,
            vectorMemoryParameter: 'VECTOR_MEMORY_SIZE',
          },
          createInsufficientVectorMemoryError(indexName, mergedConfig, error),
          ErrorCategory.USER,
        );
      }
      throw error;
    }
  }

  private async dropVectorIndex(connection: Connection, indexName: string, tableNameOverride?: string): Promise<void> {
    const tableName = tableNameOverride ?? tableNameForIndex(indexName, this.tablePrefix);
    const indexObjectName = this.qualifiedIndexName(indexNameForTable(tableName, 'VECTOR_IDX'));
    await executeOracleDdl(connection, `DROP INDEX ${indexObjectName}`, [-1418]);
  }

  private async createMetadataIndexes(
    connection: Connection,
    indexName: string,
    metadataFields: string[],
    tableNameOverride?: string,
  ): Promise<void> {
    const tableName = tableNameOverride ?? tableNameForIndex(indexName, this.tablePrefix);
    const qualifiedTableName = qualifyName(tableName, this.schemaName);
    for (const field of metadataFields) {
      const metadataIndexName = indexNameForMetadataField(tableName, field);
      const jsonPath = assertJsonPath(field);

      // Metadata indexes target scalar JSON_VALUE paths used by the filter compiler.
      await executeOracleDdl(
        connection,
        `
        CREATE INDEX ${this.qualifiedIndexName(metadataIndexName)}
        ON ${qualifiedTableName} (
          JSON_VALUE(metadata, '${jsonPath}' RETURNING VARCHAR2(4000) NULL ON ERROR)
        )`,
        [-955],
      );
    }
  }

  private async getIndexMetadata(connection: Connection, indexName: string): Promise<CachedIndexInfo> {
    const logicalIndexName = normalizeLogicalIndexName(indexName);
    const cached = this.indexInfoCache.get(logicalIndexName);
    if (cached) return cached;

    await this.ensureRegistry(connection);

    const registryRow = await this.getRegistryEntry(connection, logicalIndexName);
    if (!registryRow) {
      throw new Error(`Vector index "${indexName}" does not exist`);
    }

    const qualifiedTableName = qualifyName(registryRow.tableName, this.schemaName);
    return this.cacheIndexMetadata(logicalIndexName, {
      ...registryRow,
      qualifiedTableName,
    });
  }

  private async getIndexInfo(connection: Connection, indexName: string): Promise<IndexInfo> {
    const indexInfo = await this.getIndexMetadata(connection, indexName);

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

  private cacheIndexMetadata(indexName: string, indexInfo: CachedIndexInfo): CachedIndexInfo {
    const logicalIndexName = normalizeLogicalIndexName(indexName);
    this.indexInfoCache.set(logicalIndexName, indexInfo);
    this.indexInfoCache.set(indexInfo.indexName, indexInfo);
    return indexInfo;
  }

  private clearIndexMetadata(indexName: string): void {
    const logicalIndexName = normalizeLogicalIndexName(indexName);
    this.indexInfoCache.delete(logicalIndexName);
    this.indexInfoCache.delete(safeLegacyCanonicalIndexName(logicalIndexName));
  }

  private async getRegistryEntry(connection: Connection, indexName: string): Promise<Omit<IndexInfo, 'qualifiedTableName' | 'count'> | null> {
    const logicalIndexName = normalizeLogicalIndexName(indexName);
    const legacyIndexName = safeLegacyCanonicalIndexName(logicalIndexName);
    // Prefer exact logical names, then fall back to the legacy uppercase registry key.
    const registryResult = await connection.execute<ObjectRow>(
      `
      SELECT
        index_name AS "indexName",
        table_name AS "tableName",
        dimension AS "dimension",
        metric AS "metric",
        index_type AS "indexType",
        vector_format AS "vectorFormat",
        accuracy AS "accuracy"
      FROM ${this.qualifiedRegistryTable()}
      WHERE index_name IN (:indexName, :legacyIndexName)
      ORDER BY CASE WHEN index_name = :indexName THEN 0 ELSE 1 END
      FETCH FIRST 1 ROWS ONLY`,
      { indexName: logicalIndexName, legacyIndexName },
      executeOptions(),
    );
    const registryRow = rows(registryResult)[0];
    if (!registryRow) return null;

    return {
      indexName: String(registryRow.indexName),
      tableName: String(registryRow.tableName),
      dimension: Number(registryRow.dimension),
      metric: normalizeMetric(String(registryRow.metric)),
      indexType: normalizeIndexType(String(registryRow.indexType)),
      vectorFormat: normalizeVectorFormat(String(registryRow.vectorFormat ?? DEFAULT_VECTOR_FORMAT)),
      accuracy: registryRow.accuracy === null || registryRow.accuracy === undefined ? undefined : Number(registryRow.accuracy),
    };
  }

  private async vectorTableExists(connection: Connection, tableName: string): Promise<boolean> {
    const normalizedTableName = normalizeIdentifier(tableName, 'table name');
    const binds: BindParameters = { tableName: normalizedTableName };
    const ownerPredicate = this.schemaName ? ':ownerName' : "SYS_CONTEXT('USERENV','CURRENT_SCHEMA')";
    if (this.schemaName) {
      binds.ownerName = this.schemaName;
    }

    const result = await connection.execute<ObjectRow>(
      `SELECT 1 AS "exists" FROM all_tables WHERE owner = ${ownerPredicate} AND table_name = :tableName FETCH FIRST 1 ROW ONLY`,
      binds,
      executeOptions(),
    );
    return rows(result).length > 0;
  }

  private assertCompatibleExistingIndex(
    existing: Omit<IndexInfo, 'qualifiedTableName' | 'count'>,
    indexName: string,
    dimension: number,
    metric: OracleMetric,
    vectorFormat: OracleVectorFormat,
  ): void {
    if (existing.dimension !== dimension) {
      throw asMastraError(
        'CREATE_INDEX',
        'DIMENSION_MISMATCH',
        { indexName, expected: existing.dimension, actual: dimension },
        new Error(
          `Vector index "${indexName}" already exists with dimension ${existing.dimension}; received ${dimension}`,
        ),
        ErrorCategory.USER,
      );
    }

    if (existing.metric !== metric) {
      throw asMastraError(
        'CREATE_INDEX',
        'METRIC_MISMATCH',
        { indexName, expected: existing.metric, actual: metric },
        new Error(`Vector index "${indexName}" already exists with metric ${existing.metric}; received ${metric}`),
        ErrorCategory.USER,
      );
    }

    if (existing.vectorFormat !== vectorFormat) {
      throw asMastraError(
        'CREATE_INDEX',
        'VECTOR_FORMAT_MISMATCH',
        { indexName, expected: existing.vectorFormat, actual: vectorFormat },
        new Error(
          `Vector index "${indexName}" already exists with vector format ${existing.vectorFormat}; received ${vectorFormat}`,
        ),
        ErrorCategory.USER,
      );
    }
  }

  private mergeIndexConfig(indexConfig?: OracleVectorIndexConfig): Required<Pick<OracleVectorIndexConfig, 'type'>> &
    OracleVectorIndexConfig {
    const type = normalizeIndexType(indexConfig?.type ?? this.defaultIndexConfig.type ?? 'none');
    const accuracy = indexConfig?.accuracy ?? this.defaultIndexConfig.accuracy;
    if (accuracy !== undefined) validateAccuracy(accuracy);

    return {
      ...this.defaultIndexConfig,
      ...indexConfig,
      type,
      accuracy,
      hnsw: {
        ...this.defaultIndexConfig.hnsw,
        ...indexConfig?.hnsw,
      },
      ivf: {
        ...this.defaultIndexConfig.ivf,
        ...indexConfig?.ivf,
      },
    };
  }

  private qualifiedRegistryTable(): string {
    return qualifyName(this.registryTableName, this.schemaName);
  }

  private qualifiedTableName(indexName: string): string {
    return qualifyName(tableNameForIndex(indexName, this.tablePrefix), this.schemaName);
  }

  private qualifiedIndexName(indexName: string): string {
    return qualifyName(indexName, this.schemaName);
  }

}

function normalizeQueryMode(queryMode: string): 'approx' | 'exact' {
  const normalized = queryMode.toLowerCase();
  if (normalized !== 'approx' && normalized !== 'exact') {
    throw new Error('queryMode must be one of "approx" or "exact"');
  }
  return normalized;
}

function normalizeIndexType(indexType: string): OracleVectorIndexType {
  const normalized = indexType.toLowerCase();
  if (normalized !== 'hnsw' && normalized !== 'ivf' && normalized !== 'none') {
    throw new Error('index type must be one of "hnsw", "ivf", or "none"');
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

function vectorIndexRegistryConfigMatches(
  indexInfo: Pick<OracleIndexStats, 'metric' | 'indexType' | 'accuracy'>,
  metric: OracleMetric,
  indexConfig: OracleVectorIndexConfig,
): boolean {
  return (
    indexInfo.metric === metric &&
    indexInfo.indexType === normalizeIndexType(indexConfig.type ?? 'none') &&
    (indexInfo.accuracy ?? 95) === (indexConfig.accuracy ?? 95)
  );
}

function vectorIndexAlreadyExistsError(
  operation: 'BUILD_INDEX' | 'CREATE_INDEX',
  indexName: string,
  indexInfo: Pick<OracleIndexStats, 'metric' | 'indexType'>,
): MastraError {
  return asMastraError(
    operation,
    'INDEX_ALREADY_EXISTS',
    { indexName, indexType: indexInfo.indexType, metric: indexInfo.metric },
    new Error(
      `Oracle vector index for "${indexName}" already exists. Use rebuildIndex() to change the metric or index configuration.`,
    ),
    ErrorCategory.USER,
  );
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

function createInsufficientVectorMemoryError(
  indexName: string,
  indexConfig: OracleVectorIndexConfig,
  cause: unknown,
): Error {
  const indexType = (indexConfig.type ?? 'hnsw').toUpperCase();
  return withCause(
    new Error(
      `Oracle could not create the ${indexType} vector index "${indexName}" because the current container's Vector Pool is out of space (ORA-51962). ` +
        'HNSW indexes live in the Oracle Vector Pool, controlled by VECTOR_MEMORY_SIZE. ' +
        'Increase it once with DBA privileges, for example: ALTER SYSTEM SET VECTOR_MEMORY_SIZE = 512M SCOPE=MEMORY. ' +
        'From this adapter you can also run vector.configureVectorMemory({ size: "512M" }) using a privileged connection. '
    ),
    cause,
  );
}

function withCause(error: Error, cause: unknown): Error {
  (error as Error & { cause?: unknown }).cause = cause;
  return error;
}

function validateVectors(vectors: number[][]): void {
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

function validateVectorForIndex(vector: number[], indexInfo: Pick<OracleIndexStats, 'dimension' | 'vectorFormat'>, indexName: string): void {
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

function vectorBind(vector: number[], vectorFormat: OracleVectorFormat): oracledb.BindParameter {
  return { type: oracledb.DB_TYPE_VECTOR, val: vectorValue(vector, vectorFormat) };
}

function vectorValue(vector: number[], vectorFormat: OracleVectorFormat): Float32Array | Int8Array | Uint8Array {
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

function unpackBitVector(bytes: ArrayLike<number>, dimension: number): number[] {
  const vector: number[] = [];
  for (let i = 0; i < dimension; i += 1) {
    const byte = bytes[Math.floor(i / 8)] ?? 0;
    vector.push((byte & (1 << (7 - (i % 8)))) === 0 ? 0 : 1);
  }
  return vector;
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

function safeLegacyCanonicalIndexName(indexName: string): string {
  try {
    return legacyCanonicalIndexName(indexName);
  } catch {
    return indexName;
  }
}

function chunkArray<T>(values: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }
  return chunks;
}

function asMastraError(
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
