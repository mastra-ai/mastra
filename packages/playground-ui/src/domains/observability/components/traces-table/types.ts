import { SpanRecord } from '@mastra/core/storage';

export type TraceTableData = Pick<SpanRecord, 'traceId' | 'name' | 'entityType' | 'entityId' | 'entityName'> & {
  attributes?: Record<string, any> | null;
  createdAt: Date | string;
};

export type TraceTableColumn = TraceTableData;
