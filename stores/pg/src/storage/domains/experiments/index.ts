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
  CreateExperimentInput,
  UpdateExperimentInput,
  AddExperimentResultInput,
  ListExperimentsInput,
  ListExperimentsOutput,
  ListExperimentResultsInput,
  ListExperimentResultsOutput,
  CreateIndexOptions,
} from '@mastra/core/storage';
import { PgDB, resolvePgConfig, generateTableSQL } from '../../db';
import type { PgDomainConfig } from '../../db';
import { getTableName, getSchemaName } from '../utils';

export class ExperimentsPG extends ExperimentsStorage {
  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_EXPERIMENTS, TABLE_EXPERIMENT_RESULTS] as const;

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
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
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
      targetType: row.targetType as Experiment['targetType'],
      targetId: row.targetId as string,
      status: row.status as Experiment['status'],
      totalItems: row.totalItems as number,
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
      input: safelyParseJSON(row.input),
      output: row.output ? safelyParseJSON(row.output) : null,
      groundTruth: row.groundTruth ? safelyParseJSON(row.groundTruth) : null,
      error: row.error ? safelyParseJSON(row.error) : null,
      startedAt: ensureDate(row.startedAtZ || row.startedAt)!,
      completedAt: ensureDate(row.completedAtZ || row.completedAt)!,
      retryCount: row.retryCount as number,
      traceId: (row.traceId as string | null) ?? null,
      createdAt: ensureDate(row.createdAtZ || row.createdAt)!,
    };
  }

  // --- Experiment CRUD ---

  async createExperiment(input: CreateExperimentInput): Promise<Experiment> {
    try {
      const id = input.id ?? crypto.randomUUID();
      const now = new Date();
      const nowIso = now.toISOString();

      await this.#db.insert({
        tableName: TABLE_EXPERIMENTS,
        record: {
          id,
          name: input.name ?? null,
          description: input.description ?? null,
          metadata: input.metadata ?? null,
          datasetId: input.datasetId ?? null,
          datasetVersion: input.datasetVersion ?? null,
          targetType: input.targetType,
          targetId: input.targetId,
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
        name: input.name,
        description: input.description,
        metadata: input.metadata,
        datasetId: input.datasetId ?? null,
        datasetVersion: input.datasetVersion ?? null,
        targetType: input.targetType,
        targetId: input.targetId,
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
      if (input.skippedCount !== undefined) {
        setClauses.push(`"skippedCount" = $${paramIndex++}`);
        values.push(input.skippedCount);
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

  async getExperimentById({ id }: { id: string }): Promise<Experiment | null> {
    try {
      const tableName = getTableName({ indexName: TABLE_EXPERIMENTS, schemaName: getSchemaName(this.#schema) });
      const result = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE "id" = $1`, [id]);
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

  async deleteExperiment({ id }: { id: string }): Promise<void> {
    try {
      const resultsTable = getTableName({
        indexName: TABLE_EXPERIMENT_RESULTS,
        schemaName: getSchemaName(this.#schema),
      });
      const experimentsTable = getTableName({ indexName: TABLE_EXPERIMENTS, schemaName: getSchemaName(this.#schema) });

      // Delete results first (FK semantics)
      await this.#db.client.none(`DELETE FROM ${resultsTable} WHERE "experimentId" = $1`, [id]);
      await this.#db.client.none(`DELETE FROM ${experimentsTable} WHERE "id" = $1`, [id]);
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
          input: input.input,
          output: input.output ?? null,
          groundTruth: input.groundTruth ?? null,
          error: input.error ?? null,
          startedAt: input.startedAt.toISOString(),
          completedAt: input.completedAt.toISOString(),
          retryCount: input.retryCount,
          traceId: input.traceId ?? null,
          createdAt: nowIso,
        },
      });

      return {
        id,
        experimentId: input.experimentId,
        itemId: input.itemId,
        itemDatasetVersion: input.itemDatasetVersion ?? null,
        input: input.input,
        output: input.output ?? null,
        groundTruth: input.groundTruth ?? null,
        error: input.error ?? null,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        retryCount: input.retryCount,
        traceId: input.traceId ?? null,
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

  async getExperimentResultById({ id }: { id: string }): Promise<ExperimentResult | null> {
    try {
      const tableName = getTableName({ indexName: TABLE_EXPERIMENT_RESULTS, schemaName: getSchemaName(this.#schema) });
      const result = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE "id" = $1`, [id]);
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

      const countResult = await this.#db.client.one(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE "experimentId" = $1`,
        [args.experimentId],
      );
      const total = parseInt(countResult.count, 10);

      if (total === 0) {
        return { results: [], pagination: { total: 0, page, perPage: perPageInput, hasMore: false } };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;

      const rows = await this.#db.client.manyOrNone(
        `SELECT * FROM ${tableName} WHERE "experimentId" = $1 ORDER BY "startedAt" ASC LIMIT $2 OFFSET $3`,
        [args.experimentId, limitValue, offset],
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

  async deleteExperimentResults({ experimentId }: { experimentId: string }): Promise<void> {
    try {
      const tableName = getTableName({ indexName: TABLE_EXPERIMENT_RESULTS, schemaName: getSchemaName(this.#schema) });
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

  // --- Clear ---

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_EXPERIMENT_RESULTS });
    await this.#db.clearTable({ tableName: TABLE_EXPERIMENTS });
  }
}
