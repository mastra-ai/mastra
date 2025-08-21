import { randomUUID } from 'crypto';

export const createSampleTraceForDB = (
  name: string,
  scope?: string,
  attributes?: Record<string, string>,
  createdAt?: Date,
) => ({
  id: `trace-${randomUUID()}`,
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
