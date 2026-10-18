import { it, expect, vi } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

const getMock = useLoopScenarioAimock();

describeForAllEngines(
  'AIMock loop scenario: goal gate overrides isTaskComplete',
  engine => {
    const itFailsOnInngest = engine === 'inngest' ? it.fails : it;
    // Inngest's agentic loop has no isTaskComplete, goal, or onIterationComplete steps yet.
    itFailsOnInngest('an incomplete goal keeps the loop running past an isTaskComplete pass', async () => {
      const THREAD = 'goal-overrides-itc-thread';
      // isTaskComplete passes immediately (would normally end the loop), but the
      // goal is never complete, so the goal step keeps the loop running until maxRuns.
      const taskScorer = {
        id: 'task-scorer',
        name: 'Task Scorer',
        run: vi.fn().mockResolvedValue({ score: 1, reason: 'task done' }),
      };
      const goalScorer = {
        id: 'goal-scorer',
        name: 'Goal Scorer',
        run: vi.fn().mockResolvedValue({ score: 0, reason: 'goal not yet' }),
      };

      const { agent, chunks, requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Keep going',
        memory: new MockMemory(),
        threadId: THREAD,
        resourceId: 'user-1',
        goal: { judge: 'gpt-4', maxRuns: 2, scorer: goalScorer as any },
        objective: 'Keep going',
        isTaskComplete: { scorers: [taskScorer as any] },
        maxSteps: 10,
        collectChunks: true,
        fixtures: llm => {
          llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'First attempt.' });
          llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Second attempt.' });
          llm.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'Third attempt.' });
        },
      });

      const taskChunks = (chunks ?? []).filter((c: any) => c.type === 'is-task-complete') as any[];
      const resultChunks = (chunks ?? []).filter((c: any) => c.type === 'goal' && !c.payload?.pending) as any[];

      // isTaskComplete reported complete...
      expect(taskChunks.some(c => c.payload.passed === true)).toBe(true);
      // ...but the goal gate overrode it and drove the loop to the run budget.
      expect(requests).toHaveLength(2);
      expect(goalScorer.run).toHaveBeenCalledTimes(2);
      expect(resultChunks).toHaveLength(2);
      expect(resultChunks.at(-1).payload).toMatchObject({ maxRunsReached: true, status: 'paused' });

      const record = await agent.getObjective({ threadId: THREAD });
      expect(record?.runsUsed).toBe(2);
      expect(record?.status).toBe('paused');
    });
  },
  {},
);
