import { AvailableHooks, executeHook } from '@mastra/core';
import { type Agent, type Metric } from '@mastra/core';

import { GLOBAL_RUN_ID_ENV_KEY } from './constants';

export async function evaluate<T extends Agent>(agent: T, input: Parameters<T['generate']>[0], metric: Metric) {
  const testInfo = await getCurrentTestInfo();
  let globalRunId = process.env[GLOBAL_RUN_ID_ENV_KEY];
  const runId = crypto.randomUUID();
  const agentOutput = await agent.generate(input, {
    runId,
  });

  if (!globalRunId) {
    globalRunId = process.env[GLOBAL_RUN_ID_ENV_KEY] = crypto.randomUUID();
    console.warn('Global run id not set, you should run "globalSetup" from "@mastra/evals" before evaluating.');
  }

  const metricResult = await metric.measure({
    input: input.toString(),
    output: agentOutput.text,
  });
  const traceObject = {
    input: input.toString(),
    output: agentOutput.text,
    result: metricResult,
    meta: {
      ...testInfo,
      globalRunId,
      testId: runId,
      agentName: agent.name,
      timestamp: new Date().toISOString(),
      metricName: metric.constructor.name,
    },
  };

  // capture infomration about the evaluation
  executeHook(AvailableHooks.ON_EVALUATION, traceObject);

  return metricResult;
}

export const getCurrentTestInfo = async () => {
  // Jest
  if (typeof expect !== 'undefined' && expect.getState) {
    const state = expect.getState();
    return {
      testName: state.currentTestName,
      testPath: state.testPath,
    };
  }

  try {
    const vitest = await import('vitest');
    if (typeof vitest !== 'undefined' && vitest.expect?.getState) {
      const state = vitest.expect.getState();
      return {
        testName: state.currentTestName,
        testPath: state.testPath,
      };
    }
  } catch {}

  return {
    testName: null,
    testPath: null,
  };
};
