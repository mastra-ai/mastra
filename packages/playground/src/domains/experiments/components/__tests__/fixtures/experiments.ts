import type { DatasetExperiment, GetAgentResponse, GetScorerResponse, GetWorkflowResponse } from '@mastra/client-js';

// Empty registries for the target-resolution queries the experiment top area
// fires (agents / workflows / scorers). The name/description under test come
// from the experiment itself, so these can be empty.
export const noAgents: Record<string, GetAgentResponse> = {};
export const noWorkflows: Record<string, GetWorkflowResponse> = {};
export const noScorers: Record<string, GetScorerResponse> = {};

const base: DatasetExperiment = {
  id: 'a1b2c3d4-0000-0000-0000-000000000001',
  datasetId: 'dataset-1',
  datasetVersion: 1,
  agentVersion: null,
  targetType: 'agent',
  targetId: 'example-entity-extraction-agent',
  name: 'entity-extraction / model-a',
  description: 'Entity extraction evaluation using Model A',
  status: 'completed',
  totalItems: 10,
  succeededCount: 10,
  failedCount: 0,
  startedAt: '2026-07-01T10:00:00.000Z',
  completedAt: '2026-07-01T10:05:00.000Z',
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-01T10:05:00.000Z',
};

/** Two named experiments plus one unnamed one, to exercise labels and search. */
export const experiments: DatasetExperiment[] = [
  base,
  {
    ...base,
    id: 'e5f6a7b8-0000-0000-0000-000000000002',
    name: 'entity-extraction / model-b',
    description: 'Entity extraction evaluation using Model B',
    createdAt: '2026-07-01T11:00:00.000Z',
  },
  {
    ...base,
    id: 'c0ffee00-0000-0000-0000-000000000003',
    name: undefined,
    description: undefined,
    createdAt: '2026-07-01T12:00:00.000Z',
  },
];
