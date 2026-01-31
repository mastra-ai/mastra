import { StorageDomain } from '../base';
import type {
  Dataset,
  DatasetItem,
  CreateDatasetInput,
  UpdateDatasetInput,
  AddDatasetItemInput,
  UpdateDatasetItemInput,
  ListDatasetsInput,
  ListDatasetsOutput,
  ListDatasetItemsInput,
  ListDatasetItemsOutput,
} from '../../types';

/**
 * Abstract base class for datasets storage domain.
 * Provides the contract for dataset and dataset item CRUD operations.
 */
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

  // Dataset CRUD
  abstract createDataset(input: CreateDatasetInput): Promise<Dataset>;
  abstract getDatasetById(args: { id: string }): Promise<Dataset | null>;
  abstract updateDataset(args: UpdateDatasetInput): Promise<Dataset>;
  abstract deleteDataset(args: { id: string }): Promise<void>;
  abstract listDatasets(args: ListDatasetsInput): Promise<ListDatasetsOutput>;

  // Item CRUD - these auto-increment dataset version
  abstract addItem(args: AddDatasetItemInput): Promise<DatasetItem>;
  abstract updateItem(args: UpdateDatasetItemInput): Promise<DatasetItem>;
  abstract deleteItem(args: { id: string; datasetId: string }): Promise<void>;
  abstract listItems(args: ListDatasetItemsInput): Promise<ListDatasetItemsOutput>;
  abstract getItemById(args: { id: string }): Promise<DatasetItem | null>;

  // Version-aware queries (snapshot semantics: items at or before version timestamp)
  abstract getItemsByVersion(args: { datasetId: string; version: Date }): Promise<DatasetItem[]>;
}
