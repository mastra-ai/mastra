import type { DatasetExperiment, DatasetExperimentResult, ToolReplayReport } from '@mastra/client-js';
import type { ToolReplayReportExtended } from '../../utils/tool-replay';

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

/** Object without `onMiss` or `mockedTools` — not a stamped shape, must NOT read as replay. */
export const noOnMissMarkerExperiment: DatasetExperiment = {
  ...experimentBase,
  id: 'exp-no-onmiss',
  metadata: { toolReplay: { fromExperimentId: 'exp-live-1' } },
};

/** Mock-only run: `mockedTools` without `onMiss` — mocks always answer, so there is no miss policy. */
export const mockOnlyExperiment: DatasetExperiment = {
  ...experimentBase,
  id: 'exp-mock-only',
  name: 'mock-only',
  metadata: { toolReplay: { mockedTools: ['weatherInfo'] } },
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

/**
 * Replay+mock run (onMiss: passthrough) carrying the run's call flow:
 * recorded get-weather ×2 + create-ticket ×1; the run replayed both
 * get-weather events (the second with drifted args), got send-email from a
 * mock, never asked for create-ticket, and ran get-photos live on a miss.
 * Verdict: "4 tool calls — 2 replayed (1 with different args) · 1 mocked · 1 ran live".
 */
export const callFlowReport: ToolReplayReportExtended = {
  sourceTraceId: 'trace-src-1',
  totalRecorded: 3,
  replayedCount: 2,
  misses: [{ toolName: 'get-photos', action: 'passthrough', input: { ticketId: 'T-1' } }],
  unconsumed: [{ toolName: 'create-ticket', count: 1 }],
  argMismatches: [{ toolName: 'get-weather', sequence: 1, spanId: 'span-1' }],
  mocks: [{ toolName: 'send-email', calls: 1, kind: 'output' }],
  calls: [
    { order: 0, toolName: 'get-weather', outcome: 'replayed', sequence: 0 },
    { order: 1, toolName: 'get-weather', outcome: 'replayed', sequence: 1, argsDiffered: true },
    { order: 2, toolName: 'send-email', outcome: 'mocked' },
    { order: 3, toolName: 'get-photos', outcome: 'miss-passthrough' },
  ],
};

/**
 * Replay+mock run (onMiss: error) aborted at the miss: a recorded error was
 * re-thrown, a mock injected an error, then a miss stopped the item.
 */
export const errorOutcomesCallFlowReport: ToolReplayReportExtended = {
  sourceTraceId: 'trace-src-4',
  totalRecorded: 2,
  replayedCount: 1,
  misses: [{ toolName: 'get-weather', action: 'error', input: { city: 'Lyon' } }],
  unconsumed: [{ toolName: 'fetch-invoice', count: 1 }],
  argMismatches: [],
  mocks: [{ toolName: 'charge-card', calls: 1, kind: 'error' }],
  calls: [
    { order: 0, toolName: 'fetch-invoice', outcome: 'replayed-error', sequence: 0 },
    { order: 1, toolName: 'charge-card', outcome: 'mock-error' },
    { order: 2, toolName: 'get-weather', outcome: 'miss-error' },
  ],
};

/** Mock-only run flow: one mocked answer plus an unmocked tool that ran live. */
export const mockOnlyCallFlowReport: ToolReplayReportExtended = {
  sourceTraceId: null,
  totalRecorded: 0,
  replayedCount: 0,
  misses: [],
  unconsumed: [],
  argMismatches: [],
  mocks: [{ toolName: 'weatherInfo', calls: 1, kind: 'output' }],
  calls: [
    { order: 0, toolName: 'weatherInfo', outcome: 'mocked' },
    { order: 1, toolName: 'searchDocs', outcome: 'live' },
  ],
};

/** Mock-run report: no recording, mocked answers, one satisfied and one failed expectation. */
export const expectationFailedReport: ToolReplayReportExtended = {
  sourceTraceId: null,
  totalRecorded: 0,
  replayedCount: 0,
  misses: [],
  unconsumed: [],
  argMismatches: [],
  mocks: [
    { toolName: 'weatherInfo', calls: 2, kind: 'output' },
    { toolName: 'sendEmail', calls: 0, kind: 'observe' },
  ],
  expectations: [
    { toolName: 'weatherInfo', satisfied: true, calledTimes: 2 },
    { toolName: 'sendEmail', satisfied: false, calledTimes: 0, reason: 'expected at least 1 call, got 0' },
  ],
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

/** Successful replayed item — new row shape: the report sits in the dedicated top-level column. */
export const replayResult: DatasetExperimentResult = {
  ...resultBase,
  id: 'result-replay-1',
  itemId: 'item-1',
  input: { question: 'Where is my refund?' },
  output: { text: 'Please send a photo first.' },
  toolReplay: divergentReport,
  error: null,
  traceId: 'trace-replay-run-1',
};

/** Successful replayed item whose report carries the run's call flow. */
export const callFlowResult: DatasetExperimentResult = {
  ...resultBase,
  id: 'result-replay-3',
  itemId: 'item-5',
  input: { question: 'Compare the weather and email me.' },
  output: { text: 'Sent! Paris is warmer.' },
  toolReplay: callFlowReport,
  error: null,
  traceId: 'trace-replay-run-3',
};

/** Failed replay item — older row shape: TOOL_REPLAY_MISS error + report merged into the output. */
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

/** Mock-run item whose expectation failed: top-level report + TOOL_MOCK_EXPECTATION_FAILED error. */
export const expectationFailedResult: DatasetExperimentResult = {
  ...resultBase,
  id: 'result-mock-1',
  itemId: 'item-4',
  input: { question: 'Email me the weather' },
  output: { text: 'I could not send the email.' },
  toolReplay: expectationFailedReport,
  error: {
    message: "Tool mock expectation failed for 'sendEmail': expected at least 1 call, got 0",
    code: 'TOOL_MOCK_EXPECTATION_FAILED',
  },
  traceId: 'trace-mock-run-1',
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
