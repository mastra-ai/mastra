import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

const getMock = useLoopScenarioAimock();

const RESOURCE = 'user-1';

function goalChunks(chunks: any[] | undefined) {
  return (chunks ?? []).filter((c: any) => c.type === 'goal');
}

describeForAllEngines(
  'AIMock loop scenario: goal preserved when the primary run is interrupted',
  engine => {
    const itFailsOnInngest = engine === 'inngest' ? it.fails : it;
    // Inngest's agentic loop has no isTaskComplete, goal, or onIterationComplete steps yet.

    itFailsOnInngest('a terminal model error leaves the objective untouched and is never judged', async () => {
      const THREAD = 'goal-error-thread';
      const memory = new MockMemory();
      const scorer = {
        id: 'goal-scorer',
        name: 'Goal Scorer',
        run: vi.fn().mockResolvedValue({ score: 1, reason: 'Goal achieved' }),
      };

      const { agent, chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Fail this primary turn',
        memory,
        threadId: THREAD,
        resourceId: RESOURCE,
        goal: { judge: 'gpt-4', maxRuns: 5, scorer: scorer as any },
        objective: 'Preserve this active objective',
        maxSteps: 3,
        maxRetries: 0,
        collectChunks: true,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat' },
            { error: { message: 'Terminal provider failure', type: 'invalid_request_error' }, status: 400 },
          );
        },
      });

      expect(scorer.run).not.toHaveBeenCalled();
      expect(goalChunks(chunks)).toEqual([]);
      expect(await agent.getObjective({ threadId: THREAD })).toMatchObject({
        objective: 'Preserve this active objective',
        status: 'active',
        runsUsed: 0,
      });

      const { messages } = await memory.recall({ threadId: THREAD, resourceId: RESOURCE });
      const judgeSignals = messages.filter(
        (m: any) => m.role === 'signal' && m.content?.metadata?.signal?.attributes?.type === 'goal-judge',
      );
      expect(judgeSignals).toEqual([]);
    });

    itFailsOnInngest('an aborted run leaves the objective untouched and partial work is never judged', async () => {
      const THREAD = 'goal-abort-thread';
      const abortController = new AbortController();
      const goalScorer = {
        id: 'goal-scorer',
        name: 'Goal Scorer',
        run: vi.fn().mockResolvedValue({ score: 1, reason: 'Goal achieved' }),
      };
      const completionScorer = {
        id: 'completion-scorer',
        name: 'Completion Scorer',
        run: vi.fn().mockResolvedValue({ score: 1, reason: 'Task complete' }),
      };
      const work = createTool({
        id: 'work',
        description: 'Do some work',
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.boolean() }),
        execute: async () => {
          abortController.abort();
          return { ok: true };
        },
      });

      const { agent, chunks, requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Go',
        memory: new MockMemory(),
        threadId: THREAD,
        resourceId: RESOURCE,
        tools: { work },
        goal: { judge: 'gpt-4', maxRuns: 5, scorer: goalScorer as any },
        objective: 'Finish the task',
        isTaskComplete: { scorers: [completionScorer as any] },
        abortSignal: abortController.signal,
        stopWhen: stepCountIs(5),
        collectChunks: true,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_work', name: 'work', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Should not be reached.' });
        },
      });

      expect(requests).toHaveLength(1);
      expect(goalScorer.run).not.toHaveBeenCalled();
      expect(completionScorer.run).not.toHaveBeenCalled();
      expect(goalChunks(chunks)).toEqual([]);
      expect(await agent.getObjective({ threadId: THREAD })).toMatchObject({
        objective: 'Finish the task',
        status: 'active',
        runsUsed: 0,
      });
    });
  },
  {},
);
