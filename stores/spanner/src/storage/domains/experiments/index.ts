import { randomUUID } from 'node:crypto';
import type { Database } from '@google-cloud/spanner';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  calculatePagination,
  createStorageErrorId,
  ExperimentsStorage,
  normalizePerPage,
  TABLE_EXPERIMENTS,
  TABLE_EXPERIMENT_RESULTS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  AddExperimentResultInput,
  CreateExperimentInput,
  CreateIndexOptions,
  Experiment,
  ExperimentResult,
  ExperimentReviewCounts,
  ExperimentTenancyFilters,
  ListExperimentResultsInput,
  ListExperimentResultsOutput,
  ListExperimentsInput,
  ListExperimentsOutput,
  UpdateExperimentInput,
  UpdateExperimentResultInput,
} from '@mastra/core/storage';
import { SpannerDB, resolveSpannerConfig } from '../../db';
import type { SpannerDomainConfig } from '../../db';
import { quoteIdent } from '../../db/utils';
import { transformFromSpannerRow } from '../utils';

function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(value as string);
}

function rowToExperiment(row: Record<string, any>): Experiment {
  const t = transformFromSpannerRow<Record<string, any>>({ tableName: TABLE_EXPERIMENTS, row });
  return {
    id: String(t.id),
    name: t.name ?? undefined,
    description: t.description ?? undefined,
    metadata: t.metadata ?? undefined,
    datasetId: t.datasetId ?? null,
    datasetVersion: t.datasetVersion == null ? null : Number(t.datasetVersion),
    organizationId: (t.organizationId as string | null | undefined) ?? null,
    projectId: (t.projectId as string | null | undefined) ?? null,
    targetType: t.targetType,
    targetId: String(t.targetId),
    status: t.status,
    totalItems: Number(t.totalItems ?? 0),
    succeededCount: Number(t.succeededCount ?? 0),
    failedCount: Number(t.failedCount ?? 0),
    skippedCount: Number(t.skippedCount ?? 0),
    agentVersion: t.agentVersion ?? null,
    startedAt: t.startedAt == null ? null : toDate(t.startedAt),
    completedAt: t.completedAt == null ? null : toDate(t.completedAt),
    createdAt: toDate(t.createdAt),
    updatedAt: toDate(t.updatedAt),
  };
}

function rowToExperimentResult(row: Record<string, any>): ExperimentResult {
  const t = transformFromSpannerRow<Record<string, any>>({ tableName: TABLE_EXPERIMENT_RESULTS, row });
  return {
    id: String(t.id),
    experimentId: String(t.experimentId),
    itemId: String(t.itemId),
    itemDatasetVersion: t.itemDatasetVersion == null ? null : Number(t.itemDatasetVersion),
    organizationId: (t.organizationId as string | null | undefined) ?? null,
    projectId: (t.projectId as string | null | undefined) ?? null,
    input: t.input ?? null,
    output: t.output ?? null,
    groundTruth: t.groundTruth ?? null,
    error: (t.error ?? null) as ExperimentResult['error'],
    startedAt: toDate(t.startedAt),
    completedAt: toDate(t.completedAt),
    retryCount: Number(t.retryCount ?? 0),
    traceId: t.traceId ?? null,
    status: (t.status ?? null) as ExperimentResult['status'],
    tags: (t.tags ?? null) as string[] | null,
    comment: (t.comment ?? null) as string | null,
    toolMockReport: (t.toolMockReport ?? null) as ExperimentResult['toolMockReport'],
    createdAt: toDate(t.createdAt),
  };
}

/**
 * Spanner-backed storage for experiments (`mastra_experiments`) and their per-item
 * results (`mastra_experiment_results`). Both tables are keyed by `id`; results are
 * additionally constrained to one row per `(experimentId, itemId)`.
 */
