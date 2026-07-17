import { ObservabilityStorage, TABLE_SPANS } from '@mastra/core/storage';
import type {
  BatchCreateLogsArgs,
  BatchCreateScoresArgs,
  BatchCreateSpansArgs,
  BatchDeleteTracesArgs,
  BatchUpdateSpansArgs,
  CreateScoreArgs,
  CreateSpanArgs,
  GetEntityNamesArgs,
  GetEntityNamesResponse,
  GetEntityTypesArgs,
  GetEntityTypesResponse,
  GetEnvironmentsArgs,
  GetEnvironmentsResponse,
  GetRootSpanArgs,
  GetRootSpanResponse,
  GetServiceNamesArgs,
  GetServiceNamesResponse,
  GetSpanArgs,
  GetSpanResponse,
  GetTagsArgs,
  GetTagsResponse,
  GetTraceArgs,
  GetTraceLightResponse,
  GetTraceResponse,
  ListLogsArgs,
  ListLogsResponse,
  ListScoresArgs,
  ListScoresResponse,
  ListTracesArgs,
  ListTracesResponse,
  ObservabilityStorageStrategy,
  ScoreRecord,
  TracingStorageStrategy,
  UpdateSpanArgs,
} from '@mastra/core/storage';

import { indexNameForTable, qualifyName } from '../../../vector/identifiers';
import { createOracleIndex, filterIndexesForTables, OracleDB } from '../../db';
import type { OracleCreateIndexOptions } from '../../db';
import type { OracleDomainConfig } from '../../types';
import * as logsOps from './logs';
import { getDefaultObservabilityIndexDefinitions, LOG_EVENTS_TABLE, logEventsTableSql, SPAN_NULLABLE_COLUMNS, SPAN_SCHEMA } from './schema';
import * as scoresOps from './scores-bridge';
import * as spansOps from './spans';

export { getDefaultObservabilityIndexDefinitions, LOG_EVENTS_TABLE, logEventsTableSql } from './schema';

export class ObservabilityOracle extends ObservabilityStorage {
  static readonly MANAGED_TABLES = [TABLE_SPANS, LOG_EVENTS_TABLE] as const;

  private readonly db: OracleDB;
  private readonly schemaName?: string;
  private readonly skipDefaultIndexes?: boolean;
  private readonly indexes: OracleCreateIndexOptions[];

  constructor(config: OracleDomainConfig) {
    super();
    this.db = new OracleDB(config);
    this.schemaName = config.schemaName;
    this.skipDefaultIndexes = config.skipDefaultIndexes;
    this.indexes = filterIndexesForTables(config.indexes, ObservabilityOracle.MANAGED_TABLES);
  }

  async init(): Promise<void> {
    await this.db.createTable({
      tableName: TABLE_SPANS,
      schema: SPAN_SCHEMA,
      // Spans are unique inside a trace; this composite key also makes MERGE
      // safe for insert/update observability strategies.
      compositePrimaryKey: ['traceId', 'spanId'],
    });
    await this.db.executeDdl(logEventsTableSql(this.table(LOG_EVENTS_TABLE)), [-955]);
    await this.db.alterTable({
      tableName: TABLE_SPANS,
      schema: SPAN_SCHEMA,
      ifNotExists: SPAN_NULLABLE_COLUMNS,
    });
    await this.createIndexes();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.tx(async client => {
      await client.none(`DELETE FROM ${this.table(LOG_EVENTS_TABLE)}`);
      await client.none(`DELETE FROM ${this.table(TABLE_SPANS)}`);
    });
  }

  public get observabilityStrategy(): {
    preferred: ObservabilityStorageStrategy;
    supported: ObservabilityStorageStrategy[];
  } {
    // Oracle supports efficient batch upserts, so prefer the strategy that lets
    // the runtime create spans early and update them as work completes.
    return {
      preferred: 'batch-with-updates',
      supported: ['batch-with-updates', 'insert-only'],
    };
  }

  public get tracingStrategy(): {
    preferred: TracingStorageStrategy;
    supported: TracingStorageStrategy[];
  } {
    return this.observabilityStrategy;
  }

  getDefaultIndexDefinitions(): OracleCreateIndexOptions[] {
    return getDefaultObservabilityIndexDefinitions(this.indexName.bind(this));
  }

