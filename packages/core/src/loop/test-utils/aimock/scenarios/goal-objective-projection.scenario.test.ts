import { it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

const getMock = useLoopScenarioAimock();

function objectiveSignals(chunks: any[] | undefined) {
  return (chunks ?? [])
    .filter((c: any) => c.type === 'data-signal' && c.data?.tagName === 'current-objective')
    .map((c: any) => c.data);
}

describeForAllEngines(
  'AIMock loop scenario: current-objective projection',
  engine => {
    const itFailsOnInngest = engine === 'inngest' ? it.fails : it;
    // Inngest's agentic loop has no isTaskComplete, goal, or onIterationComplete steps yet.

    // Regression: with function-form inputProcessors the goal state processor was not
    // registered with Mastra, resolved no store, and projected `status="none"` at the
    // tool-iteration boundary — which the model reads as the goal being cancelled.
    itFailsOnInngest('does not retract an active objective mid-run when inputProcessors is a function', async () => {
      const ping = createTool({
        id: 'ping',
        description: 'Ping',
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.boolean() }),
        execute: async () => ({ ok: true }),
      });
      const scorer = { id: 'never', name: 'Never', run: vi.fn().mockResolvedValue({ score: 0, reason: 'keep going' }) };

      const memory = new MockMemory();
      // createSharedAgent puts inputProcessors on the agent constructor (the
      // MastraCode shape); call-time inputProcessors do not accept the function form.
      const shared = await createSharedAgent(getMock(), {
        engine,
        memory,
        tools: { ping },
        inputProcessors: () => [],
        goal: { judge: 'gpt-4', maxRuns: 1, scorer: scorer as any },
      });

      const { chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'go',
        memory,
        threadId: 'goal-projection-fn-processors-thread',
        resourceId: 'user-1',
        objective: 'Reach the goal',
        maxSteps: 6,
        collectChunks: true,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_ping', name: 'ping', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Pinged.' });
        },
      });

      const signals = objectiveSignals(chunks);
      expect(signals).toHaveLength(1);
      expect(signals.map(s => s.attributes?.status)).not.toContain('none');
    });

    // Regression: the projection is append-only and must not be re-added while the
    // objective is unchanged; keying it on `runsUsed` re-projected it every attempt.
    itFailsOnInngest('projects an unchanged objective once across multiple attempts', async () => {
      const verdicts = [0, 0, 1];
      const scorer = {
        id: 'third-time',
        name: 'Third Time',
        run: vi.fn().mockImplementation(async () => {
          const score = verdicts.shift() ?? 1;
          return { score, reason: score ? 'complete' : 'not yet' };
        }),
      };

      const { chunks, requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'go',
        memory: new MockMemory(),
        threadId: 'goal-projection-once-thread',
        resourceId: 'user-1',
        goal: { judge: 'gpt-4', maxRuns: 5, scorer: scorer as any },
        objective: 'Reach the goal',
        maxSteps: 10,
        collectChunks: true,
        fixtures: llm => {
          llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'Attempt 1.' });
          llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Attempt 2.' });
          llm.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'Attempt 3.' });
        },
      });

      const goalResults = (chunks ?? []).filter((c: any) => c.type === 'goal' && !c.payload?.pending) as any[];
      expect(requests).toHaveLength(3);
      expect(goalResults.map(c => c.payload.status)).toEqual(['active', 'active', 'done']);

      const signals = objectiveSignals(chunks);
      expect(signals).toHaveLength(1);
      expect(signals[0].contents).toContain('Reach the goal');
    });
  },
  {},
);
