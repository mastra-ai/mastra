import type { SpanRecord } from '@mastra/core/storage';
import { DuckDBConnection } from '../../db/index.js';

export const v = DuckDBConnection.sqlValue;

export function jsonV(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  return DuckDBConnection.sqlValue(JSON.stringify(val));
}

export function toDate(val: unknown): Date {
  if (val instanceof Date) return val;
  if (val !== null && val !== undefined) return new Date(String(val));
  return new Date();
}

export function toDateOrNull(val: unknown): Date | null {
  if (val === null || val === undefined) return null;
  return val instanceof Date ? val : new Date(String(val));
}

export function parseJson(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

export function parseJsonArray(value: unknown): unknown[] | null {
  if (value === null || value === undefined) return null;
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed : null;
}

export function rowToSpanRecord(row: Record<string, unknown>): SpanRecord {
  return {
    traceId: row.traceId as string,
    spanId: row.spanId as string,
    name: row.name as string,
    spanType: row.spanType as SpanRecord['spanType'],
    parentSpanId: (row.parentSpanId as string) ?? null,
    isEvent: row.isEvent as boolean,
    startedAt: toDate(row.startedAt),
    endedAt: toDateOrNull(row.endedAt),
    experimentId: (row.experimentId as string) ?? null,
    entityType: (row.entityType as SpanRecord['entityType']) ?? null,
    entityId: (row.entityId as string) ?? null,
    entityName: (row.entityName as string) ?? null,
    userId: (row.userId as string) ?? null,
    organizationId: (row.organizationId as string) ?? null,
    resourceId: (row.resourceId as string) ?? null,
    runId: (row.runId as string) ?? null,
    sessionId: (row.sessionId as string) ?? null,
    threadId: (row.threadId as string) ?? null,
    requestId: (row.requestId as string) ?? null,
    environment: (row.environment as string) ?? null,
    source: (row.source as string) ?? null,
    serviceName: (row.serviceName as string) ?? null,
    attributes: parseJson(row.attributes) as Record<string, unknown> | null,
    metadata: parseJson(row.metadata) as Record<string, unknown> | null,
    tags: parseJsonArray(row.tags) as string[] | null,
    scope: parseJson(row.scope) as Record<string, unknown> | null,
    links: parseJsonArray(row.links),
    input: parseJson(row.input) as Record<string, unknown> | null,
    output: parseJson(row.output) as Record<string, unknown> | null,
    error: parseJson(row.error) as Record<string, unknown> | null,
    createdAt: toDate(row.startedAt),
    updatedAt: null,
  };
}
