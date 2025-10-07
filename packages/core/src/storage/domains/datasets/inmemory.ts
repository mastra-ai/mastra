import type { StoreOperations } from '..';
import type {
  DatasetRecord,
  DatasetRow,
  DatasetVersion,
  DeleteDatasetRow,
  UpdateDatasetRow,
} from '../../../datasets/types';
import type { PaginationInfo, StoragePagination } from '../../types';
import { DatasetsStorage } from './base';
import type { CreateDatasetPayload, UpdateDatasetPayload } from './base';

export class MemoryDatasetsStorage extends DatasetsStorage {
  datasets: Map<string, Omit<DatasetRecord, 'currentVersion'>>;
  datasetVersions: Map<string, DatasetVersion>;
  datasetRows: Map<string, DatasetRow>;
  operations: StoreOperations;

  constructor({
    collections,
    operations,
  }: {
    collections: { datasets: Map<string, Omit<DatasetRecord, 'currentVersion'>>; datasetVersions: Map<string, DatasetVersion>; datasetRows: Map<string, DatasetRow> };
    operations: StoreOperations;
  }) {
    super();
    this.datasets = collections.datasets;
    this.datasetVersions = collections.datasetVersions;
    this.datasetRows = collections.datasetRows;
    this.operations = operations;
  }

  // DATASETS
  createDataset(datasetPayload: CreateDatasetPayload): Promise<DatasetRecord> {
    const validatedDataset = this.validateCreateDataset(datasetPayload);
    const id = crypto.randomUUID();
    const createdAt = new Date();
    const dataset = { ...validatedDataset, id, createdAt };
    this.datasets.set(id, dataset);

    const versionULID = this.generateVersionULID();
    const datasetVersion: DatasetVersion = {
      id: versionULID,
      datasetId: id,
      version: versionULID,
      createdAt: new Date(),
    };

    this.datasetVersions.set(versionULID, datasetVersion);
    return Promise.resolve({ ...dataset, currentVersion: datasetVersion });
  }

  updateDataset({ id, updates }: { id: string; updates: UpdateDatasetPayload }): Promise<DatasetRecord> {
    const oldDataset = this.datasets.get(id);
    if (!oldDataset) {
      throw new Error('Dataset not found');
    }

    const validatedDataset = this.validateUpdateDataset(updates);
    const updatedAt = new Date();

    const versionULID = this.generateVersionULID();
    const datasetVersion: DatasetVersion = {
      id: versionULID,
      datasetId: id,
      version: versionULID,
      createdAt: new Date(),
    };
    this.datasetVersions.set(versionULID, datasetVersion);

    const updatedDataset = { ...oldDataset, ...validatedDataset, updatedAt };
    this.datasets.set(id, updatedDataset);
    return Promise.resolve({ ...updatedDataset, currentVersion: datasetVersion });
  }

  deleteDataset({ id }: { id: string }): Promise<void> {
    const oldDataset = this.datasets.get(id);
    if (!oldDataset) {
      throw new Error('Dataset not found');
    }

    for (const version of this.datasetVersions.values()) {
      if (version.datasetId === id) {
        this.datasetVersions.delete(version.id);
      }
    }

    this.datasets.delete(id);
    return Promise.resolve();
  }

  getDataset({ id }: { id: string }): Promise<DatasetRecord> {
    const dataset = this.datasets.get(id);
    if (!dataset) {
      throw new Error('Dataset not found');
    }

    const datasetVersions = Array.from(this.datasetVersions.values())
      .filter(version => version.datasetId === id)
      .sort((a, b) => (b.id >= a.id ? 1 : -1));
    const currentVersion = datasetVersions[0];

    if (!currentVersion) {
      throw new Error('Current version not found');
    }

    return Promise.resolve({ ...dataset, currentVersion });
  }

  getDatasets({
    pagination,
  }: {
    pagination: StoragePagination;
  }): Promise<{ datasets: DatasetRecord[]; pagination: PaginationInfo }> {
    const limit = pagination.perPage ?? 10;
    const offset = pagination.page ?? 0;

    const allDatasets = Array.from(this.datasets.values());
    const datasetWithVersions = allDatasets.slice(offset, offset + limit).map(dataset => {
      const datasetVersions = Array.from(this.datasetVersions.values())
        .filter(version => version.datasetId === dataset.id)
        .sort((a, b) => (b.id >= a.id ? 1 : -1));
      const currentVersion = datasetVersions[0];
      if (!currentVersion) {
        throw new Error('Current version not found');
      }

      return { ...dataset, currentVersion };
    });

    const total = allDatasets.length;
    const hasMore = allDatasets.length > offset + limit;

    return Promise.resolve({
      datasets: datasetWithVersions,
      pagination: { total, page: pagination.page, perPage: pagination.perPage, hasMore },
    });
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
    pagination: PaginationInfo;
    versionId?: string;
  }): Promise<{ rows: DatasetRow[]; pagination: PaginationInfo }> {
    throw new Error('Not implemented');
  }

  getDatasetRowVersionsById({
    id,
    pagination,
  }: {
    id: string;
    pagination: PaginationInfo;
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
    pagination: PaginationInfo;
  }): Promise<{ versions: DatasetVersion[]; pagination: PaginationInfo }> {
    throw new Error('Not implemented');
  }
}
