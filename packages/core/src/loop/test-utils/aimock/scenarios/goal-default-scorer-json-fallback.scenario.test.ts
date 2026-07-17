import { createOpenAI } from '@ai-sdk/openai-v5';
import { it, expect } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

const getMock = useLoopScenarioAimock();

describeForAllEngines(
  'AIMock loop scenario: default goal scorer JSON fallback',
  engine => {
    it('completes when the default goal scorer falls back to JSON text', async () => {
      const llm = getMock();
      const openai = createOpenAI({
        apiKey: 'aimock-test-key',
        baseURL: `${llm.url.replace(/\/+$/, '')}/v1`,
      });
      const memory = new MockMemory();
      const THREAD = 'goal-json-fallback-thread-1';
      const RESOURCE = 'user-1';

      const { agent, chunks } = await runLoopScenario({
        engine,
        llm,
        prompt: 'Implement feature X',
        memory,
        threadId: THREAD,
        resourceId: RESOURCE,
        goal: {
          judge: openai(SCENARIO_MODEL_ID),
          maxRuns: 5,
        },
        objective: 'Implement feature X',
        collectChunks: true,
        fixtures: llm => {
          llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'I have implemented feature X.' });
          llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'not-json' });
          llm.on(
            { endpoint: 'chat', sequenceIndex: 2 },
            { content: JSON.stringify({ decision: 'done', reason: 'Goal achieved' }) },
          );
        },
      });

      const goalChunks = chunks?.filter((chunk: any) => chunk.type === 'goal') ?? [];
      const pendingChunks = goalChunks.filter((chunk: any) => chunk.payload?.pending);
      const resultChunks = goalChunks.filter((chunk: any) => !chunk.payload?.pending);

      expect(pendingChunks.length).toBeGreaterThan(0);
      expect(resultChunks.length).toBeGreaterThan(0);
      const finalGoalChunk = resultChunks[resultChunks.length - 1] as any;
      expect(finalGoalChunk.payload).toMatchObject({
        objective: 'Implement feature X',
        passed: true,
        status: 'done',
      });

      const record = await agent.getObjective({ threadId: THREAD });
      expect(record?.status).toBe('done');
      expect(record?.runsUsed).toBe(1);
    });
  },
  { skip: ['durable'] },
);
