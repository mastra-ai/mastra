import { randomUUID } from 'node:crypto';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  TABLE_EXPERIMENTS,
  TABLE_EXPERIMENT_RESULTS,
  EXPERIMENTS_SCHEMA,
  EXPERIMENT_RESULTS_SCHEMA,
  ExperimentsStorage,
  calculatePagination,
  normalizePerPage,
} from '@mastra/core/storage';
import type {
  Experiment,
  ExperimentResult,
  CreateExperimentInput,
  UpdateExperimentInput,
  AddExperimentResultInput,
  ListExperimentsInput,
  ListExperimentsOutput,
  ListExperimentResultsInput,
  ListExperimentResultsOutput,
} from '@mastra/core/storage';
import type { Pool } from 'mysql2/promise';
import type { StoreOperationsMySQL } from '../operations';
import { formatTableName, parseDateTime, quoteIdentifier } from '../utils';

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
  if (typeof value === 'object') return value as T;
  return undefined;
}

interface ExperimentRow {
  id: string;
  datasetId: string | null;
  datasetVersion: number | null;
  targetType: string;
  targetId: string;
  name: string | null;
  description: string | null;
  metadata: string | null;
  status: string;
  totalItems: number;
  succeededCount: number;
  failedCount: number;
  skippedCount: number;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface ExperimentResultRow {
  id: string;
  experimentId: string;
  itemId: string;
  itemDatasetVersion: number | null;
  input: string;
  output: string | null;
  groundTruth: string | null;
  error: string | null;
  startedAt: Date | string;
  completedAt: Date | string;
  retryCount: number;
  traceId: string | null;
  createdAt: Date | string;
}

export class ExperimentsMySQL extends ExperimentsStorage {
  private pool: Pool;
  private operations: StoreOperationsMySQL;

  constructor({ pool, operations }: { pool: Pool; operations: StoreOperationsMySQL }) {
    super();
    this.pool = pool;
    this.operations = operations;
  }

  async init(): Promise<void> {
    await this.operations.createTable({ tableName: TABLE_EXPERIMENTS, schema: EXPERIMENTS_SCHEMA });
    await this.operations.createTable({ tableName: TABLE_EXPERIMENT_RESULTS, schema: EXPERIMENT_RESULTS_SCHEMA });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.pool.execute(`DELETE FROM ${formatTableName(TABLE_EXPERIMENT_RESULTS)}`);
    await this.pool.execute(`DELETE FROM ${formatTableName(TABLE_EXPERIMENTS)}`);
  }

  private mapExperiment(row: ExperimentRow): Experiment {
    return {
      id: row.id,
      datasetId: row.datasetId ?? null,
      datasetVersion: row.datasetVersion ?? null,
      targetType: row.targetType as Experiment['targetType'],
      targetId: row.targetId,
      name: row.name ?? undefined,
      description: row.description ?? undefined,
      metadata: parseJSON<Record<string, unknown>>(row.metadata),
      status: row.status as Experiment['status'],
      totalItems: row.totalItems,
      succeededCount: row.succeededCount,
      failedCount: row.failedCount,
      skippedCount: row.skippedCount ?? 0,
      startedAt: row.startedAt ? (parseDateTime(row.startedAt) ?? null) : null,
      completedAt: row.completedAt ? (parseDateTime(row.completedAt) ?? null) : null,
      createdAt: parseDateTime(row.createdAt) ?? new Date(),
      updatedAt: parseDateTime(row.updatedAt) ?? new Date(),
    };
  }

