import type { Agent } from '../agent';
import { AvailableHooks, executeHook } from '../hooks';

import type { Metric } from './metric';

export async function evaluate<T extends Agent>({
  agentName,
  input,
  metric,
  output,
  runId,
  globalRunId,
  testInfo,
  instructions,
}: {
  agentName: string;
  input: Parameters<T['generate']>[0];
  metric: Metric;
  output: string;
  globalRunId: string;
  runId?: string;
  testInfo?: {
    testName: string;
    testPath: string;
  };
  instructions: string;
}) {
  const runIdToUse = runId || crypto.randomUUID();

  const metricResult = await metric.measure(input.toString(), output);
  const traceObject = {
    input: input.toString(),
    output: output,
    result: metricResult,
    agentName,
    metricName: metric.constructor.name,
    instructions,
    globalRunId,
    runId: runIdToUse,
    testInfo,
  };

  executeHook(AvailableHooks.ON_EVALUATION, traceObject);

  return metricResult;
}
