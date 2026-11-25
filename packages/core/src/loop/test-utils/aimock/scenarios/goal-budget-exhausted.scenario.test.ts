import { it, expect } from 'vitest';
import { useLoopScenarioAimock, runLoopScenario, describeForAllEngines } from '../aimock-scenario';
import { MockMemory } from '../../../../memory/mock';

const getMock = useLoopScenarioAimock();

describeForAllEngines(
  'AIMock loop scenario: goal budget exhausted',
  engine => {
    it('maxRuns reached, goal chunk emitted with budget exhausted, objective stays paused', async () => {
      const memory = new MockMemory();
      const THREAD = 'goal-budget-thread-1';
      const RESOURCE = 'user-1';

      // Custom scorer that always fails (score = 0).
      const failingScorer = {
        id: 'goal-scorer',
        name: 'Goal Scorer',
        run: async () => ({ score: 0, reason: 'Goal not yet achieved' }),
      };

      const { agent, chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Implement feature X',
        memory,
        threadId: THREAD,
        resourceId: RESOURCE,
        goal: {
          judge: 'gpt-4',
          maxRuns: 2, // Small budget to exhaust quickly
          scorer: failingScorer as any,
        },
        objective: 'Implement feature X',
        collectChunks: true,
        stopWhen: ({ step }: { step: number }) => step > 5, // Safety limit
        fixtures: llm => {
          // Each turn: model produces a response but goal is never satisfied.
          llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'I started working on feature X.' });
          llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'I made more progress on feature X.' });
          llm.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'Still working on feature X.' });
          llm.on({ endpoint: 'chat', sequenceIndex: 3 }, { content: 'Continuing work on feature X.' });
        },
      });

      // Collect goal chunks from the stream.
      const goalChunks: any[] = [];
      if (chunks) {
        for (const chunk of chunks) {
          if (chunk.type === 'goal' && !chunk.payload?.pending) {
            goalChunks.push(chunk);
          }
        }
      }

      // Goal chunks should be emitted with budget exhausted.
      expect(goalChunks.length).toBeGreaterThan(0);

      // At least one chunk should indicate budget exhaustion.
      const budgetExhaustedChunk = goalChunks.find(c => c.payload?.maxRunsReached === true);
      expect(budgetExhaustedChunk).toBeDefined();
      expect(budgetExhaustedChunk.payload).toMatchObject({
        objective: 'Implement feature X',
        passed: false,
        status: 'paused',
        maxRunsReached: true,
      });

      // Verify objective is marked as paused (not done).
      const record = await agent.getObjective({ threadId: THREAD });
      expect(record?.status).toBe('paused');
      expect(record?.runsUsed).toBe(2); // Should match maxRuns
    });
  },
  {},
);
