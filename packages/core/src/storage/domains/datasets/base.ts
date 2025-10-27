import z from 'zod';
import { MastraBase } from '../../../base';
import type { PaginationInfo, StoragePagination } from '../../types';
import { monotonicFactory } from 'ulid';
import type { RuntimeContext } from '../../../runtime-context';

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
  runtimeContext?: RuntimeContext;
  deleted: boolean;
  traceId?: string;
  spanId?: string;
  createdAt: Date;
  updatedAt?: Date;
};

export type ExperimentRecord = {
  id: string;
  datasetId: string;
  datasetVersionId: string;
  targetType: 'agent' | 'workflow';
  targetId: string;
  targetConfig?: Record<string, any>;
  concurrency?: number;
  scorers?: ScorerRegistry;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  totalItems?: number;
  averageScores?: Record<string, number>;
  createdAt: Date;
  startedAt?: Date;
  updatedAt?: Date;
  completedAt?: Date;
  // successfulItems?: number;
  // failedItems?: number;
  // metadata?: Record<string, any>;
};

export type ScorerRegistry = {
  [scorerId: string]: {
    type: 'automatic' | 'manual';
    // addedAt: string;
    // config?: any; // Serialized scorer config (for automatic only)
    // resultCount: number;
    // coverage: number; // Percentage 0-100
    // scoredBy?: string[]; // For manual scores
    // lastUpdatedAt: string;
    // isInitial?: boolean; // Was this scorer part of the initial experiment?
  };
};

export type ExperimentRowResult = {
  id: string;
  experimentId: string;
  datasetRowId: string;
  input: any;
  output?: any;
  groundTruth?: any;
  runtimeContext?: RuntimeContext;
  status: 'success' | 'error';
  error?: any;
  traceId?: string;
  spanId?: string;
  comments?: ExperimentComment[];
  createdAt: Date;
  updatedAt?: Date;
  // duration?: number; // milliseconds
  // tokensUsed?: number;
  // cost?: number;
};