  // Logs
  async batchCreateLogs(args: BatchCreateLogsArgs): Promise<void> {
    return logsOps.batchCreateLogs(this.db, this.schemaName, args);
  }

  async listLogs(args: ListLogsArgs): Promise<ListLogsResponse> {
    return logsOps.listLogs(this.db, this.schemaName, args);
  }

  // Scores
  async listScores(args: ListScoresArgs): Promise<ListScoresResponse> {
    return scoresOps.listScores(this.db, this.schemaName, args);
  }

  async createScore(args: CreateScoreArgs): Promise<void> {
    return scoresOps.createScore(this.db, this.schemaName, args);
  }

  async batchCreateScores(args: BatchCreateScoresArgs): Promise<void> {
    return scoresOps.batchCreateScores(this.db, this.schemaName, args);
  }

  async getScoreById(scoreId: string): Promise<ScoreRecord | null> {
    return scoresOps.getScoreById(this.db, this.schemaName, scoreId);
  }

  // Spans & traces
  async createSpan(args: CreateSpanArgs): Promise<void> {
    return spansOps.createSpan(this.db, this.schemaName, args);
  }

  async batchCreateSpans(args: BatchCreateSpansArgs): Promise<void> {
    return spansOps.batchCreateSpans(this.db, this.schemaName, args);
  }

  async getSpan(args: GetSpanArgs): Promise<GetSpanResponse | null> {
    return spansOps.getSpan(this.db, this.schemaName, args);
  }

  async getRootSpan(args: GetRootSpanArgs): Promise<GetRootSpanResponse | null> {
    return spansOps.getRootSpan(this.db, this.schemaName, args);
  }

  async getTrace(args: GetTraceArgs): Promise<GetTraceResponse | null> {
    return spansOps.getTrace(this.db, this.schemaName, args);
  }

  async getTraceLight(args: GetTraceArgs): Promise<GetTraceLightResponse | null> {
    return spansOps.getTraceLight(this.db, this.schemaName, args);
  }

  async updateSpan(args: UpdateSpanArgs): Promise<void> {
    return spansOps.updateSpan(this.db, this.schemaName, args);
  }

  async batchUpdateSpans(args: BatchUpdateSpansArgs): Promise<void> {
    return spansOps.batchUpdateSpans(this.db, this.schemaName, args);
  }

  async batchDeleteTraces(args: BatchDeleteTracesArgs): Promise<void> {
    return spansOps.batchDeleteTraces(this.db, this.schemaName, args);
  }

  async listTraces(args: ListTracesArgs): Promise<ListTracesResponse> {
    return spansOps.listTraces(this.db, this.schemaName, args);
  }

  // Discovery (spans + log events)
  async getEntityTypes(args: GetEntityTypesArgs): Promise<GetEntityTypesResponse> {
    return spansOps.getEntityTypes(this.db, this.schemaName, args);
  }

  async getEntityNames(args: GetEntityNamesArgs): Promise<GetEntityNamesResponse> {
    return spansOps.getEntityNames(this.db, this.schemaName, args);
  }

  async getServiceNames(args: GetServiceNamesArgs): Promise<GetServiceNamesResponse> {
    return spansOps.getServiceNames(this.db, this.schemaName, args);
  }

  async getEnvironments(args: GetEnvironmentsArgs): Promise<GetEnvironmentsResponse> {
    return spansOps.getEnvironments(this.db, this.schemaName, args);
  }

  async getTags(args: GetTagsArgs): Promise<GetTagsResponse> {
    return spansOps.getTags(this.db, this.schemaName, args);
  }

  private async createIndexes(): Promise<void> {
    await this.db.withConnection(async connection => {
      if (!this.skipDefaultIndexes) {
        for (const index of this.getDefaultIndexDefinitions()) {
          try {
            await createOracleIndex(connection, index, this.schemaName);
          } catch (error) {
            this.logger?.warn?.(`Failed to create Oracle default index ${index.name}:`, error);
          }
        }
      }

      for (const index of this.indexes) {
        try {
          await createOracleIndex(connection, index, this.schemaName);
        } catch (error) {
          this.logger?.warn?.(`Failed to create Oracle custom index ${index.name}:`, error);
        }
      }
    });
  }

  private table(tableName = TABLE_SPANS): string {
    return qualifyName(tableName, this.schemaName);
  }

  private indexName(indexName: string): string {
    return indexNameForTable(indexName, 'IDX');
  }
}
