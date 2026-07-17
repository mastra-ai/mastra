export type * from './types';

import { MastraVector } from '@mastra/core/vector';
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
import type { Connection } from 'oracledb';

import { OraclePoolManager, normalizeBatchSize } from '../shared/connection';
import {
  DEFAULT_METADATA_INDEXES,
  DEFAULT_REGISTRY_TABLE,
  DEFAULT_TABLE_PREFIX,
  DEFAULT_VECTOR_FORMAT,
  IndexRegistry,
} from './ddl';
import type { CachedIndexInfo } from './ddl';
import { normalizeIdentifier } from './identifiers';
import { query as queryOp } from './query';
import { normalizeVectorFormat } from './sql';
import {
  configureVectorMemory as configureVectorMemoryOp,
  describeIndex as describeIndexOp,
  getIndexStatus as getIndexStatusOp,
  indexAccuracyQuery as indexAccuracyQueryOp,
  listIndexes as listIndexesOp,
} from './stats';
import type {
  OracleBuildIndexParams,
  OracleConfigureVectorMemoryParams,
  OracleCreateIndexParams,
  OracleIndexAccuracyParams,
  OracleIndexStatusParams,
  OracleMetric,
  OracleQueryVectorParams,
  OracleRebuildIndexParams,
  OracleVectorConfig,
  OracleVectorFilter,
  OracleVectorIndexConfig,
} from './types';
import {
  DEFAULT_VECTOR_UPSERT_BATCH_SIZE,
  asMastraError,
  deleteVector as deleteVectorOp,
  deleteVectors as deleteVectorsOp,
  updateVector as updateVectorOp,
  upsert as upsertOp,
} from './upsert';

// OracleVector keeps Mastra's vector API stable while using native Oracle VECTOR and JSON features.
// The implementation is split across sibling modules: ddl.ts (registry/DDL + shared error helper),
// upsert.ts (write path + vector format encode/decode), query.ts (search), stats.ts (diagnostics).
// This facade owns the connection pool and wires each call through to the right module.
export class OracleVector extends MastraVector<OracleVectorFilter> {
  private readonly poolManager: OraclePoolManager;
  private readonly ownsPoolManager: boolean;
  private readonly defaultIndexConfig: OracleVectorIndexConfig;
  private readonly upsertBatchSize: number;
  private readonly registry: IndexRegistry;

  constructor(config: OracleVectorConfig) {
    try {
      super({ id: config.id });

      this.poolManager = config.poolManager ?? new OraclePoolManager(config);
      this.ownsPoolManager = !config.poolManager;
      const schemaName = config.schemaName ? normalizeIdentifier(config.schemaName, 'schema name') : undefined;
      const tablePrefix = normalizeIdentifier(config.tablePrefix ?? DEFAULT_TABLE_PREFIX, 'table prefix');
      const registryTableName = normalizeIdentifier(
        config.registryTableName ?? DEFAULT_REGISTRY_TABLE,
        'registry table name',
      );
      this.defaultIndexConfig = { type: 'none', accuracy: 95, ...config.defaultIndexConfig };
      const defaultMetadataIndexes = config.defaultMetadataIndexes ?? DEFAULT_METADATA_INDEXES;
      const defaultVectorFormat = normalizeVectorFormat(config.defaultVectorFormat ?? DEFAULT_VECTOR_FORMAT);
      this.upsertBatchSize = normalizeBatchSize(config.upsertBatchSize, 'upsertBatchSize', DEFAULT_VECTOR_UPSERT_BATCH_SIZE);

      this.registry = new IndexRegistry({
        schemaName,
        tablePrefix,
        registryTableName,
        defaultMetadataIndexes,
        defaultVectorFormat,
        defaultIndexConfig: this.defaultIndexConfig,
      });
    } catch (error) {
      throw asMastraError('INITIALIZATION', 'FAILED', { schemaName: config.schemaName ?? '' }, error);
    }
  }

  async createIndex(params: OracleCreateIndexParams): Promise<void> {
    return this.registry.createIndex(this.withConnection.bind(this), params);
  }

  async buildIndex(params: OracleBuildIndexParams): Promise<void> {
    return this.registry.buildIndex(this.withConnection.bind(this), params);
  }

  async rebuildIndex(params: OracleRebuildIndexParams): Promise<void> {
    return this.registry.rebuildIndex(this.withConnection.bind(this), params);
  }

  async deleteIndex(params: DeleteIndexParams): Promise<void> {
    return this.registry.deleteIndex(this.withConnection.bind(this), params);
  }

  async configureVectorMemory(params: OracleConfigureVectorMemoryParams): Promise<void> {
    return configureVectorMemoryOp(this.withConnection.bind(this), params);
  }

  async getIndexStatus(params: OracleIndexStatusParams): Promise<string> {
    return getIndexStatusOp(this.registry, this.withConnection.bind(this), params);
  }

  async indexAccuracyQuery(params: OracleIndexAccuracyParams): Promise<string> {
    return indexAccuracyQueryOp(this.registry, this.withConnection.bind(this), params);
  }

  async upsert(params: UpsertVectorParams): Promise<string[]> {
    return upsertOp(this.registry, this.withConnection.bind(this), this.upsertBatchSize, params);
  }

  async query(params: OracleQueryVectorParams): Promise<QueryResult[]> {
    return queryOp(this.registry, this.withConnection.bind(this), params);
  }

  async listIndexes(): Promise<string[]> {
    return listIndexesOp(this.registry, this.withConnection.bind(this));
  }

  async describeIndex(params: DescribeIndexParams): Promise<IndexStats> {
    return describeIndexOp(this.registry, this.withConnection.bind(this), params);
  }

  async updateVector(params: UpdateVectorParams<OracleVectorFilter>): Promise<void> {
    return updateVectorOp(this.registry, this.withConnection.bind(this), params);
  }

  async deleteVector(params: DeleteVectorParams): Promise<void> {
    return deleteVectorOp(this.registry, this.withConnection.bind(this), params);
  }

  async deleteVectors(params: DeleteVectorsParams<OracleVectorFilter>): Promise<void> {
    return deleteVectorsOp(this.registry, this.withConnection.bind(this), params);
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

  // Unit tests reach into these two members directly (via `(vector as any)`), so they stay as thin
  // instance-method/property delegations even though the real logic now lives in IndexRegistry.
  private cacheIndexMetadata(indexName: string, indexInfo: CachedIndexInfo): CachedIndexInfo {
    return this.registry.cacheIndexMetadata(indexName, indexInfo);
  }

  private createVectorIndex(
    connection: Connection,
    indexName: string,
    metric: OracleMetric,
    indexConfig?: OracleVectorIndexConfig,
    tableNameOverride?: string,
  ): Promise<boolean> {
    return this.registry.createVectorIndex(connection, indexName, metric, indexConfig, tableNameOverride);
  }
}
