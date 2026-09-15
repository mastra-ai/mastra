import type { Connection } from '@lancedb/lancedb';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { ListScoresResponse, SaveScorePayload, ScoreRowData, ScoringSource } from '@mastra/core/evals';
import { saveScorePayloadSchema } from '@mastra/core/evals';
import {
  createStorageErrorId,
  ScoresStorage,
  TABLE_SCORERS,
  SCORERS_SCHEMA,
  calculatePagination,
  normalizePerPage,
} from '@mastra/core/storage';
import type { StoragePagination, ScoreTenancyFilters } from '@mastra/core/storage';
import { LanceDB, resolveLanceConfig } from '../../db';
import type { LanceDomainConfig } from '../../db';
import { getTableSchema, processResultWithTypeConversion } from '../../db/utils';

/** Escapes a value for safe inclusion in a single-quoted Lance SQL string literal. */
function lanceStringLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

/** Builds a trailing SQL AND clause for the multi-tenant scope filters (empty when none). */
function tenancyClause(filters?: ScoreTenancyFilters): string {
  const parts: string[] = [];
  if (filters?.organizationId !== undefined)
    parts.push(`\`organizationId\` = ${lanceStringLiteral(filters.organizationId)}`);
  if (filters?.projectId !== undefined) parts.push(`\`projectId\` = ${lanceStringLiteral(filters.projectId)}`);
  return parts.length ? ` AND ${parts.join(' AND ')}` : '';
}

