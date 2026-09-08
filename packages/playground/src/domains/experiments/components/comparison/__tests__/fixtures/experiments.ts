import type { DatasetExperiment } from '@mastra/client-js';

/**
 * Fully specified experiment with a name and description — exercises the
 * "named experiment" display path (name as primary label, short id + tooltip).
 */
export const namedExperiment: DatasetExperiment = {
  id: 'a1b2c3d4-0000-0000-0000-000000000001',
  datasetId: 'dataset-1',
  datasetVersion: 3,
  agentVersion: null,
  targetType: 'agent',
  targetId: 'example-entity-extraction-agent',
  name: 'entity-extraction / model-a',
  description: 'Entity extraction evaluation using Model A',
  status: 'completed',
  totalItems: 10,
  succeededCount: 8,
  failedCount: 2,
  startedAt: '2026-07-01T10:00:00.000Z',
  completedAt: '2026-07-01T10:05:00.000Z',
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-01T10:05:00.000Z',
};

/** Experiment without a name — should fall back to the short id as the label. */
export const unnamedExperiment: DatasetExperiment = {
  ...namedExperiment,
  id: 'c0ffee00-0000-0000-0000-000000000003',
  name: undefined,
  description: undefined,
};

/** Nothing rejects an empty name server-side, and it must fall back like a missing one. */
export const blankNameExperiment: DatasetExperiment = {
  ...namedExperiment,
  id: 'b1a11c00-0000-0000-0000-000000000004',
  name: '',
  description: undefined,
};
