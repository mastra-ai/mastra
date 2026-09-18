import type { DatasetExperiment, DatasetRecord } from '@mastra/client-js';

export const dataset = (id: string, name: string): DatasetRecord => ({
  id,
  name,
  version: 1,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
});

export const experiment = (id: string, datasetId: string): DatasetExperiment => ({
  id,
  datasetId,
  datasetVersion: 1,
  agentVersion: null,
  targetType: 'agent',
  targetId: 'agent-1',
  provenance: null,
  runnerAttestation: null,
  experimentSetId: null,
  comparisonId: null,
  variantId: null,
  trialIndex: null,
  status: 'completed',
  totalItems: 1,
  succeededCount: 1,
  failedCount: 0,
  skippedCount: 0,
  startedAt: '2026-08-01T00:00:00.000Z',
  completedAt: '2026-08-01T00:00:00.000Z',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
});

export const datasets: DatasetRecord[] = [
  {
    ...dataset('ds-a', 'Dataset A'),
    description: 'Customer support examples',
    version: 3,
    tags: ['support', 'english', 'reviewed'],
  },
  { ...dataset('ds-b', 'Dataset B'), targetType: 'workflow' },
];
export const experiments = [experiment('exp-1', 'ds-a'), experiment('exp-2', 'ds-a')];
export const mixedExperiments: DatasetExperiment[] = [
  ...experiments,
  { ...experiment('exp-3', 'ds-a'), status: 'failed' },
  experiment('exp-other', 'ds-other'),
];
export const taggedDatasets: DatasetRecord[] = [
  { ...dataset('ds-a', 'Dataset A'), tags: ['support', 'english', 'support'] },
  { ...dataset('ds-b', 'Dataset B'), tags: ['reviewed', 'english'] },
  dataset('ds-c', 'Dataset C'),
];
