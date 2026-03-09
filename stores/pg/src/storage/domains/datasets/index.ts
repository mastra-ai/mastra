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
  ListDatasetsInput,
  ListDatasetsOutput,
  ListDatasetItemsInput,
  ListDatasetItemsOutput,
  ListDatasetVersionsInput,
  ListDatasetVersionsOutput,
  BatchInsertItemsInput,
  BatchDeleteItemsInput,
  CreateIndexOptions,
} from '@mastra/core/storage';
import { PgDB, resolvePgConfig, generateTableSQL } from '../../db';
import type { PgDomainConfig } from '../../db';
import { getTableName, getSchemaName } from '../utils';

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
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
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
      input: safelyParseJSON(row.input),
      groundTruth: row.groundTruth ? safelyParseJSON(row.groundTruth) : undefined,
      metadata: row.metadata ? safelyParseJSON(row.metadata) : undefined,
      createdAt: ensureDate(row.createdAtZ || row.createdAt)!,
      updatedAt: ensureDate(row.updatedAtZ || row.updatedAt)!,
    };
  }

  private transformItemRowFull(row: Record<string, any>): DatasetItemRow {
    return {
      id: row.id as string,
      datasetId: row.datasetId as string,
      datasetVersion: row.datasetVersion as number,
      validTo: row.validTo as number | null,
      isDeleted: Boolean(row.isDeleted),
      input: safelyParseJSON(row.input),
      groundTruth: row.groundTruth ? safelyParseJSON(row.groundTruth) : undefined,
      metadata: row.metadata ? safelyParseJSON(row.metadata) : undefined,
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
      const id = crypto.randomUUID();
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
        version: 0,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
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

  async getDatasetById({ id }: { id: string }): Promise<DatasetRecord | null> {
    try {
      const tableName = getTableName({ indexName: TABLE_DATASETS, schemaName: getSchemaName(this.#schema) });
      const result = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE "id" = $1`, [id]);
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
      const existing = await this.getDatasetById({ id: args.id });
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

  async deleteDataset({ id }: { id: string }): Promise<void> {
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

      // Detach experiments — each wrapped in try/catch because experiment tables may not exist yet
      try {
        await this.#db.client.none(
          `DELETE FROM ${experimentResultsTable} WHERE "experimentId" IN (SELECT "id" FROM ${experimentsTable} WHERE "datasetId" = $1)`,
          [id],
        );
      } catch {
        /* table may not exist */
      }
      try {
        await this.#db.client.none(
          `UPDATE ${experimentsTable} SET "datasetId" = NULL, "datasetVersion" = NULL WHERE "datasetId" = $1`,
          [id],
        );
      } catch {
        /* table may not exist */
      }

      // Cascade delete — atomic transaction
      await this.#db.client.tx(async t => {
        await t.none(`DELETE FROM ${versionsTable} WHERE "datasetId" = $1`, [id]);
        await t.none(`DELETE FROM ${itemsTable} WHERE "datasetId" = $1`, [id]);
        await t.none(`DELETE FROM ${datasetsTable} WHERE "id" = $1`, [id]);
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

      const countResult = await this.#db.client.one(`SELECT COUNT(*) as count FROM ${tableName}`);
      const total = parseInt(countResult.count, 10);

      if (total === 0) {
        return { datasets: [], pagination: { total: 0, page, perPage: perPageInput, hasMore: false } };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;

      const rows = await this.#db.client.manyOrNone(
        `SELECT * FROM ${tableName} ORDER BY "createdAt" DESC, "id" ASC LIMIT $1 OFFSET $2`,
        [limitValue, offset],
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

      await this.#db.client.tx(async t => {
        const row = await t.one(
          `UPDATE ${datasetsTable} SET "version" = "version" + 1 WHERE "id" = $1 RETURNING "version"`,
          [args.datasetId],
        );
        newVersion = row.version as number;

        await t.none(
          `INSERT INTO ${itemsTable} ("id","datasetId","datasetVersion","validTo","isDeleted","input","groundTruth","metadata","createdAt","createdAtZ","updatedAt","updatedAtZ") VALUES ($1,$2,$3,NULL,false,$4,$5,$6,$7,$8,$9,$10)`,
          [
            id,
            args.datasetId,
            newVersion,
            JSON.stringify(args.input),
            jsonbArg(args.groundTruth),
            jsonbArg(args.metadata),
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
        input: args.input,
        groundTruth: args.groundTruth,
        metadata: args.metadata,
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

      // Merge fields: use new value if provided, else keep existing
      const mergedInput = args.input ?? existing.input;
      const mergedGroundTruth = args.groundTruth ?? existing.groundTruth;
      const mergedMetadata = args.metadata ?? existing.metadata;

      let newVersion: number;

      await this.#db.client.tx(async t => {
        // 1. Bump dataset version
        const row = await t.one(
          `UPDATE ${datasetsTable} SET "version" = "version" + 1 WHERE "id" = $1 RETURNING "version"`,
          [args.datasetId],
        );
        newVersion = row.version as number;

        // 2. Close old row (set validTo = newVersion)
        await t.none(
          `UPDATE ${itemsTable} SET "validTo" = $1 WHERE "id" = $2 AND "validTo" IS NULL AND "isDeleted" = false`,
          [newVersion, args.id],
        );

        // 3. Insert new row with merged fields, preserving original createdAt
        await t.none(
          `INSERT INTO ${itemsTable} ("id","datasetId","datasetVersion","validTo","isDeleted","input","groundTruth","metadata","createdAt","createdAtZ","updatedAt","updatedAtZ") VALUES ($1,$2,$3,NULL,false,$4,$5,$6,$7,$8,$9,$10)`,
          [
            args.id,
            args.datasetId,
            newVersion,
            JSON.stringify(mergedInput),
            jsonbArg(mergedGroundTruth),
            jsonbArg(mergedMetadata),
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
        input: mergedInput,
        groundTruth: mergedGroundTruth,
        metadata: mergedMetadata,
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

  protected async _doDeleteItem({ id, datasetId }: { id: string; datasetId: string }): Promise<void> {
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
        // 1. Bump dataset version
        const row = await t.one(
          `UPDATE ${datasetsTable} SET "version" = "version" + 1 WHERE "id" = $1 RETURNING "version"`,
          [datasetId],
        );
        const newVersion = row.version as number;

        // 2. Close old row
        await t.none(
          `UPDATE ${itemsTable} SET "validTo" = $1 WHERE "id" = $2 AND "validTo" IS NULL AND "isDeleted" = false`,
          [newVersion, id],
        );

        // 3. Insert tombstone (isDeleted=true, validTo=NULL — tombstone is the "current" terminal version)
        await t.none(
          `INSERT INTO ${itemsTable} ("id","datasetId","datasetVersion","validTo","isDeleted","input","groundTruth","metadata","createdAt","createdAtZ","updatedAt","updatedAtZ") VALUES ($1,$2,$3,NULL,true,$4,$5,$6,$7,$8,$9,$10)`,
          [
            id,
            datasetId,
            newVersion,
            JSON.stringify(existing.input),
            jsonbArg(existing.groundTruth),
            jsonbArg(existing.metadata),
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
      const dataset = await this.getDatasetById({ id: input.datasetId });
      if (!dataset) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'BULK_ADD_ITEMS', 'DATASET_NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { datasetId: input.datasetId },
        });
      }

      const datasetsTable = getTableName({ indexName: TABLE_DATASETS, schemaName: getSchemaName(this.#schema) });
      const itemsTable = getTableName({ indexName: TABLE_DATASET_ITEMS, schemaName: getSchemaName(this.#schema) });
      const versionsTable = getTableName({
        indexName: TABLE_DATASET_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });

      const now = new Date();
      const nowIso = now.toISOString();
      const versionId = crypto.randomUUID();

      // Pre-generate IDs
      const itemsWithIds = input.items.map(itemInput => ({ id: crypto.randomUUID(), input: itemInput }));

      let newVersion: number;

      await this.#db.client.tx(async t => {
        // 1. Single version bump
        const row = await t.one(
          `UPDATE ${datasetsTable} SET "version" = "version" + 1 WHERE "id" = $1 RETURNING "version"`,
          [input.datasetId],
        );
        newVersion = row.version as number;

        // 2. N item inserts
        for (const { id, input: itemInput } of itemsWithIds) {
          await t.none(
            `INSERT INTO ${itemsTable} ("id","datasetId","datasetVersion","validTo","isDeleted","input","groundTruth","metadata","createdAt","createdAtZ","updatedAt","updatedAtZ") VALUES ($1,$2,$3,NULL,false,$4,$5,$6,$7,$8,$9,$10)`,
            [
              id,
              input.datasetId,
              newVersion,
              JSON.stringify(itemInput.input),
              jsonbArg(itemInput.groundTruth),
              jsonbArg(itemInput.metadata),
              nowIso,
              nowIso,
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

      return itemsWithIds.map(({ id, input: itemInput }) => ({
        id,
        datasetId: input.datasetId,
        datasetVersion: newVersion!,
        input: itemInput.input,
        groundTruth: itemInput.groundTruth,
        metadata: itemInput.metadata,
        createdAt: now,
        updatedAt: now,
      }));
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
            `INSERT INTO ${itemsTable} ("id","datasetId","datasetVersion","validTo","isDeleted","input","groundTruth","metadata","createdAt","createdAtZ","updatedAt","updatedAtZ") VALUES ($1,$2,$3,NULL,true,$4,$5,$6,$7,$8,$9,$10)`,
            [
              item.id,
              input.datasetId,
              newVersion,
              JSON.stringify(item.input),
              jsonbArg(item.groundTruth),
              jsonbArg(item.metadata),
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
