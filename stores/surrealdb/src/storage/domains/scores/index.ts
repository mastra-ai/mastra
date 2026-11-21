import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { ListScoresResponse, SaveScorePayload, ScoreRowData, ScoringSource } from '@mastra/core/evals';
import { saveScorePayloadSchema } from '@mastra/core/evals';
import {
  calculatePagination,
  createStorageErrorId,
  normalizePerPage,
  safelyParseJSON,
  ScoresStorage,
  TABLE_SCORERS,
} from '@mastra/core/storage';
import type { ScoreTenancyFilters, StoragePagination } from '@mastra/core/storage';
import { SurrealDBConnector } from '../../../shared/connector';
import type { SurrealDBDomainConfig } from '../../../shared/connector';
import { SCORES_SCHEMA } from '../../schema';
import { recordKey, toDate, totalFrom } from '../utils';

/** Fields that callers may pass as JSON strings; they are stored as structured values. */
const JSON_FIELDS = [
  'scorer',
  'preprocessStepResult',
  'analyzeStepResult',
  'input',
  'output',
  'requestContext',
  'entity',
  'additionalContext',
  'metadata',
] as const;

function parseScore(row: Record<string, unknown>): ScoreRowData {
  return {
    ...row,
    id: recordKey(row.id),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt ?? row.createdAt),
  } as ScoreRowData;
}

export class ScoresStorageSurrealDB extends ScoresStorage {
  #connector: SurrealDBConnector;

  constructor(config: SurrealDBDomainConfig) {
    super();
    this.#connector = SurrealDBConnector.from(config);
  }

  async init(): Promise<void> {
    await this.#connector.ensureDatabase();
    await this.#connector.query(SCORES_SCHEMA);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#connector.query(`DELETE ${TABLE_SCORERS}`);
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    try {
      const [row] = await this.#connector.query<[Record<string, unknown> | undefined]>(
        `SELECT * FROM ONLY type::record('${TABLE_SCORERS}', $id)`,
        { id },
      );
      return row ? parseScore(row) : null;
    } catch (error) {
      throw this.#error('GET_SCORE_BY_ID', error, { id });
    }
  }

  async saveScore(score: SaveScorePayload): Promise<{ score: ScoreRowData }> {
    let validated: SaveScorePayload;
    try {
      validated = saveScorePayloadSchema.parse(score);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SURREALDB', 'SAVE_SCORE', 'VALIDATION_FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { scorerId: score.scorerId ?? 'unknown', runId: score.runId ?? 'unknown' },
        },
        error,
      );
    }

    try {
      // A caller-supplied id gives the score a stable identity: a retried write replaces the
      // row (latest wins) but keeps its original createdAt.
      const id = validated.id ?? crypto.randomUUID();
      const data: Record<string, unknown> = { ...validated };
      for (const field of JSON_FIELDS) {
        if (typeof data[field] === 'string') data[field] = safelyParseJSON(data[field]);
      }
      delete data.id;
      delete data.createdAt;
      delete data.updatedAt;

      const [, row] = await this.#connector.query<[unknown, Record<string, unknown>]>(
        `LET $createdAt = (SELECT VALUE createdAt FROM ONLY type::record('${TABLE_SCORERS}', $id)) ?? $now;
         UPSERT ONLY type::record('${TABLE_SCORERS}', $id)
           CONTENT object::extend($data, { createdAt: $createdAt, updatedAt: $now })
           RETURN AFTER;`,
        { id, data: JSON.parse(JSON.stringify(data)), now: new Date() },
      );
      return { score: parseScore(row) };
    } catch (error) {
      throw this.#error('SAVE_SCORE', error, { scorerId: score.scorerId, runId: score.runId });
    }
  }

  async #list(
    operation: string,
    where: string[],
    bindings: Record<string, unknown>,
    pagination: StoragePagination,
    filters?: ScoreTenancyFilters,
  ): Promise<ListScoresResponse> {
    try {
      if (filters?.organizationId !== undefined) {
        where.push('organizationId = $organizationId');
        bindings.organizationId = filters.organizationId;
      }
      if (filters?.projectId !== undefined) {
        where.push('projectId = $projectId');
        bindings.projectId = filters.projectId;
      }

      const { page, perPage: perPageInput } = pagination;
      const limit = normalizePerPage(perPageInput, Number.MAX_SAFE_INTEGER);
      const { offset, perPage } = calculatePagination(page, perPageInput, limit);
      const whereClause = `WHERE ${where.join(' AND ')}`;

      const [rows, count] = await this.#connector.query<[Record<string, unknown>[], unknown]>(
        `SELECT * FROM ${TABLE_SCORERS} ${whereClause} ORDER BY createdAt DESC LIMIT $limit START $offset;
         SELECT count() AS count FROM ${TABLE_SCORERS} ${whereClause} GROUP ALL;`,
        { ...bindings, limit, offset },
      );
      const total = totalFrom(count);
      return {
        scores: rows.map(parseScore),
        pagination: {
          total,
          page,
          perPage,
          hasMore: perPageInput === false ? false : offset + rows.length < total,
        },
      };
    } catch (error) {
      throw this.#error(operation, error);
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
    const where = ['scorerId = $scorerId'];
    const bindings: Record<string, unknown> = { scorerId };
    if (entityId) {
      where.push('entityId = $entityId');
      bindings.entityId = entityId;
    }
    if (entityType) {
      where.push('entityType = $entityType');
      bindings.entityType = entityType;
    }
    if (source) {
      where.push('source = $source');
      bindings.source = source;
    }
    return this.#list('LIST_SCORES_BY_SCORER_ID', where, bindings, pagination, filters);
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
    return this.#list('LIST_SCORES_BY_RUN_ID', ['runId = $runId'], { runId }, pagination, filters);
  }

  async listScoresByEntityId({
    entityId,
    entityType,
    pagination,
    filters,
  }: {
    entityId: string;
    entityType: string;
    pagination: StoragePagination;
    filters?: ScoreTenancyFilters;
  }): Promise<ListScoresResponse> {
    return this.#list(
      'LIST_SCORES_BY_ENTITY_ID',
      ['entityId = $entityId', 'entityType = $entityType'],
      { entityId, entityType },
      pagination,
      filters,
    );
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
    return this.#list(
      'LIST_SCORES_BY_SPAN',
      ['traceId = $traceId', 'spanId = $spanId'],
      { traceId, spanId },
      pagination,
      filters,
    );
  }

  #error(operation: string, error: unknown, details?: Record<string, string | number>): MastraError {
    if (error instanceof MastraError) return error;
    return new MastraError(
      {
        id: createStorageErrorId('SURREALDB', operation, 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        details,
      },
      error,
    );
  }
}
