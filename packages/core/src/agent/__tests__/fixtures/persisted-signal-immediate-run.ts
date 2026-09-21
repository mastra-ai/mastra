/**
 * Child-process fixture for the persisted-signal starvation regression.
 *
 * The failure mode is event-loop starvation: `waitForCrossAgentThreadRun` awaits an
 * already-resolved completion promise in a loop, so no macrotask ever runs again. An
 * in-process watchdog (`setTimeout` + `Promise.race`) can therefore never fire — the
 * timer is exactly what is starved. The regression has to run in its own process so the
 * parent can bound it externally.
 */
import type { Agent } from '../../agent';
import { createSignal } from '../../signals';
import { AgentThreadStreamRuntime } from '../../thread-stream-runtime';

const runtime = new AgentThreadStreamRuntime();
const target = { resourceId: 'persisted-signal-resource', threadId: 'persisted-signal-thread' };
const memory = { saveMessages: async () => {} };
const owner = {
  id: 'persisted-signal-owner',
  getMemory: async () => memory,
} as unknown as Agent<any, any, any, any>;
const contender = { id: 'persisted-signal-contender' } as Agent<any, any, any, any>;

// A live thread subscriber is what promotes the synthetic persisted-signal run to
// `activeThreadRunIds`, which is what the contender then waits on.
const subscription = await runtime.subscribeToThread(owner, target);

try {
  const persisted = runtime.sendSignal(owner, createSignal({ type: 'user-message', contents: 'persist only' }), {
    ...target,
    ifIdle: { behavior: 'persist' },
  });
  await persisted.persisted;
  // Marks the boundary between setup and the code under test, so a SIGKILL can be attributed
  // to the wait rather than to child startup.
  process.send?.('waiting');
  await runtime.waitForCrossAgentThreadRun(contender, {
    runId: 'persisted-signal-contender-run',
    memory: { resource: target.resourceId, thread: target.threadId },
  });
  process.send?.('ok');
} finally {
  subscription.unsubscribe();
}
