import type { EntityType } from '@mastra/core/observability';
import type { LightSpanRecord } from '@mastra/core/storage';
import type { ReactNode } from 'react';

/**
 * A light span carrying a precomputed haystack of everything it holds.
 *
 * `LightSpanRecord` exposes searchable content across a fixed set of columns
 * plus open-ended payloads whose shape is unknown, so a search cannot read it
 * field by field. `searchText` is that content flattened once — see
 * `flattenToSearchText` — so filtering is a substring test per span instead of
 * a re-walk of every payload on every keystroke.
 *
 * It holds field names as well as values, so a span is findable by the shape of
 * its payload and not only by its content.
 */
export type SearchableSpan = LightSpanRecord & {
  searchText: string;
};

export type UISpan = {
  id: string;
  name: string;
  type: string;
  latency: number;
  startTime: string;
  endTime?: string;
  spans?: UISpan[];
  parentSpanId?: string | null;
  /**
   * Set when the span survived the active search because of its payload, not its name — the
   * timeline paints such a row differently since the term is nowhere on it.
   */
  matchedInPayloadOnly?: boolean;
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

/** Tab identifier for SpanDataPanelView. */
export type SpanTab = 'details' | 'feedback';

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
