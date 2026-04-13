import type { Client, InValue } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  TABLE_EXPERIMENTS,
  TABLE_EXPERIMENT_RESULTS,
  EXPERIMENTS_SCHEMA,
  EXPERIMENT_RESULTS_SCHEMA,
  ExperimentsStorage,
  calculatePagination,
  normalizePerPage,
  safelyParseJSON,
  ensureDate,
} from '@mastra/core/storage';
import type {
  Experiment,
  ExperimentResult,
  ExperimentReviewCounts,
  CreateExperimentInput,
  UpdateExperimentInput,
  AddExperimentResultInput,
  UpdateExperimentResultInput,
  ListExperimentsInput,
  ListExperimentsOutput,
  ListExperimentResultsInput,
  ListExperimentResultsOutput,
} from '@mastra/core/storage';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import { buildSelectColumns } from '../../db/utils';

export class ExperimentsLibSQL extends ExperimentsStorage {
  #db: LibSQLDB;
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_EXPERIMENTS, schema: EXPERIMENTS_SCHEMA });
    await this.#db.createTable({
      tableName: TABLE_EXPERIMENT_RESULTS,
      schema: EXPERIMENT_RESULTS_SCHEMA,
    });
    // Add columns introduced after initial schema for backwards compatibility
    await this.#db.alterTable({
      tableName: TABLE_EXPERIMENTS,
      schema: EXPERIMENTS_SCHEMA,
      ifNotExists: ['agentVersion'],
    });
    await this.#db.alterTable({
      tableName: TABLE_EXPERIMENT_RESULTS,
      schema: EXPERIMENT_RESULTS_SCHEMA,
      ifNotExists: ['status', 'tags'],
    });

    // Indexes — idempotent, safe to run on every init
    await this.#client.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_experiments_datasetid ON "${TABLE_EXPERIMENTS}" ("datasetId")`,
      args: [],
    });
    await this.#client.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_experiment_results_experimentid ON "${TABLE_EXPERIMENT_RESULTS}" ("experimentId")`,
      args: [],
    });
    await this.#client.execute({
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_experiment_results_exp_item ON "${TABLE_EXPERIMENT_RESULTS}" ("experimentId", "itemId")`,
      args: [],
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_EXPERIMENT_RESULTS });
    await this.#db.deleteData({ tableName: TABLE_EXPERIMENTS });
  }

  // Helper to transform row to Experiment
  private transformExperimentRow(row: Record<string, unknown>): Experiment {
    return {
      id: row.id as string,
      datasetId: (row.datasetId as string | null) ?? null,
      datasetVersion: row.datasetVersion != null ? (row.datasetVersion as number) : null,
      agentVersion: (row.agentVersion as string | null) ?? null,
      targetType: row.targetType as Experiment['targetType'],
      targetId: row.targetId as string,
      name: (row.name as string) ?? undefined,
      description: (row.description as string) ?? undefined,
      metadata: row.metadata ? safelyParseJSON(row.metadata as string) : undefined,
      status: row.status as Experiment['status'],
      totalItems: row.totalItems as number,
      succeededCount: row.succeededCount as number,
      failedCount: row.failedCount as number,
      skippedCount: (row.skippedCount as number) ?? 0,
      startedAt: row.startedAt ? ensureDate(row.startedAt as string | Date)! : null,
      completedAt: row.completedAt ? ensureDate(row.completedAt as string | Date)! : null,
      createdAt: ensureDate(row.createdAt as string | Date)!,
      updatedAt: ensureDate(row.updatedAt as string | Date)!,
    };
  }

  // Helper to transform row to ExperimentResult
  private transformExperimentResultRow(row: Record<string, unknown>): ExperimentResult {
    return {
      id: row.id as string,
      experimentId: row.experimentId as string,
      itemId: row.itemId as string,
      itemDatasetVersion: row.itemDatasetVersion != null ? (row.itemDatasetVersion as number) : null,
      input: safelyParseJSON(row.input as string),
      output: row.output ? safelyParseJSON(row.output as string) : null,
      groundTruth: row.groundTruth ? safelyParseJSON(row.groundTruth as string) : null,
      error: row.error ? safelyParseJSON(row.error as string) : null,
      startedAt: ensureDate(row.startedAt as string | Date)!,
      completedAt: ensureDate(row.completedAt as string | Date)!,
      retryCount: row.retryCount as number,
      traceId: (row.traceId as string | null) ?? null,
      status: (row.status as ExperimentResult['status']) ?? null,
      tags: row.tags ? safelyParseJSON(row.tags as string) : null,
      createdAt: ensureDate(row.createdAt as string | Date)!,
    };
  }

  // Experiment lifecycle
  async createExperiment(input: CreateExperimentInput): Promise<Experiment> {
    try {
      const id = input.id ?? crypto.randomUUID();
      const now = new Date();
      const nowIso = now.toISOString();

      await this.#db.insert({
        tableName: TABLE_EXPERIMENTS,
        record: {
          id,
          datasetId: input.datasetId ?? null,
          datasetVersion: input.datasetVersion ?? null,
          agentVersion: input.agentVersion ?? null,
          targetType: input.targetType,
          targetId: input.targetId,
          name: input.name ?? null,
          description: input.description ?? null,
          metadata: input.metadata ?? null,
          status: 'pending',
          totalItems: input.totalItems,
          succeededCount: 0,
          failedCount: 0,
          skippedCount: 0,
          startedAt: null,
          completedAt: null,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      });

      return {
        id,
        datasetId: input.datasetId,
        datasetVersion: input.datasetVersion,
        agentVersion: input.agentVersion ?? null,
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
          id: createStorageErrorId('LIBSQL', 'CREATE_EXPERIMENT', 'FAILED'),
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
          id: createStorageErrorId('LIBSQL', 'UPDATE_EXPERIMENT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { experimentId: input.id },
        });
      }

      const now = new Date().toISOString();
      const updates: string[] = ['updatedAt = ?'];
      const values: InValue[] = [now];

      if (input.status !== undefined) {
        updates.push('status = ?');
        values.push(input.status);
      }
      if (input.succeededCount !== undefined) {
        updates.push('succeededCount = ?');
        values.push(input.succeededCount);
      }
      if (input.failedCount !== undefined) {
        updates.push('failedCount = ?');
        values.push(input.failedCount);
      }
      if (input.totalItems !== undefined) {
        updates.push('totalItems = ?');
        values.push(input.totalItems);
      }
      if (input.startedAt !== undefined) {
        updates.push('startedAt = ?');
        values.push(input.startedAt?.toISOString() ?? null);
      }
      if (input.completedAt !== undefined) {
        updates.push('completedAt = ?');
        values.push(input.completedAt?.toISOString() ?? null);
      }
      if (input.skippedCount !== undefined) {
        updates.push('skippedCount = ?');
        values.push(input.skippedCount);
      }
      if (input.name !== undefined) {
        updates.push('name = ?');
        values.push(input.name);
      }
      if (input.description !== undefined) {
        updates.push('description = ?');
        values.push(input.description);
      }
      if (input.metadata !== undefined) {
        updates.push('metadata = ?');
        values.push(JSON.stringify(input.metadata));
      }

      values.push(input.id);

      await this.#client.execute({
        sql: `UPDATE ${TABLE_EXPERIMENTS} SET ${updates.join(', ')} WHERE id = ?`,
        args: values,
      });

      // Re-SELECT to get all fields correctly transformed (F2 fix)
      const updated = await this.getExperimentById({ id: input.id });
      return updated!;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'UPDATE_EXPERIMENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getExperimentById(args: { id: string }): Promise<Experiment | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_EXPERIMENTS)} FROM ${TABLE_EXPERIMENTS} WHERE id = ?`,
        args: [args.id],
      });
      return result.rows?.[0] ? this.transformExperimentRow(result.rows[0] as Record<string, unknown>) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_EXPERIMENT', 'FAILED'),
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

      // Build WHERE clause
      const conditions: string[] = [];
      const queryParams: InValue[] = [];

      if (args.datasetId) {
        conditions.push('datasetId = ?');
        queryParams.push(args.datasetId);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM ${TABLE_EXPERIMENTS} ${whereClause}`,
        args: queryParams,
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      if (total === 0) {
        return {
          experiments: [],
          pagination: { total: 0, page, perPage: perPageInput, hasMore: false },
        };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_EXPERIMENTS)} FROM ${TABLE_EXPERIMENTS} ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        args: [...queryParams, limitValue, start],
      });

      return {
        experiments: result.rows?.map(row => this.transformExperimentRow(row as Record<string, unknown>)) ?? [],
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
          id: createStorageErrorId('LIBSQL', 'LIST_EXPERIMENTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteExperiment(args: { id: string }): Promise<void> {
    try {
      // Delete results first (foreign key semantics)
      await this.#client.execute({
        sql: `DELETE FROM ${TABLE_EXPERIMENT_RESULTS} WHERE experimentId = ?`,
        args: [args.id],
      });
      await this.#client.execute({
        sql: `DELETE FROM ${TABLE_EXPERIMENTS} WHERE id = ?`,
        args: [args.id],
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_EXPERIMENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // Results (per-item)
  async addExperimentResult(input: AddExperimentResultInput): Promise<ExperimentResult> {
    try {
      const id = input.id ?? crypto.randomUUID();
      const now = new Date();
      const nowIso = now.toISOString();

      await this.#db.insert({
        tableName: TABLE_EXPERIMENT_RESULTS,
        record: {
          id,
          experimentId: input.experimentId,
          itemId: input.itemId,
          itemDatasetVersion: input.itemDatasetVersion ?? null,
          input: input.input,
          output: input.output,
          groundTruth: input.groundTruth,
          error: input.error ?? null,
          startedAt: input.startedAt.toISOString(),
          completedAt: input.completedAt.toISOString(),
          retryCount: input.retryCount,
          traceId: input.traceId ?? null,
          status: input.status ?? null,
          tags: input.tags !== undefined && input.tags !== null ? JSON.stringify(input.tags) : null,
          createdAt: nowIso,
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
        status: input.status ?? null,
        tags: input.tags ?? null,
        createdAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'ADD_EXPERIMENT_RESULT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async updateExperimentResult(input: UpdateExperimentResultInput): Promise<ExperimentResult> {
    try {
      const setClauses: string[] = [];
      const values: InValue[] = [];

      if (input.status !== undefined) {
        setClauses.push(`"status" = ?`);
        values.push(input.status);
      }
      if (input.tags !== undefined) {
        setClauses.push(`"tags" = ?`);
        values.push(JSON.stringify(input.tags));
      }

      if (setClauses.length === 0) {
        const existing = await this.getExperimentResultById({ id: input.id });
        if (!existing) {
          throw new MastraError({
            id: createStorageErrorId('LIBSQL', 'UPDATE_EXPERIMENT_RESULT', 'NOT_FOUND'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { resultId: input.id },
          });
        }
        return existing;
      }

      values.push(input.id);
      let whereClause = `"id" = ?`;
      if (input.experimentId) {
        values.push(input.experimentId);
        whereClause += ` AND "experimentId" = ?`;
      }
      const updateResult = await this.#client.execute({
        sql: `UPDATE ${TABLE_EXPERIMENT_RESULTS} SET ${setClauses.join(', ')} WHERE ${whereClause}`,
        args: values,
      });

      if (updateResult.rowsAffected === 0) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_EXPERIMENT_RESULT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { resultId: input.id, ...(input.experimentId ? { experimentId: input.experimentId } : {}) },
        });
      }

      const result = await this.getExperimentResultById({ id: input.id });
      if (!result) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_EXPERIMENT_RESULT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { resultId: input.id },
        });
      }
      return result;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'UPDATE_EXPERIMENT_RESULT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getExperimentResultById(args: { id: string }): Promise<ExperimentResult | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_EXPERIMENT_RESULTS)} FROM ${TABLE_EXPERIMENT_RESULTS} WHERE id = ?`,
        args: [args.id],
      });
      return result.rows?.[0] ? this.transformExperimentResultRow(result.rows[0] as Record<string, unknown>) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_EXPERIMENT_RESULT', 'FAILED'),
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

      // Build WHERE clause
      const conditions: string[] = ['experimentId = ?'];
      const queryParams: InValue[] = [args.experimentId];

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // Get total count
      const countResult = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM ${TABLE_EXPERIMENT_RESULTS} ${whereClause}`,
        args: queryParams,
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      if (total === 0) {
        return {
          results: [],
          pagination: { total: 0, page, perPage: perPageInput, hasMore: false },
        };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_EXPERIMENT_RESULTS)} FROM ${TABLE_EXPERIMENT_RESULTS} ${whereClause} ORDER BY startedAt ASC LIMIT ? OFFSET ?`,
        args: [...queryParams, limitValue, start],
      });

      return {
        results: result.rows?.map(row => this.transformExperimentResultRow(row as Record<string, unknown>)) ?? [],
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
          id: createStorageErrorId('LIBSQL', 'LIST_EXPERIMENT_RESULTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteExperimentResults(args: { experimentId: string }): Promise<void> {
    try {
      await this.#client.execute({
        sql: `DELETE FROM ${TABLE_EXPERIMENT_RESULTS} WHERE experimentId = ?`,
        args: [args.experimentId],
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_EXPERIMENT_RESULTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getReviewSummary(): Promise<ExperimentReviewCounts[]> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT
          "experimentId",
          COUNT(*) as total,
          SUM(CASE WHEN status = 'needs-review' THEN 1 ELSE 0 END) as "needsReview",
          SUM(CASE WHEN status = 'reviewed' THEN 1 ELSE 0 END) as reviewed,
          SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) as complete
        FROM ${TABLE_EXPERIMENT_RESULTS}
        GROUP BY "experimentId"`,
        args: [],
      });

      return (result.rows ?? []).map(row => ({
        experimentId: row.experimentId as string,
        total: Number(row.total ?? 0),
        needsReview: Number(row.needsReview ?? 0),
        reviewed: Number(row.reviewed ?? 0),
        complete: Number(row.complete ?? 0),
      }));
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_REVIEW_SUMMARY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
