import type { Client, InValue } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  TABLE_DATASET_RUNS,
  TABLE_DATASET_RUN_RESULTS,
  DATASET_RUNS_SCHEMA,
  DATASET_RUN_RESULTS_SCHEMA,
  RunsStorage,
  calculatePagination,
  normalizePerPage,
  safelyParseJSON,
  ensureDate,
} from '@mastra/core/storage';
import type {
  Run,
  RunResult,
  CreateRunInput,
  UpdateRunInput,
  AddRunResultInput,
  ListRunsInput,
  ListRunsOutput,
  ListRunResultsInput,
  ListRunResultsOutput,
} from '@mastra/core/storage';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import { buildSelectColumns } from '../../db/utils';

export class RunsLibSQL extends RunsStorage {
  #db: LibSQLDB;
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_DATASET_RUNS, schema: DATASET_RUNS_SCHEMA });
    await this.#db.createTable({ tableName: TABLE_DATASET_RUN_RESULTS, schema: DATASET_RUN_RESULTS_SCHEMA });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_DATASET_RUN_RESULTS });
    await this.#db.deleteData({ tableName: TABLE_DATASET_RUNS });
  }

  // Helper to transform row to Run
  private transformRunRow(row: Record<string, unknown>): Run {
    return {
      id: row.id as string,
      datasetId: row.datasetId as string,
      datasetVersion: ensureDate(row.datasetVersion as string | Date)!,
      targetType: row.targetType as Run['targetType'],
      targetId: row.targetId as string,
      status: row.status as Run['status'],
      totalItems: row.totalItems as number,
      succeededCount: row.succeededCount as number,
      failedCount: row.failedCount as number,
      startedAt: row.startedAt ? ensureDate(row.startedAt as string | Date)! : null,
      completedAt: row.completedAt ? ensureDate(row.completedAt as string | Date)! : null,
      createdAt: ensureDate(row.createdAt as string | Date)!,
      updatedAt: ensureDate(row.updatedAt as string | Date)!,
    };
  }

  // Helper to transform row to RunResult
  private transformResultRow(row: Record<string, unknown>): RunResult {
    return {
      id: row.id as string,
      runId: row.runId as string,
      itemId: row.itemId as string,
      itemVersion: ensureDate(row.itemVersion as string | Date)!,
      input: safelyParseJSON(row.input as string),
      output: row.output ? safelyParseJSON(row.output as string) : null,
      expectedOutput: row.expectedOutput ? safelyParseJSON(row.expectedOutput as string) : null,
      latency: row.latency as number,
      error: row.error as string | null,
      startedAt: ensureDate(row.startedAt as string | Date)!,
      completedAt: ensureDate(row.completedAt as string | Date)!,
      retryCount: row.retryCount as number,
      traceId: (row.traceId as string | null) ?? null,
      scores: row.scores ? safelyParseJSON(row.scores as string) : [],
      createdAt: ensureDate(row.createdAt as string | Date)!,
    };
  }

  // Run lifecycle
  async createRun(input: CreateRunInput): Promise<Run> {
    try {
      const id = input.id ?? crypto.randomUUID();
      const now = new Date();
      const nowIso = now.toISOString();

      await this.#db.insert({
        tableName: TABLE_DATASET_RUNS,
        record: {
          id,
          datasetId: input.datasetId,
          datasetVersion: input.datasetVersion.toISOString(),
          targetType: input.targetType,
          targetId: input.targetId,
          status: 'pending',
          totalItems: input.totalItems,
          succeededCount: 0,
          failedCount: 0,
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
        targetType: input.targetType,
        targetId: input.targetId,
        status: 'pending',
        totalItems: input.totalItems,
        succeededCount: 0,
        failedCount: 0,
        startedAt: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CREATE_RUN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async updateRun(input: UpdateRunInput): Promise<Run> {
    try {
      const existing = await this.getRunById({ id: input.id });
      if (!existing) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_RUN', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { runId: input.id },
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
      if (input.startedAt !== undefined) {
        updates.push('startedAt = ?');
        values.push(input.startedAt?.toISOString() ?? null);
      }
      if (input.completedAt !== undefined) {
        updates.push('completedAt = ?');
        values.push(input.completedAt?.toISOString() ?? null);
      }

      values.push(input.id);

      await this.#client.execute({
        sql: `UPDATE ${TABLE_DATASET_RUNS} SET ${updates.join(', ')} WHERE id = ?`,
        args: values,
      });

      return {
        ...existing,
        status: input.status ?? existing.status,
        succeededCount: input.succeededCount ?? existing.succeededCount,
        failedCount: input.failedCount ?? existing.failedCount,
        startedAt: input.startedAt ?? existing.startedAt,
        completedAt: input.completedAt ?? existing.completedAt,
        updatedAt: new Date(now),
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'UPDATE_RUN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getRunById(args: { id: string }): Promise<Run | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_DATASET_RUNS)} FROM ${TABLE_DATASET_RUNS} WHERE id = ?`,
        args: [args.id],
      });
      return result.rows?.[0] ? this.transformRunRow(result.rows[0] as Record<string, unknown>) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_RUN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listRuns(args: ListRunsInput): Promise<ListRunsOutput> {
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
        sql: `SELECT COUNT(*) as count FROM ${TABLE_DATASET_RUNS} ${whereClause}`,
        args: queryParams,
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      if (total === 0) {
        return {
          runs: [],
          pagination: { total: 0, page, perPage: perPageInput, hasMore: false },
        };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_DATASET_RUNS)} FROM ${TABLE_DATASET_RUNS} ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        args: [...queryParams, limitValue, start],
      });

      return {
        runs: result.rows?.map(row => this.transformRunRow(row as Record<string, unknown>)) ?? [],
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
          id: createStorageErrorId('LIBSQL', 'LIST_RUNS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteRun(args: { id: string }): Promise<void> {
    try {
      // Delete results first (foreign key semantics)
      await this.#client.execute({
        sql: `DELETE FROM ${TABLE_DATASET_RUN_RESULTS} WHERE runId = ?`,
        args: [args.id],
      });
      await this.#client.execute({
        sql: `DELETE FROM ${TABLE_DATASET_RUNS} WHERE id = ?`,
        args: [args.id],
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_RUN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // Results (per-item)
  async addResult(input: AddRunResultInput): Promise<RunResult> {
    try {
      const id = input.id ?? crypto.randomUUID();
      const now = new Date();
      const nowIso = now.toISOString();
      const scores = input.scores ?? [];

      await this.#db.insert({
        tableName: TABLE_DATASET_RUN_RESULTS,
        record: {
          id,
          runId: input.runId,
          itemId: input.itemId,
          itemVersion: input.itemVersion.toISOString(),
          input: input.input,
          output: input.output,
          expectedOutput: input.expectedOutput,
          latency: input.latency,
          error: input.error,
          startedAt: input.startedAt.toISOString(),
          completedAt: input.completedAt.toISOString(),
          retryCount: input.retryCount,
          traceId: input.traceId ?? null,
          scores: JSON.stringify(scores),
          createdAt: nowIso,
        },
      });

      return {
        id,
        runId: input.runId,
        itemId: input.itemId,
        itemVersion: input.itemVersion,
        input: input.input,
        output: input.output,
        expectedOutput: input.expectedOutput,
        latency: input.latency,
        error: input.error,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        retryCount: input.retryCount,
        traceId: input.traceId ?? null,
        scores,
        createdAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'ADD_RESULT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getResultById(args: { id: string }): Promise<RunResult | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_DATASET_RUN_RESULTS)} FROM ${TABLE_DATASET_RUN_RESULTS} WHERE id = ?`,
        args: [args.id],
      });
      return result.rows?.[0] ? this.transformResultRow(result.rows[0] as Record<string, unknown>) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_RESULT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listResults(args: ListRunResultsInput): Promise<ListRunResultsOutput> {
    try {
      const { page, perPage: perPageInput } = args.pagination;

      // Build WHERE clause
      const conditions: string[] = ['runId = ?'];
      const queryParams: InValue[] = [args.runId];

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // Get total count
      const countResult = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM ${TABLE_DATASET_RUN_RESULTS} ${whereClause}`,
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
        sql: `SELECT ${buildSelectColumns(TABLE_DATASET_RUN_RESULTS)} FROM ${TABLE_DATASET_RUN_RESULTS} ${whereClause} ORDER BY startedAt ASC LIMIT ? OFFSET ?`,
        args: [...queryParams, limitValue, start],
      });

      return {
        results: result.rows?.map(row => this.transformResultRow(row as Record<string, unknown>)) ?? [],
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
          id: createStorageErrorId('LIBSQL', 'LIST_RESULTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteResultsByRunId(args: { runId: string }): Promise<void> {
    try {
      await this.#client.execute({
        sql: `DELETE FROM ${TABLE_DATASET_RUN_RESULTS} WHERE runId = ?`,
        args: [args.runId],
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_RESULTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
