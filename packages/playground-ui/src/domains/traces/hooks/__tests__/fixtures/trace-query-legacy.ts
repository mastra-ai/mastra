import type { MastraClient } from '@mastra/client-js';
import { EntityType, SpanType } from '@mastra/core/observability';
import { TraceStatus } from '@mastra/core/storage';

type ListTracesLightResponse = Awaited<ReturnType<MastraClient['listTracesLight']>>;

const startedAt = new Date('2026-09-01T10:00:00.000Z');
const endedAt = new Date('2026-09-01T10:01:00.000Z');

export const firstLegacyTracePage: ListTracesLightResponse = {
  pagination: { total: 2, page: 0, perPage: 1, hasMore: true },
  spans: [
    {
      traceId: 'trace-legacy-a',
      spanId: 'span-legacy-a',
      parentSpanId: null,
      name: 'Agent run',
      spanType: SpanType.AGENT_RUN,
      isEvent: false,
      startedAt,
      endedAt,
      status: TraceStatus.SUCCESS,
      entityType: EntityType.AGENT,
      entityId: 'assistant',
      entityName: 'assistant',
      metadata: { region: 'eu-west' },
      inputPreview: 'Hello',
      createdAt: startedAt,
      updatedAt: endedAt,
    },
  ],
};

export const lastLegacyTracePage: ListTracesLightResponse = {
  pagination: { total: 2, page: 1, perPage: 1, hasMore: false },
  spans: [
    {
      traceId: 'trace-legacy-b',
      spanId: 'span-legacy-b',
      parentSpanId: null,
      name: 'Workflow run',
      spanType: SpanType.WORKFLOW_RUN,
      isEvent: false,
      startedAt,
      endedAt: null,
      status: TraceStatus.RUNNING,
      createdAt: startedAt,
      updatedAt: null,
    },
  ],
};
