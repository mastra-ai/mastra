import { randomUUID } from 'node:crypto';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { ListScoresResponse, SaveScorePayload, ScoreRowData, ScoringSource } from '@mastra/core/evals';
import { saveScorePayloadSchema } from '@mastra/core/evals';
import type { StoragePagination, CreateIndexOptions, ScoreTenancyFilters } from '@mastra/core/storage';
import {
  createStorageErrorId,
  ScoresStorage,
  TABLE_SCORERS,
  TABLE_SCHEMAS,
  calculatePagination,
  normalizePerPage,
  transformScoreRow as coreTransformScoreRow,
} from '@mastra/core/storage';

import { HANAClient, resolveHanaConfig } from '../../db';
import type { HANADomainConfig } from '../../db';
import { getSchemaName, getTableName } from '../utils';

function transformScoreRow(row: Record<string, any>): ScoreRowData {
  return coreTransformScoreRow(row, { convertTimestamps: true });
}

function buildTenancyConditions(filters?: ScoreTenancyFilters): {
  conditions: string[];
  params: unknown[];
} {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filters?.organizationId !== undefined) {
    conditions.push('"organizationId" = ?');
    params.push(filters.organizationId);
  }
  if (filters?.projectId !== undefined) {
    conditions.push('"projectId" = ?');
    params.push(filters.projectId);
  }
  return { conditions, params };
}

