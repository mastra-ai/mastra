import type { DatasetExperiment, DatasetExperimentResult, ToolReplayReport } from '@mastra/client-js';

const experimentBase = {
  datasetId: 'dataset-1',
  datasetVersion: 1,
  agentVersion: null,
  targetType: 'agent' as const,
  targetId: 'support-agent',
  status: 'completed' as const,
  totalItems: 3,
  succeededCount: 3,
  failedCount: 0,
  skippedCount: 0,
  startedAt: '2026-06-01T10:00:00.000Z',
  completedAt: '2026-06-01T10:05:00.000Z',
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-06-01T10:05:00.000Z',
};

/** Completed live agent run — the only eligible replay source in the set. */
export const liveExperiment: DatasetExperiment = {
  ...experimentBase,
  id: 'exp-live-1',
  name: 'baseline',
};

/** Stamped with the exact backend marker shape — a replay run. */
export const replayExperiment: DatasetExperiment = {
  ...experimentBase,
  id: 'exp-replay-1',
  name: 'replay-of-baseline',
  metadata: { toolReplay: { fromExperimentId: 'exp-live-1', onMiss: 'error' } },
};

/** User-owned junk under the same key — must NOT read as a replay run. */
export const junkMarkerExperiment: DatasetExperiment = {
  ...experimentBase,
  id: 'exp-junk-marker',
  metadata: { toolReplay: 'user junk' },
};

/** Object without `onMiss` — not the stamped shape, must NOT read as replay. */
export const noOnMissMarkerExperiment: DatasetExperiment = {
  ...experimentBase,
  id: 'exp-no-onmiss',
  metadata: { toolReplay: { fromExperimentId: 'exp-live-1' } },
};

export const runningAgentExperiment: DatasetExperiment = {
  ...experimentBase,
  id: 'exp-running',
  status: 'running',
  completedAt: null,
};

export const completedWorkflowExperiment: DatasetExperiment = {
  ...experimentBase,
  id: 'exp-workflow',
  targetType: 'workflow',
  targetId: 'support-workflow',
};

export const divergentReport: ToolReplayReport = {
  sourceTraceId: 'trace-src-1',
  totalRecorded: 4,
  replayedCount: 3,
  misses: [{ toolName: 'get-weather', action: 'error', input: { city: 'Paris' } }],
  unconsumed: [{ toolName: 'create-ticket', count: 1 }],
  argMismatches: [{ toolName: 'get-weather', sequence: 2, spanId: 'span-2' }],
  redactedPayloadCount: 1,
  staleRecording: true,
};

export const cleanReport: ToolReplayReport = {
  sourceTraceId: 'trace-src-2',
  totalRecorded: 2,
  replayedCount: 2,
  misses: [],
  unconsumed: [],
  argMismatches: [],
};

/** Source run never called any tools — nothing was on the tape. */
export const emptyRecordingReport: ToolReplayReport = {
  sourceTraceId: 'trace-src-3',
  totalRecorded: 0,
  replayedCount: 0,
  misses: [],
  unconsumed: [],
  argMismatches: [],
};

const resultBase = {
  experimentId: 'exp-replay-1',
  itemDatasetVersion: 1,
  groundTruth: null,
  startedAt: '2026-06-01T10:00:00.000Z',
  completedAt: '2026-06-01T10:00:05.000Z',
  retryCount: 0,
  status: null,
  tags: null,
  scores: [],
  createdAt: '2026-06-01T10:00:05.000Z',
};

/** Successful replayed item whose output carries the divergence report. */
export const replayResult: DatasetExperimentResult = {
  ...resultBase,
  id: 'result-replay-1',
  itemId: 'item-1',
  input: { question: 'Where is my refund?' },
  output: { text: 'Please send a photo first.', toolReplay: divergentReport },
  error: null,
  traceId: 'trace-replay-run-1',
};

/** Failed replay item: TOOL_REPLAY_MISS error + report-only output. */
export const failedReplayResult: DatasetExperimentResult = {
  ...resultBase,
  id: 'result-replay-2',
  itemId: 'item-2',
  input: { question: 'Compare two cities' },
  output: { toolReplay: divergentReport },
  error: {
    message: "Tool replay miss for 'get-weather': no recorded call remaining — execution aborted (onMiss: 'error')",
    code: 'TOOL_REPLAY_MISS',
  },
  traceId: 'trace-replay-run-2',
};

/** Live-run result whose agent output happens to own a `toolReplay` key. */
export const liveResultWithJunkToolReplay: DatasetExperimentResult = {
  ...resultBase,
  id: 'result-live-1',
  experimentId: 'exp-live-1',
  itemId: 'item-3',
  input: { question: 'hi' },
  output: { text: 'hello', toolReplay: 'oops-user-data' },
  error: null,
  traceId: 'trace-live-run-1',
};

export const listExperimentsResponse = (experiments: DatasetExperiment[]) => ({
  experiments,
  pagination: { total: experiments.length, page: 0, perPage: 100, hasMore: false },
});

export const listResultsResponse = (results: DatasetExperimentResult[], total = results.length, page = 0) => ({
  results,
  pagination: { total, page, perPage: 100, hasMore: (page + 1) * 100 < total },
});

export const triggerExperimentResponse = {
  experimentId: 'exp-new-1',
  status: 'pending' as const,
  totalItems: 3,
  succeededCount: 0,
  failedCount: 0,
  startedAt: '2026-06-01T10:00:00.000Z',
  completedAt: null,
  results: [],
};
