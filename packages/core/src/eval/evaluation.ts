import { type Agent } from '../agent';
import { AvailableHooks, executeHook } from '../hooks';

import { type Metric } from './metric';

export async function evaluate<T extends Agent>(agent: T, input: Parameters<T['generate']>[0], metric: Metric) {
  const agentOutput = await agent.generate(input);

  const metricResult = await metric.measure({
    input: input.toString(),
    output: agentOutput.text,
  });

  // capture infomration about the evaluation
  executeHook(AvailableHooks.ON_EVALUATION, {
    input: input.toString(),
    output: agentOutput.text,
    result: metricResult,
  });

  return metricResult;
}
