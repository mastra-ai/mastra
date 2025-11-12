import type { RequestContext } from '../request-context';
import type { DatasetRecord, DatasetVersion, DatasetRow, PaginationInfo, StoragePagination } from '../storage';

// Re-export storage types for convenience
export type { DatasetRecord, DatasetVersion, DatasetRow, PaginationInfo };

/**
 * Options for creating a new dataset
 */
export type CreateDatasetOptions = {
  name: string;
  description?: string;
  metadata?: Record<string, any>;
};

/**
 * Options for updating a dataset
 */
export type UpdateDatasetOptions = {
  name?: string;
  description?: string;
  metadata?: Record<string, any>;
};

/**
 * Options for listing datasets
 */
export type ListDatasetsOptions = {
  filter?: {
    name?: string;
  };
  pagination?: StoragePagination;
};

/**
 * Options for listing dataset versions
 */
export type ListVersionsOptions = {
  pagination?: StoragePagination;
};

/**
 * Options for iterating over rows
 */
export type RowsIteratorOptions = {
  versionId?: string;
  batchSize?: number;
};

/**
 * Options for listing rows
 */
export type ListRowsOptions = {
  versionId?: string;
  pagination?: StoragePagination;
};

/**
 * Input for adding a single row to a dataset
 */
export type AddRowInput = {
  input: any;
  groundTruth?: any;
  requestContext?: Record<string, any>;
  traceId?: string;
  spanId?: string;
};

/**
 * Input for updating a single row
 */
export type UpdateRowInput = {
  rowId: string;
  input?: any;
  groundTruth?: any;
  requestContext?: Record<string, any>;
  traceId?: string;
  spanId?: string;
};

/**
 * Result of adding rows to a dataset
 */
export type AddRowsResult = {
  rows: DatasetRow[];
  versionId: string;
};

/**
 * Result of updating rows
 */
export type UpdateRowsResult = {
  rows: DatasetRow[];
  versionId: string;
};

/**
 * Result of deleting rows
 */
export type DeleteRowsResult = {
  versionId: string;
};

/**
 * Result of listing datasets
 */
export type ListDatasetsResult = {
  datasets: DatasetRecord[];
  pagination: PaginationInfo;
};

/**
 * Result of listing versions
 */
export type ListVersionsResult = {
  versions: DatasetVersion[];
  pagination: PaginationInfo;
};

/**
 * Result of listing rows
 */
export type ListRowsResult = {
  rows: DatasetRow[];
  pagination: PaginationInfo;
};

/**
 * Result of listing row versions
 */
export type ListRowVersionsResult = {
  rows: DatasetRow[];
  pagination: PaginationInfo;
};
