import { type Agent } from '../agent';
import { AvailableHooks, executeHook } from '../hooks';
import { type Mastra } from '../mastra';
import { MastraStorage } from '../storage';

import { type Metric } from './metric';

export async function evaluate<T extends Agent>({
  mastra,
  agentName,
  input,
  metric,
  output,
  runId,
  globalRunId,
  testInfo,
}: {
  mastra: Mastra;
  agentName: string;
  input: Parameters<T['generate']>[0];
  metric: Metric;
  output: string;
  globalRunId: string;
  runId?: string;
  testInfo?: {
    testName?: string;
    testPath?: string;
  } | null;
}) {
  const runIdToUse = runId || crypto.randomUUID();

  const metricResult = await metric.measure(input.toString(), output);
  const traceObject = {
    input: input.toString(),
    output: output,
    result: metricResult,
    meta: {
      ...(testInfo && {
        testName: testInfo.testName,
        testPath: testInfo.testPath,
      }),
      globalRunId,
      runId: runIdToUse,
      agentName,
      timestamp: new Date().toISOString(),
      metricName: metric.constructor.name,
    },
  };

  if (mastra?.memory?.storage) {
    await mastra.memory.storage.insert({
      tableName: MastraStorage.TABLE_EVALS,
      record: {
        result: JSON.stringify(traceObject.result),
        meta: JSON.stringify(traceObject.meta),
        input: traceObject.input,
        output: traceObject.output,
        createdAt: new Date().toISOString(),
      },
    });
  }

  executeHook(AvailableHooks.ON_EVALUATION, traceObject);

  return metricResult;
}