export class StoreScoresLance extends ScoresStorage {
  private client: Connection;
  #db: LanceDB;
  constructor(config: LanceDomainConfig) {
    super();
    const client = resolveLanceConfig(config);
    this.client = client;
    this.#db = new LanceDB({ client });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_SCORERS, schema: SCORERS_SCHEMA });
    // Add columns for backwards compatibility
    await this.#db.alterTable({
      tableName: TABLE_SCORERS,
      schema: SCORERS_SCHEMA,
      ifNotExists: ['spanId', 'requestContext', 'organizationId', 'projectId', 'batchId', 'datasetId', 'datasetItemId'],
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_SCORERS });
  }

  async saveScore(score: SaveScorePayload): Promise<{ score: ScoreRowData }> {
    let validatedScore: SaveScorePayload;
    try {
      validatedScore = saveScorePayloadSchema.parse(score);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LANCE', 'SAVE_SCORE', 'VALIDATION_FAILED'),
          text: 'Failed to save score in LanceStorage',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: {
            scorer: typeof score.scorer?.id === 'string' ? score.scorer.id : String(score.scorer?.id ?? 'unknown'),
            entityId: score.entityId ?? 'unknown',
            entityType: score.entityType ?? 'unknown',
            traceId: score.traceId ?? '',
            spanId: score.spanId ?? '',
          },
        },
        error,
      );
    }
    const id = crypto.randomUUID();
    const now = new Date();

    try {
      const table = await this.client.openTable(TABLE_SCORERS);
      // Fetch schema fields for mastra_scorers
      const schema = await getTableSchema({ tableName: TABLE_SCORERS, client: this.client });
      const allowedFields = new Set(schema.fields.map((f: any) => f.name));
      // Filter out fields not in schema
      const filteredScore: Record<string, any> = {};
      for (const key of Object.keys(validatedScore)) {
        if (allowedFields.has(key)) {
          filteredScore[key] = validatedScore[key as keyof typeof validatedScore];
        }
      }
      // Convert any object fields to JSON strings for storage
      for (const key in filteredScore) {
        if (
          filteredScore[key] !== null &&
          typeof filteredScore[key] === 'object' &&
          !(filteredScore[key] instanceof Date)
        ) {
          filteredScore[key] = JSON.stringify(filteredScore[key]);
        }
      }

      filteredScore.id = id;
      filteredScore.createdAt = now;
      filteredScore.updatedAt = now;

      await table.add([filteredScore], { mode: 'append' });
      return { score: { ...validatedScore, id, createdAt: now, updatedAt: now } as ScoreRowData };
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('LANCE', 'SAVE_SCORE', 'FAILED'),
          text: 'Failed to save score in LanceStorage',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { error: error?.message },
        },
        error,
      );
    }
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    try {
      const table = await this.client.openTable(TABLE_SCORERS);

      const query = table
        .query()
        .where(`id = ${lanceStringLiteral(id)}`)
        .limit(1);

      const records = await query.toArray();

      if (records.length === 0) return null;
      return await this.transformScoreRow(records[0]);
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('LANCE', 'GET_SCORE_BY_ID', 'FAILED'),
          text: 'Failed to get score by id in LanceStorage',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { error: error?.message },
        },
        error,
      );
    }
  }

  /**
   * LanceDB-specific score row transformation.
   *
   * Note: This implementation does NOT use coreTransformScoreRow because:
   * 1. LanceDB stores schema information in the table itself (requires async fetch)
   * 2. Uses processResultWithTypeConversion utility for LanceDB-specific type handling
   */
  private async transformScoreRow(row: Record<string, any>): Promise<ScoreRowData> {
    const schema = await getTableSchema({ tableName: TABLE_SCORERS, client: this.client });
    const transformed = processResultWithTypeConversion(row, schema) as ScoreRowData;
    return {
      ...transformed,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async listScoresByScorerId({
    scorerId,
    pagination,
    entityId,
    entityType,
    source,
    filters,
  }: {
    scorerId: string;
    pagination: StoragePagination;
    entityId?: string;
    entityType?: string;
    source?: ScoringSource;
    filters?: ScoreTenancyFilters;
  }): Promise<ListScoresResponse> {
    try {
      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const table = await this.client.openTable(TABLE_SCORERS);

      const conditions = [`\`scorerId\` = ${lanceStringLiteral(scorerId)}`];
      if (source) {
        conditions.push(`\`source\` = ${lanceStringLiteral(source)}`);
      }
      if (entityId) {
        conditions.push(`\`entityId\` = ${lanceStringLiteral(entityId)}`);
      }
      if (entityType) {
        conditions.push(`\`entityType\` = ${lanceStringLiteral(entityType)}`);
      }
      if (filters?.organizationId !== undefined) {
        conditions.push(`\`organizationId\` = ${lanceStringLiteral(filters.organizationId)}`);
      }
      if (filters?.projectId !== undefined) {
        conditions.push(`\`projectId\` = ${lanceStringLiteral(filters.projectId)}`);
      }
      const whereClause = conditions.join(' AND ');

      let query = table.query().where(whereClause);

      // Get total count first
      const totalQuery = table.query().where(whereClause);
      const allRecords = await totalQuery.toArray();
      const total = allRecords.length;

      const end = perPageInput === false ? total : start + perPage;

      // For perPage: false, don't use limit/offset, just get all records
      if (perPageInput !== false) {
        query = query.limit(perPage);
        if (start > 0) query = query.offset(start);
      }

      const records = await query.toArray();
      const scores = await Promise.all(records.map(async record => await this.transformScoreRow(record)));

      return {
        pagination: {
          page,
          perPage: perPageForResponse,
          total,
          hasMore: end < total,
        },
        scores,
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('LANCE', 'LIST_SCORES_BY_SCORER_ID', 'FAILED'),
          text: 'Failed to get scores by scorerId in LanceStorage',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { error: error?.message },
        },
        error,
      );
    }
  }

  async listScoresByRunId({
    runId,
    pagination,
    filters,
  }: {
    runId: string;
    pagination: StoragePagination;
    filters?: ScoreTenancyFilters;
  }): Promise<ListScoresResponse> {
    try {
      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const table = await this.client.openTable(TABLE_SCORERS);

      // Get total count for pagination
      const allRecords = await table
        .query()
        .where(`\`runId\` = ${lanceStringLiteral(runId)}${tenancyClause(filters)}`)
        .toArray();
      const total = allRecords.length;

      const end = perPageInput === false ? total : start + perPage;

      // Query for scores with the given runId
      let query = table.query().where(`\`runId\` = ${lanceStringLiteral(runId)}${tenancyClause(filters)}`);

      // For perPage: false, don't use limit/offset
      if (perPageInput !== false) {
        query = query.limit(perPage);
        if (start > 0) query = query.offset(start);
      }

      const records = await query.toArray();
      const scores = await Promise.all(records.map(async record => await this.transformScoreRow(record)));

      return {
        pagination: {
          page,
          perPage: perPageForResponse,
          total,
          hasMore: end < total,
        },
        scores,
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('LANCE', 'LIST_SCORES_BY_RUN_ID', 'FAILED'),
          text: 'Failed to get scores by runId in LanceStorage',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { error: error?.message },
        },
        error,
      );
    }
  }
  async listScoresByEntityId({
    entityId,
    entityType,
    pagination,
    filters,
  }: {
    pagination: StoragePagination;
    entityId: string;
    entityType: string;
    filters?: ScoreTenancyFilters;
  }): Promise<ListScoresResponse> {
    try {
      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const table = await this.client.openTable(TABLE_SCORERS);

      // Get total count for pagination
      const allRecords = await table
        .query()
        .where(
          `\`entityId\` = ${lanceStringLiteral(entityId)} AND \`entityType\` = ${lanceStringLiteral(entityType)}${tenancyClause(filters)}`,
        )
        .toArray();
      const total = allRecords.length;

      const end = perPageInput === false ? total : start + perPage;

      // Query for scores with the given entityId and entityType
      let query = table
        .query()
        .where(
          `\`entityId\` = ${lanceStringLiteral(entityId)} AND \`entityType\` = ${lanceStringLiteral(entityType)}${tenancyClause(filters)}`,
        );

      // For perPage: false, don't use limit/offset
      if (perPageInput !== false) {
        query = query.limit(perPage);
        if (start > 0) query = query.offset(start);
      }

      const records = await query.toArray();
      const scores = await Promise.all(records.map(async record => await this.transformScoreRow(record)));

      return {
        pagination: {
          page,
          perPage: perPageForResponse,
          total,
          hasMore: end < total,
        },
        scores,
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('LANCE', 'LIST_SCORES_BY_ENTITY_ID', 'FAILED'),
          text: 'Failed to get scores by entityId and entityType in LanceStorage',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { error: error?.message },
        },
        error,
      );
    }
  }

  async listScoresBySpan({
    traceId,
    spanId,
    pagination,
    filters,
  }: {
    traceId: string;
    spanId: string;
    pagination: StoragePagination;
    filters?: ScoreTenancyFilters;
  }): Promise<ListScoresResponse> {
    try {
      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const table = await this.client.openTable(TABLE_SCORERS);

      // Get total count for pagination
      const allRecords = await table
        .query()
        .where(
          `\`traceId\` = ${lanceStringLiteral(traceId)} AND \`spanId\` = ${lanceStringLiteral(spanId)}${tenancyClause(filters)}`,
        )
        .toArray();
      const total = allRecords.length;

      const end = perPageInput === false ? total : start + perPage;

      // Query for scores with the given traceId and spanId
      let query = table
        .query()
        .where(
          `\`traceId\` = ${lanceStringLiteral(traceId)} AND \`spanId\` = ${lanceStringLiteral(spanId)}${tenancyClause(filters)}`,
        );

      // For perPage: false, don't use limit/offset
      if (perPageInput !== false) {
        query = query.limit(perPage);
        if (start > 0) query = query.offset(start);
      }

      const records = await query.toArray();
      const scores = await Promise.all(records.map(async record => await this.transformScoreRow(record)));

      return {
        pagination: {
          page,
          perPage: perPageForResponse,
          total,
          hasMore: end < total,
        },
        scores,
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('LANCE', 'LIST_SCORES_BY_SPAN', 'FAILED'),
          text: 'Failed to get scores by traceId and spanId in LanceStorage',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { error: error?.message },
        },
        error,
      );
    }
  }
}
