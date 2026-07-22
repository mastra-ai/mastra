import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { saveScorePayloadSchema } from '@mastra/core/evals';
import type { ListScoresResponse, SaveScorePayload, ScoreRowData, ScoringSource } from '@mastra/core/evals';
import {
  createStorageErrorId,
  TABLE_SCORERS,
  SCORERS_SCHEMA,
  ScoresStorage,
  calculatePagination,
  normalizePerPage,
  transformScoreRow as coreTransformScoreRow,
} from '@mastra/core/storage';
import type {
  PruneOptions,
  PruneResult,
  RetentionTablesDescriptor,
  ScoreTenancyFilters,
  StoragePagination,
  TableRetentionPolicy,
} from '@mastra/core/storage';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import type { SqliteClient as Client, SqliteInValue as InValue } from '../../db/client';
import { buildSelectColumns } from '../../db/utils';
import { runPrune, resolveTargets } from '../../retention';

/** Appends multi-tenant scope conditions (`?` placeholders). Mutates inputs. */
function appendTenancyConditions(conditions: string[], args: InValue[], filters?: ScoreTenancyFilters): void {
  if (filters?.organizationId !== undefined) {
    conditions.push(`organizationId = ?`);
    args.push(filters.organizationId);
  }
  if (filters?.projectId !== undefined) {
    conditions.push(`projectId = ?`);
    args.push(filters.projectId);
  }
}

export class ScoresLibSQL extends ScoresStorage {
  /**
   * Scorer results accumulate as evals run. Single table, anchored on `createdAt`.
   */
  static override readonly retentionTables: RetentionTablesDescriptor = {
    scorers: { table: TABLE_SCORERS, column: 'createdAt', indexed: true },
  };

  #db: LibSQLDB;
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
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
    await this.#db.deleteData({ tableName: TABLE_SCORERS });
  }

  /** Delete scorer results older than the `scorers` policy's `maxAge`, batched. */
  async prune(policies: Record<string, TableRetentionPolicy>, options?: PruneOptions): Promise<PruneResult[]> {
    const targets = resolveTargets({
      policies,
      descriptor: ScoresLibSQL.retentionTables,
      order: ['scorers'],
    });
    return runPrune({ db: this.#db, domain: 'scores', targets, options, logger: this.logger });
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

      const conditions: string[] = [`runId = ?`];
      const queryParams: InValue[] = [runId];
      appendTenancyConditions(conditions, queryParams, filters);
      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // Get total count first
      const countResult = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM ${TABLE_SCORERS} ${whereClause}`,
        args: queryParams,
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      if (total === 0) {
        return {
          pagination: {
            total: 0,
            page,
            perPage: perPageInput,
            hasMore: false,
          },
          scores: [],
        };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_SCORERS)} FROM ${TABLE_SCORERS} ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        args: [...queryParams, limitValue, start],
      });

      const scores = result.rows?.map(row => this.transformScoreRow(row)) ?? [];

      return {
        scores,
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_SCORES_BY_RUN_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
  async listScoresByScorerId({
    scorerId,
    entityId,
    entityType,
    source,
    pagination,
    filters,
  }: {
    scorerId: string;
    entityId?: string;
    entityType?: string;
    source?: ScoringSource;
    pagination: StoragePagination;
    filters?: ScoreTenancyFilters;
  }): Promise<ListScoresResponse> {
    try {
      const { page, perPage: perPageInput } = pagination;

      const conditions: string[] = [];
      const queryParams: InValue[] = [];

      if (scorerId) {
        conditions.push(`scorerId = ?`);
        queryParams.push(scorerId);
      }

      if (entityId) {
        conditions.push(`entityId = ?`);
        queryParams.push(entityId);
      }

      if (entityType) {
        conditions.push(`entityType = ?`);
        queryParams.push(entityType);
      }

      if (source) {
        conditions.push(`source = ?`);
        queryParams.push(source);
      }

      appendTenancyConditions(conditions, queryParams, filters);

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count first
      const countResult = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM ${TABLE_SCORERS} ${whereClause}`,
        args: queryParams,
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      if (total === 0) {
        return {
          pagination: {
            total: 0,
            page,
            perPage: perPageInput,
            hasMore: false,
          },
          scores: [],
        };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_SCORERS)} FROM ${TABLE_SCORERS} ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        args: [...queryParams, limitValue, start],
      });

      const scores = result.rows?.map(row => this.transformScoreRow(row)) ?? [];

      return {
        scores,
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_SCORES_BY_SCORER_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * LibSQL-specific score row transformation.
   */
  private transformScoreRow(row: Record<string, any>): ScoreRowData {
    return coreTransformScoreRow(row);
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    const result = await this.#client.execute({
      sql: `SELECT ${buildSelectColumns(TABLE_SCORERS)} FROM ${TABLE_SCORERS} WHERE id = ?`,
      args: [id],
    });
    return result.rows?.[0] ? this.transformScoreRow(result.rows[0]) : null;
  }

  async saveScore(score: SaveScorePayload): Promise<{ score: ScoreRowData }> {
    let parsedScore: SaveScorePayload;
    try {
      parsedScore = saveScorePayloadSchema.parse(score);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'SAVE_SCORE', 'VALIDATION_FAILED'),
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
      const id = crypto.randomUUID();
      const now = new Date();

      await this.#db.insert({
        tableName: TABLE_SCORERS,
        record: {
          ...parsedScore,
          id,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      });

      return { score: { ...parsedScore, id, createdAt: now, updatedAt: now } as ScoreRowData };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'SAVE_SCORE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
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

      const conditions: string[] = [`entityId = ?`, `entityType = ?`];
      const queryParams: InValue[] = [entityId, entityType];
      appendTenancyConditions(conditions, queryParams, filters);
      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // Get total count first
      const countResult = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM ${TABLE_SCORERS} ${whereClause}`,
        args: queryParams,
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      if (total === 0) {
        return {
          pagination: {
            total: 0,
            page,
            perPage: perPageInput,
            hasMore: false,
          },
          scores: [],
        };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_SCORERS)} FROM ${TABLE_SCORERS} ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        args: [...queryParams, limitValue, start],
      });

      const scores = result.rows?.map(row => this.transformScoreRow(row)) ?? [];

      return {
        scores,
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_SCORES_BY_ENTITY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
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

      const conditions: string[] = [`traceId = ?`, `spanId = ?`];
      const queryParams: InValue[] = [traceId, spanId];
      appendTenancyConditions(conditions, queryParams, filters);
      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const countSQLResult = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM ${TABLE_SCORERS} ${whereClause}`,
        args: queryParams,
      });

      const total = Number(countSQLResult.rows?.[0]?.count ?? 0);

      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_SCORERS)} FROM ${TABLE_SCORERS} ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        args: [...queryParams, limitValue, start],
      });

      const scores = result.rows?.map(row => this.transformScoreRow(row)) ?? [];

      return {
        scores,
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_SCORES_BY_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
