import { it, expect, vi } from 'vitest';
import { GOAL_STATE_TYPE } from '../../../../agent/goal';
import { MockMemory } from '../../../../memory/mock';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

const getMock = useLoopScenarioAimock();

const THREAD = 'goal-no-op-thread';
const RESOURCE = 'user-1';

function goalScorer() {
  return { id: 'goal-scorer', name: 'Goal Scorer', run: vi.fn().mockResolvedValue({ score: 1, reason: 'done' }) };
}

function goalChunksOf(chunks: any[] | undefined) {
  return (chunks ?? []).filter(c => c.type === 'goal');
}

describeForAllEngines(
  'AIMock loop scenario: goal no-op paths',
  engine => {
    const itFailsOnInngest = engine === 'inngest' ? it.fails : it;
    // Inngest's agentic loop has no isTaskComplete, goal, or onIterationComplete steps yet.

    itFailsOnInngest('an agent without goal config never reads goal state or emits goal chunks', async () => {
      const llm = getMock();
      const shared = await createSharedAgent(llm, { engine, memory: new MockMemory() });
      const threadState = await shared.mastra.getStorage().getStore('threadState');
      const getState = vi.spyOn(threadState!, 'getState');

      const { output, chunks } = await runLoopScenario({
        engine,
        llm,
        sharedAgent: shared,
        prompt: 'hello',
        memory: new MockMemory(),
        threadId: THREAD,
        resourceId: RESOURCE,
        maxSteps: 1,
        collectChunks: true,
        fixtures: llm => {
          llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'Finished.' });
        },
      });

      expect(await output.text).toBe('Finished.');
      expect(goalChunksOf(chunks)).toHaveLength(0);
      expect(getState.mock.calls.filter(([options]: any[]) => options.type === GOAL_STATE_TYPE)).toHaveLength(0);
    });

    itFailsOnInngest(
      'a goal-configured agent with no active objective does not judge or emit goal chunks',
      async () => {
        const scorer = goalScorer();
        const { output, chunks, agent } = await runLoopScenario({
          engine,
          llm: getMock(),
          prompt: 'hello',
          memory: new MockMemory(),
          threadId: THREAD,
          resourceId: RESOURCE,
          goal: { judge: 'gpt-4', scorer: scorer as any },
          maxSteps: 2,
          collectChunks: true,
          fixtures: llm => {
            llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'Finished.' });
          },
        });

        expect(await output.text).toBe('Finished.');
        expect(scorer.run).not.toHaveBeenCalled();
        expect(goalChunksOf(chunks)).toHaveLength(0);
        expect(await agent.getObjective({ threadId: THREAD })).toBeUndefined();
      },
    );

    itFailsOnInngest('an active objective is left untouched when no judge model resolves', async () => {
      const scorer = goalScorer();
      const { output, chunks, agent } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'go',
        memory: new MockMemory(),
        threadId: THREAD,
        resourceId: RESOURCE,
        // goal config present (so the loop step is wired) but no judge anywhere.
        goal: { scorer: scorer as any },
        objective: 'Reach the goal',
        maxSteps: 3,
        collectChunks: true,
        fixtures: llm => {
          llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'Working on it.' });
        },
      });

      expect(await output.text).toBe('Working on it.');
      expect(scorer.run).not.toHaveBeenCalled();
      expect(goalChunksOf(chunks)).toHaveLength(0);
      expect(await agent.getObjective({ threadId: THREAD })).toMatchObject({ status: 'active', runsUsed: 0 });
    });

    itFailsOnInngest(
      'an active objective is left untouched when the goal.judge resolver returns undefined',
      async () => {
        const scorer = goalScorer();
        const judge = vi.fn(() => undefined);
        const { output, chunks, agent } = await runLoopScenario({
          engine,
          llm: getMock(),
          prompt: 'go',
          memory: new MockMemory(),
          threadId: THREAD,
          resourceId: RESOURCE,
          goal: { judge: judge as any, scorer: scorer as any },
          objective: 'Reach the goal',
          maxSteps: 3,
          collectChunks: true,
          fixtures: llm => {
            llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'Working on it.' });
          },
        });

        expect(await output.text).toBe('Working on it.');
        expect(judge).toHaveBeenCalled();
        expect(scorer.run).not.toHaveBeenCalled();
        expect(goalChunksOf(chunks)).toHaveLength(0);
        expect(await agent.getObjective({ threadId: THREAD })).toMatchObject({ status: 'active', runsUsed: 0 });
      },
    );
  },
  {},
);
