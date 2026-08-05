import { randomUUID } from 'node:crypto';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  TABLE_EXPERIMENTS,
  TABLE_EXPERIMENT_RESULTS,
  TABLE_SCHEMAS,
  EXPERIMENTS_SCHEMA,
  EXPERIMENT_RESULTS_SCHEMA,
  ExperimentsStorage,
  calculatePagination,
  normalizePerPage,
} from '@mastra/core/storage';
import type {
  CreateIndexOptions,
  Experiment,
  ExperimentResult,
  ExperimentReviewCounts,
  ExperimentResultStatus,
  ExperimentTenancyFilters,
  CreateExperimentInput,
  UpdateExperimentInput,
  AddExperimentResultInput,
  UpdateExperimentResultInput,
  ListExperimentsInput,
  ListExperimentsOutput,
  ListExperimentResultsInput,
  ListExperimentResultsOutput,
} from '@mastra/core/storage';
import type { Pool } from 'mysql2/promise';
import type { StoreOperationsMySQL } from '../operations';
import { generateTableSQL } from '../operations';
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
  agentVersion: string | null;
  organizationId: string | null;
  projectId: string | null;
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
  organizationId: string | null;
  projectId: string | null;
  input: string;
  output: string | null;
  groundTruth: string | null;
  error: string | null;
  startedAt: Date | string;
  completedAt: Date | string;
  retryCount: number;
  traceId: string | null;
  status: string | null;
  tags: string | null;
  comment: string | null;
  createdAt: Date | string;
}

export class ExperimentsMySQL extends ExperimentsStorage {
  private pool: Pool;
  private operations: StoreOperationsMySQL;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  /** Tables managed by this domain */
  static readonly MANAGED_TABLES = [TABLE_EXPERIMENTS, TABLE_EXPERIMENT_RESULTS] as const;

  /**
   * Returns default index definitions for the experiments domain tables.
   */
  static getDefaultIndexDefs(_prefix: string = ''): CreateIndexOptions[] {
    return [
      // Tenancy: leading-tenant indexes for multi-tenant scans (parity with
      // pg/libsql/spanner/mongodb experiments adapters).
      {
        name: 'idx_experiments_org_project',
        table: TABLE_EXPERIMENTS,
        columns: ['organizationId', 'projectId'],
      },
      {
        name: 'idx_experiment_results_org_project',
        table: TABLE_EXPERIMENT_RESULTS,
        columns: ['organizationId', 'projectId'],
      },
    ];
  }

  /**
   * Exports DDL statements for all managed tables.
   */
  static getExportDDL(): string[] {
    return [
      generateTableSQL({ tableName: TABLE_EXPERIMENTS, schema: TABLE_SCHEMAS[TABLE_EXPERIMENTS] }),
      generateTableSQL({ tableName: TABLE_EXPERIMENT_RESULTS, schema: TABLE_SCHEMAS[TABLE_EXPERIMENT_RESULTS] }),
    ];
  }

