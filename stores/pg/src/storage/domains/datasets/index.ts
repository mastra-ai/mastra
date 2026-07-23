import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  TABLE_DATASETS,
  TABLE_DATASET_ITEMS,
  TABLE_DATASET_VERSIONS,
  TABLE_EXPERIMENTS,
  TABLE_EXPERIMENT_RESULTS,
  TABLE_CONFIGS,
  TABLE_SCHEMAS,
  DATASETS_SCHEMA,
  DATASET_ITEMS_SCHEMA,
  DATASET_VERSIONS_SCHEMA,
  DatasetsStorage,
  calculatePagination,
  normalizePerPage,
  safelyParseJSON,
  ensureDate,
  hasErrorCode,
} from '@mastra/core/storage';
import type {
  DatasetRecord,
  DatasetItem,
  DatasetItemRow,
  DatasetVersion,
  CreateDatasetInput,
  UpdateDatasetInput,
  AddDatasetItemInput,
  UpdateDatasetItemInput,
  DeleteDatasetItemInput,
  ListDatasetsInput,
  ListDatasetsOutput,
  ListDatasetItemsInput,
  ListDatasetItemsOutput,
  ListDatasetVersionsInput,
  ListDatasetVersionsOutput,
  BatchInsertItemsInput,
  BatchDeleteItemsInput,
  CreateIndexOptions,
  TargetType,
  DatasetTenancyFilters,
} from '@mastra/core/storage';
import { PgDB, resolvePgConfig, generateTableSQL } from '../../db';
import type { PgDomainConfig } from '../../db';
import { getTableName, getSchemaName, tenancyWhere } from '../utils';

