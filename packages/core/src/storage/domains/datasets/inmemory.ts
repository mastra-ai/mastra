import type { StoreOperations } from '..';
import type { DatasetRecord, DatasetRow, DatasetVersion, ExperimentRecord, ExperimentRowResult } from './base';
import type { PaginationInfo, StoragePagination } from '../../types';
import { DatasetsStorage } from './base';
import type {
  AddDatasetRowsPayload,
  AddExperimentRowResultsPayload,
  AddCommentToRowResultPayload,
  CreateDatasetPayload,
  CreateExperimentPayload,
  DeleteDatasetRowsPayload,
  DeleteExperimentRowResultsPayload,
  UpdateDatasetPayload,
  UpdateDatasetRowsPayload,
  UpdateExperimentPayload,
  UpdateExperimentRowResultsPayload,
} from './base';
import { RuntimeContext } from '../../../runtime-context';

export class MemoryDatasetsStorage extends DatasetsStorage {
  datasets: Map<string, Omit<DatasetRecord, 'currentVersion'>>;
  datasetVersions: Map<string, DatasetVersion>;
  datasetRows: Map<string, DatasetRow>;
  experiments: Map<string, ExperimentRecord>;
  experimentRowResults: Map<string, ExperimentRowResult>;
  operations: StoreOperations;

