import type { RuntimeContext } from '../runtime-context';

// Make this a zod schema
export type UpdateDatasetRow = Omit<
  Partial<DatasetRow>,
  'rowVersionId' | 'createdAt' | 'updatedAt' | 'versionId' | 'datasetId' | 'deleted'
> & { rowId: string };
export type DeleteDatasetRow = { rowId: string };

export type AddRowInput = {
  input: any;
  groundTruth?: any;
  metadata?: Record<string, any>;
  runtimeContext?: Record<string, any>;
  traceId?: string;
  spanId?: string;
};

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
  rowVersionId: string;
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
