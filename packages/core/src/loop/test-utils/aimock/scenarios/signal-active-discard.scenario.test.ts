/**
 * AIMock Scenario: ifActive discard behavior
 *
 * A signal sent to an active thread with `ifActive: { behavior: 'discard' }`
 * must be dropped: it is not delivered into the active run, does not queue a
 * follow-up run, and the model never sees its contents.
 *
 * Mirrors the plain-Agent pin in agent-signals.test.ts ("discards an active
 * signal when active behavior is discard") across all engine variants. The
 * signal is sent from inside a tool execution so the thread is provably
 * active at send time on every engine.
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines, createSharedAgent } from '../aimock-scenario';

const DISCARDED = 'discard while running';

function requestText(request: any): string {
  return JSON.stringify(request?.body?.messages ?? request?.body ?? {});
}

describeForAllEngines('AIMock scenario: ifActive discard behavior', engine => {
  const getMock = useLoopScenarioAimock();

  it('discards an active-thread signal and never shows it to the model', async () => {
    const threadId = 'active-discard-thread';
    const resourceId = 'active-discard-user';
    const acceptedResults: any[] = [];

    let signalAgent: any;
    const doWork = createTool({
      id: 'do_work',
      description: 'Performs work; a discardable signal arrives while it runs',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => {
        const result = signalAgent.sendSignal(
          { type: 'user-message', contents: DISCARDED },
          { resourceId, threadId, ifActive: { behavior: 'discard' } },
        );
        acceptedResults.push(await result.accepted);
        return { ok: true };
      },
    });

    const memory = new MockMemory();
    const shared = await createSharedAgent(getMock(), { tools: { do_work: doWork }, memory, engine });
    signalAgent = shared.agent;

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Please do the work.',
      sharedAgent: shared,
      memory,
      threadId,
      resourceId,
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_work', name: 'do_work', arguments: {} }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'final response' });
      },
    });

    // The signal was discarded, not delivered or queued.
    expect(acceptedResults).toHaveLength(1);
    expect(acceptedResults[0]).toMatchObject({ action: 'discard' });

    // The model never saw the discarded contents, and the run stopped after
    // its natural two turns (no drain-forced continuation).
    for (const request of requests) {
      expect(requestText(request)).not.toContain(DISCARDED);
    }
    expect(requests).toHaveLength(2);

    const text = await output.text;
    expect(text).toContain('final response');
    expect(text).not.toContain(DISCARDED);
  });
});
