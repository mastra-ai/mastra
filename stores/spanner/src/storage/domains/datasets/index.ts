import { randomUUID } from 'node:crypto';
import type { Database, Transaction } from '@google-cloud/spanner';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  calculatePagination,
  createStorageErrorId,
  DatasetsStorage,
  normalizePerPage,
  TABLE_DATASETS,
  TABLE_DATASET_ITEMS,
  TABLE_DATASET_VERSIONS,
  TABLE_EXPERIMENTS,
  TABLE_EXPERIMENT_RESULTS,
  TABLE_SCHEMAS,
  hasErrorCode,
} from '@mastra/core/storage';
import type {
  AddDatasetItemInput,
  BatchDeleteItemsInput,
  BatchInsertItemsInput,
  CreateDatasetInput,
  CreateIndexOptions,
  DatasetItem,
  DatasetItemRow,
  DatasetRecord,
  DatasetTenancyFilters,
  DatasetVersion,
  ListDatasetItemsInput,
  ListDatasetItemsOutput,
  ListDatasetsInput,
  ListDatasetsOutput,
  ListDatasetVersionsInput,
  ListDatasetVersionsOutput,
  UpdateDatasetInput,
  UpdateDatasetItemInput,
  DeleteDatasetItemInput,
} from '@mastra/core/storage';
import { SpannerDB, resolveSpannerConfig } from '../../db';
import type { SpannerDomainConfig } from '../../db';
import { quoteIdent } from '../../db/utils';
import { transformFromSpannerRow } from '../utils';

function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(value as string);
}

function rowToDataset(row: Record<string, any>): DatasetRecord {
  const t = transformFromSpannerRow<Record<string, any>>({ tableName: TABLE_DATASETS, row });
  return {
    id: String(t.id),
    name: String(t.name),
    description: t.description ?? undefined,
    metadata: t.metadata ?? undefined,
    inputSchema: t.inputSchema ?? undefined,
    groundTruthSchema: t.groundTruthSchema ?? undefined,
    requestContextSchema: t.requestContextSchema ?? undefined,
    tags: t.tags ?? null,
    targetType: t.targetType ?? null,
    targetIds: t.targetIds ?? null,
    scorerIds: t.scorerIds ?? null,
    version: Number(t.version ?? 0),
    organizationId: (t.organizationId as string | null | undefined) ?? null,
    projectId: (t.projectId as string | null | undefined) ?? null,
    candidateKey: (t.candidateKey as string | null | undefined) ?? null,
    candidateId: (t.candidateId as string | null | undefined) ?? null,
    createdAt: toDate(t.createdAt),
    updatedAt: toDate(t.updatedAt),
  };
}

function rowToItem(row: Record<string, any>): DatasetItem {
  const t = transformFromSpannerRow<Record<string, any>>({ tableName: TABLE_DATASET_ITEMS, row });
  return {
    id: String(t.id),
    datasetId: String(t.datasetId),
    datasetVersion: Number(t.datasetVersion),
    externalId: (t.externalId as string | null | undefined) ?? null,
    organizationId: (t.organizationId as string | null | undefined) ?? null,
    projectId: (t.projectId as string | null | undefined) ?? null,
    input: t.input,
    groundTruth: t.groundTruth ?? undefined,
    expectedTrajectory: t.expectedTrajectory ?? undefined,
    toolMocks: t.toolMocks ?? undefined,
    requestContext: t.requestContext ?? undefined,
    metadata: t.metadata ?? undefined,
    source: t.source ?? undefined,
    createdAt: toDate(t.createdAt),
    updatedAt: toDate(t.updatedAt),
  };
}

function rowToItemRow(row: Record<string, any>): DatasetItemRow {
  const t = transformFromSpannerRow<Record<string, any>>({ tableName: TABLE_DATASET_ITEMS, row });
  return {
    ...rowToItem(row),
    validTo: t.validTo == null ? null : Number(t.validTo),
    isDeleted: Boolean(t.isDeleted),
  };
}

function rowToVersion(row: Record<string, any>): DatasetVersion {
  const t = transformFromSpannerRow<Record<string, any>>({ tableName: TABLE_DATASET_VERSIONS, row });
  return {
    id: String(t.id),
    datasetId: String(t.datasetId),
    version: Number(t.version),
    createdAt: toDate(t.createdAt),
  };
}

/**
 * Spanner-backed storage for evaluation datasets, their items (SCD-2 versioned),
 * and version snapshots.
 *
 * Items use slowly-changing-dimension type-2 bookkeeping: each item id can have
 * many rows keyed by `(id, datasetVersion)`. The "current" row is the one with
 * `validTo IS NULL`; a live item additionally has `isDeleted = false`, a deleted
 * item has a tombstone row with `isDeleted = true`. Every item mutation bumps the
 * parent dataset's `version` once (batch ops bump once for the whole batch) and
 * records a `mastra_dataset_versions` snapshot. All mutations run in a single
 * Spanner read-write transaction so the version counter, row close-out, and new
 * row never drift.
 */
