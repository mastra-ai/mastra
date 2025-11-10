import type { Client } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { RequestContext } from '@mastra/core/request-context';
import {
  DatasetsStorage,
  calculatePagination,
  normalizePerPage,
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

export class DatasetsLibSQL extends DatasetsStorage {
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
    const id = crypto.randomUUID();
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
    const updatedAt = new Date();

    await this.operations.update({
      tableName: TABLE_DATASETS,
      keys: { id },
      data: { ...validatedUpdates, updatedAt },
    });
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

  private transformDatasetRecord(row: Record<string, any>): DatasetRecord {
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

  private transformDatasetRow(row: Record<string, any>): DatasetRow {
    return {
      rowId: row.rowId,
      datasetId: row.datasetId,
      versionId: row.versionId,
      input: safelyParseJSON(row.input),
      groundTruth: safelyParseJSON(row.groundTruth),
      requestContext: row.requestContext
        ? new RequestContext(Object.entries(safelyParseJSON(row.requestContext)))
        : undefined,
      traceId: row.traceId,
      spanId: row.spanId,
      deleted: row.deleted === 1,
      createdAt: new Date(row.createdAt),
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : undefined,
    };
  }

  async listDatasets(args?: {
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
    const total = Number(totalRecords.rows?.[0]?.count ?? 0);

    const page = Math.max(0, pagination?.page ?? 0);
    const perPageInput = pagination?.perPage;

    if (total === 0) {
      return {
        datasets: [],
        pagination: { total: 0, page, perPage: perPageInput ?? 10, hasMore: false },
      };
    }

    const normalizedPerPage = normalizePerPage(perPageInput, 10);
    const { offset, perPage } = calculatePagination(page, perPageInput, normalizedPerPage);

    const limitValue = perPageInput === false ? total : normalizedPerPage;
    const end = perPageInput === false ? total : offset + normalizedPerPage;

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
      ORDER BY d.createdAt DESC
      LIMIT ? OFFSET ?
    `;

    const datasetRecords = await this.client.execute(datasetSql, [...sqlParams, limitValue, offset]);
    const datasets: DatasetRecord[] = datasetRecords.rows.map((row: any) => this.transformDatasetRecord(row));

    return {
      datasets,
      pagination: { total, page, perPage, hasMore: end < total },
    };
  }

  // DATASET VERSIONS
  async listDatasetVersions({
    datasetId,
    pagination,
  }: {
    datasetId: string;
    pagination?: StoragePagination;
  }): Promise<{ versions: DatasetVersion[]; pagination: PaginationInfo }> {
    const totalSql = `SELECT COUNT(*) as count FROM ${TABLE_DATASET_VERSIONS} WHERE datasetId = ?`;
    const totalRecords = await this.client.execute(totalSql, [datasetId]);
    const total = Number(totalRecords.rows?.[0]?.count ?? 0);

    const page = Math.max(0, pagination?.page ?? 0);
    const perPageInput = pagination?.perPage;

    if (total === 0) {
      return {
        versions: [],
        pagination: { total: 0, page, perPage: perPageInput ?? 10, hasMore: false },
      };
    }

    const normalizedPerPage = normalizePerPage(perPageInput, 10);
    const { offset, perPage } = calculatePagination(page, perPageInput, normalizedPerPage);

    const limitValue = perPageInput === false ? total : normalizedPerPage;
    const end = perPageInput === false ? total : offset + normalizedPerPage;

    const versionSql = `SELECT * FROM ${TABLE_DATASET_VERSIONS} WHERE datasetId = ? ORDER BY id DESC LIMIT ? OFFSET ?`;
    const versionRecords = await this.client.execute(versionSql, [datasetId, limitValue, offset]);

    const versions: DatasetVersion[] = versionRecords.rows.map(row => ({
      id: row.id as string,
      datasetId: row.datasetId as string,
      createdAt: new Date(row.createdAt as string),
      updatedAt: row.updatedAt ? new Date(row.updatedAt as string) : undefined,
    }));

    return {
      versions,
      pagination: {
        total,
        page,
        perPage,
        hasMore: end < total,
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
      requestContext: row.requestContext ? new RequestContext(Object.entries(row.requestContext)) : undefined,
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
        requestContext: row.requestContext ? Object.fromEntries(row.requestContext.entries()) : undefined,
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

  async listDatasetRowVersionsByRowId({
    rowId,
    pagination,
  }: {
    rowId: string;
    pagination?: StoragePagination;
  }): Promise<{ rows: DatasetRow[]; pagination: PaginationInfo }> {
    const totalSql = `SELECT COUNT(*) as count FROM ${TABLE_DATASET_ROWS} WHERE rowId = ?`;
    const totalRecords = await this.client.execute(totalSql, [rowId]);
    const total = Number(totalRecords.rows?.[0]?.count ?? 0);

    const page = Math.max(0, pagination?.page ?? 0);
    const perPageInput = pagination?.perPage;

    if (total === 0) {
      return {
        rows: [],
        pagination: { total: 0, page, perPage: perPageInput ?? 10, hasMore: false },
      };
    }

    const normalizedPerPage = normalizePerPage(perPageInput, 10);
    const { offset, perPage } = calculatePagination(page, perPageInput, normalizedPerPage);

    const limitValue = perPageInput === false ? total : normalizedPerPage;
    const end = perPageInput === false ? total : offset + normalizedPerPage;

    const sql = `SELECT * FROM ${TABLE_DATASET_ROWS} WHERE rowId = ? ORDER BY versionId DESC LIMIT ? OFFSET ?`;
    const result = await this.client.execute(sql, [rowId, limitValue, offset]);

    const rows = result.rows.map((row: any) => this.transformDatasetRow(row));

    return {
      rows,
      pagination: {
        total,
        page,
        perPage,
        hasMore: end < total,
      },
    };
  }

  async listDatasetRows({
    datasetId,
    pagination,
    versionId,
  }: {
    datasetId: string;
    pagination?: StoragePagination;
    versionId?: string;
  }): Promise<{ rows: DatasetRow[]; pagination: PaginationInfo }> {
    const page = Math.max(0, pagination?.page ?? 0);
    const perPageInput = pagination?.perPage;

    // Build version filter
    let versionFilter = '';
    const versionParams: any[] = [];
    if (versionId) {
      versionFilter = 'AND versionId <= ?';
      versionParams.push(versionId);
    }

    // Count distinct non-deleted rows
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

    const countResult = await this.client.execute(countSql, [
      datasetId,
      ...versionParams,
      datasetId,
      ...versionParams,
      datasetId,
      ...versionParams,
    ]);
    const total = Number(countResult.rows?.[0]?.count ?? 0);

    if (total === 0) {
      return {
        rows: [],
        pagination: { total: 0, page, perPage: perPageInput ?? 10, hasMore: false },
      };
    }

    const normalizedPerPage = normalizePerPage(perPageInput, 10);
    const { offset, perPage } = calculatePagination(page, perPageInput, normalizedPerPage);

    const limitValue = perPageInput === false ? total : normalizedPerPage;
    const end = perPageInput === false ? total : offset + normalizedPerPage;

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

    const dataResult = await this.client.execute(dataSql, [
      datasetId,
      ...versionParams,
      datasetId,
      ...versionParams,
      limitValue,
      offset,
    ]);
    const rows = dataResult.rows.map((row: any) => this.transformDatasetRow(row));

    return {
      rows,
      pagination: {
        total,
        page,
        perPage,
        hasMore: end < total,
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
        requestContext: update.requestContext
          ? new RequestContext(Object.entries(update.requestContext))
          : existingRow.requestContext,
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
        requestContext: row.requestContext ? Object.fromEntries(row.requestContext.entries()) : undefined,
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
        requestContext: undefined,
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