export type ExperimentComment = {
  // id: string;
  comment: string;
  createdAt: Date;
  // commentedBy?: string;
  // updatedAt?: Date;
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
      runtimeContext: z.record(z.string(), z.any()).optional(),
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
      runtimeContext: z.record(z.string(), z.any()).optional(),
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

const createExperimentValidation = z.object({
  datasetId: z.string(),
  datasetVersionId: z.string(),
  targetType: z.enum(['agent', 'workflow']),
  targetId: z.string(),
  concurrency: z.number().optional(),
  scorers: z.record(z.string(), z.any()).optional(),
  // targetConfig: z.record(z.string(), z.any()).optional(),
  // metadata: z.record(z.string(), z.any()).optional(),
});
export type CreateExperimentPayload = z.infer<typeof createExperimentValidation>;

const updateExperimentValidation = z.object({
  status: z.enum(['running', 'completed', 'failed', 'cancelled']).optional(),
  scorers: z.record(z.string(), z.any()).optional(),
  totalItems: z.number().optional(),
  averageScores: z.record(z.string(), z.number()).optional(),
  completedAt: z.date().optional(),
  // successfulItems: z.number().optional(),
  // failedItems: z.number().optional(),
  // metadata: z.record(z.string(), z.any()).optional(),
});
export type UpdateExperimentPayload = z.infer<typeof updateExperimentValidation>;

const addExperimentRowResultsValidation = z.array(
  z.object({
    experimentId: z.string(),
    datasetRowId: z.string(),
    input: z.any(),
    output: z.any().optional(),
    groundTruth: z.any().optional(),
    runtimeContext: z.record(z.string(), z.any()).optional(),
    status: z.enum(['success', 'error']),
    error: z.record(z.string(), z.any()).optional(),
    traceId: z.string().optional(),
    spanId: z.string().optional(),
    // duration: z.number().optional(),
    // tokensUsed: z.number().optional(),
    // cost: z.number().optional(),
  }),
);
export type AddExperimentRowResultsPayload = z.infer<typeof addExperimentRowResultsValidation>;

const updateExperimentRowResultsValidation = z.array(
  z.object({
    id: z.string(),

    output: z.any().optional(),
    status: z.enum(['success', 'error']).optional(),
    error: z.record(z.string(), z.any()).optional(),
    traceId: z.string().optional(),
    spanId: z.string().optional(),
    // duration: z.number().optional(),
    // tokensUsed: z.number().optional(),
    // cost: z.number().optional(),
  }),
);
export type UpdateExperimentRowResultsPayload = z.infer<typeof updateExperimentRowResultsValidation>;

const addCommentToRowResultValidation = z.object({
  experimentRowResultId: z.string(),
  comment: z.string(),
  // commentedBy: z.string().optional(),
});
export type AddCommentToRowResultPayload = z.infer<typeof addCommentToRowResultValidation>;

const deleteExperimentRowResultsValidation = z.object({
  ids: z.array(z.string()),
});
export type DeleteExperimentRowResultsPayload = z.infer<typeof deleteExperimentRowResultsValidation>;

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

  getDatasets(args?: {
    filter?: {
      name?: string;
    };
    pagination?: StoragePagination;
  }): Promise<{ datasets: DatasetRecord[]; pagination: PaginationInfo }> {
    throw new Error('Not implemented');
  }

  getDatasetVersions({
    datasetId,
    pagination,
  }: {
    datasetId: string;
    pagination?: StoragePagination;
  }): Promise<{ versions: DatasetVersion[]; pagination: PaginationInfo }> {
    throw new Error('Not implemented');
  }

  getDatasetVersionByTag({ datasetId, tag }: { datasetId: string; tag: string }): Promise<DatasetVersion> {
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

  getDatasetRowVersionsByRowId({
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

  // rows({ versionId }: { versionId?: string }): Promise<AsyncIterableIterator<DatasetRow>> {
  //   throw new Error('Not implemented');
  // }

  // Experiments
  /**
   * Create a new experiment
   */
  createExperiment(_experiment: CreateExperimentPayload): Promise<ExperimentRecord> {
    throw new Error('Not implemented');
  }

  protected validateCreateExperiment(experiment: CreateExperimentPayload): CreateExperimentPayload {
    return createExperimentValidation.parse(experiment);
  }

  /**
   * Update an experiment (metadata, status, stats)
   */
  updateExperiment({ id, updates }: { id: string; updates: UpdateExperimentPayload }): Promise<ExperimentRecord> {
    throw new Error('Not implemented');
  }

  protected validateUpdateExperiment(updates: UpdateExperimentPayload): UpdateExperimentPayload {
    return updateExperimentValidation.parse(updates);
  }

  /**
   * Get a single experiment by ID
   */
  getExperiment({ id }: { id: string }): Promise<ExperimentRecord> {
    throw new Error('Not implemented');
  }

  /**
   * List experiments with optional filtering
   */
  getExperiments(args?: {
    filter?: {
      datasetId?: string;
      // targetType?: 'agent' | 'workflow';
      // targetId?: string;
      // status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    };
    pagination?: StoragePagination;
  }): Promise<{ experiments: ExperimentRecord[]; pagination: PaginationInfo }> {
    throw new Error('Not implemented');
  }

  /**
   * Delete an experiment and all its results
   */
  deleteExperiment({ id }: { id: string }): Promise<void> {
    throw new Error('Not implemented');
  }

  // Experiment Row Results
  /**
   * Add experiment row results (batch insert)
   */
  addExperimentRowResults(_args: AddExperimentRowResultsPayload): Promise<void> {
    throw new Error('Not implemented');
  }

  protected validateAddExperimentRowResults(args: AddExperimentRowResultsPayload): AddExperimentRowResultsPayload {
    return addExperimentRowResultsValidation.parse(args);
  }

  /**
   * Get all row results for an experiment with pagination
   */
  getExperimentRowResults(_args: {
    experimentId: string;
    pagination?: StoragePagination;
  }): Promise<{ results: ExperimentRowResult[]; pagination: PaginationInfo }> {
    throw new Error('Not implemented');
  }

  /**
   * Get a single experiment row result by ID
   */
  getExperimentRowResult(_args: { id: string }): Promise<ExperimentRowResult> {
    throw new Error('Not implemented');
  }

  /**
   * Update experiment row results (batch update)
   */
  updateExperimentRowResults(_args: UpdateExperimentRowResultsPayload): Promise<void> {
    throw new Error('Not implemented');
  }

  protected validateUpdateExperimentRowResults(
    args: UpdateExperimentRowResultsPayload,
  ): UpdateExperimentRowResultsPayload {
    return updateExperimentRowResultsValidation.parse(args);
  }

  /**
   * Add a comment to an experiment row result
   */
  addCommentToRowResult(_args: AddCommentToRowResultPayload): Promise<ExperimentRowResult> {
    throw new Error('Not implemented');
  }

  protected validateAddCommentToRowResult(args: AddCommentToRowResultPayload): AddCommentToRowResultPayload {
    return addCommentToRowResultValidation.parse(args);
  }

  /**
   * Delete experiment row results (batch delete)
   */
  deleteExperimentRowResults(_args: DeleteExperimentRowResultsPayload): Promise<void> {
    throw new Error('Not implemented');
  }

  protected validateDeleteExperimentRowResults(
    args: DeleteExperimentRowResultsPayload,
  ): DeleteExperimentRowResultsPayload {
    return deleteExperimentRowResultsValidation.parse(args);
  }
}
