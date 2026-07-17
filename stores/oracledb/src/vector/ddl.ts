import { ErrorCategory, MastraError } from '@mastra/core/error';
import type { DeleteIndexParams } from '@mastra/core/vector';
import type { Connection } from 'oracledb';
import type oracledb from 'oracledb';

import type { ObjectRow } from '../shared/connection';
import { executeDdl as executeOracleDdl, executeOptions, isOracleErrorCode, rows } from '../shared/connection';
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
  OracleCreateIndexParams,
  OracleIndexStats,
  OracleMetric,
  OracleRebuildIndexParams,
  OracleVectorFormat,
  OracleVectorIndexConfig,
  OracleVectorIndexType,
} from './types';
import { asMastraError, withCause } from './upsert';

// Registry and DDL state for OracleVector. asMastraError/withCause live in upsert.ts (the
// dependency-free base module) and are re-used here so every sibling module wraps errors the
// same way without a circular runtime import (upsert.ts only needs ddl.ts's types, which are erased).

export const DEFAULT_TABLE_PREFIX = 'MASTRA_VEC';
export const DEFAULT_REGISTRY_TABLE = 'MASTRA_VECTOR_INDEXES';
export const DEFAULT_METADATA_INDEXES = ['thread_id', 'resource_id', 'message_id', 'source_id'];
export const DEFAULT_VECTOR_FORMAT: OracleVectorFormat = 'vector';
const VECTOR_MEMORY_EXHAUSTED_CODES = [-51962];

type BindParameters = oracledb.BindParameters;

// A connection-scoped callback, shaped exactly like OraclePoolManager#withConnection, so sibling
// modules can run queries without owning the pool themselves.
export type WithConnection = <T>(callback: (connection: Connection) => Promise<T>) => Promise<T>;

// Registry metadata is the source of truth for mapping logical indexes to Oracle objects.
export interface IndexInfo extends OracleIndexStats {
  qualifiedTableName: string;
}

export type CachedIndexInfo = Omit<IndexInfo, 'count'>;

export interface IndexRegistryConfig {
  schemaName?: string;
  tablePrefix: string;
  registryTableName: string;
  defaultMetadataIndexes: string[];
  defaultVectorFormat: OracleVectorFormat;
  defaultIndexConfig: OracleVectorIndexConfig;
}

// IndexRegistry owns the mutable state (locks, caches, registry readiness) plus every DDL/registry
// operation. OracleVector holds one instance and delegates to it.
export class IndexRegistry {
  readonly schemaName?: string;
  private readonly tablePrefix: string;
  private readonly registryTableName: string;
  private readonly defaultMetadataIndexes: string[];
  private readonly defaultVectorFormat: OracleVectorFormat;
  private readonly defaultIndexConfig: OracleVectorIndexConfig;
  // One lock per logical index prevents two callers from creating/dropping the same Oracle objects at once.
  private readonly indexLocks = new Map<string, Promise<void>>();
  private readonly indexInfoCache = new Map<string, CachedIndexInfo>();
  private registryReady = false;
  private registryPromise?: Promise<void>;

  constructor(config: IndexRegistryConfig) {
    this.schemaName = config.schemaName;
    this.tablePrefix = config.tablePrefix;
    this.registryTableName = config.registryTableName;
    this.defaultMetadataIndexes = config.defaultMetadataIndexes;
    this.defaultVectorFormat = config.defaultVectorFormat;
    this.defaultIndexConfig = config.defaultIndexConfig;
  }

