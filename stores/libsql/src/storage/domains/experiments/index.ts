import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  TABLE_DATASET_ITEMS,
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
  ExperimentTenancyFilters,
  CreateExperimentInput,
  UpdateExperimentInput,
  AddExperimentResultInput,
  UpdateExperimentResultInput,
  UpsertExperimentResultInput,
  ListExperimentsInput,
  ListExperimentsOutput,
  ListExperimentResultsInput,
  ListExperimentResultsOutput,
  PruneOptions,
  PruneResult,
  RetentionTablesDescriptor,
  TableRetentionPolicy,
} from '@mastra/core/storage';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import type {
  SqliteClient as Client,
  SqliteInValue as InValue,
  SqliteTransaction as Transaction,
} from '../../db/client';
import { buildSelectColumns } from '../../db/utils';
import { withClientWriteLock } from '../../db/write-lock';
import { cutoffFor, runBatchedDelete } from '../../retention';
import { buildScopedWhere, tenancyWhere } from '../utils';

const DEFAULT_PRUNE_BATCH_SIZE = 1000;

export class ExperimentsLibSQL extends ExperimentsStorage {
  /**
   * An experiment is pruned as a whole unit: when `experiments.completedAt` is
   * older than the policy, the run and all its `experiment_results` rows are
   * deleted together (results cascade with their parent, matching
   * `deleteExperiment`). Results are not an independent retention key. NULL
   * `completedAt` (still running) is never pruned.
   */
  static override readonly retentionTables: RetentionTablesDescriptor = {
    experiments: { table: TABLE_EXPERIMENTS, column: 'completedAt', indexed: true },
  };

