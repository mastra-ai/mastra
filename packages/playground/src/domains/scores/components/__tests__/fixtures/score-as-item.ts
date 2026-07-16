import { scoreRowDataSchema } from '@mastra/core/evals';

export function createScore(input: unknown, output: unknown) {
  const timestamp = new Date('2026-07-16T12:00:00.000Z');

  return scoreRowDataSchema.parse({
    id: 'score-1',
    scorerId: 'scorer-1',
    entityId: 'agent-1',
    runId: 'run-1',
    input,
    output,
    score: 1,
    scorer: {},
    source: 'LIVE',
    entity: {},
    traceId: 'trace-1',
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}
