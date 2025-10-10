import {
  DatasetsStorage,
  normalizePagination,
  safelyParseJSON,
  TABLE_DATASET_ROWS,
  TABLE_DATASET_VERSIONS,
  TABLE_DATASETS,
} from '@mastra/core/storage';
import type {
  AddDatasetRowsPayload,
  CreateDatasetPayload,
  DatasetRecord,
  DatasetRow,
  DatasetVersion,
  DeleteDatasetRowsPayload,
  PaginationInfo,
  StoragePagination,
  UpdateDatasetPayload,
  UpdateDatasetRowsPayload,
} from '@mastra/core/storage';
import type { StoreOperationsLibSQL } from '../operations';
import type { Client } from '@libsql/client';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';

export class LibSQLDatasetsStorage extends DatasetsStorage {
  operations: StoreOperationsLibSQL;
  client: Client;

  constructor({ operations, client }: { operations: StoreOperationsLibSQL; client: Client }) {
    super();
    this.operations = operations;
    this.client = client;
  }

  // DATASETS
  async createDataset(datasetPayload: CreateDatasetPayload): Promise<DatasetRecord> {
    const validatedDatasetPayload = this.validateCreateDataset(datasetPayload);
    const id = this.generateDatasetId();
    const createdAt = new Date();
    const datasetRecord = {
      ...validatedDatasetPayload,
      id,
      createdAt,
    };
    const versionRecord = this.generateDatasetVersionPayload({ datasetId: id });

    const datasetSql = `
      INSERT INTO ${TABLE_DATASETS} (id, name, description, metadata, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `;

    const versionSql = `
      INSERT INTO ${TABLE_DATASET_VERSIONS} (id, datasetId, createdAt)
      VALUES (?, ?, ?)
    `;

    try {
      await this.client.batch(
        [
          {
            sql: datasetSql,
            args: [
              id,
              datasetRecord.name,
              datasetRecord.description || null,
              datasetRecord.metadata ? JSON.stringify(datasetRecord.metadata) : null,
              createdAt.toISOString(),
            ],
          },
          {
            sql: versionSql,
            args: [versionRecord.id, versionRecord.datasetId, versionRecord.createdAt.toISOString()],
          },
        ],
        'write',
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('SQLITE_CONSTRAINT_UNIQUE')) {
        throw new MastraError(
          {
            id: 'LIBSQL_STORE_DATASET_ALREADY_EXISTS',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: {
              datasetName: validatedDatasetPayload.name,
            },
          },
          error,
        );
      } else {
        throw new MastraError(
          {
            id: 'LIBSQL_STORE_DATASET_CREATE_FAILED',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.THIRD_PARTY,
            details: {
              datasetName: validatedDatasetPayload.name,
            },
          },
          error,
        );
      }
    }

    return {
      ...datasetRecord,
      currentVersion: versionRecord,
    };
  }

  async updateDataset({ id, updates }: { id: string; updates: UpdateDatasetPayload }): Promise<DatasetRecord> {
    const validatedUpdates = this.validateUpdateDataset(updates);
    const versionRecord = this.generateDatasetVersionPayload({ datasetId: id });
    await this.operations.update({ tableName: TABLE_DATASETS, keys: { id }, data: validatedUpdates });
    await this.operations.insert({ tableName: TABLE_DATASET_VERSIONS, record: versionRecord });
    const record = (await this.operations.load({ tableName: TABLE_DATASETS, keys: { id } })) as Omit<
      DatasetRecord,
      'currentVersion'
    >;
    return {
      ...record,
      currentVersion: versionRecord,
    };
  }

  async deleteDataset({ id }: { id: string }): Promise<void> {
    await this.operations.batchDelete({ tableName: TABLE_DATASETS, keys: [{ id }] });
  }