/** Serialize a value for a jsonb column. Returns null for null/undefined. */
function jsonbArg(value: unknown): string | null {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

export class DatasetsPG extends DatasetsStorage {
  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_DATASETS, TABLE_DATASET_ITEMS, TABLE_DATASET_VERSIONS] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx => (DatasetsPG.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  static getExportDDL(schemaName?: string): string[] {
    const statements: string[] = [];
    for (const tableName of DatasetsPG.MANAGED_TABLES) {
      statements.push(
        generateTableSQL({
          tableName,
          schema: TABLE_SCHEMAS[tableName],
          schemaName,
          compositePrimaryKey: TABLE_CONFIGS[tableName]?.compositePrimaryKey,
          includeAllConstraints: true,
        }),
      );
    }
    return statements;
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_DATASETS, schema: DATASETS_SCHEMA });
    await this.#db.createTable({
      tableName: TABLE_DATASET_ITEMS,
      schema: DATASET_ITEMS_SCHEMA,
      compositePrimaryKey: TABLE_CONFIGS[TABLE_DATASET_ITEMS]?.compositePrimaryKey,
    });
    await this.#db.createTable({ tableName: TABLE_DATASET_VERSIONS, schema: DATASET_VERSIONS_SCHEMA });

    // Migrate: add new columns to existing tables
    await this.#addColumnIfNotExists(TABLE_DATASETS, 'requestContextSchema', 'JSONB');
    await this.#addColumnIfNotExists(TABLE_DATASETS, 'tags', 'JSONB');
    await this.#addColumnIfNotExists(TABLE_DATASETS, 'targetType', 'TEXT');
    await this.#addColumnIfNotExists(TABLE_DATASETS, 'targetIds', 'JSONB');
    await this.#addColumnIfNotExists(TABLE_DATASETS, 'scorerIds', 'JSONB');
    await this.#addColumnIfNotExists(TABLE_DATASETS, 'organizationId', 'TEXT');
    await this.#addColumnIfNotExists(TABLE_DATASETS, 'projectId', 'TEXT');
    await this.#addColumnIfNotExists(TABLE_DATASETS, 'candidateKey', 'TEXT');
    await this.#addColumnIfNotExists(TABLE_DATASETS, 'candidateId', 'TEXT');
    await this.#addColumnIfNotExists(TABLE_DATASET_ITEMS, 'requestContext', 'JSONB');
    await this.#addColumnIfNotExists(TABLE_DATASET_ITEMS, 'source', 'JSONB');
    await this.#addColumnIfNotExists(TABLE_DATASET_ITEMS, 'expectedTrajectory', 'JSONB');
    await this.#addColumnIfNotExists(TABLE_DATASET_ITEMS, 'organizationId', 'TEXT');
    await this.#addColumnIfNotExists(TABLE_DATASET_ITEMS, 'projectId', 'TEXT');
    await this.#addColumnIfNotExists(TABLE_DATASET_ITEMS, 'toolMocks', 'JSONB');
    await this.#addColumnIfNotExists(TABLE_DATASET_ITEMS, 'scorerIds', 'JSONB');
    await this.#addColumnIfNotExists(TABLE_DATASET_ITEMS, 'externalId', 'TEXT');

    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  async #addColumnIfNotExists(table: string, column: string, sqlType: string): Promise<void> {
    const exists = await this.#db.hasColumn(table, column);
    if (!exists) {
      const fullTableName = getTableName({ indexName: table, schemaName: getSchemaName(this.#schema) });
      await this.#db.client.none(`ALTER TABLE ${fullTableName} ADD COLUMN "${column}" ${sqlType}`);
    }
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      { name: 'idx_dataset_items_dataset_validto', table: TABLE_DATASET_ITEMS, columns: ['datasetId', 'validTo'] },
      {
        name: 'idx_dataset_items_dataset_version',
        table: TABLE_DATASET_ITEMS,
        columns: ['datasetId', 'datasetVersion'],
      },
      {
        name: 'idx_dataset_items_external_id_history',
        table: TABLE_DATASET_ITEMS,
        columns: ['datasetId', 'externalId', 'datasetVersion'],
      },
      {
        name: 'idx_dataset_items_dataset_validto_deleted',
        table: TABLE_DATASET_ITEMS,
        columns: ['datasetId', 'validTo', 'isDeleted'],
      },
      {
        name: 'idx_dataset_versions_dataset_version',
        table: TABLE_DATASET_VERSIONS,
        columns: ['datasetId', 'version'],
      },
      {
        name: 'idx_dataset_versions_dataset_version_unique',
        table: TABLE_DATASET_VERSIONS,
        columns: ['datasetId', 'version'],
        unique: true,
      },
      // Tenancy: leading-tenant indexes for multi-tenant scans (parity with observability storage).
      {
        name: 'idx_datasets_org_project',
        table: TABLE_DATASETS,
        columns: ['organizationId', 'projectId'],
      },
      {
        name: 'idx_datasets_candidate',
        table: TABLE_DATASETS,
        columns: ['candidateKey', 'candidateId'],
      },
      {
        name: 'idx_dataset_items_org_project',
        table: TABLE_DATASET_ITEMS,
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

  private transformDatasetRow(row: Record<string, any>): DatasetRecord {
    return {
      id: row.id as string,
      name: row.name as string,
      description: (row.description as string) ?? undefined,
      metadata: row.metadata ? safelyParseJSON(row.metadata) : undefined,
      inputSchema: row.inputSchema ? safelyParseJSON(row.inputSchema) : undefined,
      groundTruthSchema: row.groundTruthSchema ? safelyParseJSON(row.groundTruthSchema) : undefined,
      requestContextSchema: row.requestContextSchema ? safelyParseJSON(row.requestContextSchema) : undefined,
      tags: row.tags ? safelyParseJSON(row.tags) : undefined,
      targetType: (row.targetType as TargetType) || null,
      targetIds: row.targetIds || null,
      scorerIds: row.scorerIds || null,
      organizationId: (row.organizationId as string | null) ?? null,
      projectId: (row.projectId as string | null) ?? null,
      candidateKey: (row.candidateKey as string | null) ?? null,
      candidateId: (row.candidateId as string | null) ?? null,
      version: row.version as number,
      createdAt: ensureDate(row.createdAtZ || row.createdAt)!,
      updatedAt: ensureDate(row.updatedAtZ || row.updatedAt)!,
    };
  }

  private transformItemRow(row: Record<string, any>): DatasetItem {
    return {
      id: row.id as string,
      datasetId: row.datasetId as string,
      datasetVersion: row.datasetVersion as number,
      externalId: (row.externalId as string | null) ?? null,
      organizationId: (row.organizationId as string | null) ?? null,
      projectId: (row.projectId as string | null) ?? null,
      input: safelyParseJSON(row.input),
      groundTruth: row.groundTruth ? safelyParseJSON(row.groundTruth) : undefined,
      expectedTrajectory: row.expectedTrajectory ? safelyParseJSON(row.expectedTrajectory) : undefined,
      toolMocks: row.toolMocks ? safelyParseJSON(row.toolMocks) : undefined,
      scorerIds: row.scorerIds ? safelyParseJSON(row.scorerIds) : undefined,
      requestContext: row.requestContext ? safelyParseJSON(row.requestContext) : undefined,
      metadata: row.metadata ? safelyParseJSON(row.metadata) : undefined,
      source: row.source ? safelyParseJSON(row.source) : undefined,
      createdAt: ensureDate(row.createdAtZ || row.createdAt)!,
      updatedAt: ensureDate(row.updatedAtZ || row.updatedAt)!,
    };
  }

  private transformItemRowFull(row: Record<string, any>): DatasetItemRow {
    return {
      id: row.id as string,
      datasetId: row.datasetId as string,
      datasetVersion: row.datasetVersion as number,
      externalId: (row.externalId as string | null) ?? null,
      organizationId: (row.organizationId as string | null) ?? null,
      projectId: (row.projectId as string | null) ?? null,
      validTo: row.validTo as number | null,
      isDeleted: Boolean(row.isDeleted),
      input: safelyParseJSON(row.input),
      groundTruth: row.groundTruth ? safelyParseJSON(row.groundTruth) : undefined,
      expectedTrajectory: row.expectedTrajectory ? safelyParseJSON(row.expectedTrajectory) : undefined,
      toolMocks: row.toolMocks ? safelyParseJSON(row.toolMocks) : undefined,
      scorerIds: row.scorerIds ? safelyParseJSON(row.scorerIds) : undefined,
      requestContext: row.requestContext ? safelyParseJSON(row.requestContext) : undefined,
      metadata: row.metadata ? safelyParseJSON(row.metadata) : undefined,
      source: row.source ? safelyParseJSON(row.source) : undefined,
      createdAt: ensureDate(row.createdAtZ || row.createdAt)!,
      updatedAt: ensureDate(row.updatedAtZ || row.updatedAt)!,
    };
  }

  private transformDatasetVersionRow(row: Record<string, any>): DatasetVersion {
    return {
      id: row.id as string,
      datasetId: row.datasetId as string,
      version: row.version as number,
      createdAt: ensureDate(row.createdAtZ || row.createdAt)!,
    };
  }

  // --- Dataset CRUD ---

  async createDataset(input: CreateDatasetInput): Promise<DatasetRecord> {
    try {
      const id = input.id ?? crypto.randomUUID();
      if (input.id !== undefined) this.validateCallerDefinedDatasetId(input.id);
      const now = new Date();
      const nowIso = now.toISOString();

      await this.#db.insert({
        tableName: TABLE_DATASETS,
        record: {
          id,
          name: input.name,
          description: input.description ?? null,
          metadata: input.metadata ?? null,
          inputSchema: input.inputSchema ?? null,
          groundTruthSchema: input.groundTruthSchema ?? null,
          requestContextSchema: input.requestContextSchema ?? null,
          targetType: input.targetType ?? null,
          targetIds: input.targetIds ?? null,
          scorerIds: input.scorerIds ?? null,
          organizationId: input.organizationId ?? null,
          projectId: input.projectId ?? null,
          candidateKey: input.candidateKey ?? null,
          candidateId: input.candidateId ?? null,
          version: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      });

      return {
        id,
        name: input.name,
        description: input.description,
        metadata: input.metadata,
        inputSchema: input.inputSchema ?? undefined,
        groundTruthSchema: input.groundTruthSchema ?? undefined,
        requestContextSchema: input.requestContextSchema ?? undefined,
        targetType: input.targetType ?? null,
        targetIds: input.targetIds ?? null,
        scorerIds: input.scorerIds ?? null,
        organizationId: input.organizationId ?? null,
        projectId: input.projectId ?? null,
        candidateKey: input.candidateKey ?? null,
        candidateId: input.candidateId ?? null,
        version: 0,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      if (input.id !== undefined && hasErrorCode(error, new Set(['23505']))) {
        const existing = await this.getDatasetById({ id: input.id });
        if (existing) return this.resolveExistingDataset(existing, { ...input, id: input.id });
      }
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'CREATE_DATASET', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getDatasetById({
    id,
    filters,
  }: {
    id: string;
    filters?: DatasetTenancyFilters;
  }): Promise<DatasetRecord | null> {
    try {
      const tableName = getTableName({ indexName: TABLE_DATASETS, schemaName: getSchemaName(this.#schema) });
      const { conditions, params } = tenancyWhere(filters, 2);
      const whereSql = ['"id" = $1', ...conditions].join(' AND ');
      const result = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE ${whereSql}`, [id, ...params]);
      return result ? this.transformDatasetRow(result) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_DATASET', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  protected async _doUpdateDataset(args: UpdateDatasetInput): Promise<DatasetRecord> {
    try {
      const existing = await this.getDatasetById({ id: args.id, filters: args.filters });
      if (!existing) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'UPDATE_DATASET', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { datasetId: args.id },
        });
      }

      const tableName = getTableName({ indexName: TABLE_DATASETS, schemaName: getSchemaName(this.#schema) });
      const now = new Date().toISOString();
      const setClauses: string[] = ['"updatedAt" = $1', '"updatedAtZ" = $2'];
      const values: any[] = [now, now];
      let paramIndex = 3;

      if (args.name !== undefined) {
        setClauses.push(`"name" = $${paramIndex++}`);
        values.push(args.name);
      }
      if (args.description !== undefined) {
        setClauses.push(`"description" = $${paramIndex++}`);
        values.push(args.description);
      }
      if (args.metadata !== undefined) {
        setClauses.push(`"metadata" = $${paramIndex++}`);
        values.push(JSON.stringify(args.metadata));
      }
      if (args.inputSchema !== undefined) {
        setClauses.push(`"inputSchema" = $${paramIndex++}`);
        values.push(args.inputSchema === null ? null : JSON.stringify(args.inputSchema));
      }
      if (args.groundTruthSchema !== undefined) {
        setClauses.push(`"groundTruthSchema" = $${paramIndex++}`);
        values.push(args.groundTruthSchema === null ? null : JSON.stringify(args.groundTruthSchema));
      }
      if (args.requestContextSchema !== undefined) {
        setClauses.push(`"requestContextSchema" = $${paramIndex++}`);
        values.push(args.requestContextSchema === null ? null : JSON.stringify(args.requestContextSchema));
      }
      if (args.tags !== undefined) {
        setClauses.push(`"tags" = $${paramIndex++}`);
        values.push(args.tags === null ? null : JSON.stringify(args.tags));
      }
      if (args.targetType !== undefined) {
        setClauses.push(`"targetType" = $${paramIndex++}`);
        values.push(args.targetType);
      }
      if (args.targetIds !== undefined) {
        setClauses.push(`"targetIds" = $${paramIndex++}`);
        values.push(args.targetIds === null ? null : JSON.stringify(args.targetIds));
      }
      if (args.scorerIds !== undefined) {
        setClauses.push(`"scorerIds" = $${paramIndex++}`);
        values.push(args.scorerIds === null ? null : JSON.stringify(args.scorerIds));
      }
      // Tenancy (organizationId, projectId) and candidate identity (candidateKey,
      // candidateId) are immutable after creation — they're not part of UpdateDatasetInput.

      values.push(args.id);
      await this.#db.client.none(
        `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE "id" = $${paramIndex}`,
        values,
      );

      return {
        ...existing,
        name: args.name ?? existing.name,
        description: args.description ?? existing.description,
        metadata: args.metadata ?? existing.metadata,
        inputSchema: (args.inputSchema !== undefined ? args.inputSchema : existing.inputSchema) ?? undefined,
        groundTruthSchema:
          (args.groundTruthSchema !== undefined ? args.groundTruthSchema : existing.groundTruthSchema) ?? undefined,
        requestContextSchema:
          (args.requestContextSchema !== undefined ? args.requestContextSchema : existing.requestContextSchema) ??
          undefined,
        tags: (args.tags !== undefined ? args.tags : existing.tags) ?? undefined,
        targetType: (args.targetType !== undefined ? args.targetType : existing.targetType) ?? null,
        targetIds: (args.targetIds !== undefined ? args.targetIds : existing.targetIds) ?? null,
        scorerIds: (args.scorerIds !== undefined ? args.scorerIds : existing.scorerIds) ?? null,
        organizationId: existing.organizationId ?? null,
        projectId: existing.projectId ?? null,
        candidateKey: existing.candidateKey ?? null,
        candidateId: existing.candidateId ?? null,
        updatedAt: new Date(now),
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UPDATE_DATASET', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteDataset({ id, filters }: { id: string; filters?: DatasetTenancyFilters }): Promise<void> {
    try {
      const datasetsTable = getTableName({ indexName: TABLE_DATASETS, schemaName: getSchemaName(this.#schema) });
      const itemsTable = getTableName({ indexName: TABLE_DATASET_ITEMS, schemaName: getSchemaName(this.#schema) });
      const versionsTable = getTableName({
        indexName: TABLE_DATASET_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      const experimentsTable = getTableName({ indexName: TABLE_EXPERIMENTS, schemaName: getSchemaName(this.#schema) });
      const experimentResultsTable = getTableName({
        indexName: TABLE_EXPERIMENT_RESULTS,
        schemaName: getSchemaName(this.#schema),
      });

      // Atomic gate + cascade under a single transaction; the tenancy predicate
      // is folded into a SELECT ... FOR UPDATE lock and the parent DELETE, so
      // a concurrent delete/recreate under a different tenant cannot let a
      // scoped delete hit another tenant's row. Silent no-op on mismatch.
      const { conditions, params } = tenancyWhere(filters, 2);
      const scopedWhere = ['"id" = $1', ...conditions].join(' AND ');

      await this.#db.client.tx(async t => {
        const locked = await t.oneOrNone(`SELECT "id" FROM ${datasetsTable} WHERE ${scopedWhere} FOR UPDATE`, [
          id,
          ...params,
        ]);
        if (!locked) return;

        // Detach experiments only if their tables exist. We probe with
        // to_regclass instead of try/catch inside the transaction, because a
        // failed DML in Postgres puts the connection into an aborted state
        // (SQLSTATE 25P02), which would cause every subsequent DELETE below
        // to fail and roll back the whole transaction.
        const experimentTablesExist = await t.oneOrNone<{ exists: boolean }>(
          `SELECT to_regclass($1) IS NOT NULL AND to_regclass($2) IS NOT NULL AS exists`,
          [experimentResultsTable, experimentsTable],
        );
        if (experimentTablesExist?.exists) {
          await t.none(
            `DELETE FROM ${experimentResultsTable} WHERE "experimentId" IN (SELECT "id" FROM ${experimentsTable} WHERE "datasetId" = $1)`,
            [id],
          );
          await t.none(
            `UPDATE ${experimentsTable} SET "datasetId" = NULL, "datasetVersion" = NULL WHERE "datasetId" = $1`,
            [id],
          );
        }

        await t.none(`DELETE FROM ${versionsTable} WHERE "datasetId" = $1`, [id]);
        await t.none(`DELETE FROM ${itemsTable} WHERE "datasetId" = $1`, [id]);
        await t.none(`DELETE FROM ${datasetsTable} WHERE ${scopedWhere}`, [id, ...params]);
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_DATASET', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listDatasets(args: ListDatasetsInput): Promise<ListDatasetsOutput> {
    try {
      const { page, perPage: perPageInput } = args.pagination;
      const tableName = getTableName({ indexName: TABLE_DATASETS, schemaName: getSchemaName(this.#schema) });

      const conditions: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (args.filters) {
        const { organizationId, projectId, candidateKey, candidateId, targetType, targetIds, name } = args.filters;
        if (organizationId !== undefined) {
          conditions.push(`"organizationId" = $${paramIndex++}`);
          queryParams.push(organizationId);
        }
        if (projectId !== undefined) {
          conditions.push(`"projectId" = $${paramIndex++}`);
          queryParams.push(projectId);
        }
        if (candidateKey !== undefined) {
          conditions.push(`"candidateKey" = $${paramIndex++}`);
          queryParams.push(candidateKey);
        }
        if (candidateId !== undefined) {
          conditions.push(`"candidateId" = $${paramIndex++}`);
          queryParams.push(candidateId);
        }
        if (targetType !== undefined) {
          conditions.push(`"targetType" = $${paramIndex++}`);
          queryParams.push(targetType);
        }
        if (targetIds !== undefined && targetIds.length > 0) {
          // jsonb ?| text[] — true if any of the strings exists as a top-level element.
          conditions.push(`"targetIds" ?| $${paramIndex++}::text[]`);
          queryParams.push(targetIds);
        }
        if (name !== undefined && name.length > 0) {
          conditions.push(`"name" ILIKE $${paramIndex++}`);
          queryParams.push(`%${name}%`);
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await this.#db.client.one(
        `SELECT COUNT(*) as count FROM ${tableName} ${whereClause}`,
        queryParams,
      );
      const total = parseInt(countResult.count, 10);

      if (total === 0) {
        return { datasets: [], pagination: { total: 0, page, perPage: perPageInput, hasMore: false } };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;

      const rows = await this.#db.client.manyOrNone(
        `SELECT * FROM ${tableName} ${whereClause} ORDER BY "createdAt" DESC, "id" ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...queryParams, limitValue, offset],
      );

      return {
        datasets: (rows || []).map(row => this.transformDatasetRow(row)),
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
          id: createStorageErrorId('PG', 'LIST_DATASETS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // --- SCD-2 mutations ---

  protected async _doAddItem(args: AddDatasetItemInput): Promise<DatasetItem> {
    try {
      const datasetsTable = getTableName({ indexName: TABLE_DATASETS, schemaName: getSchemaName(this.#schema) });
      const itemsTable = getTableName({ indexName: TABLE_DATASET_ITEMS, schemaName: getSchemaName(this.#schema) });
      const versionsTable = getTableName({
        indexName: TABLE_DATASET_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });

      const id = crypto.randomUUID();
      const versionId = crypto.randomUUID();
      const now = new Date();
      const nowIso = now.toISOString();

      let newVersion: number;
      let parentOrganizationId: string | null = null;
      let parentProjectId: string | null = null;

      await this.#db.client.tx(async t => {
        const row = await t.one(
          `UPDATE ${datasetsTable} SET "version" = "version" + 1 WHERE "id" = $1 RETURNING "version", "organizationId", "projectId"`,
          [args.datasetId],
        );
        newVersion = row.version as number;
        parentOrganizationId = (row.organizationId as string | null) ?? null;
        parentProjectId = (row.projectId as string | null) ?? null;

        await t.none(
          `INSERT INTO ${itemsTable} ("id","datasetId","datasetVersion","externalId","organizationId","projectId","validTo","isDeleted","input","groundTruth","expectedTrajectory","toolMocks","scorerIds","requestContext","metadata","source","createdAt","createdAtZ","updatedAt","updatedAtZ") VALUES ($1,$2,$3,$4,$5,$6,NULL,false,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
          [
            id,
            args.datasetId,
            newVersion,
            args.externalId ?? null,
            parentOrganizationId,
            parentProjectId,
            JSON.stringify(args.input),
            jsonbArg(args.groundTruth),
            jsonbArg(args.expectedTrajectory),
            jsonbArg(args.toolMocks),
            jsonbArg(args.scorerIds),
            jsonbArg(args.requestContext),
            jsonbArg(args.metadata),
            jsonbArg(args.source),
            nowIso,
            nowIso,
            nowIso,
            nowIso,
          ],
        );

        await t.none(
          `INSERT INTO ${versionsTable} ("id","datasetId","version","createdAt","createdAtZ") VALUES ($1,$2,$3,$4,$5)`,
          [versionId, args.datasetId, newVersion, nowIso, nowIso],
        );
      });

      return {
        id,
        datasetId: args.datasetId,
        datasetVersion: newVersion!,
        organizationId: parentOrganizationId,
        projectId: parentProjectId,
        input: args.input,
        groundTruth: args.groundTruth,
        expectedTrajectory: args.expectedTrajectory,
        toolMocks: args.toolMocks,
        scorerIds: args.scorerIds,
        requestContext: args.requestContext,
        metadata: args.metadata,
        source: args.source,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'ADD_ITEM', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  protected async _doUpdateItem(args: UpdateDatasetItemInput): Promise<DatasetItem> {
    try {
      const existing = await this.getItemById({ id: args.id });
      if (!existing) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'UPDATE_ITEM', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { itemId: args.id },
        });
      }
      if (existing.datasetId !== args.datasetId) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'UPDATE_ITEM', 'DATASET_MISMATCH'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { itemId: args.id, expectedDatasetId: args.datasetId, actualDatasetId: existing.datasetId },
        });
      }

      const datasetsTable = getTableName({ indexName: TABLE_DATASETS, schemaName: getSchemaName(this.#schema) });
      const itemsTable = getTableName({ indexName: TABLE_DATASET_ITEMS, schemaName: getSchemaName(this.#schema) });
      const versionsTable = getTableName({
        indexName: TABLE_DATASET_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });

      const versionId = crypto.randomUUID();
      const now = new Date();
      const nowIso = now.toISOString();

      // Merge fields: use new value if provided (including null to clear), else keep existing
      const mergedInput = args.input !== undefined ? args.input : existing.input;
      const mergedGroundTruth = args.groundTruth !== undefined ? args.groundTruth : existing.groundTruth;
      const mergedExpectedTrajectory =
        args.expectedTrajectory !== undefined ? args.expectedTrajectory : existing.expectedTrajectory;
      const mergedToolMocks = args.toolMocks !== undefined ? args.toolMocks : existing.toolMocks;
      const mergedScorerIds = args.scorerIds !== undefined ? (args.scorerIds ?? undefined) : existing.scorerIds;
      const mergedRequestContext = args.requestContext !== undefined ? args.requestContext : existing.requestContext;
      const mergedMetadata = args.metadata !== undefined ? args.metadata : existing.metadata;
      const mergedSource = args.source !== undefined ? args.source : existing.source;

      let newVersion: number;
      let parentOrganizationId: string | null = null;
      let parentProjectId: string | null = null;

      await this.#db.client.tx(async t => {
        // 1. Bump dataset version and read parent tenancy
        const row = await t.one(
          `UPDATE ${datasetsTable} SET "version" = "version" + 1 WHERE "id" = $1 RETURNING "version", "organizationId", "projectId"`,
          [args.datasetId],
        );
        newVersion = row.version as number;
        parentOrganizationId = (row.organizationId as string | null) ?? null;
        parentProjectId = (row.projectId as string | null) ?? null;

        // 2. Close old row (set validTo = newVersion)
        await t.none(
          `UPDATE ${itemsTable} SET "validTo" = $1 WHERE "id" = $2 AND "validTo" IS NULL AND "isDeleted" = false`,
          [newVersion, args.id],
        );

        // 3. Insert new row with merged fields, preserving original createdAt;
        //    tenancy is re-inherited from parent dataset (Option B)
        await t.none(
          `INSERT INTO ${itemsTable} ("id","datasetId","datasetVersion","externalId","organizationId","projectId","validTo","isDeleted","input","groundTruth","expectedTrajectory","toolMocks","scorerIds","requestContext","metadata","source","createdAt","createdAtZ","updatedAt","updatedAtZ") VALUES ($1,$2,$3,$4,$5,$6,NULL,false,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
          [
            args.id,
            args.datasetId,
            newVersion,
            existing.externalId ?? null,
            parentOrganizationId,
            parentProjectId,
            JSON.stringify(mergedInput),
            jsonbArg(mergedGroundTruth),
            jsonbArg(mergedExpectedTrajectory),
            jsonbArg(mergedToolMocks),
            jsonbArg(mergedScorerIds),
            jsonbArg(mergedRequestContext),
            jsonbArg(mergedMetadata),
            jsonbArg(mergedSource),
            existing.createdAt.toISOString(),
            existing.createdAt.toISOString(),
            nowIso,
            nowIso,
          ],
        );

        // 4. Insert dataset_version row
        await t.none(
          `INSERT INTO ${versionsTable} ("id","datasetId","version","createdAt","createdAtZ") VALUES ($1,$2,$3,$4,$5)`,
          [versionId, args.datasetId, newVersion, nowIso, nowIso],
        );
      });

      return {
        ...existing,
        datasetVersion: newVersion!,
        organizationId: parentOrganizationId,
        projectId: parentProjectId,
        input: mergedInput,
        groundTruth: mergedGroundTruth,
        expectedTrajectory: mergedExpectedTrajectory,
        toolMocks: mergedToolMocks,
        scorerIds: mergedScorerIds,
        requestContext: mergedRequestContext,
        metadata: mergedMetadata,
        source: mergedSource,
        updatedAt: now,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UPDATE_ITEM', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  protected async _doDeleteItem({ id, datasetId }: DeleteDatasetItemInput): Promise<void> {
    try {
      const existing = await this.getItemById({ id });
      if (!existing) return; // no-op if not found
      if (existing.datasetId !== datasetId) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'DELETE_ITEM', 'DATASET_MISMATCH'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { itemId: id, expectedDatasetId: datasetId, actualDatasetId: existing.datasetId },
        });
      }

      const datasetsTable = getTableName({ indexName: TABLE_DATASETS, schemaName: getSchemaName(this.#schema) });
      const itemsTable = getTableName({ indexName: TABLE_DATASET_ITEMS, schemaName: getSchemaName(this.#schema) });
      const versionsTable = getTableName({
        indexName: TABLE_DATASET_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });

      const versionId = crypto.randomUUID();
      const nowIso = new Date().toISOString();

      await this.#db.client.tx(async t => {
        // 1. Bump dataset version and re-inherit tenancy from parent
        const row = await t.one(
          `UPDATE ${datasetsTable} SET "version" = "version" + 1 WHERE "id" = $1 RETURNING "version", "organizationId", "projectId"`,
          [datasetId],
        );
        const newVersion = row.version as number;
        const parentOrganizationId = (row.organizationId as string | null) ?? null;
        const parentProjectId = (row.projectId as string | null) ?? null;

        // 2. Close old row
        await t.none(
          `UPDATE ${itemsTable} SET "validTo" = $1 WHERE "id" = $2 AND "validTo" IS NULL AND "isDeleted" = false`,
          [newVersion, id],
        );

        // 3. Insert tombstone (isDeleted=true, validTo=NULL — tombstone is the "current" terminal version);
        //    tenancy re-inherited from parent dataset
        await t.none(
          `INSERT INTO ${itemsTable} ("id","datasetId","datasetVersion","externalId","organizationId","projectId","validTo","isDeleted","input","groundTruth","expectedTrajectory","toolMocks","scorerIds","requestContext","metadata","source","createdAt","createdAtZ","updatedAt","updatedAtZ") VALUES ($1,$2,$3,$4,$5,$6,NULL,true,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
          [
            id,
            datasetId,
            newVersion,
            existing.externalId ?? null,
            parentOrganizationId,
            parentProjectId,
            JSON.stringify(existing.input),
            jsonbArg(existing.groundTruth),
            jsonbArg(existing.expectedTrajectory),
            jsonbArg(existing.toolMocks),
            jsonbArg(existing.scorerIds),
            jsonbArg(existing.requestContext),
            jsonbArg(existing.metadata),
            jsonbArg(existing.source),
            existing.createdAt.toISOString(),
            existing.createdAt.toISOString(),
            nowIso,
            nowIso,
          ],
        );

        // 4. Insert dataset_version row
        await t.none(
          `INSERT INTO ${versionsTable} ("id","datasetId","version","createdAt","createdAtZ") VALUES ($1,$2,$3,$4,$5)`,
          [versionId, datasetId, newVersion, nowIso, nowIso],
        );
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_ITEM', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  protected async _doBatchInsertItems(input: BatchInsertItemsInput): Promise<DatasetItem[]> {
    try {
      if (input.items.length === 0) return [];
      const datasetsTable = getTableName({ indexName: TABLE_DATASETS, schemaName: getSchemaName(this.#schema) });
      const itemsTable = getTableName({ indexName: TABLE_DATASET_ITEMS, schemaName: getSchemaName(this.#schema) });
      const versionsTable = getTableName({
        indexName: TABLE_DATASET_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      let results: DatasetItem[] = [];

      await this.#db.client.tx(async t => {
        const dataset = await t.oneOrNone(
          `SELECT "version", "organizationId", "projectId" FROM ${datasetsTable} WHERE "id" = $1 FOR UPDATE`,
          [input.datasetId],
        );
        if (!dataset)
          throw new MastraError({
            id: createStorageErrorId('PG', 'BULK_ADD_ITEMS', 'DATASET_NOT_FOUND'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { datasetId: input.datasetId },
          });

        const externalIds = [...new Set(input.items.flatMap(item => (item.externalId ? [item.externalId] : [])))];
        const historyRows = externalIds.length
          ? await t.manyOrNone(
              `SELECT * FROM ${itemsTable} WHERE "datasetId" = $1 AND "externalId" = ANY($2::text[]) ORDER BY "datasetVersion"`,
              [input.datasetId, externalIds],
            )
          : [];
        const plan = this.planDatasetItemBatch(
          input.items,
          historyRows.map(row => this.transformItemRowFull(row)),
          () => crypto.randomUUID(),
        );
        const resolved = new Map<string, DatasetItem>(
          [...plan.existingCurrentItems].map(([id, row]) => [id, this.datasetItemFromRow(row)]),
        );
        if (plan.inserts.length > 0) {
          const newVersion = Number(dataset.version) + 1;
          const now = new Date();
          const nowIso = now.toISOString();
          await t.none(`UPDATE ${datasetsTable} SET "version" = $2 WHERE "id" = $1`, [input.datasetId, newVersion]);
          for (const { id, item } of plan.inserts) {
            await t.none(
              `INSERT INTO ${itemsTable} ("id","datasetId","datasetVersion","externalId","organizationId","projectId","validTo","isDeleted","input","groundTruth","expectedTrajectory","toolMocks","scorerIds","requestContext","metadata","source","createdAt","createdAtZ","updatedAt","updatedAtZ") VALUES ($1,$2,$3,$4,$5,$6,NULL,false,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
              [
                id,
                input.datasetId,
                newVersion,
                item.externalId ?? null,
                dataset.organizationId ?? null,
                dataset.projectId ?? null,
                JSON.stringify(item.input),
                jsonbArg(item.groundTruth),
                jsonbArg(item.expectedTrajectory),
                jsonbArg(item.toolMocks),
                jsonbArg(item.scorerIds),
                jsonbArg(item.requestContext),
                jsonbArg(item.metadata),
                jsonbArg(item.source),
                nowIso,
                nowIso,
                nowIso,
                nowIso,
              ],
            );
            resolved.set(id, {
              id,
              datasetId: input.datasetId,
              datasetVersion: newVersion,
              externalId: item.externalId ?? null,
              organizationId: dataset.organizationId ?? null,
              projectId: dataset.projectId ?? null,
              input: item.input,
              groundTruth: item.groundTruth,
              expectedTrajectory: item.expectedTrajectory,
              toolMocks: item.toolMocks,
              scorerIds: item.scorerIds,
              requestContext: item.requestContext,
              metadata: item.metadata,
              source: item.source,
              createdAt: now,
              updatedAt: now,
            });
          }
          await t.none(
            `INSERT INTO ${versionsTable} ("id","datasetId","version","createdAt","createdAtZ") VALUES ($1,$2,$3,$4,$5)`,
            [crypto.randomUUID(), input.datasetId, newVersion, nowIso, nowIso],
          );
        }
        results = plan.resolvedIds.map(id => resolved.get(id)!);
      });
      return results;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'BULK_ADD_ITEMS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  protected async _doBatchDeleteItems(input: BatchDeleteItemsInput): Promise<void> {
    try {
      const dataset = await this.getDatasetById({ id: input.datasetId });
      if (!dataset) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'BULK_DELETE_ITEMS', 'DATASET_NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { datasetId: input.datasetId },
        });
      }

      // Fetch current items outside tx (same as LibSQL — skip items not found or mismatched)
      const currentItems: DatasetItem[] = [];
      for (const itemId of input.itemIds) {
        const item = await this.getItemById({ id: itemId });
        if (item && item.datasetId === input.datasetId) {
          currentItems.push(item);
        }
      }
      if (currentItems.length === 0) return;

      const datasetsTable = getTableName({ indexName: TABLE_DATASETS, schemaName: getSchemaName(this.#schema) });
      const itemsTable = getTableName({ indexName: TABLE_DATASET_ITEMS, schemaName: getSchemaName(this.#schema) });
      const versionsTable = getTableName({
        indexName: TABLE_DATASET_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });

      const nowIso = new Date().toISOString();
      const versionId = crypto.randomUUID();

      // Tenancy re-inherited from parent dataset (Option B)
      const parentOrganizationId = dataset.organizationId ?? null;
      const parentProjectId = dataset.projectId ?? null;

      await this.#db.client.tx(async t => {
        // 1. Single version bump
        const row = await t.one(
          `UPDATE ${datasetsTable} SET "version" = "version" + 1 WHERE "id" = $1 RETURNING "version"`,
          [input.datasetId],
        );
        const newVersion = row.version as number;

        // 2. For each item: close old row + insert tombstone
        for (const item of currentItems) {
          await t.none(
            `UPDATE ${itemsTable} SET "validTo" = $1 WHERE "id" = $2 AND "validTo" IS NULL AND "isDeleted" = false`,
            [newVersion, item.id],
          );
          await t.none(
            `INSERT INTO ${itemsTable} ("id","datasetId","datasetVersion","externalId","organizationId","projectId","validTo","isDeleted","input","groundTruth","expectedTrajectory","toolMocks","scorerIds","requestContext","metadata","source","createdAt","createdAtZ","updatedAt","updatedAtZ") VALUES ($1,$2,$3,$4,$5,$6,NULL,true,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
            [
              item.id,
              input.datasetId,
              newVersion,
              item.externalId ?? null,
              parentOrganizationId,
              parentProjectId,
              JSON.stringify(item.input),
              jsonbArg(item.groundTruth),
              jsonbArg(item.expectedTrajectory),
              jsonbArg(item.toolMocks),
              jsonbArg(item.scorerIds),
              jsonbArg(item.requestContext),
              jsonbArg(item.metadata),
              jsonbArg(item.source),
              item.createdAt.toISOString(),
              item.createdAt.toISOString(),
              nowIso,
              nowIso,
            ],
          );
        }

        // 3. Single dataset_version row
        await t.none(
          `INSERT INTO ${versionsTable} ("id","datasetId","version","createdAt","createdAtZ") VALUES ($1,$2,$3,$4,$5)`,
          [versionId, input.datasetId, newVersion, nowIso, nowIso],
        );
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'BULK_DELETE_ITEMS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // --- SCD-2 queries ---

  async getItemById(args: { id: string; datasetVersion?: number }): Promise<DatasetItem | null> {
    try {
      const tableName = getTableName({ indexName: TABLE_DATASET_ITEMS, schemaName: getSchemaName(this.#schema) });
      let result;

      if (args.datasetVersion !== undefined) {
        result = await this.#db.client.oneOrNone(
          `SELECT * FROM ${tableName} WHERE "id" = $1 AND "datasetVersion" = $2 AND "isDeleted" = false`,
          [args.id, args.datasetVersion],
        );
      } else {
        result = await this.#db.client.oneOrNone(
          `SELECT * FROM ${tableName} WHERE "id" = $1 AND "validTo" IS NULL AND "isDeleted" = false`,
          [args.id],
        );
      }

      return result ? this.transformItemRow(result) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_ITEM', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getItemsByVersion({ datasetId, version }: { datasetId: string; version: number }): Promise<DatasetItem[]> {
    try {
      const tableName = getTableName({ indexName: TABLE_DATASET_ITEMS, schemaName: getSchemaName(this.#schema) });
      const rows = await this.#db.client.manyOrNone(
        `SELECT * FROM ${tableName} WHERE "datasetId" = $1 AND "datasetVersion" <= $2 AND ("validTo" IS NULL OR "validTo" > $3) AND "isDeleted" = false ORDER BY "createdAt" DESC, "id" ASC`,
        [datasetId, version, version],
      );
      return (rows || []).map(row => this.transformItemRow(row));
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_ITEMS_BY_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getItemHistory(itemId: string): Promise<DatasetItemRow[]> {
    try {
      const tableName = getTableName({ indexName: TABLE_DATASET_ITEMS, schemaName: getSchemaName(this.#schema) });
      const rows = await this.#db.client.manyOrNone(
        `SELECT * FROM ${tableName} WHERE "id" = $1 ORDER BY "datasetVersion" DESC`,
        [itemId],
      );
      return (rows || []).map(row => this.transformItemRowFull(row));
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_ITEM_HISTORY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listItems(args: ListDatasetItemsInput): Promise<ListDatasetItemsOutput> {
    try {
      const { page, perPage: perPageInput } = args.pagination;
      const tableName = getTableName({ indexName: TABLE_DATASET_ITEMS, schemaName: getSchemaName(this.#schema) });

      // Build WHERE conditions
      const conditions: string[] = ['"datasetId" = $1'];
      const queryParams: any[] = [args.datasetId];
      let paramIndex = 2;

      if (args.version !== undefined) {
        // SCD-2 time-travel
        conditions.push(`"datasetVersion" <= $${paramIndex++}`);
        queryParams.push(args.version);
        conditions.push(`("validTo" IS NULL OR "validTo" > $${paramIndex++})`);
        queryParams.push(args.version);
        conditions.push(`"isDeleted" = false`);
      } else {
        // Current items only
        conditions.push(`"validTo" IS NULL`);
        conditions.push(`"isDeleted" = false`);
      }

      if (args.search) {
        conditions.push(
          `("input"::text ILIKE $${paramIndex} OR COALESCE("groundTruth"::text, '') ILIKE $${paramIndex})`,
        );
        queryParams.push(`%${args.search}%`);
        paramIndex++;
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

      // Count
      const countResult = await this.#db.client.one(
        `SELECT COUNT(*) as count FROM ${tableName} ${whereClause}`,
        queryParams,
      );
      const total = parseInt(countResult.count, 10);

      if (total === 0) {
        return { items: [], pagination: { total: 0, page, perPage: perPageInput, hasMore: false } };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;

      const rows = await this.#db.client.manyOrNone(
        `SELECT * FROM ${tableName} ${whereClause} ORDER BY "createdAt" DESC, "id" ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...queryParams, limitValue, offset],
      );

      return {
        items: (rows || []).map(row => this.transformItemRow(row)),
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
          id: createStorageErrorId('PG', 'LIST_ITEMS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // --- Dataset versions ---

  async createDatasetVersion(datasetId: string, version: number): Promise<DatasetVersion> {
    try {
      const id = crypto.randomUUID();
      const now = new Date();
      const nowIso = now.toISOString();

      await this.#db.insert({
        tableName: TABLE_DATASET_VERSIONS,
        record: { id, datasetId, version, createdAt: nowIso },
      });

      return { id, datasetId, version, createdAt: now };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'CREATE_DATASET_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listDatasetVersions(input: ListDatasetVersionsInput): Promise<ListDatasetVersionsOutput> {
    try {
      const { page, perPage: perPageInput } = input.pagination;
      const tableName = getTableName({ indexName: TABLE_DATASET_VERSIONS, schemaName: getSchemaName(this.#schema) });

      const countResult = await this.#db.client.one(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE "datasetId" = $1`,
        [input.datasetId],
      );
      const total = parseInt(countResult.count, 10);

      if (total === 0) {
        return { versions: [], pagination: { total: 0, page, perPage: perPageInput, hasMore: false } };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;

      const rows = await this.#db.client.manyOrNone(
        `SELECT * FROM ${tableName} WHERE "datasetId" = $1 ORDER BY "version" DESC LIMIT $2 OFFSET $3`,
        [input.datasetId, limitValue, offset],
      );

      return {
        versions: (rows || []).map(row => this.transformDatasetVersionRow(row)),
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
          id: createStorageErrorId('PG', 'LIST_DATASET_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // --- Clear ---

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_DATASET_VERSIONS });
    await this.#db.clearTable({ tableName: TABLE_DATASET_ITEMS });
    await this.#db.clearTable({ tableName: TABLE_DATASETS });
  }
}
