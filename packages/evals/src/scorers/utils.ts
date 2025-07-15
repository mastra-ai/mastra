import type { ScoringRun } from '@mastra/core';

export const roundToTwoDecimals = (num: number) => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

export function isCloserTo(value: number, target1: number, target2: number): boolean {
  return Math.abs(value - target1) < Math.abs(value - target2);
}

export type TestCase = {
  input: string;
  output: string;
  expectedResult: {
    score: number;
    reason?: string;
  };
};

export type TestCaseWithContext = TestCase & {
  context: string[];
};

export const createTestRun = (input: string, output: string, context?: string[]): ScoringRun => {
  return {
    runId: 'test-run-id',
    traceId: 'test-trace-id',
    scorer: {},
    input: [{ role: 'user', content: input }],
    output: { role: 'assistant', text: output },
    metadata: {},
    additionalContext: { context },
    resourceId: 'test-resource-id',
    threadId: 'test-thread-id',
    source: 'LIVE',
    entity: {},
    entityType: 'AGENT',
    runtimeContext: {},
    structuredOutput: false,
  };
};
