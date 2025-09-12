import { randomUUID } from 'crypto';

export const createSampleTraceForDB = (
  name: string,
  scope?: string,
  attributes?: Record<string, string>,
  createdAt?: Date,
) => ({
  id: `span-${randomUUID()}`,
  parentSpanId: `span-${randomUUID()}`,
  traceId: `trace-${randomUUID()}`,
  name,
  scope,
  kind: 0,
  status: JSON.stringify({ code: 'success' }),
  events: JSON.stringify([{ name: 'start', timestamp: Date.now() }]),
  links: JSON.stringify([]),
  attributes: attributes ? attributes : undefined,
  startTime: (createdAt || new Date()).getTime(),
  endTime: (createdAt || new Date()).getTime(),
  other: JSON.stringify({ custom: 'data' }),
  createdAt: createdAt || new Date(),
});

/**
 * Creates a root span (parent span) for a trace
 */
export const createRootSpan = (
  name: string,
  traceId: string,
  scope?: string,
  attributes?: Record<string, string>,
  createdAt?: Date,
) => ({
  id: `span-${randomUUID()}`,
  parentSpanId: null, // Root spans have no parent
  traceId,
  name,
  scope,
  kind: 0,
  status: JSON.stringify({ code: 'success' }),
  events: JSON.stringify([{ name: 'start', timestamp: Date.now() }]),
  links: JSON.stringify([]),
  attributes: attributes ? attributes : undefined,
  startTime: (createdAt || new Date()).getTime(),
  endTime: (createdAt || new Date()).getTime(),
  other: JSON.stringify({ custom: 'data' }),
  createdAt: createdAt || new Date(),
});

/**
 * Creates a child span that belongs to a parent span
 */
export const createChildSpan = (
  name: string,
  traceId: string,
  parentSpanId: string,
  scope?: string,
  attributes?: Record<string, string>,
  createdAt?: Date,
) => ({
  id: `span-${randomUUID()}`,
  parentSpanId,
  traceId,
  name,
  scope,
  kind: 0,
  status: JSON.stringify({ code: 'success' }),
  events: JSON.stringify([{ name: 'start', timestamp: Date.now() }]),
  links: JSON.stringify([]),
  attributes: attributes ? attributes : undefined,
  startTime: (createdAt || new Date()).getTime(),
  endTime: (createdAt || new Date()).getTime(),
  other: JSON.stringify({ custom: 'data' }),
  createdAt: createdAt || new Date(),
});

/**
 * Creates a complete trace with a root span and multiple child spans
 */
export const createTraceWithSpans = (
  traceId: string,
  rootSpanName: string,
  childSpanNames: string[],
  scope?: string,
  attributes?: Record<string, string>,
  createdAt?: Date,
) => {
  const rootSpan = createRootSpan(rootSpanName, traceId, scope, attributes, createdAt);

  const childSpans = childSpanNames.map(name =>
    createChildSpan(name, traceId, rootSpan.id, scope, attributes, createdAt),
  );

  return {
    traceId,
    rootSpan,
    childSpans,
    allSpans: [rootSpan, ...childSpans],
  };
};

export const findRootSpan = (spans: any[]) => spans.find(s => s.parentSpanId === null);

export const findSpansByParentId = (spans: any[], parentId: string | null) =>
  spans.filter(s => s.parentSpanId === parentId);

export const findSpanByName = (spans: any[], name: string) => spans.find(s => s.name === name);

export const setupMultiSpanTestData = () => {
  const scope = 'libsql-get-trace-test';
  const traceId = 'test-trace-123';

  const multiSpanTrace = createTraceWithSpans(traceId, 'root-span', ['child-span-1', 'child-span-2'], scope);

  return { traceId, spans: multiSpanTrace.allSpans };
};

export const setupSingleSpanTestData = () => {
  const scope = 'libsql-single-span-trace';
  const traceId = 'single-span-trace';
  const span = createRootSpan('single-span', traceId, scope);

  return { traceId, span };
};

export const setupNestedTestData = () => {
  const traceId = 'nested-trace-456';
  const scope = 'libsql-nested-trace';

  const rootSpan = createRootSpan('api-request', traceId, scope);
  const childSpan1 = createChildSpan('database-query', traceId, rootSpan.id, scope);
  const childSpan2 = createChildSpan('external-api-call', traceId, rootSpan.id, scope);
  const grandchildSpan = createChildSpan('cache-lookup', traceId, childSpan1.id, scope);

  return {
    traceId,
    spans: [rootSpan, childSpan1, childSpan2, grandchildSpan],
  };
};
