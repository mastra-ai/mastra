import type { Connection } from '@lancedb/lancedb';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { ScoreRowData, ScoringSource } from '@mastra/core/scores';
import { ScoresStorage, TABLE_SCORERS } from '@mastra/core/storage';
import type { PaginationInfo, StoragePagination } from '@mastra/core/storage';
import { getTableSchema, processResultWithTypeConversion } from '../utils';

export class StoreScoresLance extends ScoresStorage {
  private client: Connection;
  constructor({ client }: { client: Connection }) {
    super();
    this.client = client;
  }

  async saveScore(score: ScoreRowData): Promise<{ score: ScoreRowData }> {
    try {
      const id = crypto.randomUUID();
      const table = await this.client.openTable(TABLE_SCORERS);
      // Fetch schema fields for mastra_scorers
      const schema = await getTableSchema({ tableName: TABLE_SCORERS, client: this.client });
      const allowedFields = new Set(schema.fields.map((f: any) => f.name));
      // Filter out fields not in schema
      const filteredScore: Record<string, any> = {};
      (Object.keys(score) as (keyof ScoreRowData)[]).forEach(key => {
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

  async getScoresByScorerId({
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
      const table = await this.client.openTable(TABLE_SCORERS);
      // Use zero-based pagination (default page = 0)
      const { page = 0, perPage = 10 } = pagination || {};
      const offset = page * perPage;

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

      query = query.limit(perPage);
      if (offset > 0) query.offset(offset);
      const records = await query.toArray();
      const schema = await getTableSchema({ tableName: TABLE_SCORERS, client: this.client });
      const scores = processResultWithTypeConversion(records, schema) as ScoreRowData[];

      let totalQuery = table.query().where(`\`scorerId\` = '${scorerId}'`);
      if (source) {
        totalQuery = totalQuery.where(`\`source\` = '${source}'`);
      }
      const allRecords = await totalQuery.toArray();
      const total = allRecords.length;

      return {
        pagination: {
          page,
          perPage,
          total,
          hasMore: offset + scores.length < total,
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

  async getScoresByRunId({
    runId,
    pagination,
  }: {
    runId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    try {
      const table = await this.client.openTable(TABLE_SCORERS);
      const { page = 0, perPage = 10 } = pagination || {};
      const offset = page * perPage;
      // Query for scores with the given runId
      const query = table.query().where(`\`runId\` = '${runId}'`).limit(perPage);
      if (offset > 0) query.offset(offset);
      const records = await query.toArray();
      const schema = await getTableSchema({ tableName: TABLE_SCORERS, client: this.client });
      const scores = processResultWithTypeConversion(records, schema) as ScoreRowData[];
      // Get total count for pagination
      const allRecords = await table.query().where(`\`runId\` = '${runId}'`).toArray();
      const total = allRecords.length;
      return {
        pagination: {
          page,
          perPage,
          total,
          hasMore: offset + scores.length < total,
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

  async getScoresByEntityId({
    entityId,
    entityType,
    pagination,
  }: {
    pagination: StoragePagination;
    entityId: string;
    entityType: string;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    try {
      const table = await this.client.openTable(TABLE_SCORERS);
      const { page = 0, perPage = 10 } = pagination || {};
      const offset = page * perPage;
      // Query for scores with the given entityId and entityType
      const query = table
        .query()
        .where(`\`entityId\` = '${entityId}' AND \`entityType\` = '${entityType}'`)
        .limit(perPage);
      if (offset > 0) query.offset(offset);
      const records = await query.toArray();
      const schema = await getTableSchema({ tableName: TABLE_SCORERS, client: this.client });
      const scores = processResultWithTypeConversion(records, schema) as ScoreRowData[];
      // Get total count for pagination
      const allRecords = await table
        .query()
        .where(`\`entityId\` = '${entityId}' AND \`entityType\` = '${entityType}'`)
        .toArray();
      const total = allRecords.length;
      return {
        pagination: {
          page,
          perPage,
          total,
          hasMore: offset + scores.length < total,
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
}
