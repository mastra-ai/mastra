import { spanRecordSchema } from '@mastra/core/storage';

export function createTraceDetails(input: unknown, output: unknown) {
  const timestamp = new Date('2026-07-16T12:00:00.000Z');

  return spanRecordSchema.parse({
    traceId: 'trace-1',
    spanId: 'span-1',
    name: 'Agent run',
    spanType: 'agent_run',
    isEvent: false,
    startedAt: timestamp,
    endedAt: timestamp,
    input,
    output,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}
