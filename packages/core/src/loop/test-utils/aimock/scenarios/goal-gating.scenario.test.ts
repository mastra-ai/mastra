import { createOpenAI } from '@ai-sdk/openai-v5';
import { it, expect, vi } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

const getMock = useLoopScenarioAimock();

/**
 * Regression class: when the goal step runs, and when it must stay out of the way.
 *
 * - No active objective: the goal step emits nothing.
 * - An incomplete goal overrides an isTaskComplete pass and keeps the loop going.
 * - A goal parked at its run budget is not judged again on later runs.
 * - An objective left `active` at its budget (a `waiting` verdict) is parked by
 *   the next run instead of emitting a stale continuation.
 */
describeForAllEngines(
  'AIMock loop scenario: goal gating',
  engine => {
    const THREAD = 'goal-gating-thread';
    const RESOURCE = 'goal-gating-user';
    const scorer = (score: number) => ({
      id: 'goal-scorer',
      name: 'Goal Scorer',
      run: vi.fn(async () => ({ score, reason: score ? 'done' : 'not yet' })),
    });
    const resultGoalChunks = (chunks: any[] | undefined) =>
      (chunks ?? []).filter((c: any) => c.type === 'goal' && !c.payload?.pending);

    it('emits no goal chunk when there is no active objective', async () => {
      const goalScorer = scorer(1);
      const { chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'go',
        memory: new MockMemory(),
        threadId: THREAD,
        resourceId: RESOURCE,
        goal: { judge: 'gpt-4', scorer: goalScorer as any },
        collectChunks: true,
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'hello' });
        },
      });

      expect(resultGoalChunks(chunks)).toHaveLength(0);
      expect(goalScorer.run).not.toHaveBeenCalled();
    });

    it('an incomplete goal keeps the loop going past an isTaskComplete pass', async () => {
      const taskScorer = scorer(1);
      const goalScorer = scorer(0);
      const { agent, chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'go',
        memory: new MockMemory(),
        threadId: THREAD,
        resourceId: RESOURCE,
        goal: { judge: 'gpt-4', scorer: goalScorer as any, maxRuns: 2 },
        objective: 'Keep going',
        isTaskComplete: { scorers: [taskScorer as any] },
        collectChunks: true,
        stopWhen: ({ step }: { step: number }) => step > 5,
        fixtures: llm => {
          llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'first pass' });
          llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'second pass' });
        },
      });

      expect((chunks ?? []).some((c: any) => c.type === 'is-task-complete' && c.payload?.passed)).toBe(true);
      expect(goalScorer.run).toHaveBeenCalledTimes(2);
      const results = resultGoalChunks(chunks);
      expect(results).toHaveLength(2);
      expect(results.at(-1).payload.maxRunsReached).toBe(true);
      const record = await agent.getObjective({ threadId: THREAD });
      expect(record).toMatchObject({ status: 'paused', runsUsed: 2 });
    });

    it('does not judge a budget-exhausted goal again on a later run', async () => {
      const memory = new MockMemory();
      const goalScorer = scorer(0);
      const goal = { judge: 'gpt-4', scorer: goalScorer as any, maxRuns: 1 };
      const sharedAgent = await createSharedAgent(getMock(), { memory, goal, engine });
      await runLoopScenario({
        sharedAgent,
        engine,
        llm: getMock(),
        prompt: 'go',
        memory,
        threadId: THREAD,
        resourceId: RESOURCE,
        goal,
        objective: 'Unreachable goal',
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'tried' });
        },
      });
      expect(goalScorer.run).toHaveBeenCalledTimes(1);

      const { agent, chunks } = await runLoopScenario({
        sharedAgent,
        engine,
        llm: getMock(),
        prompt: 'again',
        memory,
        threadId: THREAD,
        resourceId: RESOURCE,
        goal,
        collectChunks: true,
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'tried again' });
        },
      });

      expect(goalScorer.run).toHaveBeenCalledTimes(1);
      expect(resultGoalChunks(chunks)).toHaveLength(0);
      expect(await agent.getObjective({ threadId: THREAD })).toMatchObject({ status: 'paused', runsUsed: 1 });
    });

    it('parks an objective left active at its budget when a later run re-enters the goal step', async () => {
      const llm = getMock();
      const judge = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` })(
        SCENARIO_MODEL_ID,
      );
      const memory = new MockMemory();
      const goal = { judge, maxRuns: 1 };
      const sharedAgent = await createSharedAgent(llm, { memory, goal, engine });
      await runLoopScenario({
        sharedAgent,
        engine,
        llm,
        prompt: 'go',
        memory,
        threadId: THREAD,
        resourceId: RESOURCE,
        goal,
        objective: 'Reach the goal',
        fixtures: llm => {
          llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'working' });
          llm.on(
            { endpoint: 'chat', sequenceIndex: 1 },
            { content: JSON.stringify({ decision: 'waiting', reason: 'waiting for your review' }) },
          );
        },
      });

      llm.clearRequests();
      llm.clearFixtures();
      llm.resetMatchCounts();
      const first = await runLoopScenario({
        sharedAgent,
        engine,
        llm,
        prompt: 'again',
        memory,
        threadId: THREAD,
        resourceId: RESOURCE,
        goal,
        collectChunks: true,
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'still here' });
        },
      });

      // Only the main model is called on the second run; the judge is not.
      expect(first.requests).toHaveLength(1);
      const results = resultGoalChunks(first.chunks);
      expect(results).toHaveLength(1);
      expect(results[0].payload).toMatchObject({
        objective: 'Reach the goal',
        passed: false,
        status: 'paused',
        maxRunsReached: true,
      });
      expect(results[0].payload.pausedReason).toContain('budget');
      expect(await first.agent.getObjective({ threadId: THREAD })).toMatchObject({ status: 'paused', runsUsed: 1 });
    });
  },
  {},
);