export class DatasetsSpanner extends DatasetsStorage {
  private database: Database;
  private db: SpannerDB;
  private readonly skipDefaultIndexes?: boolean;
  private readonly indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_DATASETS, TABLE_DATASET_ITEMS, TABLE_DATASET_VERSIONS] as const;

  constructor(config: SpannerDomainConfig) {
    super();
    const { database, indexes, skipDefaultIndexes, initMode } = resolveSpannerConfig(config);
    this.database = database;
    this.db = new SpannerDB({ database, skipDefaultIndexes, initMode });
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx => (DatasetsSpanner.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  async init(): Promise<void> {
    await this.db.createTable({ tableName: TABLE_DATASETS, schema: TABLE_SCHEMAS[TABLE_DATASETS] });
    await this.db.createTable({ tableName: TABLE_DATASET_ITEMS, schema: TABLE_SCHEMAS[TABLE_DATASET_ITEMS] });
    await this.db.createTable({ tableName: TABLE_DATASET_VERSIONS, schema: TABLE_SCHEMAS[TABLE_DATASET_VERSIONS] });
    // Backfill tenancy + candidate identity columns on pre-existing tables so
    // older deployments keep working when they upgrade in place.
    await this.db.alterTable({
      tableName: TABLE_DATASETS,
      schema: TABLE_SCHEMAS[TABLE_DATASETS],
      ifNotExists: [
        'organizationId',
        'projectId',
        'candidateKey',
        'candidateId',
        'targetType',
        'targetIds',
        'scorerIds',
      ],
    });
    await this.db.alterTable({
      tableName: TABLE_DATASET_ITEMS,
      schema: TABLE_SCHEMAS[TABLE_DATASET_ITEMS],
      ifNotExists: ['organizationId', 'projectId', 'externalId'],
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      {
        // listItems / getItemsByVersion: filter current rows by dataset.
        name: 'mastra_dataset_items_dataset_validto_idx',
        table: TABLE_DATASET_ITEMS,
        columns: ['datasetId', 'validTo'],
      },
      {
        // getItemsByVersion time-travel: datasetId + datasetVersion.
        name: 'mastra_dataset_items_dataset_version_idx',
        table: TABLE_DATASET_ITEMS,
        columns: ['datasetId', 'datasetVersion'],
      },
      {
        name: 'mastra_dataset_items_dataset_externalid_version_idx',
        table: TABLE_DATASET_ITEMS,
        columns: ['datasetId', 'externalId', 'datasetVersion'],
      },
      {
        // Unique invariant: one snapshot row per (datasetId, version). The DESC
        // ordering also serves listDatasetVersions' newest-first scan.
        name: 'mastra_dataset_versions_dataset_version_idx',
        table: TABLE_DATASET_VERSIONS,
        columns: ['datasetId', 'version DESC'],
        unique: true,
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
    await this.db.clearTable({ tableName: TABLE_DATASET_VERSIONS });
    await this.db.clearTable({ tableName: TABLE_DATASET_ITEMS });
    await this.db.clearTable({ tableName: TABLE_DATASETS });
  }

  private async experimentTablesExist(): Promise<boolean> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES
              WHERE TABLE_SCHEMA = "" AND TABLE_NAME IN (@a, @b)`,
        params: { a: TABLE_EXPERIMENTS, b: TABLE_EXPERIMENT_RESULTS },
        json: true,
      });
      const row = rows?.[0] as { c?: number | string } | undefined;
      return Number(row?.c ?? 0) === 2;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // Dataset CRUD
  // ==========================================================================

  async createDataset(input: CreateDatasetInput): Promise<DatasetRecord> {
    try {
      const now = new Date();
      const id = input.id ?? randomUUID();
      if (input.id !== undefined) this.validateCallerDefinedDatasetId(input.id);
      const record: DatasetRecord = {
        id,
        name: input.name,
        description: input.description ?? undefined,
        metadata: input.metadata ?? undefined,
        inputSchema: input.inputSchema ?? undefined,
        groundTruthSchema: input.groundTruthSchema ?? undefined,
        requestContextSchema: input.requestContextSchema ?? undefined,
        tags: null,
        targetType: input.targetType ?? null,
        targetIds: input.targetIds ?? null,
        scorerIds: input.scorerIds ?? null,
        version: 0,
        organizationId: input.organizationId ?? null,
        projectId: input.projectId ?? null,
        candidateKey: input.candidateKey ?? null,
        candidateId: input.candidateId ?? null,
        createdAt: now,
        updatedAt: now,
      };
      await this.db.insert({
        tableName: TABLE_DATASETS,
        record: {
          id,
          name: record.name,
          description: record.description ?? null,
          metadata: record.metadata ?? null,
          inputSchema: record.inputSchema ?? null,
          groundTruthSchema: record.groundTruthSchema ?? null,
          requestContextSchema: record.requestContextSchema ?? null,
          tags: record.tags,
          targetType: record.targetType,
          targetIds: record.targetIds,
          scorerIds: record.scorerIds,
          version: 0,
          organizationId: record.organizationId,
          projectId: record.projectId,
          candidateKey: record.candidateKey,
          candidateId: record.candidateId,
          createdAt: now,
          updatedAt: now,
        },
      });
      return record;
    } catch (error) {
      if (input.id !== undefined && hasErrorCode(error, new Set([6, 'ALREADY_EXISTS']))) {
        const existing = await this.getDatasetById({ id: input.id });
        if (existing) return this.resolveExistingDataset(existing, { ...input, id: input.id });
      }
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'CREATE_DATASET', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getDatasetById(args: { id: string; filters?: DatasetTenancyFilters }): Promise<DatasetRecord | null> {
    try {
      const hasTenancy = args.filters?.organizationId !== undefined || args.filters?.projectId !== undefined;
      if (!hasTenancy) {
        const row = await this.db.load<Record<string, any>>({ tableName: TABLE_DATASETS, keys: { id: args.id } });
        return row ? rowToDataset(row) : null;
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
        sql: `SELECT * FROM ${quoteIdent(TABLE_DATASETS, 'table name')} WHERE ${conditions.join(' AND ')} LIMIT 1`,
        params,
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? rowToDataset(row) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_DATASET', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: args.id },
        },
        error,
      );
    }
  }

  protected async _doUpdateDataset(args: UpdateDatasetInput): Promise<DatasetRecord> {
    try {
      const data: Record<string, any> = {};
      if (args.name !== undefined) data.name = args.name;
      if (args.description !== undefined) data.description = args.description;
      if (args.metadata !== undefined) data.metadata = args.metadata;
      if (args.inputSchema !== undefined) data.inputSchema = args.inputSchema;
      if (args.groundTruthSchema !== undefined) data.groundTruthSchema = args.groundTruthSchema;
      if (args.requestContextSchema !== undefined) data.requestContextSchema = args.requestContextSchema;
      if (args.tags !== undefined) data.tags = args.tags;
      if (args.targetType !== undefined) data.targetType = args.targetType;
      if (args.targetIds !== undefined) data.targetIds = args.targetIds;
      if (args.scorerIds !== undefined) data.scorerIds = args.scorerIds;
      data.updatedAt = new Date();

      await this.db.update({ tableName: TABLE_DATASETS, keys: { id: args.id }, data });

      const updated = await this.getDatasetById({ id: args.id, filters: args.filters });
      if (!updated) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'UPDATE_DATASET', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Dataset ${args.id} not found`,
          details: { id: args.id },
        });
      }
      return updated;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'UPDATE_DATASET', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: args.id },
        },
        error,
      );
    }
  }

  async deleteDataset(args: { id: string; filters?: DatasetTenancyFilters }): Promise<void> {
    try {
      // Atomic gate + cascade inside a single read-write transaction. The
      // gate SELECT locks the parent row within the tx, and the tenancy
      // predicate is folded into the parent DELETE, so a concurrent
      // delete/recreate under a different tenant cannot let a scoped delete
      // hit another tenant's row. Silent no-op on mismatch.
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
      const scopedWhere = [`${quoteIdent('id', 'column name')} = @id`, ...tenancyConditions].join(' AND ');

      // Probe for experiment tables outside the transaction. Once any statement
      // fails inside a Spanner read-write transaction, the transaction is left
      // in a state where subsequent statements can't be trusted to run (the
      // batch-DML contract halts on the first error, and a client-side try/catch
      // around a DML doesn't put the tx back into a usable shape). Checking
      // existence up front avoids running detach DMLs against missing tables.
      const experimentTablesExist = await this.experimentTablesExist();

      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            const [rows] = await tx.run({
              sql: `SELECT ${quoteIdent('id', 'column name')} FROM ${quoteIdent(TABLE_DATASETS, 'table name')} WHERE ${scopedWhere}`,
              params: { id: args.id, ...tenancyParams },
              json: true,
            });
            if (!rows || rows.length === 0) {
              await tx.commit();
              return;
            }

            if (experimentTablesExist) {
              await tx.runUpdate({
                sql: `DELETE FROM ${quoteIdent(TABLE_EXPERIMENT_RESULTS, 'table name')}
                      WHERE ${quoteIdent('experimentId', 'column name')} IN (
                        SELECT ${quoteIdent('id', 'column name')} FROM ${quoteIdent(TABLE_EXPERIMENTS, 'table name')}
                        WHERE ${quoteIdent('datasetId', 'column name')} = @id)`,
                params: { id: args.id },
              });
              await tx.runUpdate({
                sql: `UPDATE ${quoteIdent(TABLE_EXPERIMENTS, 'table name')}
                      SET ${quoteIdent('datasetId', 'column name')} = NULL,
                          ${quoteIdent('datasetVersion', 'column name')} = NULL
                      WHERE ${quoteIdent('datasetId', 'column name')} = @id`,
                params: { id: args.id },
              });
            }

            for (const table of [TABLE_DATASET_VERSIONS, TABLE_DATASET_ITEMS]) {
              await tx.runUpdate({
                sql: `DELETE FROM ${quoteIdent(table, 'table name')} WHERE ${quoteIdent('datasetId', 'column name')} = @id`,
                params: { id: args.id },
              });
            }
            await tx.runUpdate({
              sql: `DELETE FROM ${quoteIdent(TABLE_DATASETS, 'table name')} WHERE ${scopedWhere}`,
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
          id: createStorageErrorId('SPANNER', 'DELETE_DATASET', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: args.id },
        },
        error,
      );
    }
  }

  async listDatasets(args: ListDatasetsInput): Promise<ListDatasetsOutput> {
    const { page = 0, perPage: perPageInput } = args.pagination;
    const perPage = normalizePerPage(perPageInput, 100);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    try {
      const tableName = quoteIdent(TABLE_DATASETS, 'table name');

      const filterConditions: string[] = [];
      const filterParams: Record<string, any> = {};
      if (args.filters?.organizationId !== undefined) {
        filterConditions.push(`${quoteIdent('organizationId', 'column name')} = @organizationId`);
        filterParams.organizationId = args.filters.organizationId;
      }
      if (args.filters?.projectId !== undefined) {
        filterConditions.push(`${quoteIdent('projectId', 'column name')} = @projectId`);
        filterParams.projectId = args.filters.projectId;
      }
      if (args.filters?.candidateKey !== undefined) {
        filterConditions.push(`${quoteIdent('candidateKey', 'column name')} = @candidateKey`);
        filterParams.candidateKey = args.filters.candidateKey;
      }
      if (args.filters?.candidateId !== undefined) {
        filterConditions.push(`${quoteIdent('candidateId', 'column name')} = @candidateId`);
        filterParams.candidateId = args.filters.candidateId;
      }
      if (args.filters?.targetType !== undefined) {
        filterConditions.push(`${quoteIdent('targetType', 'column name')} = @targetType`);
        filterParams.targetType = args.filters.targetType;
      }
      if (args.filters?.targetIds !== undefined && args.filters.targetIds.length > 0) {
        // Spanner stores `targetIds` as a JSON array column; unnest it and intersect
        // with the supplied IDs. This matches dataset rows whose targetIds overlap
        // with any of the supplied values.
        filterConditions.push(
          `EXISTS (SELECT 1 FROM UNNEST(JSON_QUERY_ARRAY(${quoteIdent('targetIds', 'column name')})) AS t WHERE JSON_VALUE(t) IN UNNEST(@targetIds))`,
        );
        filterParams.targetIds = args.filters.targetIds;
      }
      if (args.filters?.name !== undefined && args.filters.name.length > 0) {
        filterConditions.push(`LOWER(${quoteIdent('name', 'column name')}) LIKE LOWER(@nameSubstring)`);
        filterParams.nameSubstring = `%${args.filters.name}%`;
      }
      const whereClause = filterConditions.length > 0 ? `WHERE ${filterConditions.join(' AND ')}` : '';
      // Spanner cannot infer the element type of empty arrays, so declare ARRAY<STRING>
      // for `targetIds` whenever the filter is in play.
      const filterTypes: Record<string, any> =
        args.filters?.targetIds !== undefined && args.filters.targetIds.length > 0
          ? { targetIds: { type: 'array', child: { type: 'string' } } }
          : {};

      const [countRows] = await this.database.run({
        sql: `SELECT COUNT(*) AS count FROM ${tableName} ${whereClause}`,
        params: filterParams,
        types: filterTypes,
        json: true,
      });
      const total = Number((countRows as Array<{ count: number | string }>)[0]?.count ?? 0);
      if (total === 0) {
        return { datasets: [], pagination: { total: 0, page, perPage: perPageForResponse, hasMore: false } };
      }
      const limit = perPageInput === false ? total : perPage;
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${tableName} ${whereClause}
              ORDER BY ${quoteIdent('createdAt', 'column name')} DESC, ${quoteIdent('id', 'column name')} ASC
              LIMIT @limit OFFSET @offset`,
        params: { ...filterParams, limit, offset },
        types: filterTypes,
        json: true,
      });
      const datasets = (rows as Array<Record<string, any>>).map(rowToDataset);
      return {
        datasets,
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
          id: createStorageErrorId('SPANNER', 'LIST_DATASETS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // ==========================================================================
  // SCD-2 helpers
  // ==========================================================================

  /** Reads and increments the dataset version inside `tx`; throws if missing. Also returns parent tenancy. */
  private async bumpVersion(
    tx: Transaction,
    datasetId: string,
    now: Date,
  ): Promise<{ version: number; organizationId: string | null; projectId: string | null }> {
    const [rows] = await tx.run({
      sql: `SELECT ${quoteIdent('version', 'column name')} AS version,
                   ${quoteIdent('organizationId', 'column name')} AS organizationId,
                   ${quoteIdent('projectId', 'column name')} AS projectId
            FROM ${quoteIdent(TABLE_DATASETS, 'table name')}
            WHERE ${quoteIdent('id', 'column name')} = @id LIMIT 1`,
      params: { id: datasetId },
      json: true,
    });
    const row = (
      rows as Array<{ version: number | string; organizationId: string | null; projectId: string | null }>
    )[0];
    if (!row) {
      throw new MastraError({
        id: createStorageErrorId('SPANNER', 'DATASET_ITEM', 'DATASET_NOT_FOUND'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Dataset not found: ${datasetId}`,
        details: { datasetId },
      });
    }
    const newVersion = Number(row.version) + 1;
    await tx.runUpdate({
      sql: `UPDATE ${quoteIdent(TABLE_DATASETS, 'table name')}
            SET ${quoteIdent('version', 'column name')} = @newVersion,
                ${quoteIdent('updatedAt', 'column name')} = @now
            WHERE ${quoteIdent('id', 'column name')} = @id`,
      params: { newVersion, now: now.toISOString(), id: datasetId },
      types: { now: 'timestamp' },
    });
    return { version: newVersion, organizationId: row.organizationId ?? null, projectId: row.projectId ?? null };
  }

  /** Inserts a dataset version snapshot row inside `tx`. */
  private async insertVersionRow(tx: Transaction, datasetId: string, version: number, now: Date): Promise<void> {
    await this.db.insert({
      tableName: TABLE_DATASET_VERSIONS,
      record: { id: randomUUID(), datasetId, version, createdAt: now },
      transaction: tx,
    });
  }

  /** Closes the current (validTo IS NULL) row for an item inside `tx`. */
  private async closeCurrentRow(tx: Transaction, itemId: string, validTo: number): Promise<void> {
    await tx.runUpdate({
      sql: `UPDATE ${quoteIdent(TABLE_DATASET_ITEMS, 'table name')}
            SET ${quoteIdent('validTo', 'column name')} = @validTo
            WHERE ${quoteIdent('id', 'column name')} = @id
              AND ${quoteIdent('validTo', 'column name')} IS NULL
              AND ${quoteIdent('isDeleted', 'column name')} = FALSE`,
      params: { validTo, id: itemId },
    });
  }

  /** Reads the current live row for an item (validTo IS NULL, not deleted). */
  private async loadCurrentItemRow(itemId: string): Promise<DatasetItemRow | null> {
    const [rows] = await this.database.run({
      sql: `SELECT * FROM ${quoteIdent(TABLE_DATASET_ITEMS, 'table name')}
            WHERE ${quoteIdent('id', 'column name')} = @id
              AND ${quoteIdent('validTo', 'column name')} IS NULL
              AND ${quoteIdent('isDeleted', 'column name')} = FALSE LIMIT 1`,
      params: { id: itemId },
      json: true,
    });
    const row = (rows as Array<Record<string, any>>)[0];
    return row ? rowToItemRow(row) : null;
  }

  // ==========================================================================
  // Item CRUD (SCD-2)
  // ==========================================================================

  protected async _doAddItem(args: AddDatasetItemInput): Promise<DatasetItem> {
    try {
      const now = new Date();
      const itemId = randomUUID();
      let created: DatasetItem | null = null;
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            const { version: newVersion, organizationId, projectId } = await this.bumpVersion(tx, args.datasetId, now);
            await this.db.insert({
              tableName: TABLE_DATASET_ITEMS,
              record: {
                id: itemId,
                datasetId: args.datasetId,
                datasetVersion: newVersion,
                organizationId,
                projectId,
                validTo: null,
                isDeleted: false,
                input: args.input,
                groundTruth: args.groundTruth ?? null,
                expectedTrajectory: args.expectedTrajectory ?? null,
                toolMocks: args.toolMocks ?? null,
                requestContext: args.requestContext ?? null,
                metadata: args.metadata ?? null,
                source: args.source ?? null,
                createdAt: now,
                updatedAt: now,
              },
              transaction: tx,
            });
            await this.insertVersionRow(tx, args.datasetId, newVersion, now);
            await tx.commit();
            created = {
              id: itemId,
              datasetId: args.datasetId,
              datasetVersion: newVersion,
              organizationId,
              projectId,
              input: args.input,
              groundTruth: args.groundTruth,
              expectedTrajectory: args.expectedTrajectory,
              toolMocks: args.toolMocks,
              requestContext: args.requestContext,
              metadata: args.metadata,
              source: args.source,
              createdAt: now,
              updatedAt: now,
            };
          } catch (err) {
            await tx.rollback().catch(rollbackErr => {
              throw new AggregateError([err, rollbackErr], 'Transaction and rollback both failed');
            });
            throw err;
          }
        }),
      );
      return created!;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'ADD_DATASET_ITEM', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { datasetId: args.datasetId },
        },
        error,
      );
    }
  }

  protected async _doUpdateItem(args: UpdateDatasetItemInput): Promise<DatasetItem> {
    try {
      const existing = await this.loadCurrentItemRow(args.id);
      if (!existing) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'UPDATE_DATASET_ITEM', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Dataset item not found: ${args.id}`,
          details: { id: args.id },
        });
      }
      if (existing.datasetId !== args.datasetId) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'UPDATE_DATASET_ITEM', 'DATASET_MISMATCH'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Dataset item ${args.id} does not belong to dataset ${args.datasetId}`,
          details: { id: args.id, datasetId: args.datasetId },
        });
      }

      const merged = {
        input: args.input !== undefined ? args.input : existing.input,
        groundTruth: args.groundTruth !== undefined ? args.groundTruth : existing.groundTruth,
        expectedTrajectory:
          args.expectedTrajectory !== undefined ? args.expectedTrajectory : existing.expectedTrajectory,
        toolMocks: args.toolMocks !== undefined ? args.toolMocks : existing.toolMocks,
        requestContext: args.requestContext !== undefined ? args.requestContext : existing.requestContext,
        metadata: args.metadata !== undefined ? args.metadata : existing.metadata,
        source: args.source !== undefined ? args.source : existing.source,
      };
      const now = new Date();
      let updated: DatasetItem | null = null;
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            const { version: newVersion, organizationId, projectId } = await this.bumpVersion(tx, args.datasetId, now);
            await this.closeCurrentRow(tx, args.id, newVersion);
            await this.db.insert({
              tableName: TABLE_DATASET_ITEMS,
              record: {
                id: args.id,
                datasetId: args.datasetId,
                datasetVersion: newVersion,
                externalId: existing.externalId ?? null,
                organizationId,
                projectId,
                validTo: null,
                isDeleted: false,
                input: merged.input,
                groundTruth: merged.groundTruth ?? null,
                expectedTrajectory: merged.expectedTrajectory ?? null,
                toolMocks: merged.toolMocks ?? null,
                requestContext: merged.requestContext ?? null,
                metadata: merged.metadata ?? null,
                source: merged.source ?? null,
                createdAt: existing.createdAt,
                updatedAt: now,
              },
              transaction: tx,
            });
            await this.insertVersionRow(tx, args.datasetId, newVersion, now);
            await tx.commit();
            updated = {
              id: args.id,
              datasetId: args.datasetId,
              datasetVersion: newVersion,
              externalId: existing.externalId ?? null,
              organizationId,
              projectId,
              input: merged.input,
              groundTruth: merged.groundTruth,
              expectedTrajectory: merged.expectedTrajectory,
              toolMocks: merged.toolMocks,
              requestContext: merged.requestContext,
              metadata: merged.metadata,
              source: merged.source,
              createdAt: existing.createdAt,
              updatedAt: now,
            };
          } catch (err) {
            await tx.rollback().catch(rollbackErr => {
              throw new AggregateError([err, rollbackErr], 'Transaction and rollback both failed');
            });
            throw err;
          }
        }),
      );
      return updated!;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'UPDATE_DATASET_ITEM', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: args.id },
        },
        error,
      );
    }
  }

  protected async _doDeleteItem(args: DeleteDatasetItemInput): Promise<void> {
    try {
      const existing = await this.loadCurrentItemRow(args.id);
      if (!existing) return;
      if (existing.datasetId !== args.datasetId) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'DELETE_DATASET_ITEM', 'DATASET_MISMATCH'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Dataset item ${args.id} does not belong to dataset ${args.datasetId}`,
          details: { id: args.id, datasetId: args.datasetId },
        });
      }
      const now = new Date();
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            const { version: newVersion, organizationId, projectId } = await this.bumpVersion(tx, args.datasetId, now);
            await this.closeCurrentRow(tx, args.id, newVersion);
            await this.db.insert({
              tableName: TABLE_DATASET_ITEMS,
              record: {
                id: args.id,
                datasetId: args.datasetId,
                datasetVersion: newVersion,
                externalId: existing.externalId ?? null,
                organizationId,
                projectId,
                validTo: null,
                isDeleted: true,
                input: existing.input,
                groundTruth: existing.groundTruth ?? null,
                expectedTrajectory: existing.expectedTrajectory ?? null,
                toolMocks: existing.toolMocks ?? null,
                requestContext: existing.requestContext ?? null,
                metadata: existing.metadata ?? null,
                source: existing.source ?? null,
                createdAt: existing.createdAt,
                updatedAt: now,
              },
              transaction: tx,
            });
            await this.insertVersionRow(tx, args.datasetId, newVersion, now);
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
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_DATASET_ITEM', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: args.id },
        },
        error,
      );
    }
  }

  async listItems(args: ListDatasetItemsInput): Promise<ListDatasetItemsOutput> {
    const { page = 0, perPage: perPageInput } = args.pagination;
    const perPage = normalizePerPage(perPageInput, 100);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    try {
      const conditions: string[] = [`${quoteIdent('datasetId', 'column name')} = @datasetId`];
      const params: Record<string, any> = { datasetId: args.datasetId };
      if (args.filters?.organizationId !== undefined) {
        conditions.push(`${quoteIdent('organizationId', 'column name')} = @organizationId`);
        params.organizationId = args.filters.organizationId;
      }
      if (args.filters?.projectId !== undefined) {
        conditions.push(`${quoteIdent('projectId', 'column name')} = @projectId`);
        params.projectId = args.filters.projectId;
      }
      if (args.version !== undefined) {
        conditions.push(`${quoteIdent('datasetVersion', 'column name')} <= @version`);
        conditions.push(
          `(${quoteIdent('validTo', 'column name')} IS NULL OR ${quoteIdent('validTo', 'column name')} > @version)`,
        );
        conditions.push(`${quoteIdent('isDeleted', 'column name')} = FALSE`);
        params.version = args.version;
      } else {
        conditions.push(`${quoteIdent('validTo', 'column name')} IS NULL`);
        conditions.push(`${quoteIdent('isDeleted', 'column name')} = FALSE`);
      }
      if (args.search) {
        conditions.push(
          `(LOWER(TO_JSON_STRING(${quoteIdent('input', 'column name')})) LIKE @search` +
            ` OR LOWER(COALESCE(TO_JSON_STRING(${quoteIdent('groundTruth', 'column name')}), '')) LIKE @search)`,
        );
        params.search = `%${args.search.toLowerCase()}%`;
      }
      const whereSql = `WHERE ${conditions.join(' AND ')}`;
      const tableName = quoteIdent(TABLE_DATASET_ITEMS, 'table name');

      const [countRows] = await this.database.run({
        sql: `SELECT COUNT(*) AS count FROM ${tableName} ${whereSql}`,
        params,
        json: true,
      });
      const total = Number((countRows as Array<{ count: number | string }>)[0]?.count ?? 0);
      if (total === 0) {
        return { items: [], pagination: { total: 0, page, perPage: perPageForResponse, hasMore: false } };
      }

      const limit = perPageInput === false ? total : perPage;
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${tableName} ${whereSql}
              ORDER BY ${quoteIdent('createdAt', 'column name')} DESC, ${quoteIdent('id', 'column name')} ASC
              LIMIT @limit OFFSET @offset`,
        params: { ...params, limit, offset },
        json: true,
      });
      const items = (rows as Array<Record<string, any>>).map(rowToItem);
      return {
        items,
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
          id: createStorageErrorId('SPANNER', 'LIST_DATASET_ITEMS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { datasetId: args.datasetId },
        },
        error,
      );
    }
  }

  async getItemById(args: { id: string; datasetVersion?: number }): Promise<DatasetItem | null> {
    try {
      const tableName = quoteIdent(TABLE_DATASET_ITEMS, 'table name');
      let sql: string;
      const params: Record<string, any> = { id: args.id };
      if (args.datasetVersion !== undefined) {
        sql = `SELECT * FROM ${tableName}
               WHERE ${quoteIdent('id', 'column name')} = @id
                 AND ${quoteIdent('datasetVersion', 'column name')} = @datasetVersion
                 AND ${quoteIdent('isDeleted', 'column name')} = FALSE LIMIT 1`;
        params.datasetVersion = args.datasetVersion;
      } else {
        sql = `SELECT * FROM ${tableName}
               WHERE ${quoteIdent('id', 'column name')} = @id
                 AND ${quoteIdent('validTo', 'column name')} IS NULL
                 AND ${quoteIdent('isDeleted', 'column name')} = FALSE LIMIT 1`;
      }
      const [rows] = await this.database.run({ sql, params, json: true });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? rowToItem(row) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_DATASET_ITEM', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: args.id },
        },
        error,
      );
    }
  }

  async getItemsByVersion(args: { datasetId: string; version: number }): Promise<DatasetItem[]> {
    try {
      const tableName = quoteIdent(TABLE_DATASET_ITEMS, 'table name');
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${tableName}
              WHERE ${quoteIdent('datasetId', 'column name')} = @datasetId
                AND ${quoteIdent('datasetVersion', 'column name')} <= @version
                AND (${quoteIdent('validTo', 'column name')} IS NULL OR ${quoteIdent('validTo', 'column name')} > @version)
                AND ${quoteIdent('isDeleted', 'column name')} = FALSE
              ORDER BY ${quoteIdent('createdAt', 'column name')} DESC, ${quoteIdent('id', 'column name')} ASC`,
        params: { datasetId: args.datasetId, version: args.version },
        json: true,
      });
      return (rows as Array<Record<string, any>>).map(rowToItem);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_ITEMS_BY_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { datasetId: args.datasetId, version: args.version },
        },
        error,
      );
    }
  }

  async getItemHistory(itemId: string): Promise<DatasetItemRow[]> {
    try {
      const tableName = quoteIdent(TABLE_DATASET_ITEMS, 'table name');
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${tableName}
              WHERE ${quoteIdent('id', 'column name')} = @id
              ORDER BY ${quoteIdent('datasetVersion', 'column name')} DESC`,
        params: { id: itemId },
        json: true,
      });
      return (rows as Array<Record<string, any>>).map(rowToItemRow);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_ITEM_HISTORY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: itemId },
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Dataset versions
  // ==========================================================================

  async createDatasetVersion(datasetId: string, version: number): Promise<DatasetVersion> {
    try {
      const now = new Date();
      const id = randomUUID();
      await this.db.insert({
        tableName: TABLE_DATASET_VERSIONS,
        record: { id, datasetId, version, createdAt: now },
      });
      return { id, datasetId, version, createdAt: now };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'CREATE_DATASET_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { datasetId, version },
        },
        error,
      );
    }
  }

  async listDatasetVersions(input: ListDatasetVersionsInput): Promise<ListDatasetVersionsOutput> {
    const { page = 0, perPage: perPageInput } = input.pagination;
    const perPage = normalizePerPage(perPageInput, 100);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    try {
      const tableName = quoteIdent(TABLE_DATASET_VERSIONS, 'table name');
      const [countRows] = await this.database.run({
        sql: `SELECT COUNT(*) AS count FROM ${tableName} WHERE ${quoteIdent('datasetId', 'column name')} = @datasetId`,
        params: { datasetId: input.datasetId },
        json: true,
      });
      const total = Number((countRows as Array<{ count: number | string }>)[0]?.count ?? 0);
      if (total === 0) {
        return { versions: [], pagination: { total: 0, page, perPage: perPageForResponse, hasMore: false } };
      }
      const limit = perPageInput === false ? total : perPage;
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${tableName}
              WHERE ${quoteIdent('datasetId', 'column name')} = @datasetId
              ORDER BY ${quoteIdent('version', 'column name')} DESC
              LIMIT @limit OFFSET @offset`,
        params: { datasetId: input.datasetId, limit, offset },
        json: true,
      });
      const versions = (rows as Array<Record<string, any>>).map(rowToVersion);
      return {
        versions,
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
          id: createStorageErrorId('SPANNER', 'LIST_DATASET_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { datasetId: input.datasetId },
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Batch item operations
  // ==========================================================================

  protected async _doBatchInsertItems(input: BatchInsertItemsInput): Promise<DatasetItem[]> {
    try {
      // An empty batch is a no-op: don't bump the dataset version or write a snapshot.
      if (input.items.length === 0) return [];
      let result: DatasetItem[] = [];
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            const [datasetRows] = await tx.run({
              sql: `SELECT * FROM ${quoteIdent(TABLE_DATASETS, 'table name')} WHERE ${quoteIdent('id', 'column name')} = @id LIMIT 1`,
              params: { id: input.datasetId },
              json: true,
            });
            const dataset = datasetRows[0] as Record<string, any> | undefined;
            if (!dataset) {
              throw new MastraError({
                id: createStorageErrorId('SPANNER', 'BATCH_INSERT_ITEMS', 'DATASET_NOT_FOUND'),
                domain: ErrorDomain.STORAGE,
                category: ErrorCategory.USER,
                details: { datasetId: input.datasetId },
              });
            }
            const externalIds = [...new Set(input.items.flatMap(item => (item.externalId ? [item.externalId] : [])))];
            let historyRows: DatasetItemRow[] = [];
            if (externalIds.length > 0) {
              const [rows] = await tx.run({
                sql: `SELECT * FROM ${quoteIdent(TABLE_DATASET_ITEMS, 'table name')} WHERE ${quoteIdent('datasetId', 'column name')} = @datasetId AND ${quoteIdent('externalId', 'column name')} IN UNNEST(@externalIds) ORDER BY ${quoteIdent('datasetVersion', 'column name')}`,
                params: { datasetId: input.datasetId, externalIds },
                types: { externalIds: { type: 'array', child: 'string' } },
                json: true,
              });
              historyRows = (rows as Array<Record<string, any>>).map(rowToItemRow);
            }
            const plan = this.planDatasetItemBatch(input.items, historyRows, randomUUID);
            const resolved = new Map<string, DatasetItem>(
              [...plan.existingCurrentItems].map(([id, row]) => [id, this.datasetItemFromRow(row)]),
            );
            if (plan.inserts.length > 0) {
              const now = new Date();
              const {
                version: newVersion,
                organizationId,
                projectId,
              } = await this.bumpVersion(tx, input.datasetId, now);
              for (const insert of plan.inserts) {
                const item: DatasetItem = {
                  id: insert.id,
                  datasetId: input.datasetId,
                  datasetVersion: newVersion,
                  externalId: insert.item.externalId ?? null,
                  organizationId,
                  projectId,
                  input: insert.item.input,
                  groundTruth: insert.item.groundTruth,
                  expectedTrajectory: insert.item.expectedTrajectory,
                  toolMocks: insert.item.toolMocks,
                  requestContext: insert.item.requestContext,
                  metadata: insert.item.metadata,
                  source: insert.item.source,
                  createdAt: now,
                  updatedAt: now,
                };
                await this.db.insert({
                  tableName: TABLE_DATASET_ITEMS,
                  record: { ...item, validTo: null, isDeleted: false },
                  transaction: tx,
                });
                resolved.set(item.id, item);
              }
              await this.insertVersionRow(tx, input.datasetId, newVersion, now);
            }
            await tx.commit();
            result = plan.resolvedIds.map(id => resolved.get(id)!);
          } catch (err) {
            await tx.rollback().catch(rollbackErr => {
              throw new AggregateError([err, rollbackErr], 'Transaction and rollback both failed');
            });
            throw err;
          }
        }),
      );
      return result;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'BATCH_INSERT_ITEMS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { datasetId: input.datasetId },
        },
        error,
      );
    }
  }

  protected async _doBatchDeleteItems(input: BatchDeleteItemsInput): Promise<void> {
    try {
      // Resolve current rows up front and keep only those belonging to the dataset.
      const current: DatasetItemRow[] = [];
      for (const itemId of input.itemIds) {
        const row = await this.loadCurrentItemRow(itemId);
        if (row && row.datasetId === input.datasetId) current.push(row);
      }
      if (current.length === 0) return;

      const now = new Date();
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            const { version: newVersion, organizationId, projectId } = await this.bumpVersion(tx, input.datasetId, now);
            for (const existing of current) {
              await this.closeCurrentRow(tx, existing.id, newVersion);
              await this.db.insert({
                tableName: TABLE_DATASET_ITEMS,
                record: {
                  id: existing.id,
                  datasetId: input.datasetId,
                  datasetVersion: newVersion,
                  externalId: existing.externalId ?? null,
                  organizationId,
                  projectId,
                  validTo: null,
                  isDeleted: true,
                  input: existing.input,
                  groundTruth: existing.groundTruth ?? null,
                  expectedTrajectory: existing.expectedTrajectory ?? null,
                  toolMocks: existing.toolMocks ?? null,
                  requestContext: existing.requestContext ?? null,
                  metadata: existing.metadata ?? null,
                  source: existing.source ?? null,
                  createdAt: existing.createdAt,
                  updatedAt: now,
                },
                transaction: tx,
              });
            }
            await this.insertVersionRow(tx, input.datasetId, newVersion, now);
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
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'BATCH_DELETE_ITEMS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { datasetId: input.datasetId },
        },
        error,
      );
    }
  }
}
