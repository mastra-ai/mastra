import type { StoreOperations } from '..';
import type { DatasetRecord, DatasetRow, DatasetVersion } from './base';
import type { PaginationInfo, StoragePagination } from '../../types';
import { DatasetsStorage } from './base';
import type {
  AddDatasetRowsPayload,
  CreateDatasetPayload,
  DeleteDatasetRowsPayload,
  UpdateDatasetPayload,
  UpdateDatasetRowsPayload,
} from './base';
import { RequestContext } from '../../../request-context';
import { normalizePerPage, calculatePagination } from '../../base';

export class DatasetsInMemory extends DatasetsStorage {
  datasets: Map<string, Omit<DatasetRecord, 'currentVersion'>>;
  datasetVersions: Map<string, DatasetVersion>;
  datasetRows: Map<string, DatasetRow>;
  operations: StoreOperations;

  constructor({
    collections,
    operations,
  }: {
    collections: {
      datasets: Map<string, Omit<DatasetRecord, 'currentVersion'>>;
      datasetVersions: Map<string, DatasetVersion>;
      datasetRows: Map<string, DatasetRow>;
    };
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

    const datasetRows = Array.from(this.datasetRows.values()).filter(row => row.datasetId === id);

    for (const row of datasetRows) {
      this.datasetRows.delete(this.generateDatasetRowKey(row.rowId, row.versionId));
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
      .sort((a, b) => b.id.localeCompare(a.id));
    const currentVersion = datasetVersions[0];

    if (!currentVersion) {
      throw new Error('Current version not found');
    }

    return Promise.resolve({ ...dataset, currentVersion });
  }

  listDatasets(args: {
    filter?: {
      name?: string;
    };
    pagination?: StoragePagination;
  }): Promise<{ datasets: DatasetRecord[]; pagination: PaginationInfo }> {
    const { filter, pagination } = args ?? {};
    const page = Math.max(0, pagination?.page ?? 0);
    const normalizedPerPage = normalizePerPage(pagination?.perPage, 10);
    const { offset, perPage } = calculatePagination(page, pagination?.perPage, normalizedPerPage);

    let allDatasets = Array.from(this.datasets.values());
    if (filter?.name) {
      console.log('filtering by name', filter.name);
      allDatasets = allDatasets.filter(dataset => dataset.name === filter.name);
    }

    const start = offset;
    const end = perPage === false ? allDatasets.length : offset + normalizedPerPage;

    const datasetWithVersions = allDatasets.slice(start, end).map(dataset => {
      const datasetVersions = Array.from(this.datasetVersions.values())
        .filter(version => version.datasetId === dataset.id)
        .sort((a, b) => b.id.localeCompare(a.id));
      const currentVersion = datasetVersions[0];
      if (!currentVersion) {
        throw new Error('Current version not found');
      }

      return { ...dataset, currentVersion };
    });

    const total = allDatasets.length;
    const hasMore = end < total;

    return Promise.resolve({
      datasets: datasetWithVersions,
      pagination: { total, page, perPage, hasMore },
    });
  }

  // DATASET VERSIONS
  listDatasetVersions({
    datasetId,
    pagination,
  }: {
    datasetId: string;
    pagination?: StoragePagination;
  }): Promise<{ versions: DatasetVersion[]; pagination: PaginationInfo }> {
    const datasetVersionsAll = Array.from(this.datasetVersions.values())
      .filter(version => version.datasetId === datasetId)
      .sort((a, b) => b.id.localeCompare(a.id));

    const page = Math.max(0, pagination?.page ?? 0);
    const normalizedPerPage = normalizePerPage(pagination?.perPage, 10);
    const { offset, perPage } = calculatePagination(page, pagination?.perPage, normalizedPerPage);

    const start = offset;
    const end = perPage === false ? datasetVersionsAll.length : offset + normalizedPerPage;

    const versions = datasetVersionsAll.slice(start, end);
    const total = datasetVersionsAll.length;
    const hasMore = end < total;

    return Promise.resolve({
      versions,
      pagination: { total, page, perPage, hasMore },
    });
  }

  // DATASET ROWS
  addDatasetRows(args: AddDatasetRowsPayload): Promise<{ rows: DatasetRow[]; versionId: string }> {
    const { rows: validatedRows, datasetId } = this.validateAddDatasetRows(args);
    const versionULID = this.generateVersionULID();
    const datasetVersion: DatasetVersion = {
      id: versionULID,
      datasetId,
      createdAt: new Date(),
    };
    this.datasetVersions.set(versionULID, datasetVersion);

    const datasetRows: DatasetRow[] = validatedRows.map(row => ({
      rowId: this.generateDatasetRowId(),
      versionId: versionULID,
      datasetId,
      input: row.input,
      groundTruth: row.groundTruth,
      requestContext: row.requestContext ? new RequestContext(Object.entries(row.requestContext)) : undefined,
      traceId: row.traceId,
      spanId: row.spanId,
      deleted: false,
      createdAt: new Date(),
    }));

    for (const row of datasetRows) {
      this.datasetRows.set(this.generateDatasetRowKey(row.rowId, row.versionId), row);
    }

    return Promise.resolve({ rows: datasetRows, versionId: versionULID });
  }

  private generateDatasetRowKey(rowId: string, versionId: string): string {
    return `${rowId}-${versionId}`;
  }

  getDatasetRowByRowId({ rowId, versionId }: { rowId: string; versionId?: string }): Promise<DatasetRow> {
    const rows = Array.from(this.datasetRows.values())
      .filter(row => row.rowId === rowId)
      .sort((a, b) => b.versionId.localeCompare(a.versionId));
    let row = rows[0];
    if (versionId) {
      row = rows.find(row => row.versionId === versionId);
    }

    if (!row || row.deleted) {
      throw new Error('Row not found for version ' + versionId);
    }

    return Promise.resolve(row);
  }

  listDatasetRowVersionsByRowId({
    rowId,
    pagination,
  }: {
    rowId: string;
    pagination?: StoragePagination;
  }): Promise<{ rows: DatasetRow[]; pagination: PaginationInfo }> {
    const page = Math.max(0, pagination?.page ?? 0);
    const normalizedPerPage = normalizePerPage(pagination?.perPage, 10);
    const { offset, perPage } = calculatePagination(page, pagination?.perPage, normalizedPerPage);

    const totalRowsAll = Array.from(this.datasetRows.values())
      .filter(row => row.rowId === rowId)
      .sort((a, b) => b.versionId.localeCompare(a.versionId));
    const total = totalRowsAll.length;

    const start = offset;
    const end = perPage === false ? totalRowsAll.length : offset + normalizedPerPage;

    const rows = totalRowsAll.slice(start, end);
    const hasMore = end < total;

    return Promise.resolve({
      rows,
      pagination: { total, page, perPage, hasMore },
    });
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
    const page = Math.max(0, pagination?.page ?? 0);
    const normalizedPerPage = normalizePerPage(pagination?.perPage, 10);
    const { offset, perPage } = calculatePagination(page, pagination?.perPage, normalizedPerPage);

    // Get all rows for this dataset, sorted by versionId descending
    const allRows = Array.from(this.datasetRows.values())
      .filter(row => row.datasetId === datasetId)
      .sort((a, b) => b.versionId.localeCompare(a.versionId));

    // For each unique rowId, get the latest version that's <= the specified versionId
    const set = new Set<string>();
    const uniqueRows = [];
    for (const row of allRows) {
      if (set.has(row.rowId)) {
        continue;
      }

      // Include this row if:
      // 1. No versionId specified (get latest), OR
      // 2. This row's version <= specified version (snapshot at that point in time)
      if (!versionId || row.versionId.localeCompare(versionId) <= 0) {
        // Skip deleted rows
        if (!row.deleted) {
          set.add(row.rowId);
          uniqueRows.push(row);
        } else {
          // Mark as seen so we don't include older versions
          set.add(row.rowId);
        }
      }
    }

    const total = uniqueRows.length;
    const start = offset;
    const end = perPage === false ? uniqueRows.length : offset + normalizedPerPage;
    const hasMore = end < total;

    return Promise.resolve({
      rows: uniqueRows.slice(start, end),
      pagination: { total, page, perPage, hasMore },
    });
  }

  updateDatasetRows(args: UpdateDatasetRowsPayload): Promise<{ rows: DatasetRow[]; versionId: string }> {
    const { updates: validatedUpdates, datasetId } = this.validateUpdateDatasetRows(args);
    const versionULID = this.generateVersionULID();
    const datasetVersion: DatasetVersion = {
      id: versionULID,
      datasetId,
      createdAt: new Date(),
    };
    this.datasetVersions.set(versionULID, datasetVersion);

    const rows: DatasetRow[] = [];
    for (const update of validatedUpdates) {
      const row = this.getLatestDatasetRowByRowId(update.rowId);
      const updatedRow = {
        ...row,
        ...update,
        versionId: versionULID,
        requestContext: update.requestContext
          ? new RequestContext(Object.entries(update.requestContext))
          : row.requestContext,
        updatedAt: new Date(),
      };
      this.datasetRows.set(this.generateDatasetRowKey(updatedRow.rowId, updatedRow.versionId), updatedRow);
      rows.push(updatedRow);
    }

    return Promise.resolve({ rows, versionId: versionULID });
  }

  private getLatestDatasetRowByRowId(rowId: string): DatasetRow {
    const rows = Array.from(this.datasetRows.values())
      .filter(row => row.rowId === rowId)
      .sort((a, b) => b.versionId.localeCompare(a.versionId));

    if (!rows[0]) {
      throw new Error('Row not found');
    }

    return rows[0];
  }

  deleteDatasetRows(args: DeleteDatasetRowsPayload): Promise<{ versionId: string }> {
    const { rowIds: validatedRowIds, datasetId } = this.validateDeleteDatasetRows(args);
    const versionULID = this.generateVersionULID();
    const datasetVersion: DatasetVersion = {
      id: versionULID,
      datasetId,
      createdAt: new Date(),
    };
    this.datasetVersions.set(versionULID, datasetVersion);

    for (const rowId of validatedRowIds) {
      const row = this.getLatestDatasetRowByRowId(rowId);
      this.datasetRows.set(this.generateDatasetRowKey(rowId, versionULID), {
        rowId,
        datasetId,
        input: '',
        createdAt: row.createdAt,
        versionId: versionULID,
        deleted: true,
        updatedAt: new Date(),
      });
    }

    return Promise.resolve({ versionId: versionULID });
  }
}
