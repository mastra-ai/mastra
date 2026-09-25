/**
 * AIMock Scenario: ifIdle persist behavior
 *
 * A user-message signal sent to an idle thread with `ifIdle: { behavior:
 * 'persist' }` must be written to the thread without waking a run, and the
 * persisted contents must surface in the next run's model request through
 * ordinary memory rehydration.
 *
 * Mirrors the plain-Agent pin in agent-signals.test.ts ("persists an idle
 * signal without waking the agent when idle behavior is persist") across all
 * engine variants, and additionally pins that the persisted signal reaches
 * the next run's prompt on every engine.
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines, createSharedAgent } from '../aimock-scenario';

const PERSISTED = 'Persisted note for later';

function requestText(request: any): string {
  return JSON.stringify(request?.body?.messages ?? request?.body ?? {});
}

describeForAllEngines('AIMock scenario: ifIdle persist behavior', engine => {
  const getMock = useLoopScenarioAimock();

  it('persists an idle signal without waking a run, and the next run sees it', async () => {
    const threadId = 'idle-persist-thread';
    const resourceId = 'idle-persist-user';

    const memory = new MockMemory();
    const shared = await createSharedAgent(getMock(), { memory, engine });

    // Run 1: plain turn to establish the thread. All fixtures for both runs
    // are registered up front and are mutually exclusive.
    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Hello',
      sharedAgent: shared,
      memory,
      threadId,
      resourceId,
      stopWhen: stepCountIs(2),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', predicate: req => !JSON.stringify(req).includes(PERSISTED) },
          { content: 'initial response' },
        );
        llm.on(
          { endpoint: 'chat', predicate: req => JSON.stringify(req).includes(PERSISTED) },
          { content: 'noted response' },
        );
      },
    });

    const requestCountAfterFirstRun = getMock().getRequests().length;

    // Thread is now idle — persist a signal without waking anything.
    const result = shared.agent.sendMessage(
      { contents: PERSISTED },
      { resourceId, threadId, ifIdle: { behavior: 'persist' } },
    );
    await expect(result.accepted).resolves.toMatchObject({ action: 'persist' });

    // Give an eager (incorrect) wake a chance to surface, then confirm no
    // model request was made.
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(getMock().getRequests().length).toBe(requestCountAfterFirstRun);

    // Run 2 on the same thread: the persisted signal must be rehydrated into
    // the model request through memory.
    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'What did I note?',
      sharedAgent: shared,
      memory,
      threadId,
      resourceId,
      stopWhen: stepCountIs(2),
      fixtures: () => {
        // All fixtures were registered before run 1.
      },
    });

    const secondRunRequest = requests[requests.length - 1];
    expect(requestText(secondRunRequest)).toContain(PERSISTED);

    const text = await output.text;
    expect(text).toContain('noted response');
  });
});