  #db: LibSQLDB;
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async #withPurgeBarrier<T>(
    experimentId: string,
    itemId: string,
    fn: (tx: Transaction, purgeMetadata: Record<string, unknown> | null) => Promise<T>,
  ): Promise<T> {
    return withClientWriteLock(this.#client, async () => {
      const tx = await this.#client.transaction('write');
      try {
        const purge = await tx.execute({
          sql: `SELECT json_extract(i."metadata", '$.__purged') AS "purged",
                       json_extract(i."metadata", '$.purgedAt') AS "purgedAt"
                FROM ${TABLE_EXPERIMENTS} e
                JOIN ${TABLE_DATASET_ITEMS} i ON i."datasetId" = e."datasetId" AND i."id" = ?
                WHERE e."id" = ? AND json_extract(i."metadata", '$.__purged') = 1
                LIMIT 1`,
          args: [itemId, experimentId],
        });
        const row = purge.rows[0];
        const purgeMetadata = row?.purged === 1 ? { __purged: true, purgedAt: row.purgedAt as string } : null;
        const result = await fn(tx, purgeMetadata);
        await tx.commit();
        return result;
      } catch (error) {
        await tx.rollback();
        throw error;
      } finally {
        tx.close();
      }
    });
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
      ifNotExists: [
        'agentVersion',
        'organizationId',
        'projectId',
        'provenance',
        'runnerAttestation',
        'experimentSetId',
        'comparisonId',
        'variantId',
        'trialIndex',
        'scorerIds',
      ],
    });
    await this.#db.alterTable({
      tableName: TABLE_EXPERIMENT_RESULTS,
      schema: EXPERIMENT_RESULTS_SCHEMA,
      ifNotExists: [
        'status',
        'tags',
        'comment',
        'toolMockReport',
        'metadata',
        'organizationId',
        'projectId',
        'attempt',
      ],
    });

    // Indexes — idempotent, safe to run on every init
    await this.#client.batch(
      [
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_experiments_datasetid ON "${TABLE_EXPERIMENTS}" ("datasetId")`,
          args: [],
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_experiments_grouping ON "${TABLE_EXPERIMENTS}" ("experimentSetId", "comparisonId", "variantId", "trialIndex")`,
          args: [],
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_experiment_results_experimentid ON "${TABLE_EXPERIMENT_RESULTS}" ("experimentId")`,
          args: [],
        },
        // The natural key includes `attempt` so external runners can record
        // repeated trials as separate rows (retry convergence happens per attempt).
        {
          sql: `DROP INDEX IF EXISTS idx_experiment_results_exp_item`,
          args: [],
        },
        {
          sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_experiment_results_exp_item_attempt ON "${TABLE_EXPERIMENT_RESULTS}" ("experimentId", "itemId", "attempt")`,
          args: [],
        },
        // Tenancy: leading-tenant indexes for multi-tenant scans (parity with datasets domain).
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_experiments_org_project ON "${TABLE_EXPERIMENTS}" ("organizationId", "projectId")`,
          args: [],
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_experiment_results_org_project ON "${TABLE_EXPERIMENT_RESULTS}" ("organizationId", "projectId")`,
          args: [],
        },
      ],
      'write',
    );
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_EXPERIMENT_RESULTS });
    await this.#db.deleteData({ tableName: TABLE_EXPERIMENTS });
  }

  /**
   * Prune whole experiments older than the `experiments` policy's `maxAge`.
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

    // Lazily create the anchor index on first prune (best-effort) so only
    // deployments that configure retention pay its write/disk overhead.
    try {
      await this.#db.ensureIndex({
        indexName: `idx_retention_${TABLE_EXPERIMENTS}_completedAt`,
        tableName: TABLE_EXPERIMENTS,
        column: 'completedAt',
      });
    } catch (error) {
      this.logger?.warn?.(`Failed to ensure retention index on ${TABLE_EXPERIMENTS}(completedAt):`, error);
    }

    const cutoff = cutoffFor(policy, 'timestamp');
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

  // Helper to transform row to Experiment
  private transformExperimentRow(row: Record<string, unknown>): Experiment {
    return {
      id: row.id as string,
      datasetId: (row.datasetId as string | null) ?? null,
      datasetVersion: row.datasetVersion != null ? (row.datasetVersion as number) : null,
      agentVersion: (row.agentVersion as string | null) ?? null,
      organizationId: (row.organizationId as string | null) ?? null,
      projectId: (row.projectId as string | null) ?? null,
      targetType: (row.targetType as Experiment['targetType']) ?? null,
      targetId: (row.targetId as string | null) ?? null,
      scorerIds: row.scorerIds ? safelyParseJSON(row.scorerIds) : null,
      name: (row.name as string) ?? undefined,
      description: (row.description as string) ?? undefined,
      metadata: row.metadata ? safelyParseJSON(row.metadata as string) : undefined,
      provenance: row.provenance ? safelyParseJSON(row.provenance as string) : null,
      runnerAttestation: row.runnerAttestation ? safelyParseJSON(row.runnerAttestation as string) : null,
      experimentSetId: (row.experimentSetId as string | null) ?? null,
      comparisonId: (row.comparisonId as string | null) ?? null,
      variantId: (row.variantId as string | null) ?? null,
      trialIndex: row.trialIndex != null ? (row.trialIndex as number) : null,
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
      organizationId: (row.organizationId as string | null) ?? null,
      projectId: (row.projectId as string | null) ?? null,
      input: safelyParseJSON(row.input as string),
      output: row.output ? safelyParseJSON(row.output as string) : null,
      groundTruth: row.groundTruth ? safelyParseJSON(row.groundTruth as string) : null,
      metadata: row.metadata ? safelyParseJSON(row.metadata as string) : null,
      error: row.error ? safelyParseJSON(row.error as string) : null,
      startedAt: ensureDate(row.startedAt as string | Date)!,
      completedAt: ensureDate(row.completedAt as string | Date)!,
      retryCount: row.retryCount as number,
      attempt: row.attempt != null ? Number(row.attempt) : 0,
      traceId: (row.traceId as string | null) ?? null,
      status: (row.status as ExperimentResult['status']) ?? null,
      tags: row.tags ? safelyParseJSON(row.tags as string) : null,
      comment: (row.comment as string | null) ?? null,
      toolMockReport: row.toolMockReport ? safelyParseJSON(row.toolMockReport as string) : null,
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
          organizationId: input.organizationId ?? null,
          projectId: input.projectId ?? null,
          targetType: input.targetType ?? null,
          targetId: input.targetId ?? null,
          scorerIds: input.scorerIds ?? null,
          name: input.name ?? null,
          description: input.description ?? null,
          metadata: input.metadata ?? null,
          provenance: input.provenance ?? null,
          runnerAttestation: input.runnerAttestation ?? null,
          experimentSetId: input.experimentSetId ?? null,
          comparisonId: input.comparisonId ?? null,
          variantId: input.variantId ?? null,
          trialIndex: input.trialIndex ?? null,
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
        organizationId: input.organizationId ?? null,
        projectId: input.projectId ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        scorerIds: input.scorerIds ?? null,
        name: input.name,
        description: input.description,
        metadata: input.metadata,
        provenance: input.provenance ?? null,
        runnerAttestation: input.runnerAttestation ?? null,
        experimentSetId: input.experimentSetId ?? null,
        comparisonId: input.comparisonId ?? null,
        variantId: input.variantId ?? null,
        trialIndex: input.trialIndex ?? null,
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

  async getExperimentById(args: { id: string; filters?: ExperimentTenancyFilters }): Promise<Experiment | null> {
    try {
      const scoped = buildScopedWhere('id', args.id, args.filters);
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_EXPERIMENTS)} FROM ${TABLE_EXPERIMENTS} WHERE ${scoped.sql}`,
        args: scoped.args,
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
      if (args.targetType) {
        conditions.push('targetType = ?');
        queryParams.push(args.targetType);
      }
      if (args.targetId) {
        conditions.push('targetId = ?');
        queryParams.push(args.targetId);
      }
      if (args.agentVersion) {
        conditions.push('agentVersion = ?');
        queryParams.push(args.agentVersion);
      }
      if (args.status) {
        conditions.push('status = ?');
        queryParams.push(args.status);
      }
      if (args.experimentSetId !== undefined) {
        conditions.push('experimentSetId = ?');
        queryParams.push(args.experimentSetId);
      }
      if (args.comparisonId !== undefined) {
        conditions.push('comparisonId = ?');
        queryParams.push(args.comparisonId);
      }
      if (args.variantId !== undefined) {
        conditions.push('variantId = ?');
        queryParams.push(args.variantId);
      }
      if (args.trialIndex !== undefined) {
        conditions.push('trialIndex = ?');
        queryParams.push(args.trialIndex);
      }
      if (args.filters) {
        const { organizationId, projectId } = args.filters;
        if (organizationId !== undefined) {
          conditions.push('organizationId = ?');
          queryParams.push(organizationId);
        }
        if (projectId !== undefined) {
          conditions.push('projectId = ?');
          queryParams.push(projectId);
        }
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

  async deleteExperiment(args: { id: string; filters?: ExperimentTenancyFilters }): Promise<void> {
    try {
      // Tenancy predicate folded into both DELETEs; batch runs as one transaction.
      // Silent no-op on mismatch.
      const parentScoped = buildScopedWhere('id', args.id, args.filters);
      const { conditions, params } = tenancyWhere(args.filters);
      const cascadeWhere = conditions.length
        ? `experimentId IN (SELECT id FROM ${TABLE_EXPERIMENTS} WHERE ${['id = ?', ...conditions].join(' AND ')})`
        : `experimentId = ?`;
      const cascadeArgs = conditions.length ? [args.id, ...params] : [args.id];

      await this.#client.batch(
        [
          { sql: `DELETE FROM ${TABLE_EXPERIMENT_RESULTS} WHERE ${cascadeWhere}`, args: cascadeArgs },
          { sql: `DELETE FROM ${TABLE_EXPERIMENTS} WHERE ${parentScoped.sql}`, args: parentScoped.args },
        ],
        'write',
      );
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

      const purgeMetadata = await this.#withPurgeBarrier(input.experimentId, input.itemId, async (tx, marker) => {
        await tx.execute({
          sql: `INSERT INTO ${TABLE_EXPERIMENT_RESULTS} (
            "id", "experimentId", "itemId", "itemDatasetVersion", "organizationId", "projectId",
            "input", "output", "groundTruth", "metadata", "error", "startedAt", "completedAt",
            "retryCount", "attempt", "traceId", "status", "tags", "toolMockReport", "createdAt"
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            id,
            input.experimentId,
            input.itemId,
            input.itemDatasetVersion ?? null,
            input.organizationId ?? null,
            input.projectId ?? null,
            JSON.stringify(marker ? null : input.input),
            JSON.stringify(marker ? null : (input.output ?? null)),
            JSON.stringify(marker ? null : (input.groundTruth ?? null)),
            JSON.stringify(marker ?? input.metadata ?? null),
            JSON.stringify(marker ? null : (input.error ?? null)),
            input.startedAt.toISOString(),
            input.completedAt.toISOString(),
            input.retryCount,
            input.attempt ?? 0,
            input.traceId ?? null,
            input.status ?? null,
            JSON.stringify(marker ? null : (input.tags ?? null)),
            JSON.stringify(marker ? null : (input.toolMockReport ?? null)),
            nowIso,
          ],
        });
        return marker;
      });

      return {
        id,
        experimentId: input.experimentId,
        itemId: input.itemId,
        itemDatasetVersion: input.itemDatasetVersion,
        organizationId: input.organizationId ?? null,
        projectId: input.projectId ?? null,
        input: purgeMetadata ? null : input.input,
        output: purgeMetadata ? null : input.output,
        groundTruth: purgeMetadata ? null : input.groundTruth,
        metadata: purgeMetadata ?? input.metadata ?? null,
        error: purgeMetadata ? null : input.error,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        retryCount: input.retryCount,
        attempt: input.attempt ?? 0,
        traceId: input.traceId ?? null,
        status: input.status ?? null,
        tags: purgeMetadata ? null : (input.tags ?? null),
        toolMockReport: purgeMetadata ? null : (input.toolMockReport ?? null),
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

  async upsertExperimentResult(input: UpsertExperimentResultInput): Promise<ExperimentResult> {
    try {
      const attempt = input.attempt ?? 0;
      return await this.#withPurgeBarrier(input.experimentId, input.itemId, async (tx, marker) => {
        const id = crypto.randomUUID();
        await tx.execute({
          sql: `INSERT INTO ${TABLE_EXPERIMENT_RESULTS} (
            "id", "experimentId", "itemId", "itemDatasetVersion", "organizationId", "projectId",
            "input", "output", "groundTruth", "metadata", "error", "startedAt", "completedAt",
            "retryCount", "attempt", "traceId", "status", "tags", "toolMockReport", "createdAt"
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT("experimentId", "itemId", "attempt") DO UPDATE SET
            "itemDatasetVersion" = excluded."itemDatasetVersion", "organizationId" = excluded."organizationId",
            "projectId" = excluded."projectId", "input" = excluded."input", "output" = excluded."output",
            "groundTruth" = excluded."groundTruth", "metadata" = excluded."metadata", "error" = excluded."error",
            "startedAt" = excluded."startedAt", "completedAt" = excluded."completedAt",
            "retryCount" = excluded."retryCount", "attempt" = excluded."attempt", "traceId" = excluded."traceId",
            "status" = excluded."status", "tags" = excluded."tags", "toolMockReport" = excluded."toolMockReport",
            "comment" = CASE WHEN ? THEN NULL ELSE "comment" END`,
          args: [
            id,
            input.experimentId,
            input.itemId,
            input.itemDatasetVersion ?? null,
            input.organizationId ?? null,
            input.projectId ?? null,
            JSON.stringify(marker ? null : input.input),
            JSON.stringify(marker ? null : (input.output ?? null)),
            JSON.stringify(marker ? null : (input.groundTruth ?? null)),
            JSON.stringify(marker ?? input.metadata ?? null),
            JSON.stringify(marker ? null : (input.error ?? null)),
            input.startedAt.toISOString(),
            input.completedAt.toISOString(),
            input.retryCount,
            attempt,
            input.traceId ?? null,
            input.status ?? null,
            JSON.stringify(marker ? null : (input.tags ?? null)),
            JSON.stringify(marker ? null : (input.toolMockReport ?? null)),
            new Date().toISOString(),
            Boolean(marker),
          ],
        });
        const result = await tx.execute({
          sql: `SELECT * FROM ${TABLE_EXPERIMENT_RESULTS} WHERE "experimentId" = ? AND "itemId" = ? AND COALESCE("attempt", 0) = ?`,
          args: [input.experimentId, input.itemId, attempt],
        });
        const row = result.rows[0];
        if (!row) {
          throw new MastraError({
            id: createStorageErrorId('LIBSQL', 'UPSERT_EXPERIMENT_RESULT', 'NOT_FOUND'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
          });
        }
        return this.transformExperimentResultRow(row as Record<string, unknown>);
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'UPSERT_EXPERIMENT_RESULT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async updateExperimentResult(input: UpdateExperimentResultInput): Promise<ExperimentResult> {
    try {
      const owner = await this.#client.execute({
        sql: `SELECT "experimentId", "itemId" FROM ${TABLE_EXPERIMENT_RESULTS} WHERE "id" = ?${input.experimentId ? ' AND "experimentId" = ?' : ''}`,
        args: input.experimentId ? [input.id, input.experimentId] : [input.id],
      });
      const ownerRow = owner.rows[0];
      if (!ownerRow) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_EXPERIMENT_RESULT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { resultId: input.id },
        });
      }

      return await this.#withPurgeBarrier(
        String(ownerRow.experimentId),
        String(ownerRow.itemId),
        async (tx, marker) => {
          const updateResult = await tx.execute({
            sql: `UPDATE ${TABLE_EXPERIMENT_RESULTS}
                SET "status" = CASE WHEN ? THEN ? ELSE "status" END,
                    "tags" = CASE WHEN ? THEN NULL WHEN ? THEN ? ELSE "tags" END,
                    "comment" = CASE WHEN ? THEN NULL WHEN ? THEN ? ELSE "comment" END
                WHERE "id" = ?${input.experimentId ? ' AND "experimentId" = ?' : ''}`,
            args: [
              input.status !== undefined,
              input.status ?? null,
              Boolean(marker),
              input.tags !== undefined,
              JSON.stringify(input.tags ?? null),
              Boolean(marker),
              input.comment !== undefined,
              input.comment ?? null,
              input.id,
              ...(input.experimentId ? [input.experimentId] : []),
            ],
          });
          if (updateResult.rowsAffected === 0) {
            throw new MastraError({
              id: createStorageErrorId('LIBSQL', 'UPDATE_EXPERIMENT_RESULT', 'NOT_FOUND'),
              domain: ErrorDomain.STORAGE,
              category: ErrorCategory.USER,
              details: { resultId: input.id },
            });
          }
          const result = await tx.execute({
            sql: `SELECT ${buildSelectColumns(TABLE_EXPERIMENT_RESULTS)} FROM ${TABLE_EXPERIMENT_RESULTS} WHERE "id" = ?`,
            args: [input.id],
          });
          return this.transformExperimentResultRow(result.rows[0] as Record<string, unknown>);
        },
      );
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

  async getExperimentResultById(args: {
    id: string;
    filters?: ExperimentTenancyFilters;
  }): Promise<ExperimentResult | null> {
    try {
      const scoped = buildScopedWhere('id', args.id, args.filters);
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_EXPERIMENT_RESULTS)} FROM ${TABLE_EXPERIMENT_RESULTS} WHERE ${scoped.sql}`,
        args: scoped.args,
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

      if (args.traceId) {
        conditions.push('traceId = ?');
        queryParams.push(args.traceId);
      }
      if (args.status) {
        conditions.push('status = ?');
        queryParams.push(args.status);
      }
      if (args.filters) {
        const { organizationId, projectId } = args.filters;
        if (organizationId !== undefined) {
          conditions.push('organizationId = ?');
          queryParams.push(organizationId);
        }
        if (projectId !== undefined) {
          conditions.push('projectId = ?');
          queryParams.push(projectId);
        }
      }

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

  async deleteExperimentResults(args: { experimentId: string; filters?: ExperimentTenancyFilters }): Promise<void> {
    try {
      // Tenancy predicate folded into the DELETE via a scoped parent subquery.
      // Silent no-op on mismatch.
      const { conditions, params } = tenancyWhere(args.filters);
      if (conditions.length) {
        await this.#client.execute({
          sql: `DELETE FROM ${TABLE_EXPERIMENT_RESULTS} WHERE experimentId IN (SELECT id FROM ${TABLE_EXPERIMENTS} WHERE ${['id = ?', ...conditions].join(' AND ')})`,
          args: [args.experimentId, ...params],
        });
        return;
      }

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
