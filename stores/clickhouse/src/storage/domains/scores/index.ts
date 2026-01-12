import type { ClickHouseClient } from '@clickhouse/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { saveScorePayloadSchema } from '@mastra/core/evals';
import type { ListScoresResponse, SaveScorePayload, ScoreRowData, ScoringSource } from '@mastra/core/evals';
import {
  createStorageErrorId,
  ScoresStorage,
  SCORERS_SCHEMA,
  TABLE_SCORERS,
  calculatePagination,
  normalizePerPage,
  transformScoreRow as coreTransformScoreRow,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type { StoragePagination } from '@mastra/core/storage';
import { ClickhouseDB, resolveClickhouseConfig } from '../../db';
import type { ClickhouseDomainConfig } from '../../db';

export class ScoresStorageClickhouse extends ScoresStorage {
  protected client: ClickHouseClient;
  #db: ClickhouseDB;
  constructor(config: ClickhouseDomainConfig) {
    super();
    const { client, ttl } = resolveClickhouseConfig(config);
    this.client = client;
    this.#db = new ClickhouseDB({ client, ttl });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_SCORERS, schema: TABLE_SCHEMAS[TABLE_SCORERS] });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_SCORERS });
  }

  /**
   * ClickHouse-specific score row transformation.
   * Converts timestamps to Date objects and filters out '_null_' values.
   */
  private transformScoreRow(row: any): ScoreRowData {
    return coreTransformScoreRow(row, {
      convertTimestamps: true,
      nullValuePattern: '_null_',
    });
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    try {
      const result = await this.client.query({
        query: `SELECT * FROM ${TABLE_SCORERS} WHERE id = {var_id:String}`,
        query_params: { var_id: id },
        format: 'JSONEachRow',
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      const resultJson = await result.json();
      if (!Array.isArray(resultJson) || resultJson.length === 0) {
        return null;
      }

      return this.transformScoreRow(resultJson[0]);
      // return this.parseScoreRow(resultJson[0]);
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_SCORE_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scoreId: id },
        },
        error,
      );
    }
  }

  async saveScore(score: SaveScorePayload): Promise<{ score: ScoreRowData }> {
    let parsedScore: SaveScorePayload;
    try {
      parsedScore = saveScorePayloadSchema.parse(score);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'SAVE_SCORE', 'VALIDATION_FAILED'),
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

    const now = new Date();
    const id = crypto.randomUUID();
    const createdAt = now;
    const updatedAt = now;

    try {
      // Build record from schema columns, converting undefined to null for ClickHouse
      const record: Record<string, unknown> = {};
      for (const key of Object.keys(SCORERS_SCHEMA)) {
        if (key === 'id') {
          record[key] = id;
          continue;
        }
        if (key === 'createdAt' || key === 'updatedAt') {
          record[key] = now.toISOString();
          continue;
        }
        const value = parsedScore[key as keyof typeof parsedScore];
        record[key] = value === undefined || value === null ? '_null_' : value;
      }

      await this.client.insert({
        table: TABLE_SCORERS,
        values: [record],
        format: 'JSONEachRow',
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });
      return { score: { ...parsedScore, id, createdAt, updatedAt } as ScoreRowData };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'SAVE_SCORE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scoreId: id },
        },
        error,
      );
    }
  }

  async listScoresByRunId({
    runId,
    pagination,
  }: {
    runId: string;
    pagination: StoragePagination;
  }): Promise<ListScoresResponse> {
    try {
      // Get total count
      const countResult = await this.client.query({
        query: `SELECT COUNT(*) as count FROM ${TABLE_SCORERS} WHERE runId = {var_runId:String}`,
        query_params: { var_runId: runId },
        format: 'JSONEachRow',
      });
      const countRows = await countResult.json();
      let total = 0;
      if (Array.isArray(countRows) && countRows.length > 0 && countRows[0]) {
        const countObj = countRows[0] as { count: string | number };
        total = Number(countObj.count);
      }

      const { page, perPage: perPageInput } = pagination;

      if (!total) {
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

      // Get paginated results
      const result = await this.client.query({
        query: `SELECT * FROM ${TABLE_SCORERS} WHERE runId = {var_runId:String} ORDER BY createdAt DESC LIMIT {var_limit:Int64} OFFSET {var_offset:Int64}`,
        query_params: {
          var_runId: runId,
          var_limit: limitValue,
          var_offset: start,
        },
        format: 'JSONEachRow',
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });
      const rows = await result.json();
      const scores = Array.isArray(rows) ? rows.map(row => this.transformScoreRow(row)) : [];
      return {
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
        scores,
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'LIST_SCORES_BY_RUN_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runId },
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
  }: {
    scorerId: string;
    pagination: StoragePagination;
    entityId?: string;
    entityType?: string;
    source?: ScoringSource;
  }): Promise<ListScoresResponse> {
    let whereClause = `scorerId = {var_scorerId:String}`;
    if (entityId) {
      whereClause += ` AND entityId = {var_entityId:String}`;
    }
    if (entityType) {
      whereClause += ` AND entityType = {var_entityType:String}`;
    }
    if (source) {
      whereClause += ` AND source = {var_source:String}`;
    }

    try {
      // Get total count
      const countResult = await this.client.query({
        query: `SELECT COUNT(*) as count FROM ${TABLE_SCORERS} WHERE ${whereClause}`,
        query_params: {
          var_scorerId: scorerId,
          var_entityId: entityId,
          var_entityType: entityType,
          var_source: source,
        },
        format: 'JSONEachRow',
      });
      const countRows = await countResult.json();
      let total = 0;
      if (Array.isArray(countRows) && countRows.length > 0 && countRows[0]) {
        const countObj = countRows[0] as { count: string | number };
        total = Number(countObj.count);
      }

      const { page, perPage: perPageInput } = pagination;

      if (!total) {
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

      // Get paginated results
      const result = await this.client.query({
        query: `SELECT * FROM ${TABLE_SCORERS} WHERE ${whereClause} ORDER BY createdAt DESC LIMIT {var_limit:Int64} OFFSET {var_offset:Int64}`,
        query_params: {
          var_scorerId: scorerId,
          var_limit: limitValue,
          var_offset: start,
          var_entityId: entityId,
          var_entityType: entityType,
          var_source: source,
        },
        format: 'JSONEachRow',
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });
      const rows = await result.json();
      const scores = Array.isArray(rows) ? rows.map(row => this.transformScoreRow(row)) : [];
      return {
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
        scores,
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'LIST_SCORES_BY_SCORER_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId },
        },
        error,
      );
    }
  }

  async listScoresByEntityId({
    entityId,
    entityType,
    pagination,
  }: {
    pagination: StoragePagination;
    entityId: string;
    entityType: string;
  }): Promise<ListScoresResponse> {
    try {
      // Get total count
      const countResult = await this.client.query({
        query: `SELECT COUNT(*) as count FROM ${TABLE_SCORERS} WHERE entityId = {var_entityId:String} AND entityType = {var_entityType:String}`,
        query_params: { var_entityId: entityId, var_entityType: entityType },
        format: 'JSONEachRow',
      });
      const countRows = await countResult.json();
      let total = 0;
      if (Array.isArray(countRows) && countRows.length > 0 && countRows[0]) {
        const countObj = countRows[0] as { count: string | number };
        total = Number(countObj.count);
      }

      const { page, perPage: perPageInput } = pagination;

      if (!total) {
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

      // Get paginated results
      const result = await this.client.query({
        query: `SELECT * FROM ${TABLE_SCORERS} WHERE entityId = {var_entityId:String} AND entityType = {var_entityType:String} ORDER BY createdAt DESC LIMIT {var_limit:Int64} OFFSET {var_offset:Int64}`,
        query_params: {
          var_entityId: entityId,
          var_entityType: entityType,
          var_limit: limitValue,
          var_offset: start,
        },
        format: 'JSONEachRow',
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });
      const rows = await result.json();
      const scores = Array.isArray(rows) ? rows.map(row => this.transformScoreRow(row)) : [];
      return {
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
        scores,
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'LIST_SCORES_BY_ENTITY_ID', 'FAILED'),
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
  }: {
    traceId: string;
    spanId: string;
    pagination: StoragePagination;
  }): Promise<ListScoresResponse> {
    try {
      const countResult = await this.client.query({
        query: `SELECT COUNT(*) as count FROM ${TABLE_SCORERS} WHERE traceId = {var_traceId:String} AND spanId = {var_spanId:String}`,
        query_params: {
          var_traceId: traceId,
          var_spanId: spanId,
        },
        format: 'JSONEachRow',
      });
      const countRows = await countResult.json();
      let total = 0;
      if (Array.isArray(countRows) && countRows.length > 0 && countRows[0]) {
        const countObj = countRows[0] as { count: string | number };
        total = Number(countObj.count);
      }

      const { page, perPage: perPageInput } = pagination;

      if (!total) {
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

      const result = await this.client.query({
        query: `SELECT * FROM ${TABLE_SCORERS} WHERE traceId = {var_traceId:String} AND spanId = {var_spanId:String} ORDER BY createdAt DESC LIMIT {var_limit:Int64} OFFSET {var_offset:Int64}`,
        query_params: {
          var_traceId: traceId,
          var_spanId: spanId,
          var_limit: limitValue,
          var_offset: start,
        },
        format: 'JSONEachRow',
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      const rows = await result.json();
      const scores = Array.isArray(rows) ? rows.map(row => this.transformScoreRow(row)) : [];

      return {
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
        scores,
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'LIST_SCORES_BY_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { traceId, spanId },
        },
        error,
      );
    }
  }
}
