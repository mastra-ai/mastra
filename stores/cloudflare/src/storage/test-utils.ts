import { randomUUID } from 'crypto';

export const createSampleTrace = (name: string, scope?: string, attributes?: Record<string, string>) => ({
  id: `trace-${randomUUID()}`,
  parentSpanId: `span-${randomUUID()}`,
  traceId: `trace-${randomUUID()}`,
  name,
  scope,
  kind: 'internal',
  status: JSON.stringify({ code: 'success' }),
  events: JSON.stringify([{ name: 'start', timestamp: Date.now() }]),
  links: JSON.stringify([]),
  attributes: attributes ? JSON.stringify(attributes) : undefined,
  startTime: new Date().toISOString(),
  endTime: new Date().toISOString(),
  other: JSON.stringify({ custom: 'data' }),
  createdAt: new Date().toISOString(),
});
