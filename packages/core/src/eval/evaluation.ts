import { type Agent } from '../agent';
import { AvailableHooks, executeHook } from '../hooks';

import { type Metric } from './metric';

export async function evaluate<T extends Agent>({
  agentName,
  input,
  metric,
  output,
  runId,
  testInfo,
}: {
  agentName: string;
  input: Parameters<T['generate']>[0];
  metric: Metric;
  output: string;
  runId?: string;
  testInfo?: {
    testName?: string;
    testPath?: string;
  } | null;
}) {
  const runIdToUse = runId || crypto.randomUUID();

  const metricResult = await metric.measure({
    input: input.toString(),
    output: output,
  });
  const traceObject = {
    input: input.toString(),
    output: output,
    result: metricResult,
    meta: {
      ...(testInfo && {
        testName: testInfo.testName,
        testPath: testInfo.testPath,
      }),
      runId: runIdToUse,
      agentName,
      timestamp: new Date().toISOString(),
      metricName: metric.constructor.name,
    },
  };

  executeHook(AvailableHooks.ON_EVALUATION, traceObject);

  return metricResult;
}