  constructor({
    collections,
    operations,
  }: {
    collections: {
      datasets: Map<string, Omit<DatasetRecord, 'currentVersion'>>;
      datasetVersions: Map<string, DatasetVersion>;
      datasetRows: Map<string, DatasetRow>;
      experiments: Map<string, ExperimentRecord>;
      experimentRowResults: Map<string, ExperimentRowResult>;
    };
    operations: StoreOperations;
  }) {
    super();
    this.datasets = collections.datasets;
    this.datasetVersions = collections.datasetVersions;
    this.datasetRows = collections.datasetRows;
    this.experiments = collections.experiments;
    this.experimentRowResults = collections.experimentRowResults;
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

  getDatasets(args: {
    filter?: {
      name?: string;
    };
    pagination?: StoragePagination;
  }): Promise<{ datasets: DatasetRecord[]; pagination: PaginationInfo }> {
    const { filter, pagination } = args ?? {};
    const page = Math.max(0, pagination?.page ?? 0);
    const perPage = Math.max(1, pagination?.perPage ?? 10);
    const start = page * perPage;
    const end = start + perPage;

    let allDatasets = Array.from(this.datasets.values());
    if (filter?.name) {
      console.log('filtering by name', filter.name);
      allDatasets = allDatasets.filter(dataset => dataset.name === filter.name);
    }
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
  getDatasetVersions({
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
    const perPage = Math.max(1, pagination?.perPage ?? 10);
    const start = page * perPage;
    const end = start + perPage;
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
      runtimeContext: new RuntimeContext(Object.entries(row.runtimeContext ?? {})),
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

  getDatasetRowVersionsByRowId({
    rowId,
    pagination,
  }: {
    rowId: string;
    pagination?: StoragePagination;
  }): Promise<{ rows: DatasetRow[]; pagination: PaginationInfo }> {
    const page = Math.max(0, pagination?.page ?? 0);
    const perPage = Math.max(1, pagination?.perPage ?? 10);
    const start = page * perPage;
    const end = start + perPage;

    const totalRowsAll = Array.from(this.datasetRows.values())
      .filter(row => row.rowId === rowId)
      .sort((a, b) => b.versionId.localeCompare(a.versionId));
    const total = totalRowsAll.length;

    const rows = totalRowsAll.slice(start, end);
    const hasMore = end < total;

    return Promise.resolve({
      rows,
      pagination: { total, page, perPage, hasMore },
    });
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
    const page = Math.max(0, pagination?.page ?? 0);
    const perPage = Math.max(1, pagination?.perPage ?? 10);
    const start = page * perPage;
    const end = start + perPage;

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
        runtimeContext: new RuntimeContext(Object.entries(update.runtimeContext ?? {})),
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

  // EXPERIMENTS
  createExperiment(experimentPayload: CreateExperimentPayload): Promise<ExperimentRecord> {
    const validatedExperiment = this.validateCreateExperiment(experimentPayload);
    const id = crypto.randomUUID();
    const createdAt = new Date();
    const experiment: ExperimentRecord = {
      ...validatedExperiment,
      id,
      status: 'pending',
      createdAt,
    };
    this.experiments.set(id, experiment);
    return Promise.resolve(experiment);
  }

  updateExperiment({ id, updates }: { id: string; updates: UpdateExperimentPayload }): Promise<ExperimentRecord> {
    const oldExperiment = this.experiments.get(id);
    if (!oldExperiment) {
      throw new Error('Experiment not found');
    }

    const validatedUpdates = this.validateUpdateExperiment(updates);
    const updatedAt = new Date();
    const updatedExperiment = { ...oldExperiment, ...validatedUpdates, updatedAt };
    this.experiments.set(id, updatedExperiment);
    return Promise.resolve(updatedExperiment);
  }

  getExperiment({ id }: { id: string }): Promise<ExperimentRecord> {
    const experiment = this.experiments.get(id);
    if (!experiment) {
      throw new Error('Experiment not found');
    }
    return Promise.resolve(experiment);
  }

  getExperiments(args?: {
    filter?: {
      datasetId?: string;
    };
    pagination?: StoragePagination;
  }): Promise<{ experiments: ExperimentRecord[]; pagination: PaginationInfo }> {
    const { filter, pagination } = args ?? {};
    const page = Math.max(0, pagination?.page ?? 0);
    const perPage = Math.max(1, pagination?.perPage ?? 10);
    const start = page * perPage;
    const end = start + perPage;

    let allExperiments = Array.from(this.experiments.values());
    if (filter?.datasetId) {
      allExperiments = allExperiments.filter(exp => exp.datasetId === filter.datasetId);
    }

    // Sort by createdAt descending (newest first)
    allExperiments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = allExperiments.length;
    const hasMore = end < total;
    const experiments = allExperiments.slice(start, end);

    return Promise.resolve({
      experiments,
      pagination: { total, page, perPage, hasMore },
    });
  }

  deleteExperiment({ id }: { id: string }): Promise<void> {
    const experiment = this.experiments.get(id);
    if (!experiment) {
      throw new Error('Experiment not found');
    }

    // Delete all experiment row results associated with this experiment
    const resultsToDelete = Array.from(this.experimentRowResults.values()).filter(result => result.experimentId === id);

    for (const result of resultsToDelete) {
      this.experimentRowResults.delete(result.id);
    }

    this.experiments.delete(id);
    return Promise.resolve();
  }

  // EXPERIMENT ROW RESULTS
  addExperimentRowResults(args: AddExperimentRowResultsPayload): Promise<void> {
    const validatedRowResults = this.validateAddExperimentRowResults(args);
    const experimentRowResults: ExperimentRowResult[] = validatedRowResults.map(result => {
      return {
        id: crypto.randomUUID(),
        experimentId: result.experimentId,
        datasetRowId: result.datasetRowId,
        input: result.input,
        output: result.output,
        groundTruth: result.groundTruth,
        runtimeContext: result.runtimeContext ? new RuntimeContext(Object.entries(result.runtimeContext)) : undefined,
        status: result.status,
        error: result.error,
        traceId: result.traceId,
        spanId: result.spanId,
        createdAt: new Date(),
      };
    });

    for (const result of experimentRowResults) {
      this.experimentRowResults.set(result.id, result);
    }

    return Promise.resolve();
  }

  getExperimentRowResults({
    experimentId,
    pagination,
  }: {
    experimentId: string;
    pagination?: StoragePagination;
  }): Promise<{ results: ExperimentRowResult[]; pagination: PaginationInfo }> {
    const page = Math.max(0, pagination?.page ?? 0);
    const perPage = Math.max(1, pagination?.perPage ?? 10);
    const start = page * perPage;
    const end = start + perPage;

    const allResults = Array.from(this.experimentRowResults.values())
      .filter(result => result.experimentId === experimentId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = allResults.length;
    const hasMore = end < total;
    const results = allResults.slice(start, end);

    return Promise.resolve({
      results,
      pagination: { total, page, perPage, hasMore },
    });
  }

  getExperimentRowResult({ id }: { id: string }): Promise<ExperimentRowResult> {
    const result = this.experimentRowResults.get(id);
    if (!result) {
      throw new Error('Experiment row result not found');
    }
    return Promise.resolve(result);
  }

  updateExperimentRowResults(args: UpdateExperimentRowResultsPayload): Promise<void> {
    const validatedUpdates = this.validateUpdateExperimentRowResults(args);

    for (const update of validatedUpdates) {
      const { id, ...updates } = update;
      const oldResult = this.experimentRowResults.get(id);
      if (!oldResult) {
        throw new Error(`Experiment row result not found: ${id}`);
      }

      const updatedAt = new Date();
      const updatedResult = { ...oldResult, ...updates, updatedAt };
      this.experimentRowResults.set(id, updatedResult);
    }

    return Promise.resolve();
  }

  addCommentToRowResult(args: AddCommentToRowResultPayload): Promise<ExperimentRowResult> {
    const result = this.experimentRowResults.get(args.experimentRowResultId);
    if (!result) {
      throw new Error('Experiment row result not found');
    }

    const newComment = {
      comment: args.comment,
      createdAt: new Date(),
    };

    const updatedResult = {
      ...result,
      comments: [...(result.comments || []), newComment],
      updatedAt: new Date(),
    };

    this.experimentRowResults.set(args.experimentRowResultId, updatedResult);
    return Promise.resolve(updatedResult);
  }

  deleteExperimentRowResults(args: DeleteExperimentRowResultsPayload): Promise<void> {
    const { ids } = this.validateDeleteExperimentRowResults(args);

    for (const id of ids) {
      const result = this.experimentRowResults.get(id);
      if (!result) {
        throw new Error(`Experiment row result not found: ${id}`);
      }
      this.experimentRowResults.delete(id);
    }

    return Promise.resolve();
  }
}
