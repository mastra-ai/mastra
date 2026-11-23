import { it, expect } from 'vitest';
import { useLoopScenarioAimock, runLoopScenario, describeForAllEngines } from '../aimock-scenario';
import { MockMemory } from '../../../../memory/mock';

const getMock = useLoopScenarioAimock();

describeForAllEngines(
  'AIMock loop scenario: goal satisfied',
  engine => {
    it('judge marks objective satisfied, goal chunk emitted with passed=true', async () => {
      const memory = new MockMemory();
      const THREAD = 'goal-thread-1';
      const RESOURCE = 'user-1';

      // Custom scorer that always passes (score = 1).
      const passingScorer = {
        id: 'goal-scorer',
        name: 'Goal Scorer',
        run: async () => ({ score: 1, reason: 'Goal achieved' }),
      };

      const { output, agent, chunks } = await runLoopScenario({
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

      // Collect goal chunks from the stream.
      const goalChunks: any[] = [];
      if (chunks) {
        for (const chunk of chunks) {
          if (chunk.type === 'goal' && !chunk.payload?.pending) {
            goalChunks.push(chunk);
          }
        }
      }

      // Goal chunk should be emitted with passed=true.
      expect(goalChunks.length).toBeGreaterThan(0);
      expect(goalChunks[0].payload).toMatchObject({
        objective: 'Implement feature X',
        passed: true,
        status: 'done',
      });

      // Verify objective is marked as done.
      const record = await agent.getObjective({ threadId: THREAD });
      expect(record?.status).toBe('done');
      expect(record?.runsUsed).toBe(1);
    });
  },
  {},
);