export class ScoresHANA extends ScoresStorage {
  private db: HANAClient;
  private schema?: string;
  private needsInit: boolean;
  private skipDefaultIndexes?: boolean;
  private indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_SCORERS] as const;

  constructor(config: HANADomainConfig) {
    super();
    const { pool, schemaName, skipDefaultIndexes, indexes, needsInit } = resolveHanaConfig(config);
    this.schema = schemaName;
    this.db = new HANAClient({ pool, schemaName, skipDefaultIndexes });
    this.needsInit = needsInit;
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx => (ScoresHANA.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  async init(): Promise<void> {
    if (this.needsInit) {
      await this.db.pool.initialize();
      this.needsInit = false;
    }
    await this.db.createTable({ tableName: TABLE_SCORERS, schema: TABLE_SCHEMAS[TABLE_SCORERS] });
    this.schema = this.db.schemaName;
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    const schemaPrefix = this.schema ? `${this.schema}_` : '';
    return [
      {
        name: `${schemaPrefix}mastra_scores_trace_id_span_id_seqid_idx`,
        table: TABLE_SCORERS,
        columns: ['traceId', 'spanId', 'seq_id DESC'],
      },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index ${indexDef.name}:`, error);
      }
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) return;
    for (const indexDef of this.indexes) {
      try {
        await this.db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_SCORERS });
  }

  private tableName(): string {
    return getTableName({ indexName: TABLE_SCORERS, schemaName: getSchemaName(this.schema) });
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    try {
      const rows = (await this.db.pool.withConnection(conn =>
        conn.execPromise(`SELECT * FROM ${this.tableName()} WHERE "id" = ?`, [id]),
      )) as Array<Record<string, unknown>>;

      if (!rows || rows.length === 0) return null;
      return transformScoreRow(rows[0]!);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'GET_SCORE_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async saveScore(score: SaveScorePayload): Promise<{ score: ScoreRowData }> {
    let validatedScore: SaveScorePayload;
    try {
      validatedScore = saveScorePayloadSchema.parse(score);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'SAVE_SCORE', 'VALIDATION_FAILED'),
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

    try {
      const scoreId = randomUUID();
      const now = new Date();

      const {
        scorer,
        preprocessStepResult,
        analyzeStepResult,
        metadata,
        input,
        output,
        additionalContext,
        requestContext,
        entity,
        ...rest
      } = validatedScore;

      await this.db.insert({
        tableName: TABLE_SCORERS,
        record: {
          id: scoreId,
          ...rest,
          input: input || '',
          output: output || '',
          preprocessStepResult: preprocessStepResult || null,
          analyzeStepResult: analyzeStepResult || null,
          metadata: metadata || null,
          additionalContext: additionalContext || null,
          requestContext: requestContext || null,
          entity: entity || null,
          scorer: scorer || null,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      });

      return { score: { ...validatedScore, id: scoreId, createdAt: now, updatedAt: now } as ScoreRowData };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'SAVE_SCORE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
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
      const conditions: string[] = ['"scorerId" = ?'];
      const params: unknown[] = [scorerId];

      if (entityId) {
        conditions.push('"entityId" = ?');
        params.push(entityId);
      }
      if (entityType) {
        conditions.push('"entityType" = ?');
        params.push(entityType);
      }
      if (source) {
        conditions.push('"source" = ?');
        params.push(source);
      }

      const tenancy = buildTenancyConditions(filters);
      conditions.push(...tenancy.conditions);
      params.push(...tenancy.params);

      const whereClause = conditions.join(' AND ');
      const tableName = this.tableName();

      const countRows = (await this.db.pool.withConnection(conn =>
        conn.execPromise(`SELECT COUNT(*) AS CNT FROM ${tableName} WHERE ${whereClause}`, [...params]),
      )) as Array<{ CNT: number }>;
      const total = Number(countRows[0]?.CNT ?? 0);

      const { page, perPage: perPageInput } = pagination;
      if (total === 0) {
        return { pagination: { total: 0, page, perPage: perPageInput, hasMore: false }, scores: [] };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const rows = (await this.db.pool.withConnection(conn =>
        conn.execPromise(`SELECT * FROM ${tableName} WHERE ${whereClause} ORDER BY "seq_id" DESC LIMIT ? OFFSET ?`, [
          ...params,
          limitValue,
          start,
        ]),
      )) as Array<Record<string, unknown>>;

      return {
        pagination: { total: Number(total), page, perPage: perPageForResponse, hasMore: end < total },
        scores: rows.map(row => transformScoreRow(row)),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'LIST_SCORES_BY_SCORER_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId },
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
      const tenancy = buildTenancyConditions(filters);
      const tenancySql = tenancy.conditions.length > 0 ? ` AND ${tenancy.conditions.join(' AND ')}` : '';
      const params: unknown[] = [runId, ...tenancy.params];

      const countRows = (await this.db.pool.withConnection(conn =>
        conn.execPromise(`SELECT COUNT(*) AS CNT FROM ${this.tableName()} WHERE "runId" = ?${tenancySql}`, [...params]),
      )) as Array<{ CNT: number }>;
      const total = Number(countRows[0]?.CNT ?? 0);

      const { page, perPage: perPageInput } = pagination;
      if (total === 0) {
        return { pagination: { total: 0, page, perPage: perPageInput, hasMore: false }, scores: [] };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const rows = (await this.db.pool.withConnection(conn =>
        conn.execPromise(
          `SELECT * FROM ${this.tableName()} WHERE "runId" = ?${tenancySql} ORDER BY "seq_id" DESC LIMIT ? OFFSET ?`,
          [...params, limitValue, start],
        ),
      )) as Array<Record<string, unknown>>;

      return {
        pagination: { total: Number(total), page, perPage: perPageForResponse, hasMore: end < total },
        scores: rows.map(row => transformScoreRow(row)),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'LIST_SCORES_BY_RUN_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runId },
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
      const tenancy = buildTenancyConditions(filters);
      const tenancySql = tenancy.conditions.length > 0 ? ` AND ${tenancy.conditions.join(' AND ')}` : '';
      const baseParams: unknown[] = [entityId, entityType, ...tenancy.params];

      const countRows = (await this.db.pool.withConnection(conn =>
        conn.execPromise(
          `SELECT COUNT(*) AS CNT FROM ${this.tableName()} WHERE "entityId" = ? AND "entityType" = ?${tenancySql}`,
          [...baseParams],
        ),
      )) as Array<{ CNT: number }>;
      const total = Number(countRows[0]?.CNT ?? 0);

      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      if (total === 0) {
        return { pagination: { total: 0, page, perPage: perPageForResponse, hasMore: false }, scores: [] };
      }

      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const rows = (await this.db.pool.withConnection(conn =>
        conn.execPromise(
          `SELECT * FROM ${this.tableName()} WHERE "entityId" = ? AND "entityType" = ?${tenancySql} ORDER BY "seq_id" DESC LIMIT ? OFFSET ?`,
          [...baseParams, limitValue, start],
        ),
      )) as Array<Record<string, unknown>>;

      return {
        pagination: { total: Number(total), page, perPage: perPageForResponse, hasMore: end < total },
        scores: rows.map(row => transformScoreRow(row)),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'LIST_SCORES_BY_ENTITY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { entityId, entityType },
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
      const tenancy = buildTenancyConditions(filters);
      const tenancySql = tenancy.conditions.length > 0 ? ` AND ${tenancy.conditions.join(' AND ')}` : '';
      const baseParams: unknown[] = [traceId, spanId, ...tenancy.params];

      const countRows = (await this.db.pool.withConnection(conn =>
        conn.execPromise(
          `SELECT COUNT(*) AS CNT FROM ${this.tableName()} WHERE "traceId" = ? AND "spanId" = ?${tenancySql}`,
          [...baseParams],
        ),
      )) as Array<{ CNT: number }>;
      const total = Number(countRows[0]?.CNT ?? 0);

      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      if (total === 0) {
        return { pagination: { total: 0, page, perPage: perPageForResponse, hasMore: false }, scores: [] };
      }

      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const rows = (await this.db.pool.withConnection(conn =>
        conn.execPromise(
          `SELECT * FROM ${this.tableName()} WHERE "traceId" = ? AND "spanId" = ?${tenancySql} ORDER BY "seq_id" DESC LIMIT ? OFFSET ?`,
          [...baseParams, limitValue, start],
        ),
      )) as Array<Record<string, unknown>>;

      return {
        pagination: { total: Number(total), page, perPage: perPageForResponse, hasMore: end < total },
        scores: rows.map(row => transformScoreRow(row)),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'LIST_SCORES_BY_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { traceId, spanId },
        },
        error,
      );
    }
  }
}
