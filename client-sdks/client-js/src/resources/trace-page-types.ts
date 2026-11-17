import type { SpanRecord } from '@mastra/core/storage';
import type { Serialized } from '../types';

// Platform serves this contract; it is not part of the @mastra/server route registry.
// Keep declarations independent of new core exports so older supported core packages can resolve them.
// type-tests/trace-page.test-d.ts verifies parity with the shared core schemas.
export type TracePageRequest =
  | {
      mode?: 'context';
      readToken?: string;
      anchorSpanId?: string;
      depth?: number;
      spanIds?: string[];
      search?: string;
      ancestors?: boolean;
      flattenResumes?: boolean;
      includeFamilySummary?: boolean;
      include?: 'structure' | 'full';
      limit?: number;
      maxBytes?: number;
    }
  | { cursor: string };
export type GetTracePageArgs = TracePageRequest & { traceId: string };
export type TracePageNode = Pick<
  Serialized<SpanRecord>,
  | 'traceId'
  | 'spanId'
  | 'parentSpanId'
  | 'name'
  | 'spanType'
  | 'isEvent'
  | 'startedAt'
  | 'endedAt'
  | 'entityType'
  | 'entityId'
  | 'entityName'
  | 'model'
  | 'provider'
  | 'outcome'
  | 'stopReason'
  | 'stopReasonContext'
  | 'errorCount'
  | 'externalParentSpanId'
  | 'resumedFromSpanId'
  | 'timeToFirstChunkMs'
  | 'inputPreview'
  | 'outputPreview'
  | 'errorPreview'
  | 'timeToFirstTokenMs'
> & {
  executionFamilyId?: string;
  displayParentSpanId?: string | null;
  familySummary?: Pick<
    Serialized<SpanRecord>,
    'startedAt' | 'endedAt' | 'outcome' | 'stopReason' | 'stopReasonContext' | 'outputPreview' | 'errorPreview'
  > & {
    initialSpanId: string;
    currentSpanId: string;
    executionCount: number;
    originalAvailable: boolean;
  };
  status: 'success' | 'error' | 'running';
  childCount: number | null;
  match: boolean;
  parentState: 'root' | 'available' | 'unavailable' | 'not-requested';
  details?: Omit<Serialized<SpanRecord>, 'scope' | 'links'>;
};
export interface TracePageResponse {
  traceId: string;
  nodes: TracePageNode[];
  traceContext?: {
    readToken: string;
    lowerEndedAt: string;
    upperEndedAt: string;
    roots: (Pick<
      Serialized<SpanRecord>,
      | 'experimentId'
      | 'userId'
      | 'organizationId'
      | 'resourceId'
      | 'runId'
      | 'sessionId'
      | 'threadId'
      | 'requestId'
      | 'environment'
      | 'source'
      | 'serviceName'
      | 'tags'
    > & { spanId: string; projectId?: string | null })[];
  };
  missingSpanIds: string[];
  nextCursor?: string;
  ancestorPaths: 'not-requested' | 'continued' | 'complete' | 'unavailable';
}
