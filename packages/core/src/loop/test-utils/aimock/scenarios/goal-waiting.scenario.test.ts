import { it, expect, vi } from 'vitest';
import { GOAL_SCORE_WAITING, GOAL_SCORER_ID } from '../../../../agent/goal';
import { MockMemory } from '../../../../memory/mock';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

const getMock = useLoopScenarioAimock();

describeForAllEngines(
  'AIMock loop scenario: goal waiting for the user',
  engine => {
    const itFailsOnInngest = engine === 'inngest' ? it.fails : it;
    // Inngest's agentic loop has no isTaskComplete, goal, or onIterationComplete steps yet.
    itFailsOnInngest('a waiting verdict stops the loop after one run and leaves the objective active', async () => {
      const THREAD = 'goal-waiting-thread';
      // Only the built-in goal scorer's id is allowed to signal "waiting"; reuse it so
      // this runs on every engine without scripting the default judge's model calls.
      const scorer = {
        id: GOAL_SCORER_ID,
        name: 'Goal Scorer',
        run: vi.fn().mockResolvedValue({ score: GOAL_SCORE_WAITING, reason: 'waiting for your review' }),
      };

      const { agent, chunks, requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Draft the plan and wait for my review',
        memory: new MockMemory(),
        threadId: THREAD,
        resourceId: 'user-1',
        goal: { judge: 'gpt-4', maxRuns: 5, scorer: scorer as any },
        objective: 'Ship the plan after review',
        maxSteps: 10,
        collectChunks: true,
        fixtures: llm => {
          llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'Here is the plan. Please review it.' });
          llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Continuing without review.' });
        },
      });

      const resultChunks = (chunks ?? []).filter((c: any) => c.type === 'goal' && !c.payload?.pending) as any[];

      // The loop must not auto-continue past a waiting checkpoint.
      expect(requests).toHaveLength(1);
      expect(scorer.run).toHaveBeenCalledTimes(1);
      expect(resultChunks).toHaveLength(1);
      expect(resultChunks[0].payload).toMatchObject({
        objective: 'Ship the plan after review',
        iteration: 1,
        passed: false,
        status: 'active',
        waitingForUser: true,
        reason: 'waiting for your review',
      });

      const record = await agent.getObjective({ threadId: THREAD });
      expect(record?.status).toBe('active');
      expect(record?.runsUsed).toBe(1);
    });
  },
  {},
);
