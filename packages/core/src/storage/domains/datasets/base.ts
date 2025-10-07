import z from 'zod';
import { MastraBase } from '../../../base';
import type { Dataset } from '../../../datasets/dataset';
import type {
  DatasetRecord,
  DatasetRow,
  DatasetVersion,
  DeleteDatasetRow,
  UpdateDatasetRow,
} from '../../../datasets/types';
import type { PaginationInfo, StoragePagination } from '../../types';
import { monotonicFactory } from 'ulid';

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

  getDatasets({
    pagination,
  }: {
    pagination: StoragePagination;
  }): Promise<{ datasets: DatasetRecord[]; pagination: StoragePagination }> {
    throw new Error('Not implemented');
  }

  // DATASET ROWS
  addDatasetRows(rows: DatasetRow[]): Promise<{ rows: DatasetRow[] }> {
    throw new Error('Not implemented');
  }

  getDatasetRowByRowId({ rowId, versionId }: { rowId: string; versionId?: string }): Promise<DatasetRow> {
    throw new Error('Not implemented');
  }

  getDatasetRows({
    pagination,
    versionId,
  }: {
    pagination: StoragePagination;
    versionId?: string;
  }): Promise<{ rows: DatasetRow[]; pagination: PaginationInfo }> {
    throw new Error('Not implemented');
  }

  getDatasetRowVersionsById({
    id,
    pagination,
  }: {
    id: string;
    pagination: StoragePagination;
  }): Promise<{ rows: DatasetRow[]; pagination: PaginationInfo }> {
    throw new Error('Not implemented');
  }

  updateDatasetRows({ updates }: { updates: UpdateDatasetRow[] }): Promise<void> {
    throw new Error('Not implemented');
  }

  deleteDatasetRows({ rowIds }: { rowIds: DeleteDatasetRow[] }): Promise<void> {
    throw new Error('Not implemented');
  }

  // rows({ versionId }: { versionId?: string }): Promise<AsyncIterableIterator<DatasetRow>> {
  //   throw new Error('Not implemented');
  // }

  // DATASET VERSIONS
  getCurrentDatasetVersion({ datasetId }: { datasetId: string }): Promise<DatasetVersion> {
    throw new Error('Not implemented');
  }

  getDatasetVersions({
    datasetId,
    pagination,
  }: {
    datasetId: string;
    pagination: StoragePagination;
  }): Promise<{ versions: DatasetVersion[]; pagination: PaginationInfo }> {
    throw new Error('Not implemented');
  }
}