  async getDataset({ id }: { id: string }): Promise<DatasetRecord> {
    const datasetSql = `
    SELECT
      d.id, d.name, d.description, d.metadata, d.createdAt, d.updatedAt,
      v.id as version_id,
      v.datasetId as version_datasetId,
      v.createdAt as version_createdAt,
      v.updatedAt as version_updatedAt
    FROM ${TABLE_DATASETS} d
    LEFT JOIN ${TABLE_DATASET_VERSIONS} v ON v.datasetId = d.id
      AND v.id = (
        SELECT id FROM ${TABLE_DATASET_VERSIONS}
        WHERE datasetId = d.id
        ORDER BY id DESC
        LIMIT 1
      )
    WHERE d.id = ?
  `;
    const datasetRecord = await this.client.execute(datasetSql, [id]);
    if (datasetRecord.rows.length === 0) {
      throw new Error('Dataset not found');
    }

    return this.transformDatasetRecord(datasetRecord.rows[0]!);
  }

  transformDatasetRecord(row: Record<string, any>): DatasetRecord {
    return {
      currentVersion: {
        id: row.version_id,
        datasetId: row.version_datasetId,
        createdAt: new Date(row.version_createdAt),
        updatedAt: row.version_updatedAt ? new Date(row.version_updatedAt) : undefined,
      },
      id: row.id,
      name: row.name,
      description: row.description,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      createdAt: new Date(row.createdAt),
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : undefined,
    };
  }

  transformDatasetRow(row: Record<string, any>): DatasetRow {
    return {
      rowId: row.rowId,
      datasetId: row.datasetId,
      versionId: row.versionId,
      input: safelyParseJSON(row.input),
      groundTruth: safelyParseJSON(row.groundTruth),
      runtimeContext: row.runtimeContext
        ? new RuntimeContext(Object.entries(safelyParseJSON(row.runtimeContext)))
        : undefined,
      traceId: row.traceId,
      spanId: row.spanId,
      deleted: row.deleted === 1,
      createdAt: new Date(row.createdAt),
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : undefined,
    };
  }

  async getDatasets(args: {
    filter?: {
      name?: string;
    };
    pagination?: StoragePagination;
  }): Promise<{ datasets: DatasetRecord[]; pagination: PaginationInfo }> {
    const { filter, pagination } = args ?? {};
    const sqlParams: any[] = [];
    let whereClause = '';
    if (filter?.name) {
      whereClause = `WHERE name = ?`;
      sqlParams.push(filter.name);
    }

    const totalSql = `SELECT COUNT(*) as count FROM ${TABLE_DATASETS} ${whereClause}`;
    const totalRecords = await this.client.execute(totalSql, sqlParams);
    const total = totalRecords.rows[0]?.count as number;

    if (total === 0) {
      return { datasets: [], pagination: { total: 0, page: 0, perPage: 0, hasMore: false } };
    }

    const { page, perPage, offset } = normalizePagination(pagination);

    const datasetSql = `
      SELECT
        d.id, d.name, d.description, d.metadata, d.createdAt, d.updatedAt,
        v.id as version_id,
        v.datasetId as version_datasetId,
        v.createdAt as version_createdAt,
        v.updatedAt as version_updatedAt
      FROM ${TABLE_DATASETS} d
      LEFT JOIN ${TABLE_DATASET_VERSIONS} v ON v.datasetId = d.id
        AND v.id = (
          SELECT id FROM ${TABLE_DATASET_VERSIONS}
          WHERE datasetId = d.id
          ORDER BY id DESC
          LIMIT 1
        )
      ${whereClause}
      ORDER BY d.name ASC
      LIMIT ? OFFSET ?
    `;

    const datasetRecords = await this.client.execute(datasetSql, [...sqlParams, perPage + 1, offset]);
    const hasMore = datasetRecords.rows.length > perPage;

    // Transform the flat rows into DatasetRecord objects with nested currentVersion
    const datasets: DatasetRecord[] = datasetRecords.rows
      .slice(0, perPage)
      .map((row: any) => this.transformDatasetRecord(row));
    return { datasets, pagination: { total, page, perPage, hasMore } };
  }

