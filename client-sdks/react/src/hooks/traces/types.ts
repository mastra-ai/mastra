import type { MastraClient } from '@mastra/client-js';
import type { EntityType } from '@mastra/core/observability';

type GetTraceLightResponse = Awaited<ReturnType<MastraClient['getTraceLight']>>;
type GetSpanResponse = Awaited<ReturnType<MastraClient['getSpan']>>;
export type LightSpanRecord = GetTraceLightResponse['spans'][number];
export type SpanRecord = GetSpanResponse['span'];

export type TraceListMode = 'traces' | 'branches';

export type TraceUsageSummary = {
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
  costUnit?: string;
};

export const ROOT_ENTITY_TYPES = {
  AGENT: 'agent',
  WORKFLOW: 'workflow_run',
  SCORER: 'scorer',
  INGEST: 'rag_ingestion',
} as const satisfies Record<string, `${EntityType}`>;