  constructor({
    pool,
    operations,
    skipDefaultIndexes,
    indexes,
  }: {
    pool: Pool;
    operations: StoreOperationsMySQL;
    skipDefaultIndexes?: boolean;
    indexes?: CreateIndexOptions[];
  }) {
    super();
    this.pool = pool;
    this.operations = operations;
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx => (ExperimentsMySQL.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  /**
   * Returns default index definitions for the experiments domain tables.
   */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return ExperimentsMySQL.getDefaultIndexDefs('');
  }

  /**
   * Creates default indexes for optimal query performance.
   */
  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      await this.operations.createIndex(indexDef);
    }
  }

  /**
   * Creates custom user-defined indexes for this domain's tables.
   */
  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) return;
    for (const indexDef of this.#indexes) {
      await this.operations.createIndex(indexDef);
    }
  }

  async init(): Promise<void> {
    await this.operations.createTable({ tableName: TABLE_EXPERIMENTS, schema: EXPERIMENTS_SCHEMA });
    await this.operations.createTable({ tableName: TABLE_EXPERIMENT_RESULTS, schema: EXPERIMENT_RESULTS_SCHEMA });
    // Backfill tenancy columns on pre-existing tables so older deployments
    // keep working when they upgrade in place.
    await this.operations.alterTable({
      tableName: TABLE_EXPERIMENTS,
      schema: EXPERIMENTS_SCHEMA,
      ifNotExists: ['agentVersion', 'organizationId', 'projectId'],
    });
    await this.operations.alterTable({
      tableName: TABLE_EXPERIMENT_RESULTS,
      schema: EXPERIMENT_RESULTS_SCHEMA,
      ifNotExists: ['comment', 'organizationId', 'projectId'],
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
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
      agentVersion: row.agentVersion ?? null,
      organizationId: row.organizationId ?? null,
      projectId: row.projectId ?? null,
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
      organizationId: row.organizationId ?? null,
      projectId: row.projectId ?? null,
      input: parseJSON<Record<string, unknown>>(row.input),
      output: row.output ? parseJSON<Record<string, unknown>>(row.output) : null,
      groundTruth: row.groundTruth ? parseJSON<Record<string, unknown>>(row.groundTruth) : null,
      error: row.error ? (parseJSON<{ message: string; stack?: string; code?: string }>(row.error) ?? null) : null,
      startedAt: parseDateTime(row.startedAt) ?? new Date(),
      completedAt: parseDateTime(row.completedAt) ?? new Date(),
      retryCount: row.retryCount,
      traceId: row.traceId ?? null,
      status: (row.status as ExperimentResultStatus | null) ?? null,
      tags: row.tags ? (parseJSON<string[]>(row.tags) ?? null) : null,
      comment: row.comment ?? null,
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
          agentVersion: input.agentVersion ?? null,
          organizationId: input.organizationId ?? null,
          projectId: input.projectId ?? null,
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
        agentVersion: input.agentVersion ?? null,
        organizationId: input.organizationId ?? null,
        projectId: input.projectId ?? null,
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
      if (input.totalItems !== undefined) data.totalItems = input.totalItems;
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

  async getExperimentById(args: { id: string; filters?: ExperimentTenancyFilters }): Promise<Experiment | null> {
    try {
      // prepareWhereClause ignores undefined values, so this scopes the SELECT only
      // when the caller passed tenancy filters.
      const row = await this.operations.load<ExperimentRow>({
        tableName: TABLE_EXPERIMENTS,
        keys: {
          id: args.id,
          organizationId: args.filters?.organizationId,
          projectId: args.filters?.projectId,
        },
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
      if (args.targetType) {
        conditions.push(`${quoteIdentifier('targetType', 'column name')} = ?`);
        params.push(args.targetType);
      }
      if (args.targetId) {
        conditions.push(`${quoteIdentifier('targetId', 'column name')} = ?`);
        params.push(args.targetId);
      }
      if (args.agentVersion) {
        conditions.push(`${quoteIdentifier('agentVersion', 'column name')} = ?`);
        params.push(args.agentVersion);
      }
      if (args.status) {
        conditions.push(`${quoteIdentifier('status', 'column name')} = ?`);
        params.push(args.status);
      }
      if (args.filters) {
        const { organizationId, projectId } = args.filters;
        if (organizationId !== undefined) {
          conditions.push(`${quoteIdentifier('organizationId', 'column name')} = ?`);
          params.push(organizationId);
        }
        if (projectId !== undefined) {
          conditions.push(`${quoteIdentifier('projectId', 'column name')} = ?`);
          params.push(projectId);
        }
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

  async deleteExperiment(args: { id: string; filters?: ExperimentTenancyFilters }): Promise<void> {
    try {
      // Atomic gate + cascade under SELECT ... FOR UPDATE. Silent no-op on
      // tenancy mismatch.
      const tenancyConditions: string[] = [];
      const tenancyParams: any[] = [];
      if (args.filters?.organizationId !== undefined) {
        tenancyConditions.push(`${quoteIdentifier('organizationId', 'column name')} = ?`);
        tenancyParams.push(args.filters.organizationId);
      }
      if (args.filters?.projectId !== undefined) {
        tenancyConditions.push(`${quoteIdentifier('projectId', 'column name')} = ?`);
        tenancyParams.push(args.filters.projectId);
      }
      const gateWhere = ['id = ?', ...tenancyConditions].join(' AND ');

      const connection = await this.pool.getConnection();
      try {
        await connection.beginTransaction();
        const [gateRows] = await connection.execute(
          `SELECT id FROM ${formatTableName(TABLE_EXPERIMENTS)} WHERE ${gateWhere} FOR UPDATE`,
          [args.id, ...tenancyParams],
        );
        if (!Array.isArray(gateRows) || gateRows.length === 0) {
          await connection.commit();
          return;
        }
        await connection.execute(
          `DELETE FROM ${formatTableName(TABLE_EXPERIMENT_RESULTS)} WHERE ${quoteIdentifier('experimentId', 'column name')} = ?`,
          [args.id],
        );
        await connection.execute(`DELETE FROM ${formatTableName(TABLE_EXPERIMENTS)} WHERE id = ?`, [args.id]);
        await connection.commit();
      } catch (error) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          throw new MastraError(
            {
              id: 'MYSQL_DELETE_EXPERIMENT_ROLLBACK_FAILED',
              domain: ErrorDomain.STORAGE,
              category: ErrorCategory.THIRD_PARTY,
              details: { experimentId: args.id },
            },
            rollbackError,
          );
        }
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
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
    // Tool mock reports are produced only when an experiment used item-level tool
    // mocks — which the MySQL adapter rejects on write. Guard here too so a report
    // is never silently dropped.
    if (input.toolMockReport) {
      throw new MastraError({
        id: 'MYSQL_EXPERIMENT_TOOL_MOCK_REPORT_UNSUPPORTED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Tool mock reports are not supported on the MySQL storage adapter. Use a supported adapter (LibSQL, PostgreSQL, MongoDB, or Spanner) to persist experiment tool mock reports.',
      });
    }
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
          organizationId: input.organizationId ?? null,
          projectId: input.projectId ?? null,
          input: JSON.stringify(input.input),
          output: input.output ? JSON.stringify(input.output) : null,
          groundTruth: input.groundTruth ? JSON.stringify(input.groundTruth) : null,
          error: input.error ? JSON.stringify(input.error) : null,
          startedAt: input.startedAt,
          completedAt: input.completedAt,
          retryCount: input.retryCount,
          traceId: input.traceId ?? null,
          status: input.status ?? null,
          tags: input.tags ? JSON.stringify(input.tags) : null,
          createdAt: now,
        },
      });

      return {
        id,
        experimentId: input.experimentId,
        itemId: input.itemId,
        itemDatasetVersion: input.itemDatasetVersion,
        organizationId: input.organizationId ?? null,
        projectId: input.projectId ?? null,
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
          id: 'MYSQL_ADD_EXPERIMENT_RESULT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getExperimentResultById(args: {
    id: string;
    filters?: ExperimentTenancyFilters;
  }): Promise<ExperimentResult | null> {
    try {
      // prepareWhereClause ignores undefined values, so this scopes the SELECT only
      // when the caller passed tenancy filters.
      const row = await this.operations.load<ExperimentResultRow>({
        tableName: TABLE_EXPERIMENT_RESULTS,
        keys: {
          id: args.id,
          organizationId: args.filters?.organizationId,
          projectId: args.filters?.projectId,
        },
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

  async updateExperimentResult(input: UpdateExperimentResultInput): Promise<ExperimentResult> {
    try {
      const existing = await this.operations.load<ExperimentResultRow>({
        tableName: TABLE_EXPERIMENT_RESULTS,
        keys: { id: input.id },
      });
      if (!existing) {
        throw new Error(`Experiment result not found: ${input.id}`);
      }
      if (input.experimentId && existing.experimentId !== input.experimentId) {
        throw new Error(`Experiment result ${input.id} does not belong to experiment ${input.experimentId}`);
      }

      const updateData: Record<string, unknown> = {};
      if (input.status !== undefined) {
        updateData.status = input.status;
      }
      if (input.tags !== undefined) {
        updateData.tags = input.tags ? JSON.stringify(input.tags) : null;
      }
      if (input.comment !== undefined) {
        updateData.comment = input.comment;
      }

      if (Object.keys(updateData).length > 0) {
        await this.operations.update({
          tableName: TABLE_EXPERIMENT_RESULTS,
          keys: { id: input.id },
          data: updateData,
        });
      }

      const updated = await this.getExperimentResultById({ id: input.id });
      if (!updated) {
        throw new Error(`Experiment result ${input.id} not found after update`);
      }
      return updated;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: 'MYSQL_UPDATE_EXPERIMENT_RESULT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getReviewSummary(): Promise<ExperimentReviewCounts[]> {
    try {
      const rows = await this.operations.query<{
        experimentId: string;
        status: string | null;
        count: number;
      }>(
        `SELECT ${quoteIdentifier('experimentId', 'column name')}, ${quoteIdentifier('status', 'column name')}, COUNT(*) as count FROM ${formatTableName(TABLE_EXPERIMENT_RESULTS)} GROUP BY ${quoteIdentifier('experimentId', 'column name')}, ${quoteIdentifier('status', 'column name')}`,
      );

      const counts = new Map<string, ExperimentReviewCounts>();
      for (const row of rows) {
        let entry = counts.get(row.experimentId);
        if (!entry) {
          entry = { experimentId: row.experimentId, total: 0, needsReview: 0, reviewed: 0, complete: 0 };
          counts.set(row.experimentId, entry);
        }
        const count = Number(row.count);
        entry.total += count;
        if (row.status === 'needs-review') entry.needsReview += count;
        else if (row.status === 'reviewed') entry.reviewed += count;
        else if (row.status === 'complete') entry.complete += count;
      }

      return Array.from(counts.values());
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_GET_REVIEW_SUMMARY_FAILED',
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

      const conditions: string[] = [`${quoteIdentifier('experimentId', 'column name')} = ?`];
      const params: any[] = [args.experimentId];
      if (args.traceId) {
        conditions.push(`${quoteIdentifier('traceId', 'column name')} = ?`);
        params.push(args.traceId);
      }
      if (args.status) {
        conditions.push(`${quoteIdentifier('status', 'column name')} = ?`);
        params.push(args.status);
      }
      if (args.filters) {
        const { organizationId, projectId } = args.filters;
        if (organizationId !== undefined) {
          conditions.push(`${quoteIdentifier('organizationId', 'column name')} = ?`);
          params.push(organizationId);
        }
        if (projectId !== undefined) {
          conditions.push(`${quoteIdentifier('projectId', 'column name')} = ?`);
          params.push(projectId);
        }
      }

      const whereClause = {
        sql: ` WHERE ${conditions.join(' AND ')}`,
        args: params,
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

  async deleteExperimentResults(args: { experimentId: string; filters?: ExperimentTenancyFilters }): Promise<void> {
    try {
      // Tenancy predicate folded into the DELETE via a scoped parent subquery.
      // Silent no-op on mismatch.
      if (args.filters?.organizationId !== undefined || args.filters?.projectId !== undefined) {
        const tenancyConditions: string[] = [];
        const tenancyParams: any[] = [];
        if (args.filters?.organizationId !== undefined) {
          tenancyConditions.push(`${quoteIdentifier('organizationId', 'column name')} = ?`);
          tenancyParams.push(args.filters.organizationId);
        }
        if (args.filters?.projectId !== undefined) {
          tenancyConditions.push(`${quoteIdentifier('projectId', 'column name')} = ?`);
          tenancyParams.push(args.filters.projectId);
        }
        const parentWhere = ['id = ?', ...tenancyConditions].join(' AND ');
        await this.pool.execute(
          `DELETE FROM ${formatTableName(TABLE_EXPERIMENT_RESULTS)} WHERE ${quoteIdentifier('experimentId', 'column name')} IN (SELECT id FROM ${formatTableName(TABLE_EXPERIMENTS)} WHERE ${parentWhere})`,
          [args.experimentId, ...tenancyParams],
        );
        return;
      }
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
