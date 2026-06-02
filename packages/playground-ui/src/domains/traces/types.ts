import type { EntityType } from '@mastra/core/observability';
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
  typePrefix: string;
};

// -- Trace filtering types ----------------------------------------------------

export type EntityOptions =
  | { value: string; label: string; type: EntityType.AGENT }
  | { value: string; label: string; type: EntityType.WORKFLOW_RUN }
  | { value: string; label: string; type: 'all' };

export type TraceDatePreset = 'all' | 'last-24h' | 'last-3d' | 'last-7d' | 'last-14d' | 'last-30d' | 'custom';

/** Canonical list of context field IDs used for trace filtering and value extraction */
export const CONTEXT_FIELD_IDS = [
  'environment',
  'serviceName',
  'source',
  'scope',
  'userId',
  'organizationId',
  'resourceId',
  'runId',
  'sessionId',
  'threadId',
  'requestId',
  'experimentId',
  'spanType',
  'entityName',
  'parentEntityType',
  'parentEntityId',
  'parentEntityName',
  'rootEntityType',
  'rootEntityId',
  'rootEntityName',
] as const;