  // DATASET VERSIONS
  async getDatasetVersions({
    datasetId,
    pagination,
  }: {
    datasetId: string;
    pagination?: StoragePagination;
  }): Promise<{ versions: DatasetVersion[]; pagination: PaginationInfo }> {
    const totalSql = `SELECT COUNT(*) as count FROM ${TABLE_DATASET_VERSIONS} WHERE datasetId = ?`;
    const totalRecords = await this.client.execute(totalSql, [datasetId]);
    const total = totalRecords.rows[0]?.count as number;

    if (total === 0) {
      return { versions: [], pagination: { total: 0, page: 0, perPage: 0, hasMore: false } };
    }

    const { page, perPage, offset } = normalizePagination(pagination);
    const versionSql = `SELECT * FROM ${TABLE_DATASET_VERSIONS} WHERE datasetId = ? ORDER BY id DESC LIMIT ? OFFSET ?`;

    const versionRecords = await this.client.execute(versionSql, [datasetId, perPage + 1, offset]);
    const hasMore = versionRecords.rows.length > perPage;
    const versions = versionRecords.rows.slice(0, perPage) as unknown as DatasetVersion[];

    return {
      versions,
      pagination: {
        total,
        page: page,
        perPage: perPage,
        hasMore,
      },
    };
  }

  // DATASET ROWS
  async addDatasetRows(args: AddDatasetRowsPayload): Promise<{ rows: DatasetRow[]; versionId: string }> {
    const { rows: validatedRows, datasetId } = this.validateAddDatasetRows(args);

    // Create a new version for this dataset
    const versionRecord = this.generateDatasetVersionPayload({ datasetId });
    await this.operations.insert({ tableName: TABLE_DATASET_VERSIONS, record: versionRecord });

    // Map the input rows to DatasetRow records
    const datasetRows: DatasetRow[] = validatedRows.map(row => ({
      rowId: this.generateDatasetRowId(),
      versionId: versionRecord.id,
      datasetId,
      input: row.input,
      groundTruth: row.groundTruth,
      runtimeContext: row.runtimeContext ? new RuntimeContext(Object.entries(row.runtimeContext)) : undefined,
      traceId: row.traceId,
      spanId: row.spanId,
      deleted: false,
      createdAt: new Date(),
    }));

    // Batch insert all rows
    await this.operations.batchInsert({
      tableName: TABLE_DATASET_ROWS,
      records: datasetRows.map(row => ({
        ...row,
        runtimeContext: row.runtimeContext ? Object.fromEntries(row.runtimeContext.entries()) : undefined,
      })),
    });

    return { rows: datasetRows, versionId: versionRecord.id };
  }

  async getDatasetRowByRowId({ rowId, versionId }: { rowId: string; versionId?: string }): Promise<DatasetRow> {
    let sql: string;
    let params: any[];

    if (versionId) {
      // Get specific version of the row
      sql = `SELECT * FROM ${TABLE_DATASET_ROWS} WHERE rowId = ? AND versionId = ? LIMIT 1`;
      params = [rowId, versionId];
    } else {
      // Get latest version of the row
      sql = `SELECT * FROM ${TABLE_DATASET_ROWS} WHERE rowId = ? ORDER BY versionId DESC LIMIT 1`;
      params = [rowId];
    }

    const result = await this.client.execute(sql, params);

    if (!result.rows || result.rows.length === 0) {
      throw new Error(`Row not found for rowId: ${rowId}${versionId ? ` and versionId: ${versionId}` : ''}`);
    }

    const row = result.rows[0] as any;

    // Check if row is deleted
    if (row.deleted) {
      throw new Error(`Row not found for version ${versionId || 'latest'}`);
    }

    // Transform and return the row
    return this.transformDatasetRow(row);
  }

