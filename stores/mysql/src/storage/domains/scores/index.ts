import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  ScoresStorage,
  SCORERS_SCHEMA,
  TABLE_SCORERS,
  calculatePagination,
  normalizePerPage,
} from '@mastra/core/storage';
import type { PaginationInfo, StoragePagination } from '@mastra/core/storage';
import type { Pool } from 'mysql2/promise';
import type { ScoreRowData, ScoringSource } from '@mastra/core/evals';
import type { StoreOperationsMySQL } from '../operations';
import { parseDateTime, quoteIdentifier } from '../utils';

type SaveScoreInput = Omit<ScoreRowData, 'id' | 'createdAt' | 'updatedAt'>;
type ListScoresResult = { pagination: PaginationInfo; scores: ScoreRowData[] };

interface ScoreRow {
  id: string;
  scorerId: string;
  traceId: string | null;
  spanId: string | null;
  runId: string;
  score: number;
  reason: string | null;
  metadata: string | null;
  preprocessStepResult: string | null;
  extractStepResult: string | null;
  analyzeStepResult: string | null;
  preprocessPrompt: string | null;
  extractPrompt: string | null;
  generateScorePrompt: string | null;
  generateReasonPrompt: string | null;
  analyzePrompt: string | null;
  reasonPrompt: string | null;
  scorer: string | null;
  input: string | null;
  output: string | null;
  additionalContext: string | null;
  requestContext: string | null;
  entityType: string | null;
  entity: string | null;
  entityId: string | null;
  source: string | null;
  resourceId: string | null;
  threadId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

function parseJSON<T>(value: unknown): T | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    if (!value) return undefined;
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }
  if (typeof value === 'object') {
    return value as T;
  }
  return undefined;
}

export class ScoresMySQL extends ScoresStorage {
  private pool: Pool;
  private operations: StoreOperationsMySQL;

  constructor({ pool, operations }: { pool: Pool; operations: StoreOperationsMySQL }) {
    super();
    this.pool = pool;
    this.operations = operations;
  }

