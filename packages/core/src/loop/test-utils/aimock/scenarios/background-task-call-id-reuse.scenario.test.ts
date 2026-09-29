import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { createSharedAgent, runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: provider tool-call id reuse across memory-backed turns.
 *
 * Providers reuse tool-call ids (`call_0`, `call_1`, ...) on every request.
 * With memory enabled, turn N's transcript contains turn N-1's background
 * tool invocation under the SAME toolCallId, loaded from thread history.
 *
 * The background-result injector's idempotency scan walks the full db message
 * list; it must key on (toolCallId, taskId) — not toolCallId alone — and skip
 * history parts belonging to earlier dispatches. Treating them as identity
 * conflicts made `onResult` throw before the result landed — surfacing as a
 * hang under `streamUntilIdle` and a dropped result on the in-run apply path.
 * Both paths run the same scan; this scenario pins the in-run apply (the
 * deterministic one): three sequential turns on one memory-backed thread,
 * each dispatching the background tool as `call_0`, every turn's result
 * recorded in the transcript.
 */
describeForAllEngines('AIMock loop scenario: background tool with reused provider call ids', engine => {
  const getMock = useLoopScenarioAimock();

  it('lands every turn result when the provider reuses the same tool-call id', async () => {
    let executions = 0;

    const backgroundTool = createTool({
      id: 'background-work',
      description: 'Performs long-running work in the background',
      inputSchema: z.object({ turn: z.number() }),
      outputSchema: z.object({ result: z.string() }),
      background: { enabled: true, timeoutMs: 5000 },
      execute: async ({ turn }) => {
        executions++;
        await new Promise(resolve => setTimeout(resolve, 10));
        return { result: `turn-${turn} done` };
      },
    });

    const memory = new MockMemory();
    const shared = await createSharedAgent(getMock(), {
      memory,
      tools: { 'background-work': backgroundTool },
      agentBackgroundTasks: { tools: { 'background-work': true } },
      backgroundTasks: { enabled: true },
    });

    const threadId = 'bg-call-id-reuse-thread';
    const resourceId = 'user-1';

    for (let turn = 1; turn <= 3; turn++) {
      // Fresh fixtures per turn; sequence indices restart from 0.
      getMock().clearFixtures();
      getMock().clearRequests();
      getMock().resetMatchCounts();

      await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: `Run background work, turn ${turn}`,
        memory,
        threadId,
        resourceId,
        stopWhen: stepCountIs(3),
        fixtures: llm => {
          // The provider reuses `call_0` on EVERY turn — the trigger for
          // the identity-conflict regression.
          llm.on(
            { endpoint: 'chat', sequenceIndex: 0 },
            { toolCalls: [{ id: 'call_0', name: 'background-work', arguments: { turn } }] },
          );
          llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: `Turn ${turn} dispatched.` });
        },
      });
    }

    // The tool ran once per turn — turn 2+ did not hang or get dropped.
    expect(executions).toBe(3);

    // Every turn's real result (not the placeholder) is in the transcript.
    const { messages } = await memory.recall({ threadId, resourceId });
    const serialized = JSON.stringify(messages);
    expect(serialized).toContain('turn-1 done');
    expect(serialized).toContain('turn-2 done');
    expect(serialized).toContain('turn-3 done');
  }, 30_000);
});
