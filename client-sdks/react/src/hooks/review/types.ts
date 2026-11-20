import type { DatasetExperimentResult } from '@mastra/client-js';

export interface ReviewItem {
  id: string;
  input: unknown;
  output: unknown;
  error: unknown;
  itemId: string;
  datasetId?: string;
  scores?: Record<string, number>;
  tags: string[];
  rating?: 'positive' | 'negative';
  comment?: string;
  clusterId?: string;
  experimentId?: string;
  traceId?: string;
  targetType?: DatasetExperimentResult['targetType'];
  createdAt?: DatasetExperimentResult['createdAt'];
  startedAt?: DatasetExperimentResult['startedAt'];
  completedAt?: DatasetExperimentResult['completedAt'];
  status?: DatasetExperimentResult['status'];
  groundTruth?: unknown;
  toolMockReport?: DatasetExperimentResult['toolMockReport'];
}
