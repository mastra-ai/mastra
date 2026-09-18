import { randomUUID } from 'node:crypto';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  TABLE_DATASETS,
  TABLE_DATASET_ITEMS,
  TABLE_DATASET_VERSIONS,
  TABLE_DATASET_SNAPSHOT_IDENTITIES,
  TABLE_DATASET_SNAPSHOT_IMPORTS,
  captureDatasetSnapshot,
  datasetSnapshotIdentityId,
  datasetSnapshotRecordEntries,
  datasetSnapshotDestinationExists,
  datasetSnapshotStorageError,
  verifyDatasetSnapshotImport,
  verifyDatasetSnapshotReceipt,
  TABLE_EXPERIMENTS,
  TABLE_EXPERIMENT_RESULTS,
  TABLE_SCHEMAS,
  DATASETS_SCHEMA,
  DATASET_ITEMS_SCHEMA,
  DATASET_VERSIONS_SCHEMA,
  DatasetsStorage,
  calculatePagination,
  normalizePerPage,
  hasErrorCode,
} from '@mastra/core/storage';
import type {
  CreateIndexOptions,
  DatasetRecord,
  DatasetItem,
  DatasetItemRow,
  DatasetVersion,
  CreateDatasetInput,
  UpdateDatasetInput,
  AddDatasetItemInput,
  UpdateDatasetItemInput,
  DeleteDatasetItemInput,
  PurgeDatasetItemInput,
  ListDatasetsInput,
  ListDatasetsOutput,
  ListDatasetItemsInput,
  ListDatasetItemsOutput,
  ListDatasetVersionsInput,
  ListDatasetVersionsOutput,
  BatchInsertItemsInput,
  BatchDeleteItemsInput,
  DatasetTenancyFilters,
  TargetType,
  DatasetSnapshotExportOptions,
  PreparedDatasetSnapshotImport,
  DatasetSnapshotImportPlan,
  DatasetSnapshotImportResult,
  DatasetSnapshotImportReceipt,
  DatasetSnapshotIdentityRecord,
  TABLE_NAMES,
} from '@mastra/core/storage';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { StoreOperationsMySQL } from '../operations';
import { generateTableSQL } from '../operations';
import { formatTableName, parseDateTime, quoteIdentifier, transformToSqlValue } from '../utils';

function parseJSON<T>(value: unknown): T | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      // mysql2 auto-parses JSON columns, so a non-JSON string here means the
      // stored payload was a JSON string scalar (e.g. input: 'foo' was stored
      // as `"foo"` and the driver already unwrapped it). Return it as-is.
      return value as unknown as T;
    }
  }
  if (typeof value === 'object') return value as T;
  return value as T;
}

function parseOptionalJSON<T>(value: unknown, emptyValue: null | undefined): T | null | undefined {
  return value === null || value === undefined ? emptyValue : parseJSON<T>(value);
}