  async createIndex(withConnection: WithConnection, {
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
      const unbuiltConfig = this.mergeIndexConfig({ type: 'none' });
      const builtConfig = buildIndex ? mergedConfig : unbuiltConfig;
      validateDimension(dimension);
      validateVectorFormatDimension(normalizedFormat, dimension);
      validateMetricForFormat(normalizedMetric, normalizedFormat, mergedConfig.type);

      await this.withIndexLock(logicalIndexName, () => withConnection(async connection => {
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
            await this.upsertRegistry(connection, logicalIndexName, dimension, normalizedMetric, normalizedFormat, unbuiltConfig);
            this.clearIndexMetadata(logicalIndexName);
          }

          await this.createMetadataIndexes(
            connection,
            logicalIndexName,
            metadataIndexes ?? this.defaultMetadataIndexes,
            tableName,
          );

          if (buildIndex && mergedConfig.type !== 'none') {
            const createdIndex = await this.createVectorIndex(connection, logicalIndexName, normalizedMetric, mergedConfig, tableName);
            if (!createdIndex && (!tableExists || !vectorIndexRegistryConfigMatches(existing, normalizedMetric, mergedConfig))) {
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
                    indexType: builtConfig.type,
                    vectorFormat: normalizedFormat,
                    accuracy: builtConfig.accuracy ?? 95,
                  };
          this.cacheIndexMetadata(logicalIndexName, {
            ...finalInfo,
            qualifiedTableName: qualifyName(tableName, this.schemaName),
          });
          return;
        }

        const tableName = tableNameForIndex(logicalIndexName, this.tablePrefix);
        if (await this.vectorTableExists(connection, tableName)) {
          // Oracle identifier normalization can collapse two distinct logical names (e.g. "foo" and
          // "FOO") onto the same physical table. Check the registry for a row already claiming this
          // table under a different index name so the error explains the real cause instead of the
          // generic "registry metadata is missing" message below.
          const collidingIndexName = await this.findRegistryEntryByTableName(connection, tableName);
          if (collidingIndexName && collidingIndexName !== logicalIndexName) {
            throw asMastraError(
              'CREATE_INDEX',
              'IDENTIFIER_COLLISION',
              { indexName: logicalIndexName, tableName, collidingIndexName },
              new Error(
                `Logical index name "${logicalIndexName}" collides with existing index "${collidingIndexName}" after Oracle identifier normalization (both map to table "${tableName}"). Choose a different index name.`,
              ),
              ErrorCategory.USER,
            );
          }

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
        await this.upsertRegistry(connection, logicalIndexName, dimension, normalizedMetric, normalizedFormat, unbuiltConfig);
        this.clearIndexMetadata(logicalIndexName);
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
          await this.updateRegistryIndexConfig(connection, logicalIndexName, normalizedMetric, mergedConfig);
        }
        this.cacheIndexMetadata(logicalIndexName, {
          indexName: logicalIndexName,
          tableName,
          dimension,
          metric: normalizedMetric,
          indexType: builtConfig.type,
          vectorFormat: normalizedFormat,
          accuracy: builtConfig.accuracy ?? 95,
          qualifiedTableName: qualifyName(tableName, this.schemaName),
        });
      }));
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw asMastraError('CREATE_INDEX', 'FAILED', { indexName }, error);
    }
  }

  async buildIndex(withConnection: WithConnection, { indexName, metric, indexConfig }: OracleBuildIndexParams): Promise<void> {
    const logicalIndexName = normalizeLogicalIndexName(indexName);
    // Locked like createIndex/deleteIndex so a concurrent build/rebuild on the same logical index
    // cannot interleave DROP/CREATE VECTOR INDEX statements against each other.
    return this.withIndexLock(logicalIndexName, () => withConnection(async connection => {
      const indexInfo = await this.getIndexMetadata(connection, logicalIndexName);
      const existingBuiltConfig = indexInfo.indexType === 'none' ? undefined : {
        type: indexInfo.indexType,
        accuracy: indexInfo.accuracy,
      };
      const mergedConfig = this.mergeIndexConfig(indexConfig ?? existingBuiltConfig);

      // `none` is a valid exact-search mode, so buildIndex becomes a no-op for those indexes.
      if (mergedConfig.type === 'none') return;

      const normalizedMetric = normalizeMetric(metric ?? indexInfo.metric);
      validateMetricForFormat(normalizedMetric, indexInfo.vectorFormat, mergedConfig.type);
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
    })).catch(error => {
      if (error instanceof MastraError) throw error;
      throw asMastraError('BUILD_INDEX', 'FAILED', { indexName }, error);
    });
  }

  async rebuildIndex(withConnection: WithConnection, { indexName, metric, indexConfig }: OracleRebuildIndexParams): Promise<void> {
    const logicalIndexName = normalizeLogicalIndexName(indexName);
    // Locked like createIndex/deleteIndex so a concurrent build/rebuild on the same logical index
    // cannot interleave DROP/CREATE VECTOR INDEX statements against each other.
    return this.withIndexLock(logicalIndexName, () => withConnection(async connection => {
      const indexInfo = await this.getIndexMetadata(connection, logicalIndexName);
      const normalizedMetric = normalizeMetric(metric ?? indexInfo.metric);
      const mergedConfig = this.mergeIndexConfig(indexConfig ?? {
        type: indexInfo.indexType,
        accuracy: indexInfo.accuracy,
      });
      validateMetricForFormat(normalizedMetric, indexInfo.vectorFormat, mergedConfig.type);

      if (mergedConfig.type === 'none') return;

      await this.dropVectorIndex(connection, logicalIndexName, indexInfo.tableName);
      const createdIndex = await this.createVectorIndex(connection, logicalIndexName, normalizedMetric, mergedConfig, indexInfo.tableName);
      if (!createdIndex) {
        // The DROP above should have cleared the way for a fresh CREATE VECTOR INDEX; a `false`
        // return means the index still exists (e.g. a racing writer recreated it), so the registry
        // must not be advanced to describe a physical index that does not match this config.
        throw vectorIndexAlreadyExistsError('REBUILD_INDEX', logicalIndexName, indexInfo);
      }
      await this.updateRegistryIndexConfig(connection, logicalIndexName, normalizedMetric, mergedConfig);
      this.cacheIndexMetadata(logicalIndexName, {
        ...indexInfo,
        metric: normalizedMetric,
        indexType: mergedConfig.type,
        accuracy: mergedConfig.accuracy ?? 95,
      });
    })).catch(error => {
      if (error instanceof MastraError) throw error;
      throw asMastraError('REBUILD_INDEX', 'FAILED', { indexName }, error);
    });
  }

  async deleteIndex(withConnection: WithConnection, { indexName }: DeleteIndexParams): Promise<void> {
    const logicalIndexName = normalizeLogicalIndexName(indexName);
    return this.withIndexLock(logicalIndexName, () => withConnection(async connection => {
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

  async withIndexLock<T>(indexName: string, callback: () => Promise<T>): Promise<T> {
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

  async ensureRegistry(connection: Connection): Promise<void> {
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

  async createVectorTable(
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

  async upsertRegistry(
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

  async updateRegistryIndexConfig(
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

  async createVectorIndex(
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

  async dropVectorIndex(connection: Connection, indexName: string, tableNameOverride?: string): Promise<void> {
    const tableName = tableNameOverride ?? tableNameForIndex(indexName, this.tablePrefix);
    const indexObjectName = this.qualifiedIndexName(indexNameForTable(tableName, 'VECTOR_IDX'));
    await executeOracleDdl(connection, `DROP INDEX ${indexObjectName}`, [-1418]);
  }

  async createMetadataIndexes(
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

  async getIndexMetadata(connection: Connection, indexName: string): Promise<CachedIndexInfo> {
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

  cacheIndexMetadata(indexName: string, indexInfo: CachedIndexInfo): CachedIndexInfo {
    const logicalIndexName = normalizeLogicalIndexName(indexName);
    this.indexInfoCache.set(logicalIndexName, indexInfo);
    this.indexInfoCache.set(indexInfo.indexName, indexInfo);
    return indexInfo;
  }

  clearIndexMetadata(indexName: string): void {
    const logicalIndexName = normalizeLogicalIndexName(indexName);
    this.indexInfoCache.delete(logicalIndexName);
    this.indexInfoCache.delete(safeLegacyCanonicalIndexName(logicalIndexName));
  }

  async getRegistryEntry(connection: Connection, indexName: string): Promise<Omit<IndexInfo, 'qualifiedTableName' | 'count'> | null> {
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

  // Looks up a registry row by physical table name rather than logical index name, so createIndex can
  // tell an identifier-normalization collision (table claimed by a different index_name) apart from a
  // genuinely orphaned physical table with no registry row at all.
  async findRegistryEntryByTableName(connection: Connection, tableName: string): Promise<string | null> {
    const registryResult = await connection.execute<ObjectRow>(
      `
      SELECT index_name AS "indexName"
      FROM ${this.qualifiedRegistryTable()}
      WHERE table_name = :tableName
      FETCH FIRST 1 ROWS ONLY`,
      { tableName },
      executeOptions(),
    );
    const registryRow = rows(registryResult)[0];
    return registryRow ? String(registryRow.indexName) : null;
  }

  async vectorTableExists(connection: Connection, tableName: string): Promise<boolean> {
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

  assertCompatibleExistingIndex(
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

  mergeIndexConfig(indexConfig?: OracleVectorIndexConfig): Required<Pick<OracleVectorIndexConfig, 'type'>> &
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

  qualifiedRegistryTable(): string {
    return qualifyName(this.registryTableName, this.schemaName);
  }

  qualifiedTableName(indexName: string): string {
    return qualifyName(tableNameForIndex(indexName, this.tablePrefix), this.schemaName);
  }

  qualifiedIndexName(indexName: string): string {
    return qualifyName(indexName, this.schemaName);
  }
}

export function normalizeIndexType(indexType: string): OracleVectorIndexType {
  const normalized = indexType.toLowerCase();
  if (normalized !== 'hnsw' && normalized !== 'ivf' && normalized !== 'none') {
    throw new Error('index type must be one of "hnsw", "ivf", or "none"');
  }
  return normalized;
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
  operation: 'BUILD_INDEX' | 'CREATE_INDEX' | 'REBUILD_INDEX',
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

function safeLegacyCanonicalIndexName(indexName: string): string {
  try {
    return legacyCanonicalIndexName(indexName);
  } catch {
    return indexName;
  }
}
