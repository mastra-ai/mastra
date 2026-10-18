import { createOpenAI } from '@ai-sdk/openai-v5';
import { it, expect } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

const getMock = useLoopScenarioAimock();

function judgeVerdict(decision: 'done' | 'continue' | 'waiting', reason: string) {
  return { content: JSON.stringify({ decision, reason }) };
}

describeForAllEngines(
  'AIMock loop scenario: built-in goal scorer',
  engine => {
    function judgeModel() {
      const llm = getMock();
      return createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` })(
        SCENARIO_MODEL_ID,
      );
    }

    it('continues on a "continue" verdict and completes on "done" without manual continuation', async () => {
      const THREAD = 'goal-default-scorer-thread-1';
      const { agent, chunks, requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Implement feature X',
        memory: new MockMemory(),
        threadId: THREAD,
        resourceId: 'user-1',
        goal: { judge: judgeModel(), maxRuns: 5 },
        objective: 'Implement feature X',
        maxSteps: 10,
        collectChunks: true,
        fixtures: llm => {
          llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'I started feature X.' });
          llm.on({ endpoint: 'chat', sequenceIndex: 1 }, judgeVerdict('continue', 'need one more pass'));
          llm.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'I finished feature X.' });
          llm.on({ endpoint: 'chat', sequenceIndex: 3 }, judgeVerdict('done', 'goal satisfied'));
        },
      });

      expect(requests).toHaveLength(4);
      // The judge's "continue" reason is fed back to the agent's next turn.
      expect(JSON.stringify(requests[2]!.body.messages)).toContain('need one more pass');

      const resultChunks = (chunks ?? []).filter((c: any) => c.type === 'goal' && !c.payload?.pending) as any[];
      expect(resultChunks.map(c => c.payload.status)).toEqual(['active', 'done']);
      expect(resultChunks.at(-1).payload).toMatchObject({
        objective: 'Implement feature X',
        iteration: 2,
        passed: true,
        status: 'done',
        maxRunsReached: false,
      });

      const record = await agent.getObjective({ threadId: THREAD });
      expect(record?.status).toBe('done');
      expect(record?.runsUsed).toBe(2);
    });

    it('stops actionably on a "waiting" verdict and keeps the objective active', async () => {
      const THREAD = 'goal-default-scorer-thread-2';
      const { agent, chunks, requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Draft the plan and wait for my review',
        memory: new MockMemory(),
        threadId: THREAD,
        resourceId: 'user-1',
        goal: { judge: judgeModel(), maxRuns: 5 },
        objective: 'Ship the plan after review',
        maxSteps: 10,
        collectChunks: true,
        fixtures: llm => {
          llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'Here is the plan. Please review it.' });
          llm.on({ endpoint: 'chat', sequenceIndex: 1 }, judgeVerdict('waiting', 'waiting for your review'));
          llm.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'Continuing without review.' });
        },
      });

      expect(requests).toHaveLength(2);
      const resultChunks = (chunks ?? []).filter((c: any) => c.type === 'goal' && !c.payload?.pending) as any[];
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
  // Same engine coverage as goal-default-scorer-json-fallback, the existing built-in judge scenario.
  { skip: ['durable', 'evented'] },
);