  private mapExperimentResult(row: ExperimentResultRow): ExperimentResult {
    return {
      id: row.id,
      experimentId: row.experimentId,
      itemId: row.itemId,
      itemDatasetVersion: row.itemDatasetVersion ?? null,
      input: parseJSON<Record<string, unknown>>(row.input),
      output: row.output ? parseJSON<Record<string, unknown>>(row.output) : null,
      groundTruth: row.groundTruth ? parseJSON<Record<string, unknown>>(row.groundTruth) : null,
      error: row.error ? (parseJSON<{ message: string; stack?: string; code?: string }>(row.error) ?? null) : null,
      startedAt: parseDateTime(row.startedAt) ?? new Date(),
      completedAt: parseDateTime(row.completedAt) ?? new Date(),
      retryCount: row.retryCount,
      traceId: row.traceId ?? null,
      createdAt: parseDateTime(row.createdAt) ?? new Date(),
    };
  }

  async createExperiment(input: CreateExperimentInput): Promise<Experiment> {
    try {
      const id = input.id ?? randomUUID();
      const now = new Date();

      await this.operations.insert({
        tableName: TABLE_EXPERIMENTS,
        record: {
          id,
          datasetId: input.datasetId ?? null,
          datasetVersion: input.datasetVersion ?? null,
          targetType: input.targetType,
          targetId: input.targetId,
          name: input.name ?? null,
          description: input.description ?? null,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
          status: 'pending',
          totalItems: input.totalItems,
          succeededCount: 0,
          failedCount: 0,
          skippedCount: 0,
          startedAt: null,
          completedAt: null,
          createdAt: now,
          updatedAt: now,
        },
      });

      return {
        id,
        datasetId: input.datasetId,
        datasetVersion: input.datasetVersion,
        targetType: input.targetType,
        targetId: input.targetId,
        name: input.name,
        description: input.description,
        metadata: input.metadata,
        status: 'pending',
        totalItems: input.totalItems,
        succeededCount: 0,
        failedCount: 0,
        skippedCount: 0,
        startedAt: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_CREATE_EXPERIMENT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async updateExperiment(input: UpdateExperimentInput): Promise<Experiment> {
    try {
      const existing = await this.getExperimentById({ id: input.id });
      if (!existing) {
        throw new MastraError({
          id: 'MYSQL_UPDATE_EXPERIMENT_NOT_FOUND',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { experimentId: input.id },
        });
      }

      const data: Record<string, any> = { updatedAt: new Date() };

      if (input.status !== undefined) data.status = input.status;
      if (input.succeededCount !== undefined) data.succeededCount = input.succeededCount;
      if (input.failedCount !== undefined) data.failedCount = input.failedCount;
      if (input.skippedCount !== undefined) data.skippedCount = input.skippedCount;
      if (input.startedAt !== undefined) data.startedAt = input.startedAt ?? null;
      if (input.completedAt !== undefined) data.completedAt = input.completedAt ?? null;
      if (input.name !== undefined) data.name = input.name;
      if (input.description !== undefined) data.description = input.description;
      if (input.metadata !== undefined) data.metadata = JSON.stringify(input.metadata);

      await this.operations.update({
        tableName: TABLE_EXPERIMENTS,
        keys: { id: input.id },
        data,
      });

      const updated = await this.getExperimentById({ id: input.id });
      return updated!;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: 'MYSQL_UPDATE_EXPERIMENT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getExperimentById(args: { id: string }): Promise<Experiment | null> {
    try {
      const row = await this.operations.load<ExperimentRow>({
        tableName: TABLE_EXPERIMENTS,
        keys: { id: args.id },
      });
      return row ? this.mapExperiment(row) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_GET_EXPERIMENT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listExperiments(args: ListExperimentsInput): Promise<ListExperimentsOutput> {
    try {
      const { page, perPage: perPageInput } = args.pagination;

      const conditions: string[] = [];
      const params: any[] = [];

      if (args.datasetId) {
        conditions.push(`${quoteIdentifier('datasetId', 'column name')} = ?`);
        params.push(args.datasetId);
      }

      const whereClause = {
        sql: conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '',
        args: params,
      };

      const total = await this.operations.loadTotalCount({ tableName: TABLE_EXPERIMENTS, whereClause });
      if (total === 0) {
        return {
          experiments: [],
          pagination: { total: 0, page, perPage: perPageInput, hasMore: false },
        };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;

      const rows = await this.operations.loadMany<ExperimentRow>({
        tableName: TABLE_EXPERIMENTS,
        whereClause,
        orderBy: `${quoteIdentifier('createdAt', 'column name')} DESC`,
        offset,
        limit: limitValue,
      });

      return {
        experiments: rows.map(row => this.mapExperiment(row)),
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: perPageInput === false ? false : offset + perPage < total,
        },
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_LIST_EXPERIMENTS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteExperiment(args: { id: string }): Promise<void> {
    try {
      await this.pool.execute(
        `DELETE FROM ${formatTableName(TABLE_EXPERIMENT_RESULTS)} WHERE ${quoteIdentifier('experimentId', 'column name')} = ?`,
        [args.id],
      );
      await this.pool.execute(`DELETE FROM ${formatTableName(TABLE_EXPERIMENTS)} WHERE id = ?`, [args.id]);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_DELETE_EXPERIMENT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async addExperimentResult(input: AddExperimentResultInput): Promise<ExperimentResult> {
    try {
      const id = input.id ?? randomUUID();
      const now = new Date();

      await this.operations.insert({
        tableName: TABLE_EXPERIMENT_RESULTS,
        record: {
          id,
          experimentId: input.experimentId,
          itemId: input.itemId,
          itemDatasetVersion: input.itemDatasetVersion ?? null,
          input: JSON.stringify(input.input),
          output: input.output ? JSON.stringify(input.output) : null,
          groundTruth: input.groundTruth ? JSON.stringify(input.groundTruth) : null,
          error: input.error ? JSON.stringify(input.error) : null,
          startedAt: input.startedAt,
          completedAt: input.completedAt,
          retryCount: input.retryCount,
          traceId: input.traceId ?? null,
          createdAt: now,
        },
      });

      return {
        id,
        experimentId: input.experimentId,
        itemId: input.itemId,
        itemDatasetVersion: input.itemDatasetVersion,
        input: input.input,
        output: input.output,
        groundTruth: input.groundTruth,
        error: input.error,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        retryCount: input.retryCount,
        traceId: input.traceId ?? null,
        createdAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_ADD_EXPERIMENT_RESULT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getExperimentResultById(args: { id: string }): Promise<ExperimentResult | null> {
    try {
      const row = await this.operations.load<ExperimentResultRow>({
        tableName: TABLE_EXPERIMENT_RESULTS,
        keys: { id: args.id },
      });
      return row ? this.mapExperimentResult(row) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_GET_EXPERIMENT_RESULT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listExperimentResults(args: ListExperimentResultsInput): Promise<ListExperimentResultsOutput> {
    try {
      const { page, perPage: perPageInput } = args.pagination;

      const whereClause = {
        sql: ` WHERE ${quoteIdentifier('experimentId', 'column name')} = ?`,
        args: [args.experimentId] as any[],
      };

      const total = await this.operations.loadTotalCount({ tableName: TABLE_EXPERIMENT_RESULTS, whereClause });
      if (total === 0) {
        return {
          results: [],
          pagination: { total: 0, page, perPage: perPageInput, hasMore: false },
        };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;

      const rows = await this.operations.loadMany<ExperimentResultRow>({
        tableName: TABLE_EXPERIMENT_RESULTS,
        whereClause,
        orderBy: `${quoteIdentifier('startedAt', 'column name')} ASC`,
        offset,
        limit: limitValue,
      });

      return {
        results: rows.map(row => this.mapExperimentResult(row)),
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: perPageInput === false ? false : offset + perPage < total,
        },
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_LIST_EXPERIMENT_RESULTS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteExperimentResults(args: { experimentId: string }): Promise<void> {
    try {
      await this.pool.execute(
        `DELETE FROM ${formatTableName(TABLE_EXPERIMENT_RESULTS)} WHERE ${quoteIdentifier('experimentId', 'column name')} = ?`,
        [args.experimentId],
      );
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_DELETE_EXPERIMENT_RESULTS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