  async getDatasetRowVersionsByRowId({
    rowId,
    pagination,
  }: {
    rowId: string;
    pagination?: StoragePagination;
  }): Promise<{ rows: DatasetRow[]; pagination: PaginationInfo }> {
    // Get total count
    const totalSql = `SELECT COUNT(*) as count FROM ${TABLE_DATASET_ROWS} WHERE rowId = ?`;
    const totalRecords = await this.client.execute(totalSql, [rowId]);
    const total = totalRecords.rows[0]?.count as number;
    console.log('total', total);

    if (total === 0) {
      return { rows: [], pagination: { total: 0, page: 0, perPage: 0, hasMore: false } };
    }

    const { page, perPage, offset } = normalizePagination(pagination);

    // Get paginated versions sorted by versionId descending (latest first)
    const sql = `SELECT * FROM ${TABLE_DATASET_ROWS}
                 WHERE rowId = ?
                 ORDER BY versionId DESC
                 LIMIT ? OFFSET ?`;

    const result = await this.client.execute(sql, [rowId, perPage + 1, offset]);
    const hasMore = result.rows.length > perPage;
    const rows = result.rows.slice(0, perPage).map((row: any) => this.transformDatasetRow(row));

    console.log('rows', JSON.stringify(rows, null, 2));
    return {
      rows,
      pagination: {
        total,
        page,
        perPage,
        hasMore,
      },
    };
  }

  async getDatasetRows({
    datasetId,
    pagination,
    versionId,
  }: {
    datasetId: string;
    pagination?: StoragePagination;
    versionId?: string;
  }): Promise<{ rows: DatasetRow[]; pagination: PaginationInfo }> {
    // Build the query to get the latest version of each unique row
    // If versionId is specified, get snapshot at that point in time
    const versionFilter = versionId ? 'AND versionId <= ?' : '';
    const versionParams = versionId ? [datasetId, versionId] : [datasetId];

    // Count total unique non-deleted rows
    const countSql = `
      SELECT COUNT(DISTINCT rowId) as count
      FROM ${TABLE_DATASET_ROWS}
      WHERE datasetId = ? ${versionFilter}
        AND rowId IN (
          SELECT DISTINCT rowId
          FROM ${TABLE_DATASET_ROWS}
          WHERE datasetId = ? ${versionFilter}
            AND deleted = 0
            AND versionId = (
              SELECT MAX(versionId)
              FROM ${TABLE_DATASET_ROWS} r2
              WHERE r2.rowId = ${TABLE_DATASET_ROWS}.rowId
                AND r2.datasetId = ? ${versionFilter}
            )
        )
    `;

    const countResult = await this.client.execute(countSql, [...versionParams, ...versionParams, ...versionParams]);
    const total = countResult.rows[0]?.count as number;

    if (total === 0) {
      return { rows: [], pagination: { total: 0, page: 0, perPage: 0, hasMore: false } };
    }

    const { page, perPage, offset } = normalizePagination(pagination);

    // Get the latest version of each row, excluding deleted rows
    const dataSql = `
      SELECT *
      FROM ${TABLE_DATASET_ROWS} r1
      WHERE r1.datasetId = ? ${versionFilter}
        AND r1.deleted = 0
        AND r1.versionId = (
          SELECT MAX(versionId)
          FROM ${TABLE_DATASET_ROWS} r2
          WHERE r2.rowId = r1.rowId
            AND r2.datasetId = ? ${versionFilter}
        )
      GROUP BY r1.rowId
      ORDER BY r1.versionId DESC
      LIMIT ? OFFSET ?
    `;

    const dataResult = await this.client.execute(dataSql, [...versionParams, ...versionParams, perPage + 1, offset]);
    const hasMore = dataResult.rows.length > perPage;
    const rows = dataResult.rows.slice(0, perPage).map((row: any) => this.transformDatasetRow(row));

    return {
      rows,
      pagination: {
        total,
        page,
        perPage,
        hasMore,
      },
    };
  }

