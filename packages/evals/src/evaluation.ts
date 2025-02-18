import { evaluate as coreEvaluate } from '@mastra/core';
import type { Metric } from '@mastra/core';
import type { Agent } from '@mastra/core/agent';

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

  const metricResult = await coreEvaluate({
    agentName: agent.name,
    input,
    metric,
    output: agentOutput.text,
    globalRunId,
    runId,
    testInfo,
    instructions: agent.instructions,
  });

  return metricResult;
}

export const getCurrentTestInfo = async () => {
  // Jest
  // @ts-ignore
  if (typeof expect !== 'undefined' && expect.getState) {
    // @ts-ignore
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

  return undefined;
};
