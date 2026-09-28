/**
 * AIMock Scenario: queueMessage waits for the active run
 *
 * `queueMessage` targeting a thread with an active run must NOT interrupt the
 * run: the message is accepted (with a reserved follow-up run id distinct from
 * the active run) but stays queued until the active run completes, then starts
 * its own run.
 *
 * Mirrors the plain-Agent pin in agent-signals.test.ts ("queues queueMessage
 * until the active run completes") across all engine variants. The message is
 * queued from inside a tool execution, which is the deterministic cross-engine
 * way to act while the run is provably active.
 *
 * Asserts:
 * - acceptance action is `deliver` with a run id different from the active run
 * - no model request contains the queued content while the run is active
 * - the active run finishes with its own response, unaffected by the queue
 * - after the active run completes, the queued message starts a follow-up run
 *   whose model request contains the queued content
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines, createSharedAgent } from '../aimock-scenario';

const QUEUED = 'Queued follow-up';

function requestText(request: any): string {
  return JSON.stringify(request?.body?.messages ?? request?.body ?? {});
}

async function waitFor(condition: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for condition');
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}

describeForAllEngines('AIMock scenario: queueMessage waits for the active run', engine => {
  const getMock = useLoopScenarioAimock();

  it('holds a queued message until the active run completes, then runs it', async () => {
    const threadId = 'queue-message-thread';
    const resourceId = 'queue-message-user';
    const acceptedResults: any[] = [];
    // Journal snapshot taken inside the tool, after acceptance settled while
    // the run was still active: the queued content must not have reached the
    // model yet.
    const queuedSeenWhileActive: boolean[] = [];

    let signalAgent: any;
    const doWork = createTool({
      id: 'do_work',
      description: 'Performs work; a follow-up message is queued while it runs',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => {
        const result = signalAgent.queueMessage(QUEUED, { resourceId, threadId });
        acceptedResults.push(await result.accepted);
        // Give an eager (incorrect) dispatch a chance to surface before the
        // negative assertion below.
        await new Promise(resolve => setTimeout(resolve, 150));
        queuedSeenWhileActive.push(
          getMock()
            .getRequests()
            .some((request: any) => requestText(request).includes(QUEUED)),
        );
        return { ok: true };
      },
    });

    const memory = new MockMemory();
    const shared = await createSharedAgent(getMock(), { tools: { do_work: doWork }, memory, engine });
    signalAgent = shared.agent;

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Please do the work.',
      sharedAgent: shared,
      memory,
      threadId,
      resourceId,
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        // All matchers are mutually exclusive so registration order is moot.
        llm.on(
          {
            endpoint: 'chat',
            hasToolResult: false,
            predicate: req => !JSON.stringify(req).includes(QUEUED),
          },
          { toolCalls: [{ id: 'call_work', name: 'do_work', arguments: {} }] },
        );
        llm.on(
          {
            endpoint: 'chat',
            hasToolResult: true,
            predicate: req => !JSON.stringify(req).includes(QUEUED),
          },
          { content: 'first response' },
        );
        // The queued follow-up run.
        llm.on(
          { endpoint: 'chat', predicate: req => JSON.stringify(req).includes(QUEUED) },
          { content: 'queued response' },
        );
      },
    });

    // Accepted for a distinct follow-up run — not delivered into the active one.
    expect(acceptedResults).toHaveLength(1);
    expect(acceptedResults[0]).toMatchObject({ action: 'deliver' });
    const activeRunId = (output as any).runId;
    expect(acceptedResults[0].runId).toBeTruthy();
    expect(acceptedResults[0].runId).not.toBe(activeRunId);

    // Never dispatched while the run was active.
    expect(queuedSeenWhileActive).toEqual([false]);

    // The active run's own output is unaffected by the queued message.
    const text = await output.text;
    expect(text).toContain('first response');
    expect(text).not.toContain('queued response');

    // After the active run completes, the queued message starts its own run.
    await waitFor(() =>
      getMock()
        .getRequests()
        .some((request: any) => requestText(request).includes(QUEUED)),
    );
  });
});
