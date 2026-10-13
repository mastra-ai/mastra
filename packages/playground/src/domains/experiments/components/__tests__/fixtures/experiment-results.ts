import type { DatasetExperimentResult, ListDatasetExperimentResultsResponse } from '@mastra/client-js';

const base = {
  experimentId: 'exp-1',
  itemDatasetVersion: 1,
  input: 'question',
  groundTruth: null,
  error: null,
  startedAt: '2026-08-25T10:00:00.000Z',
  completedAt: '2026-08-25T10:00:01.000Z',
  retryCount: 0,
  traceId: null,
  status: null,
  tags: null,
  scores: [],
  createdAt: '2026-08-25T10:00:00.000Z',
} satisfies Partial<DatasetExperimentResult>;

export const agentMarkdownResult: DatasetExperimentResult = {
  ...base,
  id: 'res-agent-ok',
  itemId: 'item-agent-ok',
  targetType: 'agent',
  output: { text: '# Title\n\n**bold**' },
};

export const agentFailedResult: DatasetExperimentResult = {
  ...base,
  id: 'res-agent-fail',
  itemId: 'item-agent-fail',
  targetType: 'agent',
  output: { text: '', error: { message: 'model exploded' } },
  error: { message: 'model exploded' },
};

export const workflowResult: DatasetExperimentResult = {
  ...base,
  id: 'res-workflow',
  itemId: 'item-workflow',
  targetType: 'workflow',
  output: { answer: 42 },
};

export const experimentResultsResponse: ListDatasetExperimentResultsResponse = {
  results: [agentMarkdownResult, agentFailedResult, workflowResult],
  pagination: { total: 3, page: 0, perPage: 50, hasMore: false },
};
