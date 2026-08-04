import { SpanType } from '@mastra/core/observability';
import type { LightSpanRecord, ListTracesLightResponse, ListTracesResponse } from '@mastra/core/storage';
import { TraceStatus } from '@mastra/core/storage';

const timestamp = new Date('2026-06-10T00:00:00.000Z');
const laterTimestamp = new Date('2026-06-10T00:05:00.000Z');

const lightSpanAlpha: LightSpanRecord = {
  traceId: 'trace-alpha',
  spanId: 'span-alpha',
  parentSpanId: null,
  name: 'weather agent run',
  spanType: SpanType.AGENT_RUN,
  isEvent: false,
  startedAt: timestamp,
  endedAt: timestamp,
  status: TraceStatus.SUCCESS,
  metadata: { environment: 'production' },
  inputPreview: 'What is the weather in Paris?',
  createdAt: timestamp,
  updatedAt: timestamp,
};

const lightSpanBravo: LightSpanRecord = {
  traceId: 'trace-bravo',
  spanId: 'span-bravo',
  parentSpanId: null,
  name: 'travel agent run',
  spanType: SpanType.AGENT_RUN,
  isEvent: false,
  startedAt: laterTimestamp,
  endedAt: laterTimestamp,
  status: TraceStatus.SUCCESS,
  metadata: { environment: 'staging' },
  inputPreview: 'Book a train to Lyon',
  createdAt: laterTimestamp,
  updatedAt: laterTimestamp,
};

export const lightPage0: ListTracesLightResponse = {
  pagination: { total: 1, page: 0, perPage: 25, hasMore: false },
  deltaCursor: 'cursor-1',
  spans: [lightSpanAlpha],
};

export const lightDeltaBatch: ListTracesLightResponse = {
  delta: { limit: 100, hasMore: false },
  deltaCursor: 'cursor-2',
  spans: [lightSpanBravo],
};

/** A light page as served by stores that predate the preview/status fields:
 *  rows without `status`/`inputPreview`/`metadata` and no `deltaCursor`. */
export const legacyLightPage0: ListTracesLightResponse = {
  pagination: { total: 1, page: 0, perPage: 25, hasMore: false },
  spans: [
    {
      traceId: 'trace-legacy',
      spanId: 'span-legacy',
      parentSpanId: null,
      name: 'legacy agent run',
      spanType: SpanType.AGENT_RUN,
      isEvent: false,
      startedAt: timestamp,
      endedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ],
};

export const legacyLightEmptyPage0: ListTracesLightResponse = {
  pagination: { total: 0, page: 0, perPage: 25, hasMore: false },
  spans: [],
};

export const lightDeltaEmptyBatch: ListTracesLightResponse = {
  delta: { limit: 100, hasMore: false },
  deltaCursor: 'cursor-2',
  spans: [],
};

export const fullTracesPage0: ListTracesResponse = {
  pagination: { total: 1, page: 0, perPage: 25, hasMore: false },
  deltaCursor: 'cursor-full-1',
  spans: [
    {
      traceId: 'trace-full',
      spanId: 'span-full',
      parentSpanId: null,
      name: 'full agent run',
      spanType: SpanType.AGENT_RUN,
      isEvent: false,
      startedAt: timestamp,
      endedAt: timestamp,
      input: { prompt: 'What is the weather in Paris?' },
      output: { text: 'Sunny' },
      attributes: { agentId: 'weather-agent' },
      status: TraceStatus.SUCCESS,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ],
};

export const fullDeltaBatch: ListTracesResponse = {
  delta: { limit: 100, hasMore: false },
  deltaCursor: 'cursor-full-2',
  spans: [],
};
