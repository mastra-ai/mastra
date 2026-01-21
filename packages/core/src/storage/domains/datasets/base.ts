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
  abstract getDatasetById(id: string): Promise<Dataset | null>;
  abstract getDatasetByName(name: string): Promise<Dataset | null>;
  abstract updateDataset(id: string, payload: UpdateDatasetPayload): Promise<Dataset>;
  abstract deleteDataset(id: string): Promise<void>;
  abstract listDatasets(pagination: StoragePagination): Promise<ListDatasetsResponse>;

  // Dataset Item methods
  abstract createDatasetItem(payload: CreateDatasetItemPayload): Promise<DatasetItem>;
  abstract createDatasetItems(payloads: CreateDatasetItemPayload[]): Promise<DatasetItem[]>;
  abstract getDatasetItemById(id: string): Promise<DatasetItem | null>;
  abstract updateDatasetItem(id: string, payload: UpdateDatasetItemPayload): Promise<DatasetItem>;
  abstract archiveDatasetItem(id: string): Promise<void>;
  abstract listDatasetItems(
    options: ListDatasetItemsOptions,
    pagination: StoragePagination,
  ): Promise<ListDatasetItemsResponse>;

  // Dataset Run methods
  abstract createDatasetRun(payload: CreateDatasetRunPayload): Promise<DatasetRun>;
  abstract getDatasetRunById(id: string): Promise<DatasetRun | null>;
  abstract updateDatasetRun(id: string, payload: UpdateDatasetRunPayload): Promise<DatasetRun>;
  abstract listDatasetRuns(
    options: ListDatasetRunsOptions,
    pagination: StoragePagination,
  ): Promise<ListDatasetRunsResponse>;

  // Dataset Run Result methods
  abstract createDatasetRunResult(payload: CreateDatasetRunResultPayload): Promise<DatasetRunResult>;
  abstract createDatasetRunResults(payloads: CreateDatasetRunResultPayload[]): Promise<DatasetRunResult[]>;
  abstract listDatasetRunResults(
    options: ListDatasetRunResultsOptions,
    pagination: StoragePagination,
  ): Promise<ListDatasetRunResultsResponse>;
}
