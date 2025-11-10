import z from 'zod';
import { MastraBase } from '../../../base';
import type { PaginationInfo, StoragePagination } from '../../types';
import { monotonicFactory } from 'ulid';
import type { RequestContext } from '../../../request-context';

export type DatasetRecord = {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt?: Date;
  currentVersion: DatasetVersion;
};

export type DatasetVersion = {
  id: string;
  datasetId: string;
  createdAt: Date;
  updatedAt?: Date;
};

export type DatasetRow = {
  rowId: string;
  datasetId: string;
  versionId: string;
  input: any;
  groundTruth?: any;
  requestContext?: RequestContext;
  deleted: boolean;
  traceId?: string;
  spanId?: string;
  createdAt: Date;
  updatedAt?: Date;
};

const createDatasetValidation = z.object({
  name: z.string(),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});
export type CreateDatasetPayload = z.infer<typeof createDatasetValidation>;

const updateDatasetValidation = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});
export type UpdateDatasetPayload = z.infer<typeof updateDatasetValidation>;

const addDatasetRowsValidation = z.object({
  rows: z.array(
    z.object({
      input: z.any(),
      groundTruth: z.any().optional(),
      requestContext: z.record(z.string(), z.any()).optional(),
      traceId: z.string().optional(),
      spanId: z.string().optional(),
    }),
  ),
  datasetId: z.string(),
});
export type AddDatasetRowsPayload = z.infer<typeof addDatasetRowsValidation>;

const updateDatasetRowsValidation = z.object({
  updates: z.array(
    z.object({
      rowId: z.string(),
      input: z.any().optional(),
      groundTruth: z.any().optional(),
      requestContext: z.record(z.string(), z.any()).optional(),
      traceId: z.string().optional(),
      spanId: z.string().optional(),
    }),
  ),
  datasetId: z.string(),
});
export type UpdateDatasetRowsPayload = z.infer<typeof updateDatasetRowsValidation>;

const deleteDatasetRowsValidation = z.object({
  rowIds: z.array(z.string()),
  datasetId: z.string(),
});
export type DeleteDatasetRowsPayload = z.infer<typeof deleteDatasetRowsValidation>;

export class DatasetsStorage extends MastraBase {
  versionULIDGenerator: ReturnType<typeof monotonicFactory>;
  constructor() {
    super({
      component: 'STORAGE',
      name: 'DATASETS',
    });
    this.versionULIDGenerator = monotonicFactory();
  }

  // DATASETS
  createDataset(_dataset: CreateDatasetPayload): Promise<DatasetRecord> {
    throw new Error('Not implemented');
  }

  protected generateDatasetId(): string {
    return crypto.randomUUID();
  }

  protected validateCreateDataset(dataset: CreateDatasetPayload): CreateDatasetPayload {
    return createDatasetValidation.parse(dataset);
  }

  updateDataset({ id, updates }: { id: string; updates: UpdateDatasetPayload }): Promise<DatasetRecord> {
    throw new Error('Not implemented');
  }

  protected validateUpdateDataset(dataset: UpdateDatasetPayload): UpdateDatasetPayload {
    return updateDatasetValidation.parse(dataset);
  }

  deleteDataset({ id }: { id: string }): Promise<void> {
    throw new Error('Not implemented');
  }

  protected generateVersionULID(): string {
    return this.versionULIDGenerator();
  }

  getDataset({ id }: { id: string }): Promise<DatasetRecord> {
    throw new Error('Not implemented');
  }

  listDatasets(args?: {
    filter?: {
      name?: string;
    };
    pagination?: StoragePagination;
  }): Promise<{ datasets: DatasetRecord[]; pagination: PaginationInfo }> {
    throw new Error('Not implemented');
  }

  listDatasetVersions({
    datasetId,
    pagination,
  }: {
    datasetId: string;
    pagination?: StoragePagination;
  }): Promise<{ versions: DatasetVersion[]; pagination: PaginationInfo }> {
    throw new Error('Not implemented');
  }

  // DATASET ROWS
  addDatasetRows(args: AddDatasetRowsPayload): Promise<{ rows: DatasetRow[]; versionId: string }> {
    throw new Error('Not implemented');
  }

  protected generateDatasetVersionPayload({ datasetId }: { datasetId: string }): DatasetVersion {
    return {
      id: this.generateVersionULID(),
      datasetId,
      createdAt: new Date(),
    };
  }

  protected generateDatasetRowId(): string {
    return crypto.randomUUID();
  }

  protected validateAddDatasetRows(rows: AddDatasetRowsPayload): AddDatasetRowsPayload {
    return addDatasetRowsValidation.parse(rows);
  }

  getDatasetRowByRowId({ rowId, versionId }: { rowId: string; versionId?: string }): Promise<DatasetRow> {
    throw new Error('Not implemented');
  }

  listDatasetRows({
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

  listDatasetRowVersionsByRowId({
    rowId,
    pagination,
  }: {
    rowId: string;
    pagination?: StoragePagination;
  }): Promise<{ rows: DatasetRow[]; pagination: PaginationInfo }> {
    throw new Error('Not implemented');
  }

  updateDatasetRows(args: UpdateDatasetRowsPayload): Promise<{ rows: DatasetRow[]; versionId: string }> {
    throw new Error('Not implemented');
  }

  protected validateUpdateDatasetRows(updates: UpdateDatasetRowsPayload): UpdateDatasetRowsPayload {
    return updateDatasetRowsValidation.parse(updates);
  }

  deleteDatasetRows(args: DeleteDatasetRowsPayload): Promise<{ versionId: string }> {
    throw new Error('Not implemented');
  }

  protected validateDeleteDatasetRows(args: DeleteDatasetRowsPayload): DeleteDatasetRowsPayload {
    return deleteDatasetRowsValidation.parse(args);
  }
}