export class ExperimentsSpanner extends ExperimentsStorage {
  private database: Database;
  private db: SpannerDB;
  private readonly skipDefaultIndexes?: boolean;
  private readonly indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_EXPERIMENTS, TABLE_EXPERIMENT_RESULTS] as const;

  constructor(config: SpannerDomainConfig) {
    super();
    const { database, indexes, skipDefaultIndexes, initMode } = resolveSpannerConfig(config);
    this.database = database;
    this.db = new SpannerDB({ database, skipDefaultIndexes, initMode });
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx => (ExperimentsSpanner.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  async init(): Promise<void> {
    await this.db.createTable({ tableName: TABLE_EXPERIMENTS, schema: TABLE_SCHEMAS[TABLE_EXPERIMENTS] });
    await this.db.createTable({ tableName: TABLE_EXPERIMENT_RESULTS, schema: TABLE_SCHEMAS[TABLE_EXPERIMENT_RESULTS] });
    // Backfill tenancy columns on pre-existing tables so older deployments
    // keep working when they upgrade in place.
    await this.db.alterTable({
      tableName: TABLE_EXPERIMENTS,
      schema: TABLE_SCHEMAS[TABLE_EXPERIMENTS],
      ifNotExists: ['organizationId', 'projectId'],
    });
    await this.db.alterTable({
      tableName: TABLE_EXPERIMENT_RESULTS,
      schema: TABLE_SCHEMAS[TABLE_EXPERIMENT_RESULTS],
      ifNotExists: ['comment', 'organizationId', 'projectId'],
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      {
        name: 'mastra_experiments_datasetid_idx',
        table: TABLE_EXPERIMENTS,
        columns: ['datasetId'],
      },
      {
        name: 'mastra_experiment_results_experimentid_idx',
        table: TABLE_EXPERIMENT_RESULTS,
        columns: ['experimentId', 'startedAt'],
      },
      {
        // One result per (experiment, item).
        name: 'mastra_experiment_results_exp_item_idx',
        table: TABLE_EXPERIMENT_RESULTS,
        columns: ['experimentId', 'itemId'],
        unique: true,
      },
      // Tenancy: leading-tenant indexes for multi-tenant scans (parity with datasets domain).
      {
        name: 'mastra_experiments_org_project_idx',
        table: TABLE_EXPERIMENTS,
        columns: ['organizationId', 'projectId'],
      },
      {
        name: 'mastra_experiment_results_org_project_idx',
        table: TABLE_EXPERIMENT_RESULTS,
        columns: ['organizationId', 'projectId'],
      },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.skipDefaultIndexes) return;
    await this.db.createIndexes(this.getDefaultIndexDefinitions());
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) return;
    await this.db.createIndexes(this.indexes);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_EXPERIMENT_RESULTS });
    await this.db.clearTable({ tableName: TABLE_EXPERIMENTS });
  }

  async createExperiment(input: CreateExperimentInput): Promise<Experiment> {
    try {
      const now = new Date();
      const id = input.id ?? randomUUID();
      const experiment: Experiment = {
        id,
        name: input.name ?? undefined,
        description: input.description ?? undefined,
        metadata: input.metadata ?? undefined,
        datasetId: input.datasetId ?? null,
        datasetVersion: input.datasetVersion ?? null,
        organizationId: input.organizationId ?? null,
        projectId: input.projectId ?? null,
        targetType: input.targetType,
        targetId: input.targetId,
        status: 'pending',
        totalItems: input.totalItems,
        succeededCount: 0,
        failedCount: 0,
        skippedCount: 0,
        agentVersion: input.agentVersion ?? null,
        startedAt: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      await this.db.insert({
        tableName: TABLE_EXPERIMENTS,
        record: {
          id,
          name: experiment.name ?? null,
          description: experiment.description ?? null,
          metadata: experiment.metadata ?? null,
          datasetId: experiment.datasetId,
          datasetVersion: experiment.datasetVersion,
          organizationId: experiment.organizationId,
          projectId: experiment.projectId,
          targetType: experiment.targetType,
          targetId: experiment.targetId,
          status: experiment.status,
          totalItems: experiment.totalItems,
          succeededCount: 0,
          failedCount: 0,
          skippedCount: 0,
          agentVersion: experiment.agentVersion,
          startedAt: null,
          completedAt: null,
          createdAt: now,
          updatedAt: now,
        },
      });
      return experiment;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'CREATE_EXPERIMENT', 'FAILED'),
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
          id: createStorageErrorId('SPANNER', 'UPDATE_EXPERIMENT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Experiment ${input.id} not found`,
          details: { id: input.id },
        });
      }

      const data: Record<string, any> = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.description !== undefined) data.description = input.description;
      if (input.metadata !== undefined) data.metadata = input.metadata;
      if (input.status !== undefined) data.status = input.status;
      if (input.totalItems !== undefined) data.totalItems = input.totalItems;
      if (input.succeededCount !== undefined) data.succeededCount = input.succeededCount;
      if (input.failedCount !== undefined) data.failedCount = input.failedCount;
      if (input.skippedCount !== undefined) data.skippedCount = input.skippedCount;
      if (input.startedAt !== undefined) data.startedAt = input.startedAt;
      if (input.completedAt !== undefined) data.completedAt = input.completedAt;
      data.updatedAt = new Date();

      await this.db.update({ tableName: TABLE_EXPERIMENTS, keys: { id: input.id }, data });

      const updated = await this.getExperimentById({ id: input.id });
      if (!updated) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'UPDATE_EXPERIMENT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Experiment ${input.id} not found`,
          details: { id: input.id },
        });
      }
      return updated;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'UPDATE_EXPERIMENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
        },
        error,
      );
    }
  }

  async getExperimentById(args: { id: string; filters?: ExperimentTenancyFilters }): Promise<Experiment | null> {
    try {
      const hasTenancy = args.filters?.organizationId !== undefined || args.filters?.projectId !== undefined;
      if (!hasTenancy) {
        const row = await this.db.load<Record<string, any>>({ tableName: TABLE_EXPERIMENTS, keys: { id: args.id } });
        return row ? rowToExperiment(row) : null;
      }
      const conditions: string[] = [`${quoteIdent('id', 'column name')} = @id`];
      const params: Record<string, any> = { id: args.id };
      if (args.filters?.organizationId !== undefined) {
        conditions.push(`${quoteIdent('organizationId', 'column name')} = @organizationId`);
        params.organizationId = args.filters.organizationId;
      }
      if (args.filters?.projectId !== undefined) {
        conditions.push(`${quoteIdent('projectId', 'column name')} = @projectId`);
        params.projectId = args.filters.projectId;
      }
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_EXPERIMENTS, 'table name')} WHERE ${conditions.join(' AND ')} LIMIT 1`,
        params,
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? rowToExperiment(row) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_EXPERIMENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: args.id },
        },
        error,
      );
    }
  }

  async listExperiments(args: ListExperimentsInput): Promise<ListExperimentsOutput> {
    const { page = 0, perPage: perPageInput } = args.pagination;
    const perPage = normalizePerPage(perPageInput, 100);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    try {
      const conditions: string[] = [];
      const params: Record<string, any> = {};
      if (args.datasetId !== undefined) {
        conditions.push(`${quoteIdent('datasetId', 'column name')} = @datasetId`);
        params.datasetId = args.datasetId;
      }
      if (args.targetType !== undefined) {
        conditions.push(`${quoteIdent('targetType', 'column name')} = @targetType`);
        params.targetType = args.targetType;
      }
      if (args.targetId !== undefined) {
        conditions.push(`${quoteIdent('targetId', 'column name')} = @targetId`);
        params.targetId = args.targetId;
      }
      if (args.agentVersion !== undefined) {
        conditions.push(`${quoteIdent('agentVersion', 'column name')} = @agentVersion`);
        params.agentVersion = args.agentVersion;
      }
      if (args.status !== undefined) {
        conditions.push(`${quoteIdent('status', 'column name')} = @status`);
        params.status = args.status;
      }
      if (args.filters) {
        const { organizationId, projectId } = args.filters;
        if (organizationId !== undefined) {
          conditions.push(`${quoteIdent('organizationId', 'column name')} = @organizationId`);
          params.organizationId = organizationId;
        }
        if (projectId !== undefined) {
          conditions.push(`${quoteIdent('projectId', 'column name')} = @projectId`);
          params.projectId = projectId;
        }
      }
      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const tableName = quoteIdent(TABLE_EXPERIMENTS, 'table name');

      const [countRows] = await this.database.run({
        sql: `SELECT COUNT(*) AS count FROM ${tableName} ${whereSql}`,
        params,
        json: true,
      });
      const total = Number((countRows as Array<{ count: number | string }>)[0]?.count ?? 0);
      if (total === 0) {
        return { experiments: [], pagination: { total: 0, page, perPage: perPageForResponse, hasMore: false } };
      }

      const limit = perPageInput === false ? total : perPage;
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${tableName} ${whereSql}
              ORDER BY ${quoteIdent('createdAt', 'column name')} DESC
              LIMIT @limit OFFSET @offset`,
        params: { ...params, limit, offset },
        json: true,
      });
      const experiments = (rows as Array<Record<string, any>>).map(rowToExperiment);
      return {
        experiments,
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
          id: createStorageErrorId('SPANNER', 'LIST_EXPERIMENTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteExperiment(args: { id: string; filters?: ExperimentTenancyFilters }): Promise<void> {
    try {
      // Atomic gate + cascade inside a single read-write transaction; tenancy
      // predicate folded into both DELETE DMLs. Silent no-op on mismatch.
      const tenancyConditions: string[] = [];
      const tenancyParams: Record<string, any> = {};
      if (args.filters?.organizationId !== undefined) {
        tenancyConditions.push(`${quoteIdent('organizationId', 'column name')} = @organizationId`);
        tenancyParams.organizationId = args.filters.organizationId;
      }
      if (args.filters?.projectId !== undefined) {
        tenancyConditions.push(`${quoteIdent('projectId', 'column name')} = @projectId`);
        tenancyParams.projectId = args.filters.projectId;
      }
      const gateWhere = [`${quoteIdent('id', 'column name')} = @id`, ...tenancyConditions].join(' AND ');

      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            const [gateRows] = await tx.run({
              sql: `SELECT ${quoteIdent('id', 'column name')} FROM ${quoteIdent(TABLE_EXPERIMENTS, 'table name')}
                    WHERE ${gateWhere} LIMIT 1`,
              params: { id: args.id, ...tenancyParams },
              json: true,
            });
            if (!Array.isArray(gateRows) || gateRows.length === 0) {
              await tx.commit();
              return;
            }
            const cascadeWhere = [
              `${quoteIdent('experimentId', 'column name')} = @id`,
              // Result rows carry the same organizationId/projectId as their parent,
              // so applying tenancy here makes the cascade itself tenant-scoped.
              ...tenancyConditions,
            ].join(' AND ');
            await tx.runUpdate({
              sql: `DELETE FROM ${quoteIdent(TABLE_EXPERIMENT_RESULTS, 'table name')} WHERE ${cascadeWhere}`,
              params: { id: args.id, ...tenancyParams },
            });
            await tx.runUpdate({
              sql: `DELETE FROM ${quoteIdent(TABLE_EXPERIMENTS, 'table name')} WHERE ${gateWhere}`,
              params: { id: args.id, ...tenancyParams },
            });
            await tx.commit();
          } catch (err) {
            await tx.rollback().catch(rollbackErr => {
              throw new AggregateError([err, rollbackErr], 'Transaction and rollback both failed');
            });
            throw err;
          }
        }),
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_EXPERIMENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: args.id },
        },
        error,
      );
    }
  }

  async addExperimentResult(input: AddExperimentResultInput): Promise<ExperimentResult> {
    try {
      const now = new Date();
      const id = input.id ?? randomUUID();
      const result: ExperimentResult = {
        id,
        experimentId: input.experimentId,
        itemId: input.itemId,
        itemDatasetVersion: input.itemDatasetVersion ?? null,
        organizationId: input.organizationId ?? null,
        projectId: input.projectId ?? null,
        input: input.input ?? null,
        output: input.output ?? null,
        groundTruth: input.groundTruth ?? null,
        error: input.error ?? null,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        retryCount: input.retryCount,
        traceId: input.traceId ?? null,
        status: input.status ?? null,
        tags: input.tags ?? null,
        toolMockReport: input.toolMockReport ?? null,
        createdAt: now,
      };
      await this.db.insert({
        tableName: TABLE_EXPERIMENT_RESULTS,
        record: {
          id,
          experimentId: result.experimentId,
          itemId: result.itemId,
          itemDatasetVersion: result.itemDatasetVersion,
          organizationId: result.organizationId,
          projectId: result.projectId,
          input: result.input,
          output: result.output,
          groundTruth: result.groundTruth,
          error: result.error,
          startedAt: result.startedAt,
          completedAt: result.completedAt,
          retryCount: result.retryCount,
          traceId: result.traceId,
          status: result.status,
          tags: result.tags,
          toolMockReport: result.toolMockReport,
          createdAt: now,
        },
      });
      return result;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'ADD_EXPERIMENT_RESULT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { experimentId: input.experimentId, itemId: input.itemId },
        },
        error,
      );
    }
  }

  async updateExperimentResult(input: UpdateExperimentResultInput): Promise<ExperimentResult> {
    try {
      if (input.status === undefined && input.tags === undefined && input.comment === undefined) {
        const existing = await this.getExperimentResultById({ id: input.id });
        // Honor the experimentId scope even on the no-op path: a result that
        // belongs to a different experiment must not be returned.
        if (!existing || (input.experimentId !== undefined && existing.experimentId !== input.experimentId)) {
          throw new MastraError({
            id: createStorageErrorId('SPANNER', 'UPDATE_EXPERIMENT_RESULT', 'NOT_FOUND'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            text: `Experiment result ${input.id} not found`,
            details: { id: input.id },
          });
        }
        return existing;
      }

      const setClauses: string[] = [];
      const params: Record<string, any> = { id: input.id };
      const types: Record<string, any> = {};
      if (input.status !== undefined) {
        setClauses.push(`${quoteIdent('status', 'column name')} = @status`);
        params.status = input.status;
        if (input.status === null) types.status = 'string';
      }
      if (input.tags !== undefined) {
        setClauses.push(`${quoteIdent('tags', 'column name')} = @tags`);
        params.tags = input.tags === null ? null : JSON.stringify(input.tags);
        types.tags = 'json';
      }
      if (input.comment !== undefined) {
        setClauses.push(`${quoteIdent('comment', 'column name')} = @comment`);
        params.comment = input.comment;
        if (input.comment === null) types.comment = 'string';
      }
      const whereClauses = [`${quoteIdent('id', 'column name')} = @id`];
      if (input.experimentId !== undefined) {
        whereClauses.push(`${quoteIdent('experimentId', 'column name')} = @experimentId`);
        params.experimentId = input.experimentId;
      }
      const rowCount = await this.db.runDml({
        sql: `UPDATE ${quoteIdent(TABLE_EXPERIMENT_RESULTS, 'table name')}
              SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`,
        params,
        types,
      });
      if (rowCount === 0) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'UPDATE_EXPERIMENT_RESULT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Experiment result ${input.id} not found`,
          details: { id: input.id },
        });
      }
      const updated = await this.getExperimentResultById({ id: input.id });
      if (!updated) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'UPDATE_EXPERIMENT_RESULT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Experiment result ${input.id} not found`,
          details: { id: input.id },
        });
      }
      return updated;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'UPDATE_EXPERIMENT_RESULT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: input.id },
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
      const hasTenancy = args.filters?.organizationId !== undefined || args.filters?.projectId !== undefined;
      if (!hasTenancy) {
        const row = await this.db.load<Record<string, any>>({
          tableName: TABLE_EXPERIMENT_RESULTS,
          keys: { id: args.id },
        });
        return row ? rowToExperimentResult(row) : null;
      }
      const conditions: string[] = [`${quoteIdent('id', 'column name')} = @id`];
      const params: Record<string, any> = { id: args.id };
      if (args.filters?.organizationId !== undefined) {
        conditions.push(`${quoteIdent('organizationId', 'column name')} = @organizationId`);
        params.organizationId = args.filters.organizationId;
      }
      if (args.filters?.projectId !== undefined) {
        conditions.push(`${quoteIdent('projectId', 'column name')} = @projectId`);
        params.projectId = args.filters.projectId;
      }
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_EXPERIMENT_RESULTS, 'table name')} WHERE ${conditions.join(' AND ')} LIMIT 1`,
        params,
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? rowToExperimentResult(row) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_EXPERIMENT_RESULT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: args.id },
        },
        error,
      );
    }
  }

  async listExperimentResults(args: ListExperimentResultsInput): Promise<ListExperimentResultsOutput> {
    const { page = 0, perPage: perPageInput } = args.pagination;
    const perPage = normalizePerPage(perPageInput, 100);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    try {
      const conditions: string[] = [`${quoteIdent('experimentId', 'column name')} = @experimentId`];
      const params: Record<string, any> = { experimentId: args.experimentId };
      if (args.traceId !== undefined) {
        conditions.push(`${quoteIdent('traceId', 'column name')} = @traceId`);
        params.traceId = args.traceId;
      }
      if (args.status !== undefined) {
        conditions.push(`${quoteIdent('status', 'column name')} = @status`);
        params.status = args.status;
      }
      if (args.filters) {
        const { organizationId, projectId } = args.filters;
        if (organizationId !== undefined) {
          conditions.push(`${quoteIdent('organizationId', 'column name')} = @organizationId`);
          params.organizationId = organizationId;
        }
        if (projectId !== undefined) {
          conditions.push(`${quoteIdent('projectId', 'column name')} = @projectId`);
          params.projectId = projectId;
        }
      }
      const whereSql = `WHERE ${conditions.join(' AND ')}`;
      const tableName = quoteIdent(TABLE_EXPERIMENT_RESULTS, 'table name');

      const [countRows] = await this.database.run({
        sql: `SELECT COUNT(*) AS count FROM ${tableName} ${whereSql}`,
        params,
        json: true,
      });
      const total = Number((countRows as Array<{ count: number | string }>)[0]?.count ?? 0);
      if (total === 0) {
        return { results: [], pagination: { total: 0, page, perPage: perPageForResponse, hasMore: false } };
      }

      const limit = perPageInput === false ? total : perPage;
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${tableName} ${whereSql}
              ORDER BY ${quoteIdent('startedAt', 'column name')} ASC
              LIMIT @limit OFFSET @offset`,
        params: { ...params, limit, offset },
        json: true,
      });
      const results = (rows as Array<Record<string, any>>).map(rowToExperimentResult);
      return {
        results,
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
          id: createStorageErrorId('SPANNER', 'LIST_EXPERIMENT_RESULTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { experimentId: args.experimentId },
        },
        error,
      );
    }
  }

  async deleteExperimentResults(args: { experimentId: string; filters?: ExperimentTenancyFilters }): Promise<void> {
    try {
      // Tenancy predicate folded directly into the DELETE DML. Silent no-op on
      // mismatch.
      if (args.filters?.organizationId !== undefined || args.filters?.projectId !== undefined) {
        const conditions: string[] = [`${quoteIdent('experimentId', 'column name')} = @experimentId`];
        const params: Record<string, any> = { experimentId: args.experimentId };
        if (args.filters?.organizationId !== undefined) {
          conditions.push(`${quoteIdent('organizationId', 'column name')} = @organizationId`);
          params.organizationId = args.filters.organizationId;
        }
        if (args.filters?.projectId !== undefined) {
          conditions.push(`${quoteIdent('projectId', 'column name')} = @projectId`);
          params.projectId = args.filters.projectId;
        }
        await this.db.runDml({
          sql: `DELETE FROM ${quoteIdent(TABLE_EXPERIMENT_RESULTS, 'table name')} WHERE ${conditions.join(' AND ')}`,
          params,
        });
        return;
      }
      await this.db.runDml({
        sql: `DELETE FROM ${quoteIdent(TABLE_EXPERIMENT_RESULTS, 'table name')}
              WHERE ${quoteIdent('experimentId', 'column name')} = @experimentId`,
        params: { experimentId: args.experimentId },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_EXPERIMENT_RESULTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { experimentId: args.experimentId },
        },
        error,
      );
    }
  }

  async getReviewSummary(): Promise<ExperimentReviewCounts[]> {
    try {
      const tableName = quoteIdent(TABLE_EXPERIMENT_RESULTS, 'table name');
      const statusCol = quoteIdent('status', 'column name');
      const [rows] = await this.database.run({
        sql: `SELECT ${quoteIdent('experimentId', 'column name')} AS experimentId,
                     COUNT(*) AS total,
                     SUM(CASE WHEN ${statusCol} = 'needs-review' THEN 1 ELSE 0 END) AS needsReview,
                     SUM(CASE WHEN ${statusCol} = 'reviewed' THEN 1 ELSE 0 END) AS reviewed,
                     SUM(CASE WHEN ${statusCol} = 'complete' THEN 1 ELSE 0 END) AS complete
              FROM ${tableName}
              GROUP BY ${quoteIdent('experimentId', 'column name')}`,
        json: true,
      });
      return (rows as Array<Record<string, any>>).map(r => ({
        experimentId: String(r.experimentId),
        total: Number(r.total ?? 0),
        needsReview: Number(r.needsReview ?? 0),
        reviewed: Number(r.reviewed ?? 0),
        complete: Number(r.complete ?? 0),
      }));
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_REVIEW_SUMMARY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
