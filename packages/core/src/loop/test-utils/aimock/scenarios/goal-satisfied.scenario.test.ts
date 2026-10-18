import { it, expect, vi } from 'vitest';
import { useLoopScenarioAimock, runLoopScenario, describeForAllEngines } from '../aimock-scenario';
import { MockMemory } from '../../../../memory/mock';

const getMock = useLoopScenarioAimock();

describeForAllEngines(
  'AIMock loop scenario: goal satisfied',
  engine => {
    const itFailsOnInngest = engine === 'inngest' ? it.fails : it;
    // Inngest's agentic loop has no isTaskComplete, goal, or onIterationComplete steps yet.
    itFailsOnInngest('judge marks objective satisfied, goal chunk emitted with passed=true', async () => {
      const memory = new MockMemory();
      const THREAD = 'goal-thread-1';
      const RESOURCE = 'user-1';

      // Custom scorer that always passes (score = 1).
      const passingScorer = {
        id: 'goal-scorer',
        name: 'Goal Scorer',
        run: vi.fn().mockResolvedValue({ score: 1, reason: 'Goal achieved' }),
      };

      const { agent, chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Implement feature X',
        memory,
        threadId: THREAD,
        resourceId: RESOURCE,
        goal: {
          judge: 'gpt-4', // Judge model ID (not actually called, scorer handles evaluation)
          maxRuns: 5,
          scorer: passingScorer as any,
        },
        objective: 'Implement feature X',
        collectChunks: true,
        fixtures: llm => {
          // Initial turn: model produces a response.
          llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'I have implemented feature X.' });
        },
      });

      const goalChunks = (chunks ?? []).filter((c: any) => c.type === 'goal' && !c.payload?.pending) as any[];

      expect(passingScorer.run).toHaveBeenCalledTimes(1);
      expect(goalChunks).toHaveLength(1);
      // Lock the public `goal` chunk payload shape (consumed by the TUI + client-js).
      expect(goalChunks[0].payload).toMatchObject({
        objective: 'Implement feature X',
        iteration: 1,
        maxRuns: 5,
        passed: true,
        status: 'done',
        maxRunsReached: false,
        timedOut: false,
        suppressFeedback: false,
      });
      expect(Array.isArray(goalChunks[0].payload.results)).toBe(true);
      expect(typeof goalChunks[0].payload.duration).toBe('number');

      const record = await agent.getObjective({ threadId: THREAD });
      expect(record?.status).toBe('done');
      expect(record?.runsUsed).toBe(1);
    });

    itFailsOnInngest('resolves goal.judge from a resolver function and scores the objective', async () => {
      const THREAD = 'goal-thread-judge-fn';
      const RESOURCE = 'user-1';
      const judge = vi.fn(() => 'gpt-4');
      const passingScorer = {
        id: 'goal-scorer',
        name: 'Goal Scorer',
        run: vi.fn().mockResolvedValue({ score: 1, reason: 'Goal achieved' }),
      };

      const { agent, chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Implement feature X',
        memory: new MockMemory(),
        threadId: THREAD,
        resourceId: RESOURCE,
        goal: { judge: judge as any, maxRuns: 5, scorer: passingScorer as any },
        objective: 'Implement feature X',
        collectChunks: true,
        fixtures: llm => {
          llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'I have implemented feature X.' });
        },
      });

      const goalChunks = (chunks ?? []).filter((c: any) => c.type === 'goal' && !c.payload?.pending) as any[];

      expect(judge).toHaveBeenCalled();
      expect(passingScorer.run).toHaveBeenCalledTimes(1);
      expect(goalChunks).toHaveLength(1);
      expect(goalChunks[0].payload).toMatchObject({ passed: true, status: 'done' });
      expect((await agent.getObjective({ threadId: THREAD }))?.status).toBe('done');
    });
  },
  {},
);
