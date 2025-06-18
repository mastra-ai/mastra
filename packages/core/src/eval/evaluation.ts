import type { Agent } from '../agent';
import { MastraError, ErrorCategory, ErrorDomain } from '../error';
import { AvailableHooks, executeHook } from '../hooks';
import type { Metric } from './metric';
import type { TestInfo, EvaluationResult } from './types';

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
  testInfo?: TestInfo;
  instructions: string;
}): Promise<EvaluationResult> {
  const runIdToUse = runId || crypto.randomUUID();

  let metricResult;
  let metricName = metric.constructor.name;
  try {
    metricResult = await metric.measure(input.toString(), output);
  } catch (e: unknown) {
    throw new MastraError(
      {
        id: 'EVAL_METRIC_MEASURE_EXECUTION_FAILED',
        domain: ErrorDomain.EVAL,
        category: ErrorCategory.USER,
        details: {
          agentName,
          metricName,
          globalRunId,
        },
      },
      e,
    );
  }
  const traceObject = {
    input: input.toString(),
    output: output,
    result: metricResult,
    agentName,
    metricName,
    instructions,
    globalRunId,
    runId: runIdToUse,
    testInfo,
  };

  try {
    executeHook(AvailableHooks.ON_EVALUATION, traceObject);
  } catch (e: unknown) {
    throw new MastraError(
      {
        id: 'EVAL_HOOK_EXECUTION_FAILED',
        domain: ErrorDomain.EVAL,
        category: ErrorCategory.USER,
        details: {
          agentName,
          metricName,
          globalRunId,
        },
      },
      e,
    );
  }

  return { ...metricResult, output };
}
