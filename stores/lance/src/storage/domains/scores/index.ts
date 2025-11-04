import type { Connection } from '@lancedb/lancedb';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { ScoreRowData, ScoringSource, ValidatedSaveScorePayload } from '@mastra/core/evals';
import { saveScorePayloadSchema } from '@mastra/core/evals';
import { ScoresStorage, TABLE_SCORERS, calculatePagination, normalizePerPage } from '@mastra/core/storage';
import type { PaginationInfo, StoragePagination } from '@mastra/core/storage';
import { getTableSchema, processResultWithTypeConversion } from '../utils';

export class StoreScoresLance extends ScoresStorage {
  private client: Connection;
  constructor({ client }: { client: Connection }) {
    super();
    this.client = client;
  }

  async saveScore(score: ScoreRowData): Promise<{ score: ScoreRowData }> {
    let validatedScore: ValidatedSaveScorePayload;
    try {
      validatedScore = saveScorePayloadSchema.parse(score);
    } catch (error) {
      throw new MastraError(
        {
          id: 'LANCE_STORAGE_SAVE_SCORE_FAILED',
          text: 'Failed to save score in LanceStorage',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
    try {
      const id = crypto.randomUUID();
      const table = await this.client.openTable(TABLE_SCORERS);
      // Fetch schema fields for mastra_scorers
      const schema = await getTableSchema({ tableName: TABLE_SCORERS, client: this.client });
      const allowedFields = new Set(schema.fields.map((f: any) => f.name));
      // Filter out fields not in schema
      const filteredScore: Record<string, any> = {};
      (Object.keys(validatedScore) as (keyof ScoreRowData)[]).forEach(key => {
        if (allowedFields.has(key)) {
          filteredScore[key] = score[key];
        }
      });
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
      await table.add([filteredScore], { mode: 'append' });
      return { score };
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORAGE_SAVE_SCORE_FAILED',
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

      const query = table.query().where(`id = '${id}'`).limit(1);

      const records = await query.toArray();

      if (records.length === 0) return null;
      const schema = await getTableSchema({ tableName: TABLE_SCORERS, client: this.client });
      return processResultWithTypeConversion(records[0], schema) as ScoreRowData;
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORAGE_GET_SCORE_BY_ID_FAILED',
          text: 'Failed to get score by id in LanceStorage',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { error: error?.message },
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
  }: {
    scorerId: string;
    pagination: StoragePagination;
    entityId?: string;
    entityType?: string;
    source?: ScoringSource;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    try {
      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const table = await this.client.openTable(TABLE_SCORERS);

      let query = table.query().where(`\`scorerId\` = '${scorerId}'`);

      if (source) {
        query = query.where(`\`source\` = '${source}'`);
      }

      if (entityId) {
        query = query.where(`\`entityId\` = '${entityId}'`);
      }
      if (entityType) {
        query = query.where(`\`entityType\` = '${entityType}'`);
      }

      // Get total count first
      let totalQuery = table.query().where(`\`scorerId\` = '${scorerId}'`);
      if (source) {
        totalQuery = totalQuery.where(`\`source\` = '${source}'`);
      }
      if (entityId) {
        totalQuery = totalQuery.where(`\`entityId\` = '${entityId}'`);
      }
      if (entityType) {
        totalQuery = totalQuery.where(`\`entityType\` = '${entityType}'`);
      }
      const allRecords = await totalQuery.toArray();
      const total = allRecords.length;

      const end = perPageInput === false ? total : start + perPage;

      // For perPage: false, don't use limit/offset, just get all records
      if (perPageInput !== false) {
        query = query.limit(perPage);
        if (start > 0) query = query.offset(start);
      }

      const records = await query.toArray();
      const schema = await getTableSchema({ tableName: TABLE_SCORERS, client: this.client });
      const scores = processResultWithTypeConversion(records, schema) as ScoreRowData[];

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
          id: 'LANCE_STORAGE_GET_SCORES_BY_SCORER_ID_FAILED',
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
  }: {
    runId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    try {
      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const table = await this.client.openTable(TABLE_SCORERS);

      // Get total count for pagination
      const allRecords = await table.query().where(`\`runId\` = '${runId}'`).toArray();
      const total = allRecords.length;

      const end = perPageInput === false ? total : start + perPage;

      // Query for scores with the given runId
      let query = table.query().where(`\`runId\` = '${runId}'`);

      // For perPage: false, don't use limit/offset
      if (perPageInput !== false) {
        query = query.limit(perPage);
        if (start > 0) query = query.offset(start);
      }

      const records = await query.toArray();
      const schema = await getTableSchema({ tableName: TABLE_SCORERS, client: this.client });
      const scores = processResultWithTypeConversion(records, schema) as ScoreRowData[];

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
          id: 'LANCE_STORAGE_GET_SCORES_BY_RUN_ID_FAILED',
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
  }: {
    pagination: StoragePagination;
    entityId: string;
    entityType: string;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    try {
      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const table = await this.client.openTable(TABLE_SCORERS);

      // Get total count for pagination
      const allRecords = await table
        .query()
        .where(`\`entityId\` = '${entityId}' AND \`entityType\` = '${entityType}'`)
        .toArray();
      const total = allRecords.length;

      const end = perPageInput === false ? total : start + perPage;

      // Query for scores with the given entityId and entityType
      let query = table.query().where(`\`entityId\` = '${entityId}' AND \`entityType\` = '${entityType}'`);

      // For perPage: false, don't use limit/offset
      if (perPageInput !== false) {
        query = query.limit(perPage);
        if (start > 0) query = query.offset(start);
      }

      const records = await query.toArray();
      const schema = await getTableSchema({ tableName: TABLE_SCORERS, client: this.client });
      const scores = processResultWithTypeConversion(records, schema) as ScoreRowData[];

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
          id: 'LANCE_STORAGE_GET_SCORES_BY_ENTITY_ID_FAILED',
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
  }: {
    traceId: string;
    spanId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    try {
      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const table = await this.client.openTable(TABLE_SCORERS);

      // Get total count for pagination
      const allRecords = await table.query().where(`\`traceId\` = '${traceId}' AND \`spanId\` = '${spanId}'`).toArray();
      const total = allRecords.length;

      const end = perPageInput === false ? total : start + perPage;

      // Query for scores with the given traceId and spanId
      let query = table.query().where(`\`traceId\` = '${traceId}' AND \`spanId\` = '${spanId}'`);

      // For perPage: false, don't use limit/offset
      if (perPageInput !== false) {
        query = query.limit(perPage);
        if (start > 0) query = query.offset(start);
      }

      const records = await query.toArray();
      const schema = await getTableSchema({ tableName: TABLE_SCORERS, client: this.client });
      const scores = processResultWithTypeConversion(records, schema) as ScoreRowData[];

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
          id: 'LANCE_STORAGE_GET_SCORES_BY_SPAN_FAILED',
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
