import { it, expect, vi } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

const getMock = useLoopScenarioAimock();

const THREAD = 'goal-scorer-resolution-thread';
const RESOURCE = 'user-1';

function registrableScorer(id: string, name: string) {
  return {
    id,
    name,
    run: vi.fn().mockResolvedValue({ score: 1, reason: 'done' }),
    __registerMastra: vi.fn(),
  };
}

describeForAllEngines(
  'AIMock loop scenario: string goal.scorer resolution',
  engine => {
    const itFailsOnInngest = engine === 'inngest' ? it.fails : it;
    // Inngest's agentic loop has no isTaskComplete, goal, or onIterationComplete steps yet.

    async function runWithRegisteredScorer(scorerRef: string, scorers: Record<string, any>) {
      const llm = getMock();
      const shared = await createSharedAgent(llm, {
        engine,
        memory: new MockMemory(),
        goal: { judge: 'gpt-4', scorer: scorerRef },
      });
      for (const [key, scorer] of Object.entries(scorers)) {
        shared.mastra.addScorer(scorer, key, { source: 'code' });
      }

      const { agent } = await runLoopScenario({
        engine,
        llm,
        sharedAgent: shared,
        prompt: 'go',
        memory: new MockMemory(),
        threadId: THREAD,
        resourceId: RESOURCE,
        objective: 'Reach the goal',
        maxSteps: 3,
        fixtures: llm => {
          llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'Working on it.' });
        },
      });
      return agent.getObjective({ threadId: THREAD });
    }

    itFailsOnInngest('resolves a scorer by its id when registered under a different key', async () => {
      const scorer = registrableScorer('tests-pass', 'Tests Pass');
      const record = await runWithRegisteredScorer('tests-pass', { testsPass: scorer });
      expect(scorer.run).toHaveBeenCalledTimes(1);
      expect(record?.status).toBe('done');
    });

    itFailsOnInngest('prefers a scorer id over another scorer name', async () => {
      const scorerA = registrableScorer('shared-ref', 'Scorer A');
      const scorerB = registrableScorer('scorer-b', 'shared-ref');
      const record = await runWithRegisteredScorer('shared-ref', { scorerB, scorerA });
      expect(scorerA.run).toHaveBeenCalledTimes(1);
      expect(scorerB.run).not.toHaveBeenCalled();
      expect(record?.status).toBe('done');
    });

    itFailsOnInngest('resolves a scorer by its registration key', async () => {
      const scorer = registrableScorer('tests-pass', 'Tests Pass');
      const record = await runWithRegisteredScorer('testsPass', { testsPass: scorer });
      expect(scorer.run).toHaveBeenCalledTimes(1);
      expect(record?.status).toBe('done');
    });

    itFailsOnInngest('pauses the objective with a not-found reason for an unknown scorer', async () => {
      const scorer = registrableScorer('tests-pass', 'Tests Pass');
      const record = await runWithRegisteredScorer('missing-scorer', { testsPass: scorer });
      expect(scorer.run).not.toHaveBeenCalled();
      expect(record?.status).toBe('paused');
      expect(record?.pausedReason).toContain('not found');
    });
  },
  {},
);
