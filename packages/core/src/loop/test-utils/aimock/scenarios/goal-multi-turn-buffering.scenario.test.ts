import { it, expect } from 'vitest';
import { useLoopScenarioAimock, runLoopScenario, describeForAllEngines } from '../aimock-scenario';
import { MockMemory } from '../../../../memory/mock';

const getMock = useLoopScenarioAimock();

describeForAllEngines(
  'AIMock loop scenario: goal multi-turn buffering',
  engine => {
    it('continuing evaluations carry shouldContinue and bound buffering while the terminal turn is preserved', async () => {
      const memory = new MockMemory();
      const THREAD = 'goal-buffering-thread-1';
      const RESOURCE = 'user-1';

      // Scorer that fails twice (continue) and passes on the third evaluation
      // (terminal), producing the normal continuing → terminal sequence.
      let evaluations = 0;
      const scorer = {
        id: 'goal-scorer',
        name: 'Goal Scorer',
        run: async () => {
          evaluations += 1;
          return evaluations < 3
            ? { score: 0, reason: 'Goal not yet achieved' }
            : { score: 1, reason: 'Goal achieved' };
        },
      };

      const { output, agent, chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Implement feature X',
        memory,
        threadId: THREAD,
        resourceId: RESOURCE,
        goal: {
          judge: 'gpt-4',
          maxRuns: 5,
          scorer: scorer as any,
        },
        objective: 'Implement feature X',
        collectChunks: true,
        stopWhen: ({ step }: { step: number }) => step > 8, // Safety limit
        fixtures: llm => {
          llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'I started working on feature X.' });
          llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'I made more progress on feature X.' });
          llm.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'Feature X is now complete.' });
        },
      });

      // Final (non-pending) goal evaluations carry the goal gate's explicit
      // continuation decision.
      const goalChunks: any[] = (chunks ?? []).filter((c: any) => c.type === 'goal' && !c.payload?.pending);
      expect(goalChunks.map((c: any) => c.payload.shouldContinue)).toEqual([true, true, false]);
      expect(goalChunks[2].payload).toMatchObject({ passed: true, status: 'done' });

      // Run-lifetime buffers were truncated at each continuing evaluation, but
      // the terminal evaluation preserved the final turn: run-end results
      // cover the last iteration, not the whole run and not an empty run.
      const fullOutput = await output.getFullOutput();
      expect(fullOutput.steps).toHaveLength(1);
      expect(fullOutput.text).toBe('Feature X is now complete.');

      const record = await agent.getObjective({ threadId: THREAD });
      expect(record?.status).toBe('done');
      expect(record?.runsUsed).toBe(3);
    });
  },
  {},
);
