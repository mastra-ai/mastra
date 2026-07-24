import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  TABLE_EXPERIMENTS,
  TABLE_EXPERIMENT_RESULTS,
  TABLE_SCHEMAS,
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
  ExperimentTenancyFilters,
  CreateExperimentInput,
  UpdateExperimentInput,
  AddExperimentResultInput,
  UpdateExperimentResultInput,
  ListExperimentsInput,
  ListExperimentsOutput,
  ListExperimentResultsInput,
  ListExperimentResultsOutput,
  CreateIndexOptions,
  TABLE_NAMES,
  PruneOptions,
  PruneResult,
  RetentionTablesDescriptor,
  TableRetentionPolicy,
} from '@mastra/core/storage';
import { PgDB, resolvePgConfig, generateTableSQL } from '../../db';
import type { PgDomainConfig } from '../../db';
import { cutoffFor, runBatchedDelete } from '../../retention';
import { getTableName, getSchemaName, tenancyWhere } from '../utils';

const DEFAULT_PRUNE_BATCH_SIZE = 1000;

export class ExperimentsPG extends ExperimentsStorage {
  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_EXPERIMENTS, TABLE_EXPERIMENT_RESULTS] as const;

  /**
   * Experiments prune as whole units: an aged experiment and its result rows go
   * together, mirroring `deleteExperiment`. Anchored on `completedAt` (not the
   * `completedAtZ` mirror, which carries a `DEFAULT NOW()` this domain never
   * overrides — it holds insert time even for running rows). `completedAt` is
   * written as a UTC ISO string and stays NULL while running, so
   * `completedAt < cutoff` is false for in-flight experiments.
   */
  static override readonly retentionTables: RetentionTablesDescriptor = {
    experiments: { table: TABLE_EXPERIMENTS, column: 'completedAt', indexed: true },
  };

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx => (ExperimentsPG.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  static getExportDDL(schemaName?: string): string[] {
    const statements: string[] = [];
    for (const tableName of ExperimentsPG.MANAGED_TABLES) {
      statements.push(
        generateTableSQL({
          tableName,
          schema: TABLE_SCHEMAS[tableName],
          schemaName,
          includeAllConstraints: true,
        }),
      );
    }
    return statements;
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_EXPERIMENTS, schema: EXPERIMENTS_SCHEMA });
    await this.#db.createTable({ tableName: TABLE_EXPERIMENT_RESULTS, schema: EXPERIMENT_RESULTS_SCHEMA });
    // Add columns introduced after initial schema for backwards compatibility
    await this.#db.alterTable({
      tableName: TABLE_EXPERIMENTS,
      schema: EXPERIMENTS_SCHEMA,
      ifNotExists: [
        'agentVersion',
        'organizationId',
        'projectId',
        'executionStatusCounts',
        'scorerStatusCounts',
        'thresholds',
      ],
    });
    await this.#db.alterTable({
      tableName: TABLE_EXPERIMENT_RESULTS,
      schema: EXPERIMENT_RESULTS_SCHEMA,
      ifNotExists: ['status', 'tags', 'toolMockReport', 'organizationId', 'projectId', 'executionStatus'],
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  /**
   * Lazily ensures a btree index exists on each configured policy's retention
   * anchor column so age-based `prune()` deletes stay fast on large tables.
   * Called from the prune path (not init) so only deployments that configure
   * retention pay the index's write/disk overhead. Best-effort: failures are
   * logged and pruning proceeds (correct, just slower).
   * Created even with `skipDefaultIndexes` — retention is an explicit opt-in,
   * so its supporting index is not part of the default index set.
   */
  private async ensureRetentionIndexes(policies: Record<string, TableRetentionPolicy>): Promise<void> {
    const prefix = this.#schema !== 'public' ? `${this.#schema}_` : '';
    for (const [key, entry] of Object.entries(ExperimentsPG.retentionTables)) {
      if (!entry.indexed || !policies[key]) continue;
      try {
        await this.#db.ensureIndex({
          indexName: `${prefix}mastra_${key}_retention_idx`,
          tableName: entry.table as TABLE_NAMES,
          column: entry.column,
        });
      } catch (error) {
        this.logger?.warn?.(`Failed to create retention index for ${entry.table}:`, error);
      }
    }
  }

  /**
   * Delete experiments whose `completedAt` is older than the policy's `maxAge`.
   *
   * Each batch selects up to `batchSize` aged experiments and deletes their
   * `experiment_results` rows and the experiment rows in one transaction —
   * mirroring `deleteExperiment` — so hitting `maxBatches`/`maxRows` or the
   * abort signal between batches never leaves a run hollow (parent kept,
   * results gone). NULL `completedAt` (still running) is excluded by the
   * `< cutoff` predicate. Bounds count whole experiments, not rows.
   */
  async prune(policies: Record<string, TableRetentionPolicy>, options?: PruneOptions): Promise<PruneResult[]> {
    const policy = policies['experiments'];
    if (!policy || options?.signal?.aborted) {
      return policy
        ? [
            { domain: 'experiments', table: TABLE_EXPERIMENT_RESULTS, deleted: 0, done: false },
            { domain: 'experiments', table: TABLE_EXPERIMENTS, deleted: 0, done: false },
          ]
        : [];
    }

    await this.ensureRetentionIndexes(policies);

    // `completedAt` is a naive TIMESTAMP holding UTC ISO strings, so bind the
    // cutoff as a UTC ISO string too — a Date would be serialized with the
    // session's local offset and compared against the wrong wall time.
    const rawCutoff = cutoffFor(policy, 'timestamp');
    const cutoff = rawCutoff instanceof Date ? rawCutoff.toISOString() : rawCutoff;
    const batchSize = policy.batchSize ?? DEFAULT_PRUNE_BATCH_SIZE;

    let childDeleted = 0;
    const parent = await runBatchedDelete({
      deleteBatch: async limit => {
        const { parents, children } = await this.#db.pruneUnitsBatch({
          parentTable: TABLE_EXPERIMENTS,
          parentKey: 'id',
          parentColumn: 'completedAt',
          childTable: TABLE_EXPERIMENT_RESULTS,
          childForeignKey: 'experimentId',
          cutoff,
          limit,
        });
        childDeleted += children;
        return parents;
      },
      batchSize,
      options,
    });

    return [
      { domain: 'experiments', table: TABLE_EXPERIMENT_RESULTS, deleted: childDeleted, done: parent.done },
      { domain: 'experiments', table: TABLE_EXPERIMENTS, deleted: parent.deleted, done: parent.done },
    ];
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      { name: 'idx_experiments_datasetid', table: TABLE_EXPERIMENTS, columns: ['datasetId'] },
      { name: 'idx_experiment_results_experimentid', table: TABLE_EXPERIMENT_RESULTS, columns: ['experimentId'] },
      {
        name: 'idx_experiment_results_exp_item',
        table: TABLE_EXPERIMENT_RESULTS,
        columns: ['experimentId', 'itemId'],
        unique: true,
      },
      // Tenancy: leading-tenant indexes for multi-tenant scans (parity with datasets domain).
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

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create default index ${indexDef.name}:`, error);
      }
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) return;
    for (const indexDef of this.#indexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  // --- Row transformers ---

  private transformExperimentRow(row: Record<string, any>): Experiment {
    return {
      id: row.id as string,
      name: (row.name as string) ?? undefined,
      description: (row.description as string) ?? undefined,
      metadata: row.metadata ? safelyParseJSON(row.metadata) : undefined,
      datasetId: (row.datasetId as string | null) ?? null,
      datasetVersion: row.datasetVersion != null ? (row.datasetVersion as number) : null,
      agentVersion: (row.agentVersion as string | null) ?? null,
      organizationId: (row.organizationId as string | null) ?? null,
      projectId: (row.projectId as string | null) ?? null,
      targetType: row.targetType as Experiment['targetType'],
      targetId: row.targetId as string,
      status: row.status as Experiment['status'],
      totalItems: row.totalItems as number,
      executionStatusCounts:
        row.executionStatusCounts != null
          ? safelyParseJSON(row.executionStatusCounts)
          : {
              completed: row.succeededCount as number,
              skipped: (row.skippedCount as number) ?? 0,
              error: row.failedCount as number,
              cancelled: 0,
            },
      scorerStatusCounts: row.scorerStatusCounts != null ? safelyParseJSON(row.scorerStatusCounts) : null,
      thresholds: row.thresholds != null ? safelyParseJSON(row.thresholds) : null,
      succeededCount: row.succeededCount as number,
      failedCount: row.failedCount as number,
      skippedCount: (row.skippedCount as number) ?? 0,
      startedAt: row.startedAt ? ensureDate(row.startedAtZ || row.startedAt)! : null,
      completedAt: row.completedAt ? ensureDate(row.completedAtZ || row.completedAt)! : null,
      createdAt: ensureDate(row.createdAtZ || row.createdAt)!,
      updatedAt: ensureDate(row.updatedAtZ || row.updatedAt)!,
    };
  }

  private transformExperimentResultRow(row: Record<string, any>): ExperimentResult {
    return {
      id: row.id as string,
      experimentId: row.experimentId as string,
      itemId: row.itemId as string,
      itemDatasetVersion: row.itemDatasetVersion != null ? (row.itemDatasetVersion as number) : null,
      organizationId: (row.organizationId as string | null) ?? null,
      projectId: (row.projectId as string | null) ?? null,
      input: safelyParseJSON(row.input),
      output: row.output ? safelyParseJSON(row.output) : null,
      groundTruth: row.groundTruth ? safelyParseJSON(row.groundTruth) : null,
      error: row.error ? safelyParseJSON(row.error) : null,
      executionStatus: (row.executionStatus as ExperimentResult['executionStatus']) ?? null,
      startedAt: ensureDate(row.startedAtZ || row.startedAt)!,
      completedAt: ensureDate(row.completedAtZ || row.completedAt)!,
      retryCount: row.retryCount as number,
      traceId: (row.traceId as string | null) ?? null,
      status: (row.status as ExperimentResult['status']) ?? null,
      tags: row.tags ? safelyParseJSON(row.tags) : null,
      toolMockReport: row.toolMockReport ? safelyParseJSON(row.toolMockReport) : null,
      createdAt: ensureDate(row.createdAtZ || row.createdAt)!,
    };
  }

  // --- Experiment CRUD ---

  async createExperiment(input: CreateExperimentInput): Promise<Experiment> {
    try {
      const id = input.id ?? crypto.randomUUID();
      const now = new Date();
      const nowIso = now.toISOString();
      const thresholds = (input.thresholds ?? []).map(binding => ({
        ...binding,
        threshold: typeof binding.threshold === 'number' ? binding.threshold : { ...binding.threshold },
      }));
      const executionStatusCounts = { completed: 0, skipped: 0, error: 0, cancelled: 0 };
      const scorerStatusCounts = { completed: 0, error: 0 };

      await this.#db.insert({
        tableName: TABLE_EXPERIMENTS,
        record: {
          id,
          name: input.name ?? null,
          description: input.description ?? null,
          metadata: input.metadata ?? null,
          datasetId: input.datasetId ?? null,
          datasetVersion: input.datasetVersion ?? null,
          agentVersion: input.agentVersion ?? null,
          organizationId: input.organizationId ?? null,
          projectId: input.projectId ?? null,
          targetType: input.targetType,
          targetId: input.targetId,
          status: 'pending',
          totalItems: input.totalItems,
          executionStatusCounts,
          scorerStatusCounts,
          thresholds,
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
        name: input.name,
        description: input.description,
        metadata: input.metadata,
        datasetId: input.datasetId ?? null,
        datasetVersion: input.datasetVersion ?? null,
        agentVersion: input.agentVersion ?? null,
        organizationId: input.organizationId ?? null,
        projectId: input.projectId ?? null,
        targetType: input.targetType,
        targetId: input.targetId,
        status: 'pending',
        totalItems: input.totalItems,
        executionStatusCounts,
        scorerStatusCounts,
        thresholds,
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
          id: createStorageErrorId('PG', 'CREATE_EXPERIMENT', 'FAILED'),
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
          id: createStorageErrorId('PG', 'UPDATE_EXPERIMENT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { experimentId: input.id },
        });
      }

      const hasLegacyCountUpdate =
        input.succeededCount !== undefined || input.failedCount !== undefined || input.skippedCount !== undefined;
      const executionStatusCounts =
        input.executionStatusCounts !== undefined
          ? input.executionStatusCounts
          : hasLegacyCountUpdate
            ? {
                completed: input.succeededCount ?? existing.succeededCount,
                skipped: input.skippedCount ?? existing.skippedCount,
                error: input.failedCount ?? existing.failedCount,
                cancelled: 0,
              }
            : undefined;

      const tableName = getTableName({ indexName: TABLE_EXPERIMENTS, schemaName: getSchemaName(this.#schema) });
      const now = new Date().toISOString();
      const setClauses: string[] = ['"updatedAt" = $1', '"updatedAtZ" = $2'];
      const values: any[] = [now, now];
      let paramIndex = 3;

      if (input.name !== undefined) {
        setClauses.push(`"name" = $${paramIndex++}`);
        values.push(input.name);
      }
      if (input.description !== undefined) {
        setClauses.push(`"description" = $${paramIndex++}`);
        values.push(input.description);
      }
      if (input.metadata !== undefined) {
        setClauses.push(`"metadata" = $${paramIndex++}`);
        values.push(JSON.stringify(input.metadata));
      }
      if (input.status !== undefined) {
        setClauses.push(`"status" = $${paramIndex++}`);
        values.push(input.status);
      }
      if (input.succeededCount !== undefined) {
        setClauses.push(`"succeededCount" = $${paramIndex++}`);
        values.push(input.succeededCount);
      }
      if (input.failedCount !== undefined) {
        setClauses.push(`"failedCount" = $${paramIndex++}`);
        values.push(input.failedCount);
      }
      if (input.totalItems !== undefined) {
        setClauses.push(`"totalItems" = $${paramIndex++}`);
        values.push(input.totalItems);
      }
      if (input.skippedCount !== undefined) {
        setClauses.push(`"skippedCount" = $${paramIndex++}`);
        values.push(input.skippedCount);
      }
      if (executionStatusCounts !== undefined) {
        setClauses.push(`"executionStatusCounts" = $${paramIndex++}`);
        values.push(executionStatusCounts === null ? null : JSON.stringify(executionStatusCounts));
      }
      if (input.scorerStatusCounts !== undefined) {
        setClauses.push(`"scorerStatusCounts" = $${paramIndex++}`);
        values.push(input.scorerStatusCounts === null ? null : JSON.stringify(input.scorerStatusCounts));
      }
      if (input.startedAt !== undefined) {
        setClauses.push(`"startedAt" = $${paramIndex++}`);
        values.push(input.startedAt?.toISOString() ?? null);
      }
      if (input.completedAt !== undefined) {
        setClauses.push(`"completedAt" = $${paramIndex++}`);
        values.push(input.completedAt?.toISOString() ?? null);
      }

      values.push(input.id);
      await this.#db.client.none(
        `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE "id" = $${paramIndex}`,
        values,
      );

      // Re-SELECT to get correctly transformed fields (timestamps, jsonb)
      const updated = await this.getExperimentById({ id: input.id });
      return updated!;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UPDATE_EXPERIMENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getExperimentById({
    id,
    filters,
  }: {
    id: string;
    filters?: ExperimentTenancyFilters;
  }): Promise<Experiment | null> {
    try {
      const tableName = getTableName({ indexName: TABLE_EXPERIMENTS, schemaName: getSchemaName(this.#schema) });
      const { conditions, params } = tenancyWhere(filters, 2);
      const whereSql = ['"id" = $1', ...conditions].join(' AND ');
      const result = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE ${whereSql}`, [id, ...params]);
      return result ? this.transformExperimentRow(result) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_EXPERIMENT', 'FAILED'),
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
      const tableName = getTableName({ indexName: TABLE_EXPERIMENTS, schemaName: getSchemaName(this.#schema) });

      // Build WHERE
      const conditions: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (args.datasetId) {
        conditions.push(`"datasetId" = $${paramIndex++}`);
        queryParams.push(args.datasetId);
      }
      if (args.targetType) {
        conditions.push(`"targetType" = $${paramIndex++}`);
        queryParams.push(args.targetType);
      }
      if (args.targetId) {
        conditions.push(`"targetId" = $${paramIndex++}`);
        queryParams.push(args.targetId);
      }
      if (args.agentVersion) {
        conditions.push(`"agentVersion" = $${paramIndex++}`);
        queryParams.push(args.agentVersion);
      }
      if (args.status) {
        conditions.push(`"status" = $${paramIndex++}`);
        queryParams.push(args.status);
      }
      if (args.filters) {
        const { organizationId, projectId } = args.filters;
        if (organizationId !== undefined) {
          conditions.push(`"organizationId" = $${paramIndex++}`);
          queryParams.push(organizationId);
        }
        if (projectId !== undefined) {
          conditions.push(`"projectId" = $${paramIndex++}`);
          queryParams.push(projectId);
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count
      const countResult = await this.#db.client.one(
        `SELECT COUNT(*) as count FROM ${tableName} ${whereClause}`,
        queryParams,
      );
      const total = parseInt(countResult.count, 10);

      if (total === 0) {
        return { experiments: [], pagination: { total: 0, page, perPage: perPageInput, hasMore: false } };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;

      const rows = await this.#db.client.manyOrNone(
        `SELECT * FROM ${tableName} ${whereClause} ORDER BY "createdAt" DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...queryParams, limitValue, offset],
      );

      return {
        experiments: (rows || []).map(row => this.transformExperimentRow(row)),
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
          id: createStorageErrorId('PG', 'LIST_EXPERIMENTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteExperiment({ id, filters }: { id: string; filters?: ExperimentTenancyFilters }): Promise<void> {
    try {
      const resultsTable = getTableName({
        indexName: TABLE_EXPERIMENT_RESULTS,
        schemaName: getSchemaName(this.#schema),
      });
      const experimentsTable = getTableName({ indexName: TABLE_EXPERIMENTS, schemaName: getSchemaName(this.#schema) });

      // Tenancy gate + cascade run in a single transaction with SELECT ... FOR UPDATE,
      // so a concurrent delete/recreate cannot let a scoped delete hit another tenant's row.
      // Silent no-op on tenancy mismatch (does not throw).
      const { conditions, params } = tenancyWhere(filters, 2);
      const gateSql = `SELECT "id" FROM ${experimentsTable} WHERE ${['"id" = $1', ...conditions].join(' AND ')} FOR UPDATE`;

      await this.#db.client.tx(async t => {
        const parent = await t.oneOrNone(gateSql, [id, ...params]);
        if (!parent) return;
        await t.none(`DELETE FROM ${resultsTable} WHERE "experimentId" = $1`, [id]);
        await t.none(`DELETE FROM ${experimentsTable} WHERE "id" = $1`, [id]);
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_EXPERIMENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // --- Experiment results ---

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
          organizationId: input.organizationId ?? null,
          projectId: input.projectId ?? null,
          input: input.input,
          output: input.output ?? null,
          groundTruth: input.groundTruth ?? null,
          error: input.error ?? null,
          executionStatus: input.executionStatus ?? null,
          startedAt: input.startedAt.toISOString(),
          completedAt: input.completedAt.toISOString(),
          retryCount: input.retryCount,
          traceId: input.traceId ?? null,
          status: input.status ?? null,
          tags: input.tags ?? null,
          toolMockReport: input.toolMockReport ?? null,
          createdAt: nowIso,
        },
      });

      return {
        id,
        experimentId: input.experimentId,
        itemId: input.itemId,
        itemDatasetVersion: input.itemDatasetVersion ?? null,
        organizationId: input.organizationId ?? null,
        projectId: input.projectId ?? null,
        input: input.input,
        output: input.output ?? null,
        groundTruth: input.groundTruth ?? null,
        error: input.error ?? null,
        executionStatus: input.executionStatus ?? null,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        retryCount: input.retryCount,
        traceId: input.traceId ?? null,
        status: input.status ?? null,
        tags: input.tags ?? null,
        toolMockReport: input.toolMockReport ?? null,
        createdAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'ADD_EXPERIMENT_RESULT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async updateExperimentResult(input: UpdateExperimentResultInput): Promise<ExperimentResult> {
    try {
      const tableName = getTableName({ indexName: TABLE_EXPERIMENT_RESULTS, schemaName: getSchemaName(this.#schema) });
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (input.status !== undefined) {
        setClauses.push(`"status" = $${paramIndex++}`);
        values.push(input.status);
      }
      if (input.tags !== undefined) {
        setClauses.push(`"tags" = $${paramIndex++}`);
        values.push(JSON.stringify(input.tags));
      }

      if (setClauses.length === 0) {
        const existing = await this.getExperimentResultById({ id: input.id });
        if (!existing) {
          throw new MastraError({
            id: createStorageErrorId('PG', 'UPDATE_EXPERIMENT_RESULT', 'NOT_FOUND'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { resultId: input.id },
          });
        }
        return existing;
      }

      values.push(input.id);
      let whereClause = `"id" = $${paramIndex}`;
      if (input.experimentId) {
        paramIndex++;
        values.push(input.experimentId);
        whereClause += ` AND "experimentId" = $${paramIndex}`;
      }
      const row = await this.#db.client.oneOrNone(
        `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE ${whereClause} RETURNING *`,
        values,
      );

      if (!row) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'UPDATE_EXPERIMENT_RESULT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { resultId: input.id },
        });
      }

      return this.transformExperimentResultRow(row);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UPDATE_EXPERIMENT_RESULT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getExperimentResultById({
    id,
    filters,
  }: {
    id: string;
    filters?: ExperimentTenancyFilters;
  }): Promise<ExperimentResult | null> {
    try {
      const tableName = getTableName({ indexName: TABLE_EXPERIMENT_RESULTS, schemaName: getSchemaName(this.#schema) });
      const { conditions, params } = tenancyWhere(filters, 2);
      const whereSql = ['"id" = $1', ...conditions].join(' AND ');
      const result = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE ${whereSql}`, [id, ...params]);
      return result ? this.transformExperimentResultRow(result) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_EXPERIMENT_RESULT', 'FAILED'),
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
      const tableName = getTableName({ indexName: TABLE_EXPERIMENT_RESULTS, schemaName: getSchemaName(this.#schema) });

      const conditions: string[] = ['"experimentId" = $1'];
      const queryParams: any[] = [args.experimentId];
      let paramIndex = 2;

      if (args.traceId) {
        conditions.push(`"traceId" = $${paramIndex++}`);
        queryParams.push(args.traceId);
      }
      if (args.status) {
        conditions.push(`"status" = $${paramIndex++}`);
        queryParams.push(args.status);
      }
      if (args.filters) {
        const { organizationId, projectId } = args.filters;
        if (organizationId !== undefined) {
          conditions.push(`"organizationId" = $${paramIndex++}`);
          queryParams.push(organizationId);
        }
        if (projectId !== undefined) {
          conditions.push(`"projectId" = $${paramIndex++}`);
          queryParams.push(projectId);
        }
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const countResult = await this.#db.client.one(
        `SELECT COUNT(*) as count FROM ${tableName} ${whereClause}`,
        queryParams,
      );
      const total = parseInt(countResult.count, 10);

      if (total === 0) {
        return { results: [], pagination: { total: 0, page, perPage: perPageInput, hasMore: false } };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;

      const rows = await this.#db.client.manyOrNone(
        `SELECT * FROM ${tableName} ${whereClause} ORDER BY "startedAt" ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...queryParams, limitValue, offset],
      );

      return {
        results: (rows || []).map(row => this.transformExperimentResultRow(row)),
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
          id: createStorageErrorId('PG', 'LIST_EXPERIMENT_RESULTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteExperimentResults({
    experimentId,
    filters,
  }: {
    experimentId: string;
    filters?: ExperimentTenancyFilters;
  }): Promise<void> {
    try {
      const tableName = getTableName({ indexName: TABLE_EXPERIMENT_RESULTS, schemaName: getSchemaName(this.#schema) });
      const experimentsTable = getTableName({ indexName: TABLE_EXPERIMENTS, schemaName: getSchemaName(this.#schema) });

      // Atomic gate + cascade under SELECT ... FOR UPDATE. Silent no-op on
      // tenancy mismatch.
      if (filters?.organizationId !== undefined || filters?.projectId !== undefined) {
        const { conditions, params } = tenancyWhere(filters, 2);
        const gateSql = `SELECT "id" FROM ${experimentsTable} WHERE ${['"id" = $1', ...conditions].join(' AND ')} FOR UPDATE`;

        await this.#db.client.tx(async t => {
          const parent = await t.oneOrNone(gateSql, [experimentId, ...params]);
          if (!parent) return;
          await t.none(`DELETE FROM ${tableName} WHERE "experimentId" = $1`, [experimentId]);
        });
        return;
      }

      await this.#db.client.none(`DELETE FROM ${tableName} WHERE "experimentId" = $1`, [experimentId]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_EXPERIMENT_RESULTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // --- Aggregation ---

  async getReviewSummary(): Promise<ExperimentReviewCounts[]> {
    try {
      const tableName = getTableName({ indexName: TABLE_EXPERIMENT_RESULTS, schemaName: getSchemaName(this.#schema) });
      const rows = await this.#db.client.manyOrNone(
        `SELECT
          "experimentId",
          COUNT(*)::int as total,
          SUM(CASE WHEN status = 'needs-review' THEN 1 ELSE 0 END)::int as "needsReview",
          SUM(CASE WHEN status = 'reviewed' THEN 1 ELSE 0 END)::int as reviewed,
          SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END)::int as complete
        FROM ${tableName}
        GROUP BY "experimentId"`,
      );

      return (rows || []).map(row => ({
        experimentId: row.experimentId as string,
        total: Number(row.total ?? 0),
        needsReview: Number(row.needsReview ?? 0),
        reviewed: Number(row.reviewed ?? 0),
        complete: Number(row.complete ?? 0),
      }));
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_REVIEW_SUMMARY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // --- Clear ---

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_EXPERIMENT_RESULTS });
    await this.#db.clearTable({ tableName: TABLE_EXPERIMENTS });
  }
}