  async init(): Promise<void> {
    await this.operations.createTable({ tableName: TABLE_SCORERS, schema: SCORERS_SCHEMA });
    await this.operations.alterTable({
      tableName: TABLE_SCORERS,
      schema: SCORERS_SCHEMA,
      ifNotExists: ['spanId', 'requestContext'],
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.pool.execute(`DELETE FROM ${TABLE_SCORERS}`);
  }

  private mapScore(row: ScoreRow): ScoreRowData {
    const mapped = {
      id: row.id,
      scorerId: row.scorerId,
      traceId: row.traceId ?? undefined,
      spanId: row.spanId ?? undefined,
      runId: row.runId,
      score: row.score,
      reason: row.reason ?? undefined,
      metadata: parseJSON<Record<string, unknown>>(row.metadata),
      preprocessStepResult: parseJSON<Record<string, unknown>>(row.preprocessStepResult),
      extractStepResult: parseJSON<Record<string, unknown>>(row.extractStepResult),
      analyzeStepResult: parseJSON<Record<string, unknown>>(row.analyzeStepResult),
      preprocessPrompt: row.preprocessPrompt ?? undefined,
      extractPrompt: row.extractPrompt ?? undefined,
      generateScorePrompt: row.generateScorePrompt ?? undefined,
      generateReasonPrompt: row.generateReasonPrompt ?? undefined,
      analyzePrompt: row.analyzePrompt ?? undefined,
      reasonPrompt: row.reasonPrompt ?? undefined,
      scorer: parseJSON<Record<string, unknown>>(row.scorer) as ScoreRowData['scorer'],
      input: parseJSON<any>(row.input) ?? undefined,
      output: parseJSON<Record<string, unknown>>(row.output),
      additionalContext: parseJSON<Record<string, unknown>>(row.additionalContext),
      requestContext: parseJSON<Record<string, unknown>>(row.requestContext) ?? undefined,
      // entityType is required by the ScoreRowData type but may be null in DB; keep as-is and cast below
      entityType: (row.entityType ?? undefined) as any,
      entity: parseJSON<Record<string, unknown>>(row.entity),
      entityId: row.entityId ?? undefined,
      source: (row.source ?? undefined) as ScoreRowData['source'],
      resourceId: row.resourceId ?? undefined,
      threadId: row.threadId ?? undefined,
      createdAt: parseDateTime(row.createdAt) ?? new Date(),
      updatedAt: parseDateTime(row.updatedAt) ?? new Date(),
    };
    return mapped as ScoreRowData;
  }

  private serializeScore(score: SaveScoreInput, id: string, createdAt: Date, updatedAt: Date): Record<string, any> {
    const toJson = (value: unknown): string | null => (value === undefined ? null : JSON.stringify(value));

    return {
      id,
      scorerId: score.scorerId,
      traceId: score.traceId ?? null,
      spanId: score.spanId ?? null,
      runId: score.runId,
      score: score.score,
      reason: score.reason ?? null,
      metadata: toJson(score.metadata),
      preprocessStepResult: toJson(score.preprocessStepResult),
      extractStepResult: toJson(score.extractStepResult),
      analyzeStepResult: toJson(score.analyzeStepResult),
      preprocessPrompt: score.preprocessPrompt ?? null,
      extractPrompt: score.extractPrompt ?? null,
      generateScorePrompt: score.generateScorePrompt ?? null,
      generateReasonPrompt: score.generateReasonPrompt ?? null,
      analyzePrompt: score.analyzePrompt ?? null,
      reasonPrompt: (score as any).reasonPrompt ?? null,
      scorer: toJson(score.scorer),
      input: toJson(score.input),
      output: toJson(score.output),
      additionalContext: toJson(score.additionalContext),
      requestContext: toJson((score as any).requestContext),
      entityType: score.entityType ?? null,
      entity: toJson(score.entity),
      entityId: score.entityId ?? null,
      resourceId: score.resourceId ?? null,
      threadId: score.threadId ?? null,
      source: score.source ?? null,
      createdAt,
      updatedAt,
    };
  }

  async saveScore(score: SaveScoreInput): Promise<{ score: ScoreRowData }> {
    try {
      const id = crypto.randomUUID();
      const now = new Date();

      await this.operations.insert({
        tableName: TABLE_SCORERS,
        record: this.serializeScore(score, id, now, now),
      });
      return { score: { ...score, id, createdAt: now, updatedAt: now } as ScoreRowData };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_SCORES_SAVE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    try {
      const row = await this.operations.load<ScoreRow>({ tableName: TABLE_SCORERS, keys: { id } });
      return row ? this.mapScore(row) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_SCORES_GET_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  private async fetchScores(
    whereClause: { sql: string; args: any[] },
    pagination: StoragePagination,
  ): Promise<ListScoresResult> {
    const { page = 0, perPage: perPageInput } = pagination;
    const perPageNormalized = normalizePerPage(perPageInput, 50);
    const { offset, perPage } = calculatePagination(page, perPageInput, perPageNormalized);

    const total = await this.operations.loadTotalCount({ tableName: TABLE_SCORERS, whereClause });
    if (total === 0) {
      return {
        scores: [],
        pagination: { total: 0, page, perPage, hasMore: false },
      };
    }
    
    const limitValue = perPageInput === false ? total : perPageNormalized;
    
    const rows = await this.operations.loadMany<ScoreRow>({
      tableName: TABLE_SCORERS,
      whereClause,
      orderBy: `${quoteIdentifier('createdAt', 'column name')} DESC`,
      offset,
      limit: limitValue,
    });
    
    const scores = rows.map(row => this.mapScore(row));
    
    return {
      scores,
      pagination: {
        total,
        page,
        perPage,
        hasMore: perPageInput === false ? false : offset + scores.length < total,
      },
    };
  }

  private buildWhereClause(
    filters: Record<string, string | undefined>,
  ): { sql: string; args: any[] } {
    const conditions: string[] = [];
    const args: any[] = [];
    for (const [column, value] of Object.entries(filters)) {
      if (value !== undefined) {
        conditions.push(`${quoteIdentifier(column, 'column name')} = ?`);
        args.push(value);
      }
    }
    return {
      sql: conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '',
      args,
    };
  }

  async getScoresByScorerId(args: {
    scorerId: string;
    pagination: StoragePagination;
    entityId?: string;
    entityType?: string;
    source?: ScoringSource;
  }): Promise<ListScoresResult> {
    return this.listScoresByScorerId(args);
  }

  async getScoresByRunId(args: {
    runId: string;
    pagination: StoragePagination;
  }): Promise<ListScoresResult> {
    return this.listScoresByRunId(args);
  }

  async getScoresByEntityId(args: {
    entityId: string;
    entityType: string;
    pagination: StoragePagination;
  }): Promise<ListScoresResult> {
    return this.listScoresByEntityId(args);
  }

  async getScoresBySpan(args: {
    traceId: string;
    spanId: string;
    pagination: StoragePagination;
  }): Promise<ListScoresResult> {
    return this.listScoresBySpan(args);
  }

  async listScoresByScorerId({
    scorerId,
    pagination,
    entityId,
    entityType,
    source,
  }: {
    scorerId: string;
    pagination: StoragePagination;
    entityId?: string;
    entityType?: string;
    source?: ScoringSource;
  }): Promise<ListScoresResult> {
    return this.fetchScores(
      this.buildWhereClause({ scorerId, entityId, entityType, source }),
      pagination,
    );
  }

  async listScoresByRunId({
    runId,
    pagination,
    entityId,
    entityType,
    source,
  }: {
    runId: string;
    pagination: StoragePagination;
    entityId?: string;
    entityType?: string;
    source?: ScoringSource;
  }): Promise<ListScoresResult> {
    return this.fetchScores(
      this.buildWhereClause({ runId, entityId, entityType, source }),
      pagination,
    );
  }

  async listScoresBySpan({
    traceId,
    spanId,
    pagination,
  }: {
    traceId: string;
    spanId: string;
    pagination: StoragePagination;
  }): Promise<ListScoresResult> {
    return this.fetchScores(
      this.buildWhereClause({ traceId, spanId }),
      pagination,
    );
  }

  async listScoresByEntityId({
    entityId,
    pagination,
    entityType,
    source,
  }: {
    entityId: string;
    pagination: StoragePagination;
    entityType?: string;
    source?: ScoringSource;
  }): Promise<ListScoresResult> {
    return this.fetchScores(
      this.buildWhereClause({ entityId, entityType, source }),
      pagination,
    );
  }
}
