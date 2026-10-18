import { it, expect, vi } from 'vitest';
import { GOAL_SCORE_WAITING, GOAL_SCORER_ID } from '../../../../agent/goal';
import { MockMemory } from '../../../../memory/mock';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import type { EngineVariant } from '../types';

const getMock = useLoopScenarioAimock();

const RESOURCE = 'user-1';

function resetMock() {
  const llm = getMock();
  llm.clearFixtures();
  llm.clearRequests();
  llm.resetMatchCounts();
}

async function runTurn(opts: {
  engine: EngineVariant;
  shared: { agent: any; mastra: any };
  memory: MockMemory;
  threadId: string;
  prompt: string;
  objective?: string;
}) {
  resetMock();
  return runLoopScenario({
    engine: opts.engine,
    llm: getMock(),
    sharedAgent: opts.shared,
    prompt: opts.prompt,
    memory: opts.memory,
    threadId: opts.threadId,
    resourceId: RESOURCE,
    objective: opts.objective,
    maxSteps: 10,
    collectChunks: true,
    fixtures: llm => {
      llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'Attempt 1.' });
      llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Attempt 2.' });
      llm.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'Attempt 3.' });
      llm.on({ endpoint: 'chat', sequenceIndex: 3 }, { content: 'Attempt 4.' });
    },
  });
}

function goalResults(chunks: any[] | undefined) {
  return (chunks ?? []).filter((c: any) => c.type === 'goal' && !c.payload?.pending) as any[];
}

describeForAllEngines(
  'AIMock loop scenario: goal budget across runs',
  engine => {
    const itFailsOnInngest = engine === 'inngest' ? it.fails : it;
    // Inngest's agentic loop has no isTaskComplete, goal, or onIterationComplete steps yet.

    itFailsOnInngest('parks an objective left active at the run budget when a later run re-enters', async () => {
      const THREAD = 'goal-reentry-waiting-thread';
      // A waiting verdict on the last budgeted run leaves the record active (waiting is
      // per-turn display state). Only the built-in scorer id may signal waiting.
      const scorer = {
        id: GOAL_SCORER_ID,
        name: 'Goal Scorer',
        run: vi.fn().mockResolvedValue({ score: GOAL_SCORE_WAITING, reason: 'waiting for your review' }),
      };
      const memory = new MockMemory();
      const shared = await createSharedAgent(getMock(), {
        engine,
        memory,
        goal: { judge: 'gpt-4', maxRuns: 1, scorer: scorer as any },
      });

      const first = await runTurn({
        engine,
        shared,
        memory,
        threadId: THREAD,
        prompt: 'Build a spaceship',
        objective: 'Build a spaceship',
      });
      expect(scorer.run).toHaveBeenCalledTimes(1);
      const afterFirst = await first.agent.getObjective({ threadId: THREAD });
      expect(afterFirst).toMatchObject({ status: 'active', runsUsed: 1 });

      const second = await runTurn({ engine, shared, memory, threadId: THREAD, prompt: 'keep going' });

      // The budget guard parks the record without judging again.
      expect(scorer.run).toHaveBeenCalledTimes(1);
      const results = goalResults(second.chunks);
      expect(results).toHaveLength(1);
      expect(results[0].payload).toMatchObject({
        objective: 'Build a spaceship',
        passed: false,
        status: 'paused',
        maxRunsReached: true,
      });
      const afterSecond = await second.agent.getObjective({ threadId: THREAD });
      expect(afterSecond).toMatchObject({ status: 'paused', runsUsed: 1 });
    });

    itFailsOnInngest('does not re-score a budget-exhausted (paused) objective on a later run', async () => {
      const THREAD = 'goal-reentry-paused-thread';
      const scorer = { id: 'never', name: 'Never', run: vi.fn().mockResolvedValue({ score: 0, reason: 'not yet' }) };
      const memory = new MockMemory();
      const shared = await createSharedAgent(getMock(), {
        engine,
        memory,
        goal: { judge: 'gpt-4', maxRuns: 2, scorer: scorer as any },
      });

      const first = await runTurn({
        engine,
        shared,
        memory,
        threadId: THREAD,
        prompt: 'Reach the goal',
        objective: 'Reach the goal',
      });
      expect(scorer.run).toHaveBeenCalledTimes(2);
      expect(await first.agent.getObjective({ threadId: THREAD })).toMatchObject({ status: 'paused', runsUsed: 2 });

      const second = await runTurn({ engine, shared, memory, threadId: THREAD, prompt: 'try again' });

      expect(scorer.run).toHaveBeenCalledTimes(2);
      expect(goalResults(second.chunks)).toHaveLength(0);
      expect(second.requests).toHaveLength(1);
      expect(await second.agent.getObjective({ threadId: THREAD })).toMatchObject({ status: 'paused', runsUsed: 2 });
    });

    itFailsOnInngest('resumes scoring when maxRuns is raised and the objective is set back to active', async () => {
      const THREAD = 'goal-reentry-resume-thread';
      const scorer = { id: 'never', name: 'Never', run: vi.fn().mockResolvedValue({ score: 0, reason: 'not yet' }) };
      const memory = new MockMemory();
      const shared = await createSharedAgent(getMock(), {
        engine,
        memory,
        goal: { judge: 'gpt-4', maxRuns: 1, scorer: scorer as any },
      });

      const first = await runTurn({
        engine,
        shared,
        memory,
        threadId: THREAD,
        prompt: 'Reach the goal',
        objective: 'Reach the goal',
      });
      expect(scorer.run).toHaveBeenCalledTimes(1);
      expect(await first.agent.getObjective({ threadId: THREAD })).toMatchObject({ status: 'paused', runsUsed: 1 });

      await first.agent.updateObjectiveOptions({ threadId: THREAD, maxRuns: 3, status: 'active' });

      const second = await runTurn({ engine, shared, memory, threadId: THREAD, prompt: 'keep going' });

      // Two more runs fit in the raised budget, then it pauses again.
      expect(scorer.run).toHaveBeenCalledTimes(3);
      const results = goalResults(second.chunks);
      expect(results).toHaveLength(2);
      expect(results.at(-1).payload).toMatchObject({ maxRunsReached: true, status: 'paused' });
      expect(await second.agent.getObjective({ threadId: THREAD })).toMatchObject({ status: 'paused', runsUsed: 3 });
    });
  },
  {},
);
