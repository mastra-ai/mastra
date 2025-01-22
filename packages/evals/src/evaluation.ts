import { AvailableHooks, executeHook } from '@mastra/core';
import { type Agent, type Metric } from '@mastra/core';

export async function evaluate<T extends Agent>(agent: T, input: Parameters<T['generate']>[0], metric: Metric) {
  const testInfo = getCurrentTestInfo();
  const runId = crypto.randomUUID();
  const agentOutput = await agent.generate(input, {
    runId,
  });

  const metricResult = await metric.measure({
    input: input.toString(),
    output: agentOutput.text,
  });
  const traceObject = {
    input: input.toString(),
    output: agentOutput.text,
    result: metricResult,
    meta: { ...testInfo, runId, agentName: agent.name },
  };

  // capture infomration about the evaluation
  executeHook(AvailableHooks.ON_EVALUATION, traceObject);

  return metricResult;
}

export const getCurrentTestInfo = () => {
  // Jest
  if (typeof expect !== 'undefined' && expect.getState) {
    const state = expect.getState();
    return {
      testName: state.currentTestName,
      testPath: state.testPath,
    };
  }

  return {
    testName: null,
    testPath: null,
  };
};