  async updateDatasetRows(args: UpdateDatasetRowsPayload): Promise<{ rows: DatasetRow[]; versionId: string }> {
    const { updates: validatedUpdates, datasetId } = this.validateUpdateDatasetRows(args);

    // Create a new version for this dataset
    const versionRecord = this.generateDatasetVersionPayload({ datasetId });
    await this.operations.insert({ tableName: TABLE_DATASET_VERSIONS, record: versionRecord });

    const updatedRows: DatasetRow[] = [];

    // Process each update
    for (const update of validatedUpdates) {
      // Get the latest version of the row
      const sql = `SELECT * FROM ${TABLE_DATASET_ROWS} WHERE rowId = ? ORDER BY versionId DESC LIMIT 1`;
      const result = await this.client.execute(sql, [update.rowId]);

      if (!result.rows || result.rows.length === 0) {
        throw new Error(`Row not found for rowId: ${update.rowId}`);
      }

      const existingRow = this.transformDatasetRow(result.rows[0] as any);

      // Merge existing row with updates
      const updatedRow: DatasetRow = {
        ...existingRow,
        versionId: versionRecord.id,
        input: update.input !== undefined ? update.input : existingRow.input,
        groundTruth: update.groundTruth !== undefined ? update.groundTruth : existingRow.groundTruth,
        runtimeContext: update.runtimeContext
          ? new RuntimeContext(Object.entries(update.runtimeContext))
          : existingRow.runtimeContext,
        traceId: update.traceId !== undefined ? update.traceId : existingRow.traceId,
        spanId: update.spanId !== undefined ? update.spanId : existingRow.spanId,
        updatedAt: new Date(),
      };

      updatedRows.push(updatedRow);
    }

    // Batch insert all updated rows as new versions
    await this.operations.batchInsert({
      tableName: TABLE_DATASET_ROWS,
      records: updatedRows.map(row => ({
        ...row,
        runtimeContext: row.runtimeContext ? Object.fromEntries(row.runtimeContext.entries()) : undefined,
      })),
    });

    return { rows: updatedRows, versionId: versionRecord.id };
  }

  async deleteDatasetRows(args: DeleteDatasetRowsPayload): Promise<{ versionId: string }> {
    const { rowIds: validatedRowIds, datasetId } = this.validateDeleteDatasetRows(args);

    // Create a new version for this dataset
    const versionRecord = this.generateDatasetVersionPayload({ datasetId });
    await this.operations.insert({ tableName: TABLE_DATASET_VERSIONS, record: versionRecord });

    const deletedRows: any[] = [];

    // Process each row to be deleted
    for (const rowId of validatedRowIds) {
      // Get the latest version of the row to preserve its createdAt
      const sql = `SELECT * FROM ${TABLE_DATASET_ROWS} WHERE rowId = ? ORDER BY versionId DESC LIMIT 1`;
      const result = await this.client.execute(sql, [rowId]);

      if (!result.rows || result.rows.length === 0 || result.rows[0]?.deleted === 1) {
        throw new Error(`Row not found for rowId: ${rowId} or already deleted`);
      }

      const existingRow = result.rows[0] as any;

      // Create a deleted row version
      deletedRows.push({
        rowId,
        datasetId,
        versionId: versionRecord.id,
        input: '', // Empty input for deleted rows
        groundTruth: undefined,
        runtimeContext: undefined,
        traceId: undefined,
        spanId: undefined,
        deleted: true,
        createdAt: new Date(existingRow.createdAt), // Preserve original creation date
        updatedAt: new Date(),
      });
    }

    // Batch insert all deleted row versions
    await this.operations.batchInsert({
      tableName: TABLE_DATASET_ROWS,
      records: deletedRows,
    });

    return { versionId: versionRecord.id };
  }
}
