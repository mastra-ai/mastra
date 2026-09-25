/**
 * AIMock Scenario: signal delivery into an active run (drain semantics)
 *
 * When a user-message signal targets a thread whose run is still active, the
 * runtime must deliver it into that run ("deliver", not "wake") and drain it
 * as a follow-up model turn inside the same run — the model sees the
 * interjection, and the run's final output answers it.
 *
 * Mirrors the plain-Agent pins in agent-signals.test.ts ("delivers sendMessage
 * into an active same-agent run", "drains multiple user-message signals ...
 * without merging them into users") across all engine variants. The signal is
 * sent from inside a tool execution, which is the deterministic cross-engine
 * way to act while the run is provably active.
 *
 * Asserts:
 * - acceptance action is `deliver` into the active run (no second run)
 * - the pre-drain model request does NOT contain the interjection
 * - a later model request in the same run DOES contain it (with the earlier
 *   tool result preserved in history)
 * - the final output text includes the drained follow-up response
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines, createSharedAgent } from '../aimock-scenario';

const INTERJECTION = 'Interjection while active';
const SECOND_INTERJECTION = 'Second interjection while active';

function requestText(request: any): string {
  return JSON.stringify(request?.body?.messages ?? request?.body ?? {});
}

describeForAllEngines('AIMock scenario: signal delivery into an active run', engine => {
  const getMock = useLoopScenarioAimock();

  it('delivers a sendMessage into the active run and drains it in the same run', async () => {
    const threadId = 'active-drain-thread';
    const resourceId = 'active-drain-user';
    const acceptedResults: any[] = [];

    // The tool closes over the shared agent so it can send a signal while the
    // run is provably active (mid tool execution).
    let signalAgent: any;
    const doWork = createTool({
      id: 'do_work',
      description: 'Performs work; a user interjection arrives while it runs',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => {
        const result = signalAgent.sendMessage({ contents: INTERJECTION }, { resourceId, threadId });
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
        // Turn 1: call the tool (the interjection cannot be in this request —
        // it is sent during the tool execution that this turn triggers).
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_work', name: 'do_work', arguments: {} }] },
        );
        // Any request that has seen the interjection answers it.
        llm.on(
          { endpoint: 'chat', predicate: req => JSON.stringify(req).includes(INTERJECTION) },
          { content: 'drained response' },
        );
        // Post-tool request that has NOT yet seen the interjection.
        llm.on(
          {
            endpoint: 'chat',
            hasToolResult: true,
            predicate: req => !JSON.stringify(req).includes(INTERJECTION),
          },
          { content: 'pre-drain response' },
        );
      },
    });

    // The signal was delivered into the active run, not queued for a new one.
    expect(acceptedResults).toHaveLength(1);
    expect(acceptedResults[0]).toMatchObject({ action: 'deliver' });

    // The tool-call request never contains the interjection...
    expect(requestText(requests[0])).not.toContain(INTERJECTION);
    // ...but a later request in the same run does, with the tool result still
    // present in history (the drain must not clobber the current step).
    const drainedRequest = requests.find(request => requestText(request).includes(INTERJECTION));
    expect(drainedRequest).toBeDefined();
    // The tool result from the current step survives the drain (identified by
    // tool_call_id — the journal does not record the tool function name).
    expect(requestText(drainedRequest)).toContain('call_work');

    // The same run answered the interjection.
    const text = await output.text;
    expect(text).toContain('drained response');
  });

  it('drains multiple signals sent while active as separate messages in one run', async () => {
    const threadId = 'active-multi-drain-thread';
    const resourceId = 'active-multi-drain-user';
    const acceptedResults: any[] = [];

    let signalAgent: any;
    const doWork = createTool({
      id: 'do_work',
      description: 'Performs work; two user interjections arrive while it runs',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => {
        const first = signalAgent.sendMessage({ contents: INTERJECTION }, { resourceId, threadId });
        acceptedResults.push(await first.accepted);
        const second = signalAgent.sendMessage({ contents: SECOND_INTERJECTION }, { resourceId, threadId });
        acceptedResults.push(await second.accepted);
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
        llm.on(
          { endpoint: 'chat', predicate: req => JSON.stringify(req).includes(SECOND_INTERJECTION) },
          { content: 'drained both' },
        );
        llm.on(
          {
            endpoint: 'chat',
            hasToolResult: true,
            predicate: req => !JSON.stringify(req).includes(SECOND_INTERJECTION),
          },
          { content: 'pre-drain response' },
        );
      },
    });

    // Both signals were delivered into the active run.
    expect(acceptedResults).toHaveLength(2);
    expect(acceptedResults[0]).toMatchObject({ action: 'deliver' });
    expect(acceptedResults[1]).toMatchObject({ action: 'deliver' });

    // Some request in the run saw both interjections, as distinct messages.
    const drainedRequest = requests.find(request => requestText(request).includes(SECOND_INTERJECTION));
    expect(drainedRequest).toBeDefined();
    expect(requestText(drainedRequest)).toContain(INTERJECTION);

    const text = await output.text;
    expect(text).toContain('drained both');
  });
});
