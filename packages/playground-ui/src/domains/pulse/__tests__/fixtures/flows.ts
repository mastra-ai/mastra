import type { GetPulseFlowResponse, GetPulseFlowTimelineResponse, ListPulseFlowsResponse } from '@mastra/client-js';

const t0 = new Date('2026-08-14T10:00:00.000Z');
const t1 = new Date('2026-08-14T10:00:01.000Z');
const t2 = new Date('2026-08-14T10:00:02.500Z');

const runningFlow: ListPulseFlowsResponse['flows'][number] = {
  flowId: 'flow-running',
  threadId: 'thread-1',
  startedAt: t2,
  durationMs: null,
  status: 'running',
  pulseCount: 4,
  entityName: 'weather-agent',
};

const completedFlow: ListPulseFlowsResponse['flows'][number] = {
  flowId: 'flow-completed',
  threadId: 'thread-1',
  startedAt: t0,
  durationMs: 2500,
  status: 'completed',
  pulseCount: 12,
  costUsd: 0.0042,
  entityName: 'weather-agent',
};

const failedFlow: ListPulseFlowsResponse['flows'][number] = {
  flowId: 'flow-failed',
  startedAt: t0,
  durationMs: 512,
  status: 'failed',
  pulseCount: 3,
};

/** One flow per status family: a live one (null duration), a settled one with a
 *  cost, and a failed one without a cost. */
export const mixedFlowsPage: ListPulseFlowsResponse = {
  flows: [runningFlow, completedFlow, failedFlow],
  total: 3,
};

/** Every flow settled — polling must stop after the first fetch. */
export const settledFlowsPage: ListPulseFlowsResponse = {
  flows: [completedFlow, failedFlow],
  total: 2,
};

export const emptyFlowsPage: ListPulseFlowsResponse = {
  flows: [],
  total: 0,
};

/** Settled flow with a two-level tree: a closed root and an errored child that
 *  never received an end pulse (durationMs null, no endedAt). */
export const completedFlowDetail: GetPulseFlowResponse = {
  flow: {
    flowId: 'flow-completed',
    threadId: 'thread-1',
    startedAt: t0,
    durationMs: 2500,
    status: 'completed',
    pulseCount: 12,
    costUsd: 0.0042,
    entityName: 'weather-agent',
    tree: [
      {
        spanId: 'span-root',
        label: 'agent run',
        startedAt: t0,
        endedAt: t2,
        durationMs: 2500,
        hasError: false,
      },
      {
        spanId: 'span-llm',
        parentSpanId: 'span-root',
        label: 'llm call',
        startedAt: t1,
        durationMs: null,
        hasError: true,
      },
    ],
    definitions: ['agent:weather-agent', 'tool:get-weather'],
  },
};

export const runningFlowDetail: GetPulseFlowResponse = {
  flow: {
    flowId: 'flow-running',
    threadId: 'thread-1',
    startedAt: t2,
    durationMs: null,
    status: 'running',
    pulseCount: 4,
    entityName: 'weather-agent',
    tree: [
      {
        spanId: 'span-root',
        label: 'agent run',
        startedAt: t2,
        durationMs: null,
        hasError: false,
      },
    ],
    definitions: [],
  },
};

export const missingFlowDetail: GetPulseFlowResponse = {
  flow: null,
};

/** One entry per capture lane the detail view color-codes. */
export const completedFlowTimeline: GetPulseFlowTimelineResponse = {
  timeline: [
    { timestamp: t0, seq: 1, source: 'span', type: 'system', surface: 'agent', action: 'run_started' },
    {
      timestamp: t0,
      seq: 2,
      source: 'session',
      type: 'input',
      surface: 'thread',
      action: 'message_added',
      runId: 'run-1',
    },
    { timestamp: t1, seq: 3, source: 'runtime', type: 'progress', surface: 'model', action: 'stream_step' },
    { timestamp: t1, seq: 4, source: 'metric', type: 'system', surface: 'model', action: 'usage_recorded' },
    { timestamp: t2, seq: 5, source: 'score', type: 'decision', surface: 'scorer', action: 'score_recorded' },
    { timestamp: t2, seq: 6, source: 'feedback', type: 'state', surface: 'user', action: 'thumbs_up' },
  ],
};

export const emptyTimeline: GetPulseFlowTimelineResponse = {
  timeline: [],
};
