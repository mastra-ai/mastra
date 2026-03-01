import { randomUUID } from 'node:crypto';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  TABLE_DATASETS,
  TABLE_DATASET_ITEMS,
  TABLE_DATASET_VERSIONS,
  TABLE_EXPERIMENTS,
  TABLE_EXPERIMENT_RESULTS,
  DATASETS_SCHEMA,
  DATASET_ITEMS_SCHEMA,
  DATASET_VERSIONS_SCHEMA,
  DatasetsStorage,
  calculatePagination,
  normalizePerPage,
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
} from '@mastra/core/storage';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { StoreOperationsMySQL } from '../operations';
import { formatTableName, parseDateTime, quoteIdentifier, transformToSqlValue } from '../utils';

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

function jsonArg(value: unknown): string | null {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

export class DatasetsMySQL extends DatasetsStorage {
  private pool: Pool;
  private operations: StoreOperationsMySQL;

  constructor({ pool, operations }: { pool: Pool; operations: StoreOperationsMySQL }) {
    super();
    this.pool = pool;
    this.operations = operations;
  }

  async init(): Promise<void> {
    await this.operations.createTable({ tableName: TABLE_DATASETS, schema: DATASETS_SCHEMA });
    await this.operations.createTable({ tableName: TABLE_DATASET_ITEMS as any, schema: DATASET_ITEMS_SCHEMA });
    await this.operations.createTable({ tableName: TABLE_DATASET_VERSIONS, schema: DATASET_VERSIONS_SCHEMA });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.pool.execute(`DELETE FROM ${formatTableName(TABLE_DATASET_VERSIONS)}`);
    await this.pool.execute(`DELETE FROM ${formatTableName(TABLE_DATASET_ITEMS)}`);
    await this.pool.execute(`DELETE FROM ${formatTableName(TABLE_DATASETS)}`);
  }

  // --- Row transformers ---

  private mapDataset(row: Record<string, any>): DatasetRecord {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      metadata: parseJSON<Record<string, unknown>>(row.metadata),
      inputSchema: parseJSON<Record<string, unknown>>(row.inputSchema),
      groundTruthSchema: parseJSON<Record<string, unknown>>(row.groundTruthSchema),
      version: row.version as number,
      createdAt: parseDateTime(row.createdAt) ?? new Date(),
      updatedAt: parseDateTime(row.updatedAt) ?? new Date(),
    };
  }

  private mapItem(row: Record<string, any>): DatasetItem {
    return {
      id: row.id as string,
      datasetId: row.datasetId as string,
      datasetVersion: row.datasetVersion as number,
      input: parseJSON<Record<string, unknown>>(row.input),
      groundTruth: row.groundTruth ? parseJSON<Record<string, unknown>>(row.groundTruth) : undefined,
      metadata: row.metadata ? parseJSON<Record<string, unknown>>(row.metadata) : undefined,
      createdAt: parseDateTime(row.createdAt) ?? new Date(),
      updatedAt: parseDateTime(row.updatedAt) ?? new Date(),
    };
  }

  private mapItemFull(row: Record<string, any>): DatasetItemRow {
    return {
      id: row.id as string,
      datasetId: row.datasetId as string,
      datasetVersion: row.datasetVersion as number,
      validTo: row.validTo as number | null,
      isDeleted: Boolean(row.isDeleted),
      input: parseJSON<Record<string, unknown>>(row.input),
      groundTruth: row.groundTruth ? parseJSON<Record<string, unknown>>(row.groundTruth) : undefined,
      metadata: row.metadata ? parseJSON<Record<string, unknown>>(row.metadata) : undefined,
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
      const id = randomUUID();
      const now = new Date();

      await this.operations.insert({
        tableName: TABLE_DATASETS,
        record: {
          id,
          name: input.name,
          description: input.description ?? null,
          metadata: jsonArg(input.metadata),
          inputSchema: jsonArg(input.inputSchema),
          groundTruthSchema: jsonArg(input.groundTruthSchema),
          version: 0,
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
        version: 0,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
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

  async getDatasetById({ id }: { id: string }): Promise<DatasetRecord | null> {
    try {
      const row = await this.operations.load<Record<string, any>>({
        tableName: TABLE_DATASETS,
        keys: { id },
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
      const existing = await this.getDatasetById({ id: args.id });
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
      if (args.inputSchema !== undefined) data.inputSchema = args.inputSchema === null ? null : JSON.stringify(args.inputSchema);
      if (args.groundTruthSchema !== undefined) data.groundTruthSchema = args.groundTruthSchema === null ? null : JSON.stringify(args.groundTruthSchema);

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
        groundTruthSchema: (args.groundTruthSchema !== undefined ? args.groundTruthSchema : existing.groundTruthSchema) ?? undefined,
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

  async deleteDataset({ id }: { id: string }): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      try {
        await connection.execute(
          `DELETE FROM ${formatTableName(TABLE_EXPERIMENT_RESULTS)} WHERE ${quoteIdentifier('experimentId', 'column name')} IN (SELECT id FROM ${formatTableName(TABLE_EXPERIMENTS)} WHERE ${quoteIdentifier('datasetId', 'column name')} = ?)`,
          [id],
        );
      } catch {
        // experiment_results table may not exist
      }
      try {
        await connection.execute(
          `UPDATE ${formatTableName(TABLE_EXPERIMENTS)} SET ${quoteIdentifier('datasetId', 'column name')} = NULL, ${quoteIdentifier('datasetVersion', 'column name')} = NULL WHERE ${quoteIdentifier('datasetId', 'column name')} = ?`,
          [id],
        );
      } catch {
        // experiments table may not exist
      }

      await connection.execute(`DELETE FROM ${formatTableName(TABLE_DATASET_VERSIONS)} WHERE ${quoteIdentifier('datasetId', 'column name')} = ?`, [id]);
      await connection.execute(`DELETE FROM ${formatTableName(TABLE_DATASET_ITEMS)} WHERE ${quoteIdentifier('datasetId', 'column name')} = ?`, [id]);
      await connection.execute(`DELETE FROM ${formatTableName(TABLE_DATASETS)} WHERE id = ?`, [id]);

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

      const whereClause = { sql: '', args: [] as any[] };
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
      await connection.execute(
        `UPDATE ${tableDatasetsName} SET \`version\` = \`version\` + 1 WHERE id = ?`,
        [args.datasetId],
      );

      // Get new version
      const [versionRows] = await connection.execute<RowDataPacket[]>(
        `SELECT \`version\` FROM ${tableDatasetsName} WHERE id = ?`,
        [args.datasetId],
      );
      const newVersion = (versionRows as any[])[0]?.version as number;

      // Insert item
      await connection.execute(
        `INSERT INTO ${tableItemsName} (\`id\`, \`datasetId\`, \`datasetVersion\`, \`validTo\`, \`isDeleted\`, \`input\`, \`groundTruth\`, \`metadata\`, \`createdAt\`, \`updatedAt\`) VALUES (?, ?, ?, NULL, 0, ?, ?, ?, ?, ?)`,
        [id, args.datasetId, newVersion, jsonArg(args.input), jsonArg(args.groundTruth), jsonArg(args.metadata), transformToSqlValue(now), transformToSqlValue(now)],
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
        input: args.input,
        groundTruth: args.groundTruth,
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
    const existing = await this.getItemById({ id: args.id });
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

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      const versionId = randomUUID();
      const now = new Date();
      const tableDatasetsName = formatTableName(TABLE_DATASETS);
      const tableItemsName = formatTableName(TABLE_DATASET_ITEMS);
      const tableVersionsName = formatTableName(TABLE_DATASET_VERSIONS);

      const mergedInput = args.input ?? existing.input;
      const mergedGroundTruth = args.groundTruth ?? existing.groundTruth;
      const mergedMetadata = args.metadata ?? existing.metadata;

      // Bump version
      await connection.execute(
        `UPDATE ${tableDatasetsName} SET \`version\` = \`version\` + 1 WHERE id = ?`,
        [args.datasetId],
      );

      const [versionRows] = await connection.execute<RowDataPacket[]>(
        `SELECT \`version\` FROM ${tableDatasetsName} WHERE id = ?`,
        [args.datasetId],
      );
      const newVersion = (versionRows as any[])[0]?.version as number;

      // Close old row
      await connection.execute(
        `UPDATE ${tableItemsName} SET \`validTo\` = ? WHERE \`id\` = ? AND \`validTo\` IS NULL AND \`isDeleted\` = 0`,
        [newVersion, args.id],
      );

      // Insert new row
      await connection.execute(
        `INSERT INTO ${tableItemsName} (\`id\`, \`datasetId\`, \`datasetVersion\`, \`validTo\`, \`isDeleted\`, \`input\`, \`groundTruth\`, \`metadata\`, \`createdAt\`, \`updatedAt\`) VALUES (?, ?, ?, NULL, 0, ?, ?, ?, ?, ?)`,
        [args.id, args.datasetId, newVersion, jsonArg(mergedInput), jsonArg(mergedGroundTruth), jsonArg(mergedMetadata), transformToSqlValue(existing.createdAt), transformToSqlValue(now)],
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
        input: mergedInput,
        groundTruth: mergedGroundTruth,
        metadata: mergedMetadata,
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

  protected async _doDeleteItem({ id, datasetId }: { id: string; datasetId: string }): Promise<void> {
    const existing = await this.getItemById({ id });
    if (!existing) return;
    if (existing.datasetId !== datasetId) {
      throw new MastraError({
        id: 'MYSQL_DELETE_ITEM_DATASET_MISMATCH',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { itemId: id, expectedDatasetId: datasetId, actualDatasetId: existing.datasetId },
      });
    }

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      const versionId = randomUUID();
      const now = new Date();
      const tableDatasetsName = formatTableName(TABLE_DATASETS);
      const tableItemsName = formatTableName(TABLE_DATASET_ITEMS);
      const tableVersionsName = formatTableName(TABLE_DATASET_VERSIONS);

      // Bump version
      await connection.execute(
        `UPDATE ${tableDatasetsName} SET \`version\` = \`version\` + 1 WHERE id = ?`,
        [datasetId],
      );

      const [versionRows] = await connection.execute<RowDataPacket[]>(
        `SELECT \`version\` FROM ${tableDatasetsName} WHERE id = ?`,
        [datasetId],
      );
      const newVersion = (versionRows as any[])[0]?.version as number;

      // Close old row
      await connection.execute(
        `UPDATE ${tableItemsName} SET \`validTo\` = ? WHERE \`id\` = ? AND \`validTo\` IS NULL AND \`isDeleted\` = 0`,
        [newVersion, id],
      );

      // Insert tombstone
      await connection.execute(
        `INSERT INTO ${tableItemsName} (\`id\`, \`datasetId\`, \`datasetVersion\`, \`validTo\`, \`isDeleted\`, \`input\`, \`groundTruth\`, \`metadata\`, \`createdAt\`, \`updatedAt\`) VALUES (?, ?, ?, NULL, 1, ?, ?, ?, ?, ?)`,
        [id, datasetId, newVersion, jsonArg(existing.input), jsonArg(existing.groundTruth), jsonArg(existing.metadata), transformToSqlValue(existing.createdAt), transformToSqlValue(now)],
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

  // --- SCD-2 queries ---

  async getItemById(args: { id: string; datasetVersion?: number }): Promise<DatasetItem | null> {
    try {
      const tableItemsName = formatTableName(TABLE_DATASET_ITEMS);
      let rows: RowDataPacket[];

      if (args.datasetVersion !== undefined) {
        [rows] = await this.pool.execute<RowDataPacket[]>(
          `SELECT * FROM ${tableItemsName} WHERE \`id\` = ? AND \`datasetVersion\` = ? AND \`isDeleted\` = 0`,
          [args.id, args.datasetVersion],
        );
      } else {
        [rows] = await this.pool.execute<RowDataPacket[]>(
          `SELECT * FROM ${tableItemsName} WHERE \`id\` = ? AND \`validTo\` IS NULL AND \`isDeleted\` = 0`,
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
        `SELECT * FROM ${tableItemsName} WHERE \`datasetId\` = ? AND \`datasetVersion\` <= ? AND (\`validTo\` IS NULL OR \`validTo\` > ?) AND \`isDeleted\` = 0 ORDER BY \`createdAt\` DESC, \`id\` ASC`,
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
        `SELECT * FROM ${tableItemsName} WHERE \`id\` = ? ORDER BY \`datasetVersion\` DESC`,
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
        `SELECT * FROM ${tableItemsName}${whereSql} ORDER BY \`createdAt\` DESC, \`id\` ASC LIMIT ${limitValue} OFFSET ${offset}`,
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
    const dataset = await this.getDatasetById({ id: input.datasetId });
    if (!dataset) {
      throw new MastraError({
        id: 'MYSQL_BULK_ADD_ITEMS_DATASET_NOT_FOUND',
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

      // Single version increment
      await connection.execute(
        `UPDATE ${tableDatasetsName} SET \`version\` = \`version\` + 1 WHERE id = ?`,
        [input.datasetId],
      );

      const [versionRows] = await connection.execute<RowDataPacket[]>(
        `SELECT \`version\` FROM ${tableDatasetsName} WHERE id = ?`,
        [input.datasetId],
      );
      const newVersion = (versionRows as any[])[0]?.version as number;

      const items: { id: string; itemInput: BatchInsertItemsInput['items'][number] }[] = [];
      for (const itemInput of input.items) {
        const id = randomUUID();
        items.push({ id, itemInput });

        await connection.execute(
          `INSERT INTO ${tableItemsName} (\`id\`, \`datasetId\`, \`datasetVersion\`, \`validTo\`, \`isDeleted\`, \`input\`, \`groundTruth\`, \`metadata\`, \`createdAt\`, \`updatedAt\`) VALUES (?, ?, ?, NULL, 0, ?, ?, ?, ?, ?)`,
          [id, input.datasetId, newVersion, jsonArg(itemInput.input), jsonArg(itemInput.groundTruth), jsonArg(itemInput.metadata), transformToSqlValue(now), transformToSqlValue(now)],
        );
      }

      // Single dataset_version record
      await connection.execute(
        `INSERT INTO ${tableVersionsName} (\`id\`, \`datasetId\`, \`version\`, \`createdAt\`) VALUES (?, ?, ?, ?)`,
        [versionId, input.datasetId, newVersion, transformToSqlValue(now)],
      );

      await connection.commit();

      return items.map(({ id, itemInput }) => ({
        id,
        datasetId: input.datasetId,
        datasetVersion: newVersion,
        input: itemInput.input,
        groundTruth: itemInput.groundTruth,
        metadata: itemInput.metadata,
        createdAt: now,
        updatedAt: now,
      }));
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

    // Fetch current items for tombstone data
    const currentItems: DatasetItem[] = [];
    for (const itemId of input.itemIds) {
      const item = await this.getItemById({ id: itemId });
      if (item && item.datasetId === input.datasetId) {
        currentItems.push(item);
      }
    }

    if (currentItems.length === 0) return;

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      const now = new Date();
      const versionId = randomUUID();
      const tableDatasetsName = formatTableName(TABLE_DATASETS);
      const tableItemsName = formatTableName(TABLE_DATASET_ITEMS);
      const tableVersionsName = formatTableName(TABLE_DATASET_VERSIONS);

      // Single version increment
      await connection.execute(
        `UPDATE ${tableDatasetsName} SET \`version\` = \`version\` + 1 WHERE id = ?`,
        [input.datasetId],
      );

      const [versionRows] = await connection.execute<RowDataPacket[]>(
        `SELECT \`version\` FROM ${tableDatasetsName} WHERE id = ?`,
        [input.datasetId],
      );
      const newVersion = (versionRows as any[])[0]?.version as number;

      for (const item of currentItems) {
        // Close old row
        await connection.execute(
          `UPDATE ${tableItemsName} SET \`validTo\` = ? WHERE \`id\` = ? AND \`validTo\` IS NULL AND \`isDeleted\` = 0`,
          [newVersion, item.id],
        );

        // Insert tombstone
        await connection.execute(
          `INSERT INTO ${tableItemsName} (\`id\`, \`datasetId\`, \`datasetVersion\`, \`validTo\`, \`isDeleted\`, \`input\`, \`groundTruth\`, \`metadata\`, \`createdAt\`, \`updatedAt\`) VALUES (?, ?, ?, NULL, 1, ?, ?, ?, ?, ?)`,
          [item.id, input.datasetId, newVersion, jsonArg(item.input), jsonArg(item.groundTruth), jsonArg(item.metadata), transformToSqlValue(item.createdAt), transformToSqlValue(now)],
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