function jsonArg(value: unknown): string | null {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

function jsonDataArg(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

// Read authored JSON as text so the driver cannot collapse JSON null into SQL NULL
// or leave a JSON-looking string indistinguishable from serialized JSON.
const ITEM_SELECT_COLUMNS = Object.keys(DATASET_ITEMS_SCHEMA)
  .map(column => {
    const name = quoteIdentifier(column, 'column name');
    return ['input', 'groundTruth', 'expectedTrajectory'].includes(column)
      ? `CAST(${name} AS CHAR CHARACTER SET utf8mb4) AS ${name}`
      : name;
  })
  .join(', ');

export class DatasetsMySQL extends DatasetsStorage {
  private pool: Pool;
  private operations: StoreOperationsMySQL;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  /** Tables managed by this domain */
  static readonly MANAGED_TABLES = [
    TABLE_DATASETS,
    TABLE_DATASET_ITEMS,
    TABLE_DATASET_VERSIONS,
    TABLE_DATASET_SNAPSHOT_IDENTITIES,
    TABLE_DATASET_SNAPSHOT_IMPORTS,
  ] as const;

  override readonly supportsSnapshotTransfer: boolean = true;

  protected async validateSnapshotImportCapability(prepared: PreparedDatasetSnapshotImport): Promise<void> {
    for (const item of prepared.content.items) this.#rejectToolMocks(item.payload.toolMocks);
  }

  private async withSnapshotTransaction<T>(work: (connection: PoolConnection) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async insertSnapshotRecord(connection: PoolConnection, table: TABLE_NAMES, record: object): Promise<void> {
    const entries = datasetSnapshotRecordEntries(table, record);
    const values = entries.map(([, value, type]) =>
      type === 'jsonb' ? jsonDataArg(value) : transformToSqlValue(value),
    );
    await connection.execute(
      `INSERT INTO ${formatTableName(table)} (${entries.map(([column]) => quoteIdentifier(column, 'column name')).join(', ')}) VALUES (${entries.map(() => '?').join(', ')})`,
      values,
    );
  }

  private async snapshotState(
    connection: PoolConnection,
    datasetId: string,
    version?: number,
    filters?: DatasetTenancyFilters,
  ) {
    const conditions = ['id = ?'];
    const values = [datasetId];
    for (const column of ['organizationId', 'projectId'] as const) {
      if (filters?.[column] !== undefined) {
        conditions.push(`${quoteIdentifier(column, 'column name')} = ?`);
        values.push(filters[column]);
      }
    }
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT * FROM ${formatTableName(TABLE_DATASETS)} WHERE ${conditions.join(' AND ')} FOR UPDATE`,
      values,
    );
    if (!rows[0]) throw datasetSnapshotStorageError('DATASET_NOT_FOUND', 'Dataset not found');
    const dataset = this.mapDataset(rows[0]);
    const selectedVersion = version ?? dataset.version;
    const [items] = await connection.execute<RowDataPacket[]>(
      `SELECT ${ITEM_SELECT_COLUMNS} FROM ${formatTableName(TABLE_DATASET_ITEMS)} WHERE \`datasetId\` = ? AND \`datasetVersion\` <= ? AND (\`validTo\` IS NULL OR \`validTo\` > ?) AND \`isDeleted\` = FALSE`,
      [datasetId, selectedVersion, selectedVersion],
    );
    const [identities] = await connection.execute<Array<RowDataPacket & DatasetSnapshotIdentityRecord>>(
      `SELECT * FROM ${formatTableName(TABLE_DATASET_SNAPSHOT_IDENTITIES)} WHERE \`datasetId\` = ?`,
      [datasetId],
    );
    return { dataset, items: items.map(item => this.mapItem(item)), identities };
  }

  private async snapshotReceipt(connection: PoolConnection, id: string): Promise<DatasetSnapshotImportReceipt | null> {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT receipt FROM ${formatTableName(TABLE_DATASET_SNAPSHOT_IMPORTS)} WHERE id = ? FOR UPDATE`,
      [id],
    );
    return rows[0] ? (parseJSON<DatasetSnapshotImportReceipt>(rows[0].receipt) ?? null) : null;
  }

  private async snapshotImportResult(
    connection: PoolConnection,
    receipt: DatasetSnapshotImportReceipt,
  ): Promise<DatasetSnapshotImportResult> {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT * FROM ${formatTableName(TABLE_DATASETS)} WHERE id = ? AND \`organizationId\` <=> ? AND \`projectId\` <=> ? FOR UPDATE`,
      [receipt.datasetId, receipt.organizationId, receipt.projectId],
    );
    const [identities] = await connection.execute<Array<RowDataPacket & DatasetSnapshotIdentityRecord>>(
      `SELECT * FROM ${formatTableName(TABLE_DATASET_SNAPSHOT_IDENTITIES)} WHERE id = ?`,
      [datasetSnapshotIdentityId(receipt.datasetId, null)],
    );
    return {
      receipt,
      datasetExists: datasetSnapshotDestinationExists(
        receipt,
        rows[0] ? this.mapDataset(rows[0]) : null,
        identities[0] ?? null,
      ),
    };
  }

  protected async _doExportSnapshot(
    input: DatasetSnapshotExportOptions & { datasetId: string; filters?: DatasetTenancyFilters },
  ) {
    return this.withSnapshotTransaction(async connection => {
      const state = await this.snapshotState(connection, input.datasetId, input.version, input.filters);
      const captured = captureDatasetSnapshot({
        ...state,
        version: input.version ?? state.dataset.version,
        options: { maxBytes: input.maxBytes },
      });
      for (const identity of captured.adopted)
        await this.insertSnapshotRecord(connection, TABLE_DATASET_SNAPSHOT_IDENTITIES, identity);
      return captured.snapshot;
    });
  }

  protected async _doImportSnapshot(
    prepared: PreparedDatasetSnapshotImport,
    plan: DatasetSnapshotImportPlan,
  ): Promise<DatasetSnapshotImportResult> {
    return this.withSnapshotTransaction(async connection => {
      // Claim the unique receipt key before creating any destination records.
      await connection.execute(
        `INSERT INTO ${formatTableName(TABLE_DATASET_SNAPSHOT_IMPORTS)} (id, receipt) VALUES (?, ?) ON DUPLICATE KEY UPDATE id = id`,
        [prepared.receiptId, JSON.stringify(plan.receipt)],
      );
      const existing = await this.snapshotReceipt(connection, prepared.receiptId);
      if (!existing)
        throw datasetSnapshotStorageError('DATASET_SNAPSHOT_RECEIPT_NOT_FOUND', 'Snapshot import receipt not found');
      verifyDatasetSnapshotReceipt(existing, prepared);
      // `plan.dataset.id` is a fresh UUID for this call, so reading it back proves this
      // transaction won the claim. Any other value means a completed import already
      // holds the key and this call must replay its outcome instead of writing.
      if (existing.datasetId !== plan.dataset.id) return this.snapshotImportResult(connection, existing);
      await this.insertSnapshotRecord(connection, TABLE_DATASETS, plan.dataset);
      for (const item of plan.items) await this.insertSnapshotRecord(connection, TABLE_DATASET_ITEMS, item);
      if (plan.versionRecord) await this.insertSnapshotRecord(connection, TABLE_DATASET_VERSIONS, plan.versionRecord);
      for (const identity of plan.identities)
        await this.insertSnapshotRecord(connection, TABLE_DATASET_SNAPSHOT_IDENTITIES, identity);
      verifyDatasetSnapshotImport(plan, await this.snapshotState(connection, plan.dataset.id));
      // The claim already stored the complete receipt; it becomes visible at commit.
      return { receipt: plan.receipt, datasetExists: true };
    });
  }

  protected async _doGetSnapshotImport(id: string): Promise<DatasetSnapshotImportResult | null> {
    return this.withSnapshotTransaction(async connection => {
      const receipt = await this.snapshotReceipt(connection, id);
      return receipt ? this.snapshotImportResult(connection, receipt) : null;
    });
  }

  /**
   * Item-level tool mocks are not persisted by the MySQL adapter. Reject writes
   * that carry them so the feature fails loudly here instead of silently dropping
   * the mocks and then running tools live during experiments.
   */
  #rejectToolMocks(toolMocks: unknown): void {
    if (Array.isArray(toolMocks) && toolMocks.length > 0) {
      throw new MastraError({
        id: 'MYSQL_DATASET_TOOL_MOCKS_UNSUPPORTED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Tool mocks are not supported on the MySQL storage adapter. Use a supported adapter (LibSQL, PostgreSQL, MongoDB, or Spanner) to persist dataset item tool mocks.',
      });
    }
  }

  /**
   * Returns default index definitions for the datasets domain tables.
   * Currently no default indexes are defined for datasets.
   */
  static getDefaultIndexDefs(prefix: string = ''): CreateIndexOptions[] {
    return [
      {
        name: `${prefix}idx_dataset_snapshot_identities_dataset`,
        table: TABLE_DATASET_SNAPSHOT_IDENTITIES,
        columns: ['datasetId'],
      },
      {
        name: `${prefix}idx_dataset_items_dataset_externalid_version`,
        table: TABLE_DATASET_ITEMS,
        columns: ['datasetId', 'externalId', 'datasetVersion'],
      },
    ];
  }

  /**
   * Exports DDL statements for all managed tables.
   */
  static getExportDDL(): string[] {
    return [
      generateTableSQL({ tableName: TABLE_DATASETS, schema: TABLE_SCHEMAS[TABLE_DATASETS] }),
      generateTableSQL({
        tableName: TABLE_DATASET_ITEMS,
        schema: TABLE_SCHEMAS[TABLE_DATASET_ITEMS],
        compositePrimaryKey: ['id', 'datasetVersion'],
      }),
      generateTableSQL({ tableName: TABLE_DATASET_VERSIONS, schema: TABLE_SCHEMAS[TABLE_DATASET_VERSIONS] }),
      generateTableSQL({
        tableName: TABLE_DATASET_SNAPSHOT_IDENTITIES,
        schema: TABLE_SCHEMAS[TABLE_DATASET_SNAPSHOT_IDENTITIES],
      }),
      generateTableSQL({
        tableName: TABLE_DATASET_SNAPSHOT_IMPORTS,
        schema: TABLE_SCHEMAS[TABLE_DATASET_SNAPSHOT_IMPORTS],
      }),
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
    this.#indexes = indexes?.filter(idx => (DatasetsMySQL.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  /**
   * Returns default index definitions for the datasets domain tables.
   */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return DatasetsMySQL.getDefaultIndexDefs('');
  }

  /**
   * Creates default indexes for optimal query performance.
   * Currently no default indexes are defined for datasets.
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
    await this.operations.createTable({ tableName: TABLE_DATASETS, schema: DATASETS_SCHEMA });
    await this.operations.createTable({ tableName: TABLE_DATASET_ITEMS as any, schema: DATASET_ITEMS_SCHEMA });
    await this.operations.createTable({ tableName: TABLE_DATASET_VERSIONS, schema: DATASET_VERSIONS_SCHEMA });
    await this.operations.createTable({
      tableName: TABLE_DATASET_SNAPSHOT_IDENTITIES,
      schema: TABLE_SCHEMAS[TABLE_DATASET_SNAPSHOT_IDENTITIES],
    });
    await this.operations.createTable({
      tableName: TABLE_DATASET_SNAPSHOT_IMPORTS,
      schema: TABLE_SCHEMAS[TABLE_DATASET_SNAPSHOT_IMPORTS],
    });
    // Backfill tenancy + candidate identity columns on pre-existing tables so
    // older deployments keep working when they upgrade in place.
    await this.operations.alterTable({
      tableName: TABLE_DATASETS,
      schema: DATASETS_SCHEMA,
      ifNotExists: [
        'organizationId',
        'projectId',
        'candidateKey',
        'candidateId',
        'requestContextSchema',
        'tags',
        'targetType',
        'targetIds',
        'scorerIds',
      ],
    });
    await this.operations.alterTable({
      tableName: TABLE_DATASET_ITEMS as any,
      schema: DATASET_ITEMS_SCHEMA,
      ifNotExists: [
        'organizationId',
        'projectId',
        'requestContext',
        'source',
        'expectedTrajectory',
        'toolMocks',
        'unmockedToolPolicy',
        'scorerIds',
        'externalId',
      ],
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.pool.execute(`DELETE FROM ${formatTableName(TABLE_DATASET_SNAPSHOT_IMPORTS)}`);
    await this.pool.execute(`DELETE FROM ${formatTableName(TABLE_DATASET_SNAPSHOT_IDENTITIES)}`);
    await this.pool.execute(`DELETE FROM ${formatTableName(TABLE_DATASET_VERSIONS)}`);
    await this.pool.execute(`DELETE FROM ${formatTableName(TABLE_DATASET_ITEMS)}`);
    await this.pool.execute(`DELETE FROM ${formatTableName(TABLE_DATASETS)}`);
  }

  private async experimentTablesExist(): Promise<boolean> {
    const [rows] = await this.pool.execute<any[]>(
      `SELECT COUNT(*) AS c FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name IN (?, ?)`,
      [TABLE_EXPERIMENTS, TABLE_EXPERIMENT_RESULTS],
    );
    const row = Array.isArray(rows) ? (rows[0] as { c?: number | string } | undefined) : undefined;
    return Number(row?.c ?? 0) === 2;
  }

  // --- Row transformers ---

  private mapDataset(row: Record<string, any>): DatasetRecord {
    return {
      id: row.id as string,
      name: row.name as string,
      description: (row.description as string | null) ?? undefined,
      metadata: parseJSON<Record<string, unknown>>(row.metadata),
      inputSchema: parseJSON<Record<string, unknown>>(row.inputSchema),
      groundTruthSchema: parseJSON<Record<string, unknown>>(row.groundTruthSchema),
      requestContextSchema: parseJSON<Record<string, unknown>>(row.requestContextSchema),
      tags: parseJSON<string[]>(row.tags),
      targetType: (row.targetType as TargetType | null | undefined) ?? undefined,
      targetIds: parseJSON<string[]>(row.targetIds),
      scorerIds: parseJSON<string[]>(row.scorerIds),
      version: row.version as number,
      organizationId: (row.organizationId as string | null | undefined) ?? null,
      projectId: (row.projectId as string | null | undefined) ?? null,
      candidateKey: (row.candidateKey as string | null | undefined) ?? null,
      candidateId: (row.candidateId as string | null | undefined) ?? null,
      createdAt: parseDateTime(row.createdAt) ?? new Date(),
      updatedAt: parseDateTime(row.updatedAt) ?? new Date(),
    };
  }

  private mapItem(row: Record<string, any>): DatasetItem {
    const metadata = row.metadata ? parseJSON<Record<string, unknown>>(row.metadata) : undefined;
    const emptyValue = metadata?.__purged === true ? null : undefined;
    return {
      id: row.id as string,
      datasetId: row.datasetId as string,
      datasetVersion: row.datasetVersion as number,
      externalId: (row.externalId as string | null | undefined) ?? null,
      organizationId: (row.organizationId as string | null | undefined) ?? null,
      projectId: (row.projectId as string | null | undefined) ?? null,
      input: row.input === null ? null : parseJSON<Record<string, unknown>>(row.input),
      groundTruth: parseOptionalJSON<Record<string, unknown>>(row.groundTruth, emptyValue),
      expectedTrajectory: parseOptionalJSON<DatasetItem['expectedTrajectory']>(row.expectedTrajectory, emptyValue),
      toolMocks: parseOptionalJSON<DatasetItem['toolMocks']>(row.toolMocks, emptyValue),
      unmockedToolPolicy: row.unmockedToolPolicy ?? emptyValue,
      scorerIds: parseOptionalJSON<string[]>(row.scorerIds, emptyValue),
      requestContext: parseOptionalJSON<Record<string, unknown>>(row.requestContext, emptyValue),
      metadata,
      source: parseOptionalJSON<DatasetItem['source']>(row.source, emptyValue),
      createdAt: parseDateTime(row.createdAt) ?? new Date(),
      updatedAt: parseDateTime(row.updatedAt) ?? new Date(),
    };
  }

  private mapItemFull(row: Record<string, any>): DatasetItemRow {
    const metadata = row.metadata ? parseJSON<Record<string, unknown>>(row.metadata) : undefined;
    const emptyValue = metadata?.__purged === true ? null : undefined;
    return {
      id: row.id as string,
      datasetId: row.datasetId as string,
      datasetVersion: row.datasetVersion as number,
      externalId: (row.externalId as string | null | undefined) ?? null,
      organizationId: (row.organizationId as string | null | undefined) ?? null,
      projectId: (row.projectId as string | null | undefined) ?? null,
      validTo: row.validTo as number | null,
      isDeleted: Boolean(row.isDeleted),
      input: row.input === null ? null : parseJSON<Record<string, unknown>>(row.input),
      groundTruth: parseOptionalJSON<Record<string, unknown>>(row.groundTruth, emptyValue),
      expectedTrajectory: parseOptionalJSON<DatasetItem['expectedTrajectory']>(row.expectedTrajectory, emptyValue),
      toolMocks: parseOptionalJSON<DatasetItem['toolMocks']>(row.toolMocks, emptyValue),
      unmockedToolPolicy: row.unmockedToolPolicy ?? emptyValue,
      scorerIds: parseOptionalJSON<string[]>(row.scorerIds, emptyValue),
      requestContext: parseOptionalJSON<Record<string, unknown>>(row.requestContext, emptyValue),
      metadata,
      source: parseOptionalJSON<DatasetItem['source']>(row.source, emptyValue),
      createdAt: parseDateTime(row.createdAt) ?? new Date(),
      updatedAt: parseDateTime(row.updatedAt) ?? new Date(),
    };
  }

  private mapVersion(row: Record<string, any>): DatasetVersion {
    return {
      id: row.id as string,
      datasetId: row.datasetId as string,
      version: row.version as number,
      createdAt: parseDateTime(row.createdAt) ?? new Date(),
    };
  }

  // --- Dataset CRUD ---

  async createDataset(input: CreateDatasetInput): Promise<DatasetRecord> {
    try {
      const id = input.id ?? randomUUID();
      if (input.id !== undefined) this.validateCallerDefinedDatasetId(input.id);
      const now = new Date();

      const insert =
        input.id === undefined
          ? this.operations.insert.bind(this.operations)
          : this.operations.insertOnly.bind(this.operations);
      await insert({
        tableName: TABLE_DATASETS,
        record: {
          id,
          name: input.name,
          description: input.description ?? null,
          metadata: jsonArg(input.metadata),
          inputSchema: jsonArg(input.inputSchema),
          groundTruthSchema: jsonArg(input.groundTruthSchema),
          requestContextSchema: jsonArg(input.requestContextSchema),
          targetType: input.targetType ?? null,
          targetIds: jsonArg(input.targetIds),
          scorerIds: jsonArg(input.scorerIds),
          version: 0,
          organizationId: input.organizationId ?? null,
          projectId: input.projectId ?? null,
          candidateKey: input.candidateKey ?? null,
          candidateId: input.candidateId ?? null,
          createdAt: now,
          updatedAt: now,
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
        targetType: input.targetType ?? undefined,
        targetIds: input.targetIds ?? undefined,
        scorerIds: input.scorerIds ?? undefined,
        version: 0,
        organizationId: input.organizationId ?? null,
        projectId: input.projectId ?? null,
        candidateKey: input.candidateKey ?? null,
        candidateId: input.candidateId ?? null,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      if (input.id !== undefined && hasErrorCode(error, new Set([1062, 'ER_DUP_ENTRY']))) {
        const existing = await this.getDatasetById({ id: input.id });
        if (existing) return this.resolveExistingDataset(existing, { ...input, id: input.id });
      }
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: 'MYSQL_CREATE_DATASET_FAILED',
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
      // prepareWhereClause ignores undefined values, so this scopes the SELECT only
      // when the caller passed tenancy filters.
      const row = await this.operations.load<Record<string, any>>({
        tableName: TABLE_DATASETS,
        keys: {
          id,
          organizationId: filters?.organizationId,
          projectId: filters?.projectId,
        },
      });
      return row ? this.mapDataset(row) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_GET_DATASET_FAILED',
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
          id: 'MYSQL_UPDATE_DATASET_NOT_FOUND',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { datasetId: args.id },
        });
      }

      const data: Record<string, any> = { updatedAt: new Date() };

      if (args.name !== undefined) data.name = args.name;
      if (args.description !== undefined) data.description = args.description;
      if (args.metadata !== undefined) data.metadata = JSON.stringify(args.metadata);
      if (args.inputSchema !== undefined)
        data.inputSchema = args.inputSchema === null ? null : JSON.stringify(args.inputSchema);
      if (args.groundTruthSchema !== undefined)
        data.groundTruthSchema = args.groundTruthSchema === null ? null : JSON.stringify(args.groundTruthSchema);
      if (args.requestContextSchema !== undefined)
        data.requestContextSchema =
          args.requestContextSchema === null ? null : JSON.stringify(args.requestContextSchema);
      if (args.tags !== undefined) data.tags = args.tags === null ? null : JSON.stringify(args.tags);
      if (args.targetType !== undefined) data.targetType = args.targetType;
      if (args.targetIds !== undefined)
        data.targetIds = args.targetIds === null ? null : JSON.stringify(args.targetIds);
      if (args.scorerIds !== undefined)
        data.scorerIds = args.scorerIds === null ? null : JSON.stringify(args.scorerIds);

      await this.operations.update({
        tableName: TABLE_DATASETS,
        keys: { id: args.id },
        data,
      });

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
        targetType: (args.targetType !== undefined ? args.targetType : existing.targetType) ?? undefined,
        targetIds: (args.targetIds !== undefined ? args.targetIds : existing.targetIds) ?? undefined,
        scorerIds: (args.scorerIds !== undefined ? args.scorerIds : existing.scorerIds) ?? undefined,
        updatedAt: data.updatedAt,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: 'MYSQL_UPDATE_DATASET_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteDataset({ id, filters }: { id: string; filters?: DatasetTenancyFilters }): Promise<void> {
    // Atomic gate + cascade under SELECT ... FOR UPDATE, so a concurrent
    // delete/recreate under a different tenant cannot let a scoped delete hit
    // another tenant's row. Silent no-op on tenancy mismatch.
    const filterCols: string[] = [];
    const filterVals: any[] = [];
    if (filters?.organizationId !== undefined) {
      filterCols.push(`${quoteIdentifier('organizationId', 'column name')} = ?`);
      filterVals.push(filters.organizationId);
    }
    if (filters?.projectId !== undefined) {
      filterCols.push(`${quoteIdentifier('projectId', 'column name')} = ?`);
      filterVals.push(filters.projectId);
    }
    const scopedWhere = ['id = ?', ...filterCols].join(' AND ');

    // Probe for experiment tables via information_schema outside the transaction
    // rather than running DMLs and swallowing "table missing" errors. Even though
    // ER_NO_SUCH_TABLE (1146) does not abort an InnoDB transaction, resolving
    // existence up front keeps the transaction focused on real writes.
    const experimentTablesExist = await this.experimentTablesExist();

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      const [rows] = await connection.execute<any[]>(
        `SELECT id FROM ${formatTableName(TABLE_DATASETS)} WHERE ${scopedWhere} FOR UPDATE`,
        [id, ...filterVals],
      );
      if (!Array.isArray(rows) || rows.length === 0) {
        await connection.commit();
        return;
      }

      if (experimentTablesExist) {
        await connection.execute(
          `DELETE FROM ${formatTableName(TABLE_EXPERIMENT_RESULTS)} WHERE ${quoteIdentifier('experimentId', 'column name')} IN (SELECT id FROM ${formatTableName(TABLE_EXPERIMENTS)} WHERE ${quoteIdentifier('datasetId', 'column name')} = ?)`,
          [id],
        );
        await connection.execute(
          `UPDATE ${formatTableName(TABLE_EXPERIMENTS)} SET ${quoteIdentifier('datasetId', 'column name')} = NULL, ${quoteIdentifier('datasetVersion', 'column name')} = NULL WHERE ${quoteIdentifier('datasetId', 'column name')} = ?`,
          [id],
        );
      }

      await connection.execute(
        `DELETE FROM ${formatTableName(TABLE_DATASET_SNAPSHOT_IDENTITIES)} WHERE ${quoteIdentifier('datasetId', 'column name')} = ?`,
        [id],
      );
      await connection.execute(
        `DELETE FROM ${formatTableName(TABLE_DATASET_VERSIONS)} WHERE ${quoteIdentifier('datasetId', 'column name')} = ?`,
        [id],
      );
      await connection.execute(
        `DELETE FROM ${formatTableName(TABLE_DATASET_ITEMS)} WHERE ${quoteIdentifier('datasetId', 'column name')} = ?`,
        [id],
      );
      await connection.execute(`DELETE FROM ${formatTableName(TABLE_DATASETS)} WHERE ${scopedWhere}`, [
        id,
        ...filterVals,
      ]);

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw new MastraError(
        {
          id: 'MYSQL_DELETE_DATASET_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    } finally {
      connection.release();
    }
  }

  async listDatasets(args: ListDatasetsInput): Promise<ListDatasetsOutput> {
    try {
      const { page, perPage: perPageInput } = args.pagination;

      const filterParts: string[] = [];
      const filterArgs: any[] = [];
      if (args.filters?.organizationId !== undefined) {
        filterParts.push(`${quoteIdentifier('organizationId', 'column name')} = ?`);
        filterArgs.push(args.filters.organizationId);
      }
      if (args.filters?.projectId !== undefined) {
        filterParts.push(`${quoteIdentifier('projectId', 'column name')} = ?`);
        filterArgs.push(args.filters.projectId);
      }
      if (args.filters?.candidateKey !== undefined) {
        filterParts.push(`${quoteIdentifier('candidateKey', 'column name')} = ?`);
        filterArgs.push(args.filters.candidateKey);
      }
      if (args.filters?.candidateId !== undefined) {
        filterParts.push(`${quoteIdentifier('candidateId', 'column name')} = ?`);
        filterArgs.push(args.filters.candidateId);
      }
      if (args.filters?.targetType !== undefined) {
        filterParts.push(`${quoteIdentifier('targetType', 'column name')} = ?`);
        filterArgs.push(args.filters.targetType);
      }
      if (args.filters?.targetIds !== undefined && args.filters.targetIds.length > 0) {
        // JSON_OVERLAPS returns true if any value in JSON_ARRAY(?,?,...) is present in `targetIds`.
        const placeholders = args.filters.targetIds.map(() => '?').join(',');
        filterParts.push(`JSON_OVERLAPS(${quoteIdentifier('targetIds', 'column name')}, JSON_ARRAY(${placeholders}))`);
        filterArgs.push(...args.filters.targetIds);
      }
      if (args.filters?.name !== undefined && args.filters.name.length > 0) {
        filterParts.push(`LOWER(${quoteIdentifier('name', 'column name')}) LIKE LOWER(?)`);
        filterArgs.push(`%${args.filters.name}%`);
      }
      const whereClause = {
        sql: filterParts.length > 0 ? `WHERE ${filterParts.join(' AND ')}` : '',
        args: filterArgs,
      };
      const total = await this.operations.loadTotalCount({ tableName: TABLE_DATASETS, whereClause });

      if (total === 0) {
        return {
          datasets: [],
          pagination: { total: 0, page, perPage: perPageInput, hasMore: false },
        };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;

      const rows = await this.operations.loadMany<Record<string, any>>({
        tableName: TABLE_DATASETS,
        whereClause,
        orderBy: `${quoteIdentifier('createdAt', 'column name')} DESC, \`id\` ASC`,
        offset,
        limit: limitValue,
      });

      return {
        datasets: rows.map(row => this.mapDataset(row)),
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
          id: 'MYSQL_LIST_DATASETS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // --- SCD-2 item mutations ---

  protected async _doAddItem(args: AddDatasetItemInput): Promise<DatasetItem> {
    this.#rejectToolMocks(args.toolMocks);
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      const id = randomUUID();
      const versionId = randomUUID();
      const now = new Date();
      const tableDatasetsName = formatTableName(TABLE_DATASETS);
      const tableItemsName = formatTableName(TABLE_DATASET_ITEMS);
      const tableVersionsName = formatTableName(TABLE_DATASET_VERSIONS);

      // Bump version
      await connection.execute(`UPDATE ${tableDatasetsName} SET \`version\` = \`version\` + 1 WHERE id = ?`, [
        args.datasetId,
      ]);

      // Get new version + parent tenancy
      const [datasetRows] = await connection.execute<RowDataPacket[]>(
        `SELECT \`version\`, \`organizationId\`, \`projectId\` FROM ${tableDatasetsName} WHERE id = ?`,
        [args.datasetId],
      );
      const parentRow = (datasetRows as any[])[0];
      const newVersion = parentRow?.version as number;
      const parentOrganizationId = (parentRow?.organizationId as string | null | undefined) ?? null;
      const parentProjectId = (parentRow?.projectId as string | null | undefined) ?? null;

      // Insert item (tenancy inherited from parent dataset)
      await connection.execute(
        `INSERT INTO ${tableItemsName} (\`id\`,\`datasetId\`,\`datasetVersion\`,\`organizationId\`,\`projectId\`,\`validTo\`,\`isDeleted\`,\`input\`,\`groundTruth\`,\`unmockedToolPolicy\`,\`scorerIds\`,\`metadata\`,\`createdAt\`,\`updatedAt\`) VALUES (?,?,?,?,?,NULL,0,?,?,?,?,?,?,?)`,
        [
          id,
          args.datasetId,
          newVersion,
          parentOrganizationId,
          parentProjectId,
          jsonDataArg(args.input),
          jsonDataArg(args.groundTruth),
          args.unmockedToolPolicy ?? null,
          jsonArg(args.scorerIds),
          jsonArg(args.metadata),
          transformToSqlValue(now),
          transformToSqlValue(now),
        ],
      );

      // Insert dataset version record
      await connection.execute(
        `INSERT INTO ${tableVersionsName} (\`id\`, \`datasetId\`, \`version\`, \`createdAt\`) VALUES (?, ?, ?, ?)`,
        [versionId, args.datasetId, newVersion, transformToSqlValue(now)],
      );

      await connection.commit();

      return {
        id,
        datasetId: args.datasetId,
        datasetVersion: newVersion,
        organizationId: parentOrganizationId,
        projectId: parentProjectId,
        input: args.input,
        groundTruth: args.groundTruth,
        unmockedToolPolicy: args.unmockedToolPolicy,
        scorerIds: args.scorerIds,
        metadata: args.metadata,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      await connection.rollback();
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: 'MYSQL_ADD_ITEM_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    } finally {
      connection.release();
    }
  }

  protected async _doUpdateItem(args: UpdateDatasetItemInput): Promise<DatasetItem> {
    this.#rejectToolMocks(args.toolMocks);
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      const versionId = randomUUID();
      const now = new Date();
      const tableDatasetsName = formatTableName(TABLE_DATASETS);
      const tableItemsName = formatTableName(TABLE_DATASET_ITEMS);
      const tableVersionsName = formatTableName(TABLE_DATASET_VERSIONS);

      await connection.execute(`SELECT id FROM ${tableDatasetsName} WHERE id = ? FOR UPDATE`, [args.datasetId]);
      const [itemRows] = await connection.execute<RowDataPacket[]>(
        `SELECT ${ITEM_SELECT_COLUMNS} FROM ${tableItemsName} WHERE id = ? AND validTo IS NULL AND isDeleted = 0`,
        [args.id],
      );
      const itemRow = (itemRows as any[])[0];
      const existing = itemRow ? this.mapItem(itemRow) : null;
      if (!existing) {
        throw new MastraError({
          id: 'MYSQL_UPDATE_ITEM_NOT_FOUND',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { itemId: args.id },
        });
      }
      if (existing.datasetId !== args.datasetId) {
        throw new MastraError({
          id: 'MYSQL_UPDATE_ITEM_DATASET_MISMATCH',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { itemId: args.id, expectedDatasetId: args.datasetId, actualDatasetId: existing.datasetId },
        });
      }
      if (existing.metadata?.__purged === true) {
        throw new MastraError({
          id: 'DATASET_ITEM_PURGED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { datasetId: args.datasetId, itemId: args.id },
          text: `Purged dataset item cannot be updated: ${args.id}`,
        });
      }

      const mergedInput = args.input !== undefined ? args.input : existing.input;
      const mergedGroundTruth = args.groundTruth !== undefined ? args.groundTruth : existing.groundTruth;
      const mergedExpectedTrajectory =
        args.expectedTrajectory !== undefined ? args.expectedTrajectory : existing.expectedTrajectory;
      const mergedToolMocks = args.toolMocks ?? existing.toolMocks;
      const mergedUnmockedToolPolicy = args.unmockedToolPolicy ?? existing.unmockedToolPolicy;
      const mergedScorerIds = args.scorerIds !== undefined ? (args.scorerIds ?? undefined) : existing.scorerIds;
      const mergedRequestContext = args.requestContext ?? existing.requestContext;
      const mergedMetadata = args.metadata ?? existing.metadata;
      const mergedSource = args.source ?? existing.source;

      // Bump version
      await connection.execute(`UPDATE ${tableDatasetsName} SET \`version\` = \`version\` + 1 WHERE id = ?`, [
        args.datasetId,
      ]);

      const [datasetRows] = await connection.execute<RowDataPacket[]>(
        `SELECT \`version\`, \`organizationId\`, \`projectId\` FROM ${tableDatasetsName} WHERE id = ?`,
        [args.datasetId],
      );
      const parentRow = (datasetRows as any[])[0];
      const newVersion = parentRow?.version as number;
      const parentOrganizationId = (parentRow?.organizationId as string | null | undefined) ?? null;
      const parentProjectId = (parentRow?.projectId as string | null | undefined) ?? null;

      // Close old row
      await connection.execute(
        `UPDATE ${tableItemsName} SET \`validTo\` = ? WHERE \`id\` = ? AND \`validTo\` IS NULL AND \`isDeleted\` = 0`,
        [newVersion, args.id],
      );

      // Insert new row (tenancy inherited from parent dataset)
      await connection.execute(
        `INSERT INTO ${tableItemsName} (\`id\`,\`datasetId\`,\`datasetVersion\`,\`externalId\`,\`organizationId\`,\`projectId\`,\`validTo\`,\`isDeleted\`,\`input\`,\`groundTruth\`,\`expectedTrajectory\`,\`toolMocks\`,\`unmockedToolPolicy\`,\`scorerIds\`,\`requestContext\`,\`metadata\`,\`source\`,\`createdAt\`,\`updatedAt\`) VALUES (?,?,?,?,?,?,NULL,0,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          args.id,
          args.datasetId,
          newVersion,
          existing.externalId ?? null,
          parentOrganizationId,
          parentProjectId,
          jsonDataArg(mergedInput),
          jsonDataArg(mergedGroundTruth),
          jsonDataArg(mergedExpectedTrajectory),
          jsonArg(mergedToolMocks),
          mergedUnmockedToolPolicy ?? null,
          jsonArg(mergedScorerIds),
          jsonArg(mergedRequestContext),
          jsonArg(mergedMetadata),
          jsonArg(mergedSource),
          transformToSqlValue(existing.createdAt),
          transformToSqlValue(now),
        ],
      );

      // Insert dataset version record
      await connection.execute(
        `INSERT INTO ${tableVersionsName} (\`id\`, \`datasetId\`, \`version\`, \`createdAt\`) VALUES (?, ?, ?, ?)`,
        [versionId, args.datasetId, newVersion, transformToSqlValue(now)],
      );

      await connection.commit();

      return {
        ...existing,
        datasetVersion: newVersion,
        organizationId: parentOrganizationId,
        projectId: parentProjectId,
        input: mergedInput,
        groundTruth: mergedGroundTruth,
        expectedTrajectory: mergedExpectedTrajectory,
        toolMocks: mergedToolMocks,
        unmockedToolPolicy: mergedUnmockedToolPolicy,
        scorerIds: mergedScorerIds,
        requestContext: mergedRequestContext,
        metadata: mergedMetadata,
        source: mergedSource,
        updatedAt: now,
      };
    } catch (error) {
      await connection.rollback();
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: 'MYSQL_UPDATE_ITEM_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    } finally {
      connection.release();
    }
  }

  protected async _doDeleteItem({ id, datasetId }: DeleteDatasetItemInput): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      const versionId = randomUUID();
      const now = new Date();
      const tableDatasetsName = formatTableName(TABLE_DATASETS);
      const tableItemsName = formatTableName(TABLE_DATASET_ITEMS);
      const tableVersionsName = formatTableName(TABLE_DATASET_VERSIONS);

      await connection.execute(`SELECT id FROM ${tableDatasetsName} WHERE id = ? FOR UPDATE`, [datasetId]);
      const [itemRows] = await connection.execute<RowDataPacket[]>(
        `SELECT ${ITEM_SELECT_COLUMNS} FROM ${tableItemsName} WHERE id = ? AND validTo IS NULL AND isDeleted = 0`,
        [id],
      );
      const itemRow = (itemRows as any[])[0];
      const existing = itemRow ? this.mapItem(itemRow) : null;
      if (!existing) {
        await connection.commit();
        return;
      }
      if (existing.datasetId !== datasetId) {
        throw new MastraError({
          id: 'MYSQL_DELETE_ITEM_DATASET_MISMATCH',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { itemId: id, expectedDatasetId: datasetId, actualDatasetId: existing.datasetId },
        });
      }

      // Bump version
      await connection.execute(`UPDATE ${tableDatasetsName} SET \`version\` = \`version\` + 1 WHERE id = ?`, [
        datasetId,
      ]);

      const [datasetRows] = await connection.execute<RowDataPacket[]>(
        `SELECT \`version\`, \`organizationId\`, \`projectId\` FROM ${tableDatasetsName} WHERE id = ?`,
        [datasetId],
      );
      const parentRow = (datasetRows as any[])[0];
      const newVersion = parentRow?.version as number;
      const parentOrganizationId = (parentRow?.organizationId as string | null | undefined) ?? null;
      const parentProjectId = (parentRow?.projectId as string | null | undefined) ?? null;

      // Close old row
      await connection.execute(
        `UPDATE ${tableItemsName} SET \`validTo\` = ? WHERE \`id\` = ? AND \`validTo\` IS NULL AND \`isDeleted\` = 0`,
        [newVersion, id],
      );

      // Insert tombstone (tenancy inherited from parent dataset)
      await connection.execute(
        `INSERT INTO ${tableItemsName} (\`id\`,\`datasetId\`,\`datasetVersion\`,\`externalId\`,\`organizationId\`,\`projectId\`,\`validTo\`,\`isDeleted\`,\`input\`,\`groundTruth\`,\`expectedTrajectory\`,\`toolMocks\`,\`unmockedToolPolicy\`,\`scorerIds\`,\`requestContext\`,\`metadata\`,\`source\`,\`createdAt\`,\`updatedAt\`) VALUES (?,?,?,?,?,?,NULL,1,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id,
          datasetId,
          newVersion,
          existing.externalId ?? null,
          parentOrganizationId,
          parentProjectId,
          jsonDataArg(existing.input),
          jsonDataArg(existing.groundTruth),
          jsonDataArg(existing.expectedTrajectory),
          jsonArg(existing.toolMocks),
          existing.unmockedToolPolicy ?? null,
          jsonArg(existing.scorerIds),
          jsonArg(existing.requestContext),
          jsonArg(existing.metadata),
          jsonArg(existing.source),
          transformToSqlValue(existing.createdAt),
          transformToSqlValue(now),
        ],
      );

      // Insert dataset version record
      await connection.execute(
        `INSERT INTO ${tableVersionsName} (\`id\`, \`datasetId\`, \`version\`, \`createdAt\`) VALUES (?, ?, ?, ?)`,
        [versionId, datasetId, newVersion, transformToSqlValue(now)],
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: 'MYSQL_DELETE_ITEM_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    } finally {
      connection.release();
    }
  }

  protected async _doPurgeItem({ id, datasetId }: PurgeDatasetItemInput): Promise<void> {
    const experimentTablesExist = await this.experimentTablesExist();
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `SELECT ${quoteIdentifier('id', 'column name')} FROM ${formatTableName(TABLE_DATASETS)} WHERE ${quoteIdentifier('id', 'column name')} = ? FOR UPDATE`,
        [datasetId],
      );
      const itemsTable = formatTableName(TABLE_DATASET_ITEMS);
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT ${quoteIdentifier('id', 'column name')} FROM ${itemsTable} WHERE ${quoteIdentifier('id', 'column name')} = ? AND ${quoteIdentifier('datasetId', 'column name')} = ? LIMIT 1 FOR UPDATE`,
        [id, datasetId],
      );
      if (rows.length === 0) {
        await connection.commit();
        return;
      }

      const purgedAt = new Date().toISOString();
      const purgedMetadata = JSON.stringify({ __purged: true, purgedAt });
      await connection.execute(
        `UPDATE ${itemsTable} SET ${quoteIdentifier('input', 'column name')} = ?, ${quoteIdentifier('groundTruth', 'column name')} = NULL, ${quoteIdentifier('expectedTrajectory', 'column name')} = NULL, ${quoteIdentifier('toolMocks', 'column name')} = NULL, ${quoteIdentifier('unmockedToolPolicy', 'column name')} = NULL, ${quoteIdentifier('scorerIds', 'column name')} = NULL, ${quoteIdentifier('requestContext', 'column name')} = NULL, ${quoteIdentifier('metadata', 'column name')} = ?, ${quoteIdentifier('source', 'column name')} = NULL WHERE ${quoteIdentifier('id', 'column name')} = ? AND ${quoteIdentifier('datasetId', 'column name')} = ?`,
        ['null', purgedMetadata, id, datasetId],
      );
      await connection.execute(`DELETE FROM ${formatTableName(TABLE_DATASET_SNAPSHOT_IDENTITIES)} WHERE id = ?`, [
        datasetSnapshotIdentityId(datasetId, id),
      ]);

      if (experimentTablesExist) {
        await connection.execute(
          `UPDATE ${formatTableName(TABLE_EXPERIMENT_RESULTS)} SET ${quoteIdentifier('input', 'column name')} = ?, ${quoteIdentifier('output', 'column name')} = NULL, ${quoteIdentifier('groundTruth', 'column name')} = NULL, ${quoteIdentifier('error', 'column name')} = NULL, ${quoteIdentifier('toolMockReport', 'column name')} = NULL, ${quoteIdentifier('tags', 'column name')} = NULL, ${quoteIdentifier('comment', 'column name')} = NULL, ${quoteIdentifier('metadata', 'column name')} = ? WHERE ${quoteIdentifier('itemId', 'column name')} = ? AND ${quoteIdentifier('experimentId', 'column name')} IN (SELECT id FROM ${formatTableName(TABLE_EXPERIMENTS)} WHERE ${quoteIdentifier('datasetId', 'column name')} = ?)`,
          ['null', purgedMetadata, id, datasetId],
        );
      }
      await connection.commit();
    } catch (error) {
      let transactionError = error;
      try {
        await connection.rollback();
      } catch (rollbackError) {
        transactionError = new AggregateError([error, rollbackError], 'Transaction and rollback both failed');
      }
      if (transactionError instanceof MastraError) throw transactionError;
      throw new MastraError(
        {
          id: 'MYSQL_PURGE_ITEM_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        transactionError,
      );
    } finally {
      connection.release();
    }
  }

  // --- SCD-2 queries ---

  async getItemById(args: { id: string; datasetVersion?: number }): Promise<DatasetItem | null> {
    try {
      const tableItemsName = formatTableName(TABLE_DATASET_ITEMS);
      let rows: RowDataPacket[];

      if (args.datasetVersion !== undefined) {
        [rows] = await this.pool.execute<RowDataPacket[]>(
          `SELECT ${ITEM_SELECT_COLUMNS} FROM ${tableItemsName} WHERE \`id\` = ? AND \`datasetVersion\` <= ? AND (\`validTo\` IS NULL OR \`validTo\` > ?) AND \`isDeleted\` = 0 ORDER BY \`datasetVersion\` DESC LIMIT 1`,
          [args.id, args.datasetVersion, args.datasetVersion],
        );
      } else {
        [rows] = await this.pool.execute<RowDataPacket[]>(
          `SELECT ${ITEM_SELECT_COLUMNS} FROM ${tableItemsName} WHERE \`id\` = ? AND \`validTo\` IS NULL AND \`isDeleted\` = 0`,
          [args.id],
        );
      }

      return rows.length > 0 ? this.mapItem(rows[0]!) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_GET_ITEM_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getItemsByVersion({ datasetId, version }: { datasetId: string; version: number }): Promise<DatasetItem[]> {
    try {
      const tableItemsName = formatTableName(TABLE_DATASET_ITEMS);
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT ${ITEM_SELECT_COLUMNS} FROM ${tableItemsName} WHERE \`datasetId\` = ? AND \`datasetVersion\` <= ? AND (\`validTo\` IS NULL OR \`validTo\` > ?) AND \`isDeleted\` = 0 ORDER BY \`createdAt\` DESC, \`id\` ASC`,
        [datasetId, version, version],
      );

      return (rows as any[]).map(row => this.mapItem(row));
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_GET_ITEMS_BY_VERSION_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getItemHistory(itemId: string): Promise<DatasetItemRow[]> {
    try {
      const tableItemsName = formatTableName(TABLE_DATASET_ITEMS);
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT ${ITEM_SELECT_COLUMNS} FROM ${tableItemsName} WHERE \`id\` = ? ORDER BY \`datasetVersion\` DESC`,
        [itemId],
      );

      return (rows as any[]).map(row => this.mapItemFull(row));
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_GET_ITEM_HISTORY_FAILED',
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
      const tableItemsName = formatTableName(TABLE_DATASET_ITEMS);

      const conditions: string[] = [`\`datasetId\` = ?`];
      const params: any[] = [args.datasetId];

      if (args.version !== undefined) {
        // SCD-2 time-travel query
        conditions.push(`\`datasetVersion\` <= ?`);
        conditions.push(`(\`validTo\` IS NULL OR \`validTo\` > ?)`);
        conditions.push(`\`isDeleted\` = 0`);
        params.push(args.version, args.version);
      } else {
        // Current items only
        conditions.push(`\`validTo\` IS NULL`);
        conditions.push(`\`isDeleted\` = 0`);
      }

      if (args.filters?.organizationId !== undefined) {
        conditions.push(`\`organizationId\` = ?`);
        params.push(args.filters.organizationId);
      }
      if (args.filters?.projectId !== undefined) {
        conditions.push(`\`projectId\` = ?`);
        params.push(args.filters.projectId);
      }

      if (args.search) {
        conditions.push(`(LOWER(\`input\`) LIKE ? OR LOWER(COALESCE(\`groundTruth\`, '')) LIKE ?)`);
        const searchPattern = `%${args.search.toLowerCase()}%`;
        params.push(searchPattern, searchPattern);
      }

      const whereSql = ` WHERE ${conditions.join(' AND ')}`;

      const [countRows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM ${tableItemsName}${whereSql}`,
        params,
      );
      const total = Number((countRows as any[])[0]?.count ?? 0);

      if (total === 0) {
        return {
          items: [],
          pagination: { total: 0, page, perPage: perPageInput, hasMore: false },
        };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;

      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT ${ITEM_SELECT_COLUMNS} FROM ${tableItemsName}${whereSql} ORDER BY \`createdAt\` DESC, \`id\` ASC LIMIT ${limitValue} OFFSET ${offset}`,
        params,
      );

      return {
        items: (rows as any[]).map(row => this.mapItem(row)),
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
          id: 'MYSQL_LIST_ITEMS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // --- Dataset version methods ---

  async createDatasetVersion(datasetId: string, version: number): Promise<DatasetVersion> {
    try {
      const id = randomUUID();
      const now = new Date();

      await this.operations.insert({
        tableName: TABLE_DATASET_VERSIONS,
        record: {
          id,
          datasetId,
          version,
          createdAt: now,
        },
      });

      return { id, datasetId, version, createdAt: now };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_CREATE_DATASET_VERSION_FAILED',
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

      const whereClause = {
        sql: ` WHERE ${quoteIdentifier('datasetId', 'column name')} = ?`,
        args: [input.datasetId] as any[],
      };

      const total = await this.operations.loadTotalCount({ tableName: TABLE_DATASET_VERSIONS, whereClause });
      if (total === 0) {
        return {
          versions: [],
          pagination: { total: 0, page, perPage: perPageInput, hasMore: false },
        };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;

      const rows = await this.operations.loadMany<Record<string, any>>({
        tableName: TABLE_DATASET_VERSIONS,
        whereClause,
        orderBy: `\`version\` DESC`,
        offset,
        limit: limitValue,
      });

      return {
        versions: rows.map(row => this.mapVersion(row)),
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
          id: 'MYSQL_LIST_DATASET_VERSIONS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // --- Bulk operations (SCD-2 internally) ---

  protected async _doBatchInsertItems(input: BatchInsertItemsInput): Promise<DatasetItem[]> {
    for (const item of input.items) {
      this.#rejectToolMocks(item.toolMocks);
    }

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      const tableDatasetsName = formatTableName(TABLE_DATASETS);
      const tableItemsName = formatTableName(TABLE_DATASET_ITEMS);
      const tableVersionsName = formatTableName(TABLE_DATASET_VERSIONS);
      const [datasetRows] = await connection.execute<RowDataPacket[]>(
        `SELECT \`version\`, \`organizationId\`, \`projectId\` FROM ${tableDatasetsName} WHERE id = ? FOR UPDATE`,
        [input.datasetId],
      );
      const dataset = datasetRows[0];
      if (!dataset) {
        throw new MastraError({
          id: 'MYSQL_BULK_ADD_ITEMS_DATASET_NOT_FOUND',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { datasetId: input.datasetId },
        });
      }

      const externalIds = [...new Set(input.items.flatMap(item => (item.externalId ? [item.externalId] : [])))];
      let historyRows: DatasetItemRow[] = [];
      if (externalIds.length > 0) {
        const placeholders = externalIds.map(() => '?').join(', ');
        const [rows] = await connection.execute<RowDataPacket[]>(
          `SELECT ${ITEM_SELECT_COLUMNS} FROM ${tableItemsName} WHERE \`datasetId\` = ? AND \`externalId\` IN (${placeholders}) ORDER BY \`datasetVersion\` ASC`,
          [input.datasetId, ...externalIds],
        );
        historyRows = rows.map(row => this.mapItemFull(row));
      }

      const plan = this.planDatasetItemBatch(input.items, historyRows, randomUUID);
      const existingItems = new Map<string, DatasetItem>(
        [...plan.existingCurrentItems].map(([id, row]) => [id, this.datasetItemFromRow(row)]),
      );
      if (plan.inserts.length === 0) {
        await connection.commit();
        return plan.resolvedIds.map(id => existingItems.get(id)!);
      }

      const now = new Date();
      const newVersion = Number(dataset.version) + 1;
      await connection.execute(`UPDATE ${tableDatasetsName} SET \`version\` = ? WHERE id = ?`, [
        newVersion,
        input.datasetId,
      ]);

      const inserted = new Map<string, DatasetItem>();
      for (const { id, item } of plan.inserts) {
        await connection.execute(
          `INSERT INTO ${tableItemsName} (\`id\`,\`datasetId\`,\`datasetVersion\`,\`externalId\`,\`organizationId\`,\`projectId\`,\`validTo\`,\`isDeleted\`,\`input\`,\`groundTruth\`,\`expectedTrajectory\`,\`toolMocks\`,\`unmockedToolPolicy\`,\`scorerIds\`,\`requestContext\`,\`metadata\`,\`source\`,\`createdAt\`,\`updatedAt\`) VALUES (?,?,?,?,?,?,NULL,0,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            id,
            input.datasetId,
            newVersion,
            item.externalId ?? null,
            dataset.organizationId ?? null,
            dataset.projectId ?? null,
            jsonDataArg(item.input),
            jsonDataArg(item.groundTruth),
            jsonDataArg(item.expectedTrajectory),
            jsonArg(item.toolMocks),
            item.unmockedToolPolicy ?? null,
            jsonArg(item.scorerIds),
            jsonArg(item.requestContext),
            jsonArg(item.metadata),
            jsonArg(item.source),
            transformToSqlValue(now),
            transformToSqlValue(now),
          ],
        );
        inserted.set(id, {
          id,
          datasetId: input.datasetId,
          datasetVersion: newVersion,
          externalId: item.externalId ?? null,
          organizationId: dataset.organizationId ?? null,
          projectId: dataset.projectId ?? null,
          ...item,
          createdAt: now,
          updatedAt: now,
        });
      }

      await connection.execute(
        `INSERT INTO ${tableVersionsName} (\`id\`, \`datasetId\`, \`version\`, \`createdAt\`) VALUES (?, ?, ?, ?)`,
        [randomUUID(), input.datasetId, newVersion, transformToSqlValue(now)],
      );
      await connection.commit();

      return plan.resolvedIds.map(id => inserted.get(id) ?? existingItems.get(id)!);
    } catch (error) {
      await connection.rollback();
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: 'MYSQL_BULK_ADD_ITEMS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    } finally {
      connection.release();
    }
  }

  protected async _doBatchDeleteItems(input: BatchDeleteItemsInput): Promise<void> {
    const dataset = await this.getDatasetById({ id: input.datasetId });
    if (!dataset) {
      throw new MastraError({
        id: 'MYSQL_BULK_DELETE_ITEMS_DATASET_NOT_FOUND',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { datasetId: input.datasetId },
      });
    }

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      const now = new Date();
      const versionId = randomUUID();
      const tableDatasetsName = formatTableName(TABLE_DATASETS);
      const tableItemsName = formatTableName(TABLE_DATASET_ITEMS);
      const tableVersionsName = formatTableName(TABLE_DATASET_VERSIONS);

      await connection.execute(`SELECT id FROM ${tableDatasetsName} WHERE id = ? FOR UPDATE`, [input.datasetId]);
      const currentItems: DatasetItem[] = [];
      for (const itemId of input.itemIds) {
        const [itemRows] = await connection.execute<RowDataPacket[]>(
          `SELECT ${ITEM_SELECT_COLUMNS} FROM ${tableItemsName} WHERE id = ? AND validTo IS NULL AND isDeleted = 0`,
          [itemId],
        );
        const row = (itemRows as any[])[0];
        const item = row ? this.mapItem(row) : null;
        if (item && item.datasetId === input.datasetId) currentItems.push(item);
      }
      if (currentItems.length === 0) {
        await connection.commit();
        return;
      }

      // Single version increment
      await connection.execute(`UPDATE ${tableDatasetsName} SET \`version\` = \`version\` + 1 WHERE id = ?`, [
        input.datasetId,
      ]);

      const [versionRows] = await connection.execute<RowDataPacket[]>(
        `SELECT \`version\` FROM ${tableDatasetsName} WHERE id = ?`,
        [input.datasetId],
      );
      const newVersion = (versionRows as any[])[0]?.version as number;

      const parentOrganizationId = dataset.organizationId ?? null;
      const parentProjectId = dataset.projectId ?? null;

      for (const item of currentItems) {
        // Close old row
        await connection.execute(
          `UPDATE ${tableItemsName} SET \`validTo\` = ? WHERE \`id\` = ? AND \`validTo\` IS NULL AND \`isDeleted\` = 0`,
          [newVersion, item.id],
        );

        // Insert tombstone (tenancy inherited from parent dataset)
        await connection.execute(
          `INSERT INTO ${tableItemsName} (\`id\`,\`datasetId\`,\`datasetVersion\`,\`externalId\`,\`organizationId\`,\`projectId\`,\`validTo\`,\`isDeleted\`,\`input\`,\`groundTruth\`,\`expectedTrajectory\`,\`toolMocks\`,\`unmockedToolPolicy\`,\`scorerIds\`,\`requestContext\`,\`metadata\`,\`source\`,\`createdAt\`,\`updatedAt\`) VALUES (?,?,?,?,?,?,NULL,1,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            item.id,
            input.datasetId,
            newVersion,
            item.externalId ?? null,
            parentOrganizationId,
            parentProjectId,
            jsonDataArg(item.input),
            jsonDataArg(item.groundTruth),
            jsonDataArg(item.expectedTrajectory),
            jsonArg(item.toolMocks),
            item.unmockedToolPolicy ?? null,
            jsonArg(item.scorerIds),
            jsonArg(item.requestContext),
            jsonArg(item.metadata),
            jsonArg(item.source),
            transformToSqlValue(item.createdAt),
            transformToSqlValue(now),
          ],
        );
      }

      // Single dataset_version
      await connection.execute(
        `INSERT INTO ${tableVersionsName} (\`id\`, \`datasetId\`, \`version\`, \`createdAt\`) VALUES (?, ?, ?, ?)`,
        [versionId, input.datasetId, newVersion, transformToSqlValue(now)],
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: 'MYSQL_BULK_DELETE_ITEMS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    } finally {
      connection.release();
    }
  }
}
