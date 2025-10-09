import { DatasetsStorage, TABLE_DATASET_VERSIONS, TABLE_DATASETS } from '@mastra/core/storage';
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
    const record = {
      ...validatedDatasetPayload,
      id,
      createdAt: new Date(),
    };
    const versionRecord = this.generateDatasetVersionPayload({ datasetId: id });

    // Need to transform the record to the correct type
    await this.operations.insert({ tableName: TABLE_DATASETS, record });
    await this.operations.insert({ tableName: TABLE_DATASET_VERSIONS, record: versionRecord });

    return {
      ...record,
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
    const record = await this.operations.load({ tableName: TABLE_DATASETS, keys: { id } });
    if (!record) {
      throw new Error('Dataset not found');
    }

    const versionSql = `SELECT * FROM ${TABLE_DATASET_VERSIONS} WHERE datasetId = ? ORDER BY id DESC LIMIT 1`;
    const versionRecord = await this.client.execute(versionSql, [id]);

    return {
      ...(record as Omit<DatasetRecord, 'currentVersion'>),
      currentVersion: versionRecord.rows[0]! as unknown as DatasetVersion,
    };
  }

  getDatasets({
    pagination,
  }: {
    pagination?: StoragePagination;
  }): Promise<{ datasets: DatasetRecord[]; pagination: PaginationInfo }> {
    throw new Error('Not implemented');
  }

  // DATASET VERSIONS
  async getDatasetVersions({
    datasetId,
    pagination,
  }: {
    datasetId: string;
    pagination?: StoragePagination;
  }): Promise<{ versions: DatasetVersion[]; pagination: PaginationInfo }> {
    const limit = pagination?.perPage ?? 10;
    const offset = pagination?.page ?? 0;
    const versionSql = `SELECT * FROM ${TABLE_DATASET_VERSIONS} WHERE datasetId = ? LIMIT ? OFFSET ? ORDER BY id DESC`;
    const versionRecords = await this.client.execute(versionSql, [datasetId, limit + 1, offset]);
    const hasMore = versionRecords.rows.length > limit;
    const versions = versionRecords.rows.slice(0, limit) as unknown as DatasetVersion[];
    return {
      versions,
      pagination: {
        total: versionRecords.rows.length,
        page: pagination?.page ?? 0,
        perPage: pagination?.perPage ?? 10,
        hasMore,
      },
    };
  }

  // DATASET ROWS
  addDatasetRows(args: AddDatasetRowsPayload): Promise<{ rows: DatasetRow[]; versionId: string }> {
    throw new Error('Not implemented');
  }

  getDatasetRowByRowId({ rowId, versionId }: { rowId: string; versionId?: string }): Promise<DatasetRow> {
    throw new Error('Not implemented');
  }

  getDatasetRowVersionsByRowId({
    rowId,
    pagination,
  }: {
    rowId: string;
    pagination?: StoragePagination;
  }): Promise<{ rows: DatasetRow[]; pagination: PaginationInfo }> {
    throw new Error('Not implemented');
  }

  getDatasetRows({
    datasetId,
    pagination,
    versionId,
  }: {
    datasetId: string;
    pagination?: StoragePagination;
    versionId?: string;
  }): Promise<{ rows: DatasetRow[]; pagination: PaginationInfo }> {
    throw new Error('Not implemented');
  }

  updateDatasetRows(args: UpdateDatasetRowsPayload): Promise<{ rows: DatasetRow[]; versionId: string }> {
    throw new Error('Not implemented');
  }

  deleteDatasetRows(args: DeleteDatasetRowsPayload): Promise<{ versionId: string }> {
    throw new Error('Not implemented');
  }
}
