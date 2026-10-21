/**
 * AIMock Scenario: live scorers supplied per call or via defaultOptions (#27579)
 *
 * A scorer passed in `stream()`/`generate()` options, or in the agent's
 * `defaultOptions.scorers`, is registered neither on the agent nor on Mastra.
 * It must still run after the call on every engine — the scorer object the
 * caller handed over is the one that runs, not a lookup by id that misses.
 */

import { expect, it, vi } from 'vitest';
import type { AgentExecutionOptions } from '../../../../agent/agent.types';
import { createScorer } from '../../../../evals';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  useLoopScenarioAimock,
} from '../aimock-scenario';

const REPLY = 'Scored reply.';

function recordingScorer(id: string) {
  const runs: Array<{ runId?: string }> = [];
  const scorer = createScorer({ id, name: id, description: `records ${id} runs` }).generateScore(({ run }) => {
    runs.push({ runId: run.runId });
    return 1;
  });
  return { scorer, runs };
}

// The harness types defaultOptions narrowly but forwards it verbatim to the Agent.
const scorerDefaults = (scorers: AgentExecutionOptions['scorers']): AgentExecutionOptions => ({ scorers });

describeForAllEngines('AIMock loop scenario: call-time and defaultOptions scorers', engine => {
  const getMock = useLoopScenarioAimock();

  async function streamToEnd(agent: any, options?: AgentExecutionOptions) {
    const result = await agent.stream('Hello.', options);
    const output = isDurableEngineVariant(engine) ? result.output : result;
    expect(await output.text).toBe(REPLY);
    result.cleanup?.();
    return result.runId as string;
  }

  it('runs a scorer passed at call time that is registered nowhere else', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: REPLY });
    const { scorer, runs } = recordingScorer('call-time-only-scorer');
    const { agent } = await createSharedAgent(llm, { engine });

    const runId = await streamToEnd(agent, { scorers: { callTime: { scorer } } });

    await vi.waitFor(() => expect(runs).toHaveLength(1));
    expect(runs[0]!.runId).toBe(runId);
  });

  it('runs a scorer from defaultOptions.scorers that is registered nowhere else', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: REPLY });
    const { scorer, runs } = recordingScorer('default-options-only-scorer');
    const { agent } = await createSharedAgent(llm, {
      engine,
      defaultOptions: scorerDefaults({ fromDefaults: { scorer } }),
    });

    const runId = await streamToEnd(agent);

    await vi.waitFor(() => expect(runs).toHaveLength(1));
    expect(runs[0]!.runId).toBe(runId);
  });
});
