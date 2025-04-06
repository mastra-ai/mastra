import type { Agent } from '../agent';
import { AvailableHooks, executeHook } from '../hooks';
import type { Evaluator, EvaluationResult } from './evaluator';
import { Metric } from './metric';
import type { TestInfo } from './types';

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
  metric: Metric | Evaluator;
  output: string;
  globalRunId: string;
  runId?: string;
  testInfo?: TestInfo;
  instructions: string;
}): Promise<EvaluationResult> {
  const runIdToUse = runId || crypto.randomUUID();

  let metricResult;

  if (metric instanceof Metric) {
    metricResult = await metric.measure(input.toString(), output);
  } else {
    metricResult = await metric.score({ input: input.toString(), output });
  }

  console.log('metricResult', metricResult);

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

  console.log('traceObject', traceObject);

  executeHook(AvailableHooks.ON_EVALUATION, traceObject);

  return { ...metricResult, output };
}
