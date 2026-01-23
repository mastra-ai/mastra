import type {
  CreateDatasetItemPayload,
  CreateDatasetPayload,
  CreateDatasetRunPayload,
  CreateDatasetRunResultPayload,
  Dataset,
  DatasetItem,
  DatasetRun,
  DatasetRunResult,
  ListDatasetItemsOptions,
  ListDatasetItemsResponse,
  ListDatasetRunResultsOptions,
  ListDatasetRunResultsResponse,
  ListDatasetRunsOptions,
  ListDatasetRunsResponse,
  ListDatasetsResponse,
  UpdateDatasetItemPayload,
  UpdateDatasetPayload,
  UpdateDatasetRunPayload,
} from '../../../datasets/types';
import type { StoragePagination } from '../../types';
import { StorageDomain } from '../base';

export abstract class DatasetsStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'DATASETS',
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    // Default no-op - subclasses override
  }

  // Dataset methods
  abstract createDataset(payload: CreateDatasetPayload): Promise<Dataset>;
  abstract getDatasetById(args: { id: string }): Promise<Dataset | null>;
  abstract getDatasetByName(args: { name: string }): Promise<Dataset | null>;
  abstract updateDataset(args: { id: string; payload: UpdateDatasetPayload }): Promise<Dataset>;
  abstract deleteDataset(args: { id: string }): Promise<void>;
  abstract listDatasets(pagination: StoragePagination): Promise<ListDatasetsResponse>;

  // Dataset Item methods
  abstract createDatasetItem(payload: CreateDatasetItemPayload): Promise<DatasetItem>;
  abstract createDatasetItems(payloads: CreateDatasetItemPayload[]): Promise<DatasetItem[]>;
  abstract getDatasetItemById(args: { id: string }): Promise<DatasetItem | null>;
  abstract updateDatasetItem(args: { id: string; payload: UpdateDatasetItemPayload }): Promise<DatasetItem>;
  abstract archiveDatasetItem(args: { id: string }): Promise<void>;
  abstract listDatasetItems(args: {
    options: ListDatasetItemsOptions;
    pagination: StoragePagination;
  }): Promise<ListDatasetItemsResponse>;

  // Dataset Run methods
  abstract createDatasetRun(payload: CreateDatasetRunPayload): Promise<DatasetRun>;
  abstract getDatasetRunById(args: { id: string }): Promise<DatasetRun | null>;
  abstract updateDatasetRun(args: { id: string; payload: UpdateDatasetRunPayload }): Promise<DatasetRun>;
  abstract listDatasetRuns(args: {
    options: ListDatasetRunsOptions;
    pagination: StoragePagination;
  }): Promise<ListDatasetRunsResponse>;

  // Dataset Run Result methods
  abstract createDatasetRunResult(payload: CreateDatasetRunResultPayload): Promise<DatasetRunResult>;
  abstract createDatasetRunResults(payloads: CreateDatasetRunResultPayload[]): Promise<DatasetRunResult[]>;
  abstract listDatasetRunResults(args: {
    options: ListDatasetRunResultsOptions;
    pagination: StoragePagination;
  }): Promise<ListDatasetRunResultsResponse>;
}
