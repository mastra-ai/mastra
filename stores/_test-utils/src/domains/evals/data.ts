import type { MetricResult } from '@mastra/core/eval';
import { randomUUID } from 'crypto';

export const createSampleEval = (agentName: string, isTest = false, createdAt?: Date) => {
  const testInfo = isTest ? { testPath: 'test/path.ts', testName: 'Test Name' } : undefined;

  return {
    agent_name: agentName,
    input: 'Sample input',
    output: 'Sample output',
    result: { score: 0.8 } as MetricResult,
    metric_name: 'sample-metric',
    instructions: 'Sample instructions',
    test_info: testInfo,
    global_run_id: `global-${randomUUID()}`,
    run_id: `run-${randomUUID()}`,
    created_at: createdAt || new Date(),
    createdAt: createdAt || new Date(),
  };
};
