import type { Agent } from '../../agent';
import { createSignal } from '../../signals';
import { AgentThreadStreamRuntime } from '../../thread-stream-runtime';

const runtime = new AgentThreadStreamRuntime();
const target = { resourceId: 'persisted-signal-resource', threadId: 'persisted-signal-thread' };
const memory = {
  saveMessages: async () => {},
};
const owner = {
  id: 'persisted-signal-owner',
  getMemory: async () => memory,
} as unknown as Agent<any, any, any, any>;
const contender = { id: 'persisted-signal-contender' } as Agent<any, any, any, any>;
const subscription = await runtime.subscribeToThread(owner, target);

try {
  const persisted = runtime.sendSignal(owner, createSignal({ type: 'user-message', contents: 'persist only' }), {
    ...target,
    ifIdle: { behavior: 'persist' },
  });
  await persisted.persisted;
  await runtime.waitForCrossAgentThreadRun(contender, {
    runId: 'persisted-signal-contender-run',
    memory: { resource: target.resourceId, thread: target.threadId },
  });
} finally {
  subscription.unsubscribe();
}
