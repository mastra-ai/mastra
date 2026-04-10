import { EntityType } from '@mastra/core/observability';
import type { ReactNode } from 'react';

export type UISpan = {
  id: string;
  name: string;
  type: string;
  latency: number;
  startTime: string;
  endTime?: string;
  spans?: UISpan[];
  parentSpanId?: string | null;
};

export type UISpanStyle = {
  icon?: ReactNode;
  color?: string;
  label?: string;
  bgColor?: string;
  typePrefix: string;
};

// -- Trace filtering types ----------------------------------------------------

export type EntityOptions = { label: string; entityType: EntityType };

export const ROOT_ENTITY_TYPES = {
  AGENT: EntityType.AGENT,
  WORKFLOW: EntityType.WORKFLOW_RUN,
  SCORER: EntityType.SCORER,
  INGEST: EntityType.RAG_INGESTION,
} as const;

export const ROOT_ENTITY_TYPE_OPTIONS = [
  { label: 'Agent', entityType: ROOT_ENTITY_TYPES.AGENT },
  { label: 'Workflow', entityType: ROOT_ENTITY_TYPES.WORKFLOW },
  { label: 'Scorer', entityType: ROOT_ENTITY_TYPES.SCORER },
  { label: 'Ingest', entityType: ROOT_ENTITY_TYPES.INGEST },
] as const satisfies readonly EntityOptions[];

export type TraceStatusFilter = 'running' | 'success' | 'error';

export const TRACE_STATUS_OPTIONS = [
  { label: 'Running', value: 'running' },
  { label: 'Success', value: 'success' },
  { label: 'Error', value: 'error' },
] as const satisfies readonly { label: string; value: TraceStatusFilter }[];

export type TraceDatePreset = 'all' | 'last-24h' | 'last-3d' | 'last-7d' | 'last-14d' | 'last-30d' | 'custom';
